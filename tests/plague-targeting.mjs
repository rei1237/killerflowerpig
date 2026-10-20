import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots } from '../src/game/weapons.js';
import { spawnHazard, updateHazards } from '../src/game/hazards.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { choosePlagueLanding, PLAGUE_TARGET_SCAN_LIMIT } from '../src/game/plague-targeting.js';
import { save } from '../src/core/save.js';

let nextId = 1;
function setup(tech = 'plague') {
    resetBuild(); clearWorld(); clearFocus();
    save.upgrades = {}; save.equippedPet = null; save.equippedCosmetics = {};
    createPlayer();
    Object.assign(G, { tech, mode: 'play', paused: false, stage: 1, clock: 1, boss: null, damageBy: {}, caps: { particles: 0, texts: 0 } });
    G.passives = {}; G.grid.reset(); recomputeStats();
}
function enemy(x, y = 0, motionVX = 0, motionVY = 0, insert = true) {
    const e = Object.assign(G.enemies.spawn(), {
        id: nextId++, x, y, motionVX, motionVY, radius: 12, hp: 1e6, maxHp: 1e6,
        alive: true, elite: true, mass: 1, kx: 0, ky: 0, slow: 0, slowT: 0, bleed: 0, bleedT: 0,
        hits: new Float32Array(24).fill(-99), def: {},
    });
    if (insert) G.grid.insert(e);
    return e;
}
function fire(id = 'molotov', tech = 'plague') {
    G.tech = tech;
    const w = Object.assign(createWeapon(id, 0), { cd: 0 });
    G.weapons = [w]; updateWeapons(.001);
    return G.shots.items.find((shot, index) => index < G.shots.count && shot.kind === 'lob');
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('primary throw honors live focus and leads measured lateral motion without using player velocity', () => {
    setup(); enemy(40);
    const focus = enemy(200, 20, 0, 220);
    tapFocusAt(focus.x, focus.y - focus.radius);
    Object.assign(G.player, { vx: -300, vy: 90 });
    const landing = choosePlagueLanding(G.player, 320, .35, 0);
    assert.equal(landing.target, focus); near(landing.x, 200); near(landing.y, 97);
    // Landing coordinates are snapshots, even if the selected target later turns.
    focus.y = 300; focus.motionVY = -220;
    near(landing.y, 97);
});

test('secondary throws cover distinct predicted clusters before repeating primary coverage', () => {
    setup();
    const focus = enemy(70); tapFocusAt(focus.x, focus.y - focus.radius);
    const dense = [enemy(200, 30), enemy(205, 45), enemy(212, 20)];
    const separate = enemy(-170, 40);
    assert.equal(choosePlagueLanding(G.player, 320, .35, 0).target, focus);
    assert.ok(dense.includes(choosePlagueLanding(G.player, 320, .35, 1).target));
    assert.equal(choosePlagueLanding(G.player, 320, .35, 2).target, separate);
    assert.equal(choosePlagueLanding(G.player, 320, .35, 3).target, focus);
});

const fireOptions = { radius: 60, kind: 'fire', weapon: 'molotov' };
function field(x, y, options = {}) {
    return spawnHazard('fire', x, y, { radius: 60, duration: 3, tick: .3, weapon: 'molotov', ...options });
}
function airborne(landing, options = {}) {
    return Object.assign(G.shots.spawn(), {
        kind: 'lob', hazard: 'fire', weapon: 'molotov', tx: landing.x, ty: landing.y,
        t: 0, dur: .35, s: { radius: 60, area: 1, duration: 3, tick: .3 }, ...options,
    });
}

test('nonfocused throws prefer a nearby uncovered threat over an already covered nearest target', () => {
    setup(); const covered = enemy(45), fresh = enemy(150);
    field(covered.x, covered.y);
    assert.equal(choosePlagueLanding(G.player, 320, .35, 0, fireOptions).target, fresh);
    // With all targets already covered, another cast is still useful sustained
    // damage. Never discard a volley just because its single boss is covered.
    field(fresh.x, fresh.y);
    assert.ok(choosePlagueLanding(G.player, 320, .35, 0, fireOptions));
});

test('field coverage uses the actual damage ellipse and predicted position at landing', () => {
    setup();
    const covered = enemy(80), moving = enemy(80, 40, 0, 120);
    field(80, 0, { radius: 100 });
    // Current y=40 is inside, but predicted y=82 is outside the 70px vertical
    // semi-axis even though it would remain inside a mistaken 100px circle.
    const landing = choosePlagueLanding(G.player, 320, .35, 0, { ...fireOptions, radius: 100 });
    assert.equal(landing.target, moving); near(landing.y, 82);
    assert.notEqual(landing.target, covered);
});

test('actual ellipse separates vertical volley patches and radius affects cluster selection', () => {
    setup(); const first = enemy(80), vertical = enemy(80, 80);
    tapFocusAt(first.x, first.y - first.radius);
    const second = choosePlagueLanding(G.player, 320, .35, 1, { ...fireOptions, radius: 100 });
    assert.equal(second.target, vertical, '80px separation exceeds a 100px field’s 70px vertical reach');
    setup(); const nearest = enemy(50), cluster = [enemy(190, -30), enemy(190, 30), enemy(210, 0)];
    assert.equal(choosePlagueLanding(G.player, 320, .35, 0, { ...fireOptions, radius: 20 }).target, nearest);
    assert.ok(cluster.includes(choosePlagueLanding(G.player, 320, .35, 0, { ...fireOptions, radius: 100 }).target));
});

test('explicit primary focus overrides existing field coverage without retargeting the bottle later', () => {
    setup(); const focus = enemy(100), other = enemy(-100);
    field(focus.x, focus.y); tapFocusAt(focus.x, focus.y - focus.radius);
    const landing = choosePlagueLanding(G.player, 320, .35, 0, fireOptions);
    assert.equal(landing.target, focus);
    focus.x = 200;
    near(landing.x, 100);
    assert.notEqual(landing.target, other);
});

test('fire and gas can combine, while expired fields do not reserve future landing coverage', () => {
    for (const variant of ['gas', 'different-owner', 'expiring', 'follow']) {
        setup(); const nearEnemy = enemy(45); enemy(170);
        const h = field(45, 0);
        if (variant === 'gas') h.kind = 'gas';
        if (variant === 'different-owner') h.weapon = 'plague_fire';
        if (variant === 'expiring') h.t = h.duration - .6;
        if (variant === 'follow') h.follow = true;
        assert.equal(choosePlagueLanding(G.player, 320, .35, 0, fireOptions).target, nearEnemy, variant);
    }
    setup(); const nearEnemy = enemy(45), farther = enemy(170);
    field(45, 0).t = 2.2; // .8 seconds left: survives arrival plus one tick.
    assert.equal(choosePlagueLanding(G.player, 320, .35, 0, fireOptions).target, farther);
    assert.notEqual(farther, nearEnemy);
});

test('same-volley airborne snapshots select distinct remaining patches without double-advancing shot index', () => {
    setup(); const targets = [enemy(65), enemy(-135), enemy(220, 40)];
    const chosen = [];
    for (let index = 0; index < 3; index++) {
        const landing = choosePlagueLanding(G.player, 320, .35, index, fireOptions);
        chosen.push(landing.target); airborne(landing);
    }
    assert.equal(new Set(chosen).size, 3);
    assert.deepEqual(chosen, targets);
    // Fused firegas creates ordinary fire fields on arrival.
    setup(); const covered = enemy(45), fresh = enemy(170);
    airborne(covered, { hazard: 'firegas' });
    assert.equal(choosePlagueLanding(G.player, 320, .35, 0, fireOptions).target, fresh);
});

test('coverage inspection stays bounded even when dynamic shot and hazard pools grow', () => {
    setup(); enemy(70); let inspected = 0; const tracked = [];
    for (let i = 0; i < 200; i++) {
        const shot = airborne({ x: -200, y: 0 });
        const h = field(-200, 0);
        for (const [object, property, value] of [[shot, 'kind', 'lob'], [h, 'alive', true]]) {
            Object.defineProperty(object, property, { configurable: true, get() { inspected++; return value; } });
            tracked.push({ object, property, value });
        }
    }
    try {
        assert.ok(choosePlagueLanding(G.player, 320, .35, 0, fireOptions));
        assert.equal(inspected, PLAGUE_TARGET_SCAN_LIMIT);
    } finally {
        for (const { object, property, value } of tracked) {
            Object.defineProperty(object, property, { configurable: true, enumerable: true, writable: true, value });
        }
    }
});

test('real tier-I two-bottle volley reserves airborne coverage before selecting its second patch', () => {
    setup(); G.passives = { spread: 1 }; recomputeStats();
    const left = enemy(-130), right = enemy(130);
    fire();
    const lobs = G.shots.items.slice(0, G.shots.count).filter(shot => shot.kind === 'lob');
    assert.equal(lobs.length, 2);
    assert.deepEqual(lobs.map(shot => shot.tx).sort((a, b) => a - b), [left.x, right.x]);
    for (const shot of lobs) { near(shot.ty, 0); near(shot.dur, .35); }
});

test('dead and out-of-range targets fall back to a live spawn before its grid rebuild', () => {
    setup(); const dead = enemy(20); dead.alive = false;
    const outside = enemy(400); tapFocusAt(outside.x, outside.y - outside.radius);
    const fresh = enemy(-140, 20, 30, 0, false);
    const landing = choosePlagueLanding(G.player, 300, .35, 0);
    assert.equal(landing.target, fresh); near(landing.x, -129.5);
    fresh.alive = false;
    assert.equal(choosePlagueLanding(G.player, 300, .35, 0), null);
});

test('prediction never extends throw range, and nonfinite motion cannot contaminate a projectile', () => {
    setup(); const e = enemy(290, 0, 500, 0);
    near(choosePlagueLanding(G.player, 300, .35, 0).x, 300);
    e.motionVX = NaN; e.motionVY = Infinity;
    const landing = choosePlagueLanding(G.player, 300, .35, 0);
    near(landing.x, 290); near(landing.y, 0);
    assert.equal(choosePlagueLanding(G.player, NaN, .35, 0), null);
});

test('dense encounters inspect no more than 64 target objects per throw', () => {
    setup(); let inspected = 0; const tracked = [];
    for (let i = 0; i < 300; i++) {
        const e = enemy(30 + i % 3, 30 + i % 4);
        let alive = true;
        Object.defineProperty(e, 'alive', { configurable: true, get() { inspected++; return alive; }, set(value) { alive = value; } });
        tracked.push(e);
    }
    try {
        assert.ok(choosePlagueLanding(G.player, 420, .35, 1));
        assert.equal(inspected, PLAGUE_TARGET_SCAN_LIMIT);
    } finally {
        for (const e of tracked) Object.defineProperty(e, 'alive', { configurable: true, enumerable: true, writable: true, value: true });
    }
});

test('a focused moving boss uses measured displacement for the same ballistic prediction', () => {
    setup(); enemy(30);
    const b = G.boss = { id: -1, x: 240, y: 20, radius: 28, hp: 1e6, alive: true, motionVX: -90, motionVY: 100 };
    tapFocusAt(b.x, b.y - b.radius);
    const landing = choosePlagueLanding(G.player, 420, .35, 0);
    assert.equal(landing.target, b); near(landing.x, 208.5); near(landing.y, 55);
});

test('real Plague bottle snapshots predicted landing, while another tech keeps existing placement and flight', () => {
    for (const tech of ['plague', 'gunline']) {
        setup(tech); const e = enemy(180, 0, 0, 200);
        const shot = fire('molotov', tech);
        near(shot.tx, 180); near(shot.ty, tech === 'plague' ? 70 : 0);
        near(shot.dur, tech === 'plague' ? .35 : .55);
        e.x = -200; e.y = -200;
        updateShots(.1);
        near(shot.tx, 180); near(shot.ty, tech === 'plague' ? 70 : 0);
    }
});

test('gas, fused firegas and absolute inherited throws all use the same predicted landing contract', () => {
    for (const id of ['gas', 'plague_fire', 'plague_end', 'ember_lance']) {
        setup(); enemy(180, 0, 0, 200); fire(id);
        const lobs = G.shots.items.slice(0, G.shots.count).filter(shot => shot.kind === 'lob');
        assert.ok(lobs.length > 0, id);
        for (const shot of lobs) { near(shot.tx, 180); near(shot.ty, 70); near(shot.dur, .35); }
    }
});

test('Plague Lv5 damage imprint is earned at Lv5 and combines additively with Lv7 only once', () => {
    setup(); G.passives = { spread: 1 }; recomputeStats();
    for (const [level, bonus] of [[4, 0], [5, .25], [7, .55]]) {
        const w = Object.assign(createWeapon('molotov', 0), { level }); G.weapons = [w];
        G.tech = null; const ordinary = weaponStats(w);
        G.tech = 'plague'; const empowered = weaponStats(w);
        near(empowered.dmg / ordinary.dmg, .85 * (1 + bonus));
        assert.equal(empowered.amount, ordinary.amount + 1, 'tier-I extra throw applies once');
        assert.deepEqual(weaponStats(w), empowered, 'recomputing stats never accumulates the imprint again');
    }
});

function landingEncounter({ vx, vy, playerVX = 0, prediction = true }) {
    setup(); const e = enemy(180, 0, vx, vy), shot = fire();
    if (!prediction) { shot.tx = e.x; shot.ty = e.y; }
    let coveredSeconds = 0;
    for (let frame = 0; frame < 60; frame++) {
        G.clock += 1 / 60;
        G.player.x += playerVX / 60; G.player.vx = playerVX;
        e.x += vx / 60; e.y += vy / 60;
        G.grid.reset(); G.grid.insert(e);
        updateShots(1 / 60);
        const h = G.hazards.items.find((hazard, i) => i < G.hazards.count && hazard.kind === 'fire');
        if (h && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 / .49 <= h.radius ** 2) coveredSeconds += 1 / 60;
        updateHazards(1 / 60);
    }
    return { coveredSeconds, damage: e.maxHp - e.hp };
}

for (const scenario of [
    { name: 'fast lateral sparse target', vx: 0, vy: 220 },
    { name: 'chasing target while the player kites away', vx: -180, vy: 0, playerVX: -230 },
]) test(`predicted real landing improves actual field uptime against a ${scenario.name}`, () => {
    const aimed = landingEncounter(scenario), stale = landingEncounter({ ...scenario, prediction: false });
    assert.ok(aimed.coveredSeconds >= .1, JSON.stringify(aimed));
    assert.equal(stale.coveredSeconds, 0, JSON.stringify(stale));
    assert.ok(aimed.damage > 0); assert.equal(stale.damage, 0);
});
