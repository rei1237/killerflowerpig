import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { WEAPONS } from '../src/data/weapons.js';
import { TECHS } from '../src/data/techs.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, precisionCrit } from '../src/game/weapons.js';
import { hitEnemy } from '../src/game/enemies.js';
import { Boss } from '../src/game/boss.js';
import { clearFocus, tapFocusAt, focusedTarget } from '../src/game/targeting.js';
import { updateHazards } from '../src/game/hazards.js';
import { save } from '../src/core/save.js';

const DUAL = ['pistols', 'burst_rail', 'guillotine'];
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);
let serial = 1;
function fixedRandom(value, run) {
    const original = Math.random;
    Math.random = typeof value === 'function' ? value : () => value;
    try { return run(); } finally { Math.random = original; }
}
function reset(tech = 'executioner') {
    resetBuild(); clearWorld(); clearFocus();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null } });
    Object.assign(G, { tech, mode: 'play', stage: 1, clock: 10, time: 0, paused: false, godMode: false,
        kills: 0, gold: 0, damageBy: {}, events: {}, lowQ: true,
        caps: { particles: 0, texts: 0, gems: 500, enemies: 100, decalScale: 0 },
        view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    createPlayer();
}
function enemy(x = 100, { elite = false, hp = 10000, maxHp = hp } = {}) {
    const e = Object.assign(G.enemies.spawn(), { id: serial++, x, y: 0, radius: 12,
        hp, maxHp, alive: true, elite, mass: 1, kx: 0, ky: 0, xp: 1,
        scale: .5, atlas: { walkH: 64, frameCount: () => 4 }, def: { tint: 'normal' },
        state: 'walk', anim: 0, animT: 0, deadT: 0, slow: 0, slowT: 0, bleed: 0, bleedT: 0,
        hits: new Float32Array(24).fill(-99) });
    G.grid.insert(e);
    return e;
}
function select(e) { assert.equal(tapFocusAt(e.x, e.y - e.radius), e); }
function build(id, level = 1, tierThree = false, evolved = false) {
    const w = Object.assign(createWeapon(id, 0), { level, evolved, cd: 0, fusionCores: [] });
    G.weapons = [w];
    G.passives = { focus: 1 };
    if (tierThree) {
        if (id === 'pistols') G.weapons.push(createWeapon('rifle', 1), createWeapon('saw', 2));
        if (id === 'burst_rail') G.weapons.push(createWeapon('saw', 1));
        G.passives = { focus: 1, whet: 1, madness: 1 };
    }
    recomputeStats();
    return w;
}
function fire(id = 'pistols', options = {}) {
    const w = build(id, options.level || 1, false, !!options.evolved);
    fixedRandom(.99, () => {
        updateWeapons(.01);
        G.clock += .01;
        updateWeapons(.01);
    });
    const sh = G.shots.items.slice(0, G.shots.count).find(s => s.weapon === id && s.kind === 'bullet');
    assert.ok(sh, `actual ${id} projectile`);
    return sh;
}
function collide(sh, target, random = .99) {
    sh.x = target.x; sh.y = target.y - target.radius;
    sh.vx = sh.vy = 0; sh.life = 10;
    fixedRandom(random, () => updateShots(0));
}

test.beforeEach(() => reset());

test('pistol base crit identity is explicit and every old HP-threshold execute is removed', () => {
    close(WEAPONS.pistols.base.crit, .15);
    close(WEAPONS.pistols.base.critBonus, .25);
    for (const [id, def] of Object.entries(WEAPONS)) {
        assert.equal(def.base.execute || 0, 0, `${id} base has no HP threshold`);
        assert.equal(def.evolve?.mods.execute || 0, 0, `${id} evolution has no HP threshold`);
    }
    for (const tech of Object.values(TECHS)) {
        for (const tier of tech.tiers) assert.equal(tier.weapon?.execute || 0, 0);
        for (const imprint of Object.values(tech.imprints)) assert.equal(imprint.mod.execute || 0, 0);
    }
    const e = enemy(100, { hp: 1, maxHp: 1000 });
    G.player.stats.crit = 0;
    fixedRandom(.99, () => hitEnemy(e, .1, { execute: .99, silent: true }));
    close(e.hp, .9);
    assert.equal(e.alive, true);
    assert.equal(e.lastExecute, false);
});

test('only executioner dual-family weapons receive the extra crit damage and precision identity', () => {
    for (const id of Object.keys(WEAPONS)) {
        const w = build(id, 8, false, !!WEAPONS[id].evolve);
        G.tech = null; recomputeStats(); const ordinary = weaponStats(w);
        G.tech = 'executioner'; recomputeStats(); const exclusive = weaponStats(w);
        close(exclusive.critBonus - ordinary.critBonus, DUAL.includes(id) ? .75 : 0, id);
        assert.equal(!!exclusive.precision, DUAL.includes(id), id);
        if (!DUAL.includes(id)) assert.equal(exclusive.executeChance, 0, id);
        for (const tech of ['gunline', 'bloom', 'plague', 'butcher']) {
            G.tech = tech; recomputeStats();
            const other = weaponStats(w);
            close(other.critBonus, ordinary.critBonus, `${tech}/${id}`);
            assert.equal(other.executeChance, 0);
            assert.equal(!!other.precision, false);
        }
        G.tech = 'executioner';
    }
});

test('instant-kill chance is 3%, 5%, 6%, or 8% by real weapon level and resonance, including evolved pistols', () => {
    for (const id of DUAL) for (const evolved of id === 'pistols' ? [false, true] : [false]) {
        for (const [level, tierThree, chance] of [[1, false, .03], [4, false, .03],
            [5, false, .05], [8, false, .05], [1, true, .06], [5, true, .08], [8, true, .08]]) {
            const w = build(id, level, tierThree, evolved);
            close(weaponStats(w).executeChance, chance, `${id}/${level}/${tierThree}/${evolved}`);
        }
    }
});

test('actual shots snapshot focus object and generation ID; clearing, retargeting and recycling cannot transfer the bonus', () => {
    for (const id of DUAL) {
        reset();
        const a = enemy(100), b = enemy(220);
        select(a);
        const sh = fire(id);
        assert.equal(sh.precision, true);
        assert.equal(sh.precisionTarget, a);
        assert.equal(sh.precisionTargetId, a.id);
        close(precisionCrit(sh, a), sh.crit + .12);
        close(precisionCrit(sh, b), sh.crit);
        clearFocus(); close(precisionCrit(sh, a), sh.crit);
        select(b);
        close(precisionCrit(sh, a), sh.crit);
        close(precisionCrit(sh, b), sh.crit, 'retargeting never grants old bullets a new target');
        clearFocus(); select(a);
        close(precisionCrit(sh, a), sh.crit + .12);
        a.id = serial++;
        assert.equal(focusedTarget(), null);
        select(a);
        close(precisionCrit(sh, a), sh.crit, 'same pooled object with new ID is a new enemy');
    }
});

test('no retroactive focus bonus, no range extension, and pooled nonprecision shots clear prior precision state', () => {
    const a = enemy(100);
    const unfocused = fire();
    select(a);
    close(precisionCrit(unfocused, a), unfocused.crit);
    G.shots.clear();
    const focused = fire();
    close(precisionCrit(focused, a), focused.crit + .12);
    G.shots.clear(); G.tech = 'gunline';
    const ordinary = fire();
    assert.equal(ordinary, focused, 'fixture exercises the same pooled projectile');
    assert.equal(ordinary.precision, false);
    assert.equal(ordinary.precisionTarget, null);
    assert.equal(ordinary.precisionTargetId, undefined);
    close(precisionCrit(ordinary, a), ordinary.crit);
    reset();
    const distant = enemy(600); enemy(100); select(distant);
    const sh = fire();
    assert.equal(sh.precisionTarget, null, 'focus outside the 520px weapon range is not captured');
    close(precisionCrit(sh, distant), sh.crit);
});

test('real projectile collision applies focus crit only while its originally selected target remains focused', () => {
    for (const invalidate of ['none', 'clear', 'retarget', 'generation']) {
        reset();
        const a = enemy(100), b = enemy(220); select(a);
        const sh = fire();
        G.player.stats.crit = 0;
        sh.crit = 0; sh.critBonus = 1; sh.dmg = 10; sh.executeChance = 0;
        if (invalidate === 'clear') clearFocus();
        if (invalidate === 'retarget') select(b);
        if (invalidate === 'generation') { a.id = serial++; clearFocus(); select(a); }
        let calls = 0;
        collide(sh, a, () => calls++ === 0 ? .06 : .99);
        close(a.maxHp - a.hp, invalidate === 'none' ? 40 : 10, invalidate);
        assert.equal(a.lastCrit, invalidate === 'none');
    }
});

test('normal enemies can proc at full HP; one kill issues one reward and repeated hits never roll again', () => {
    const e = enemy(100, { hp: 5000 });
    G.player.stats.crit = 0;
    let killEvents = 0, calls = 0;
    G.events.kill = target => { assert.equal(target, e); killEvents++; };
    fixedRandom(() => calls++ === 0 ? .01 : .99, () =>
        hitEnemy(e, 1, { executeChance: .03, weapon: 'pistols', silent: true }));
    assert.equal(e.alive, false); assert.equal(e.lastExecute, true);
    assert.equal(G.kills, 1); assert.equal(killEvents, 1); assert.equal(G.gems.count, 1);
    close(G.damageBy.pistols, 5000);
    const after = { calls, kills: G.kills, gems: G.gems.count, pickups: G.pickups.count, damage: G.damageBy.pistols };
    fixedRandom(() => { calls++; return 0; }, () =>
        assert.equal(hitEnemy(e, 999, { executeChance: .08, weapon: 'pistols' }), 0));
    assert.deepEqual({ calls, kills: G.kills, gems: G.gems.count, pickups: G.pickups.count, damage: G.damageBy.pistols }, after);
    assert.equal(killEvents, 1);
});

test('one actual hit makes exactly one execution roll, 8% is capped, and elite/boss targets never execute', () => {
    G.player.stats.crit = 0;
    let calls = 0;
    const normal = enemy();
    fixedRandom(() => { calls++; return .5; }, () => hitEnemy(normal, 1, { executeChance: .08, silent: true }));
    assert.equal(calls, 2, 'one execute roll plus the existing blood-effect roll');
    const capped = enemy(180);
    let first = true;
    fixedRandom(() => { const value = first ? .081 : .99; first = false; return value; },
        () => hitEnemy(capped, 1, { executeChance: 1, silent: true }));
    assert.equal(capped.alive, true); assert.equal(capped.lastExecute, false);
    const elite = enemy(260, { elite: true });
    calls = 0;
    fixedRandom(() => { calls++; return .99; }, () => hitEnemy(elite, 1, { executeChance: 1, silent: true }));
    assert.equal(calls, 1, 'elite never consumes an execution RNG draw');
    close(elite.hp, elite.maxHp - 1); assert.equal(elite.lastExecute, false);
    const boss = { alive: true, hp: 10000, maxHp: 10000, invuln: 0, phase: 0, x: 100, y: 0, radius: 26 };
    fixedRandom(.99, () => Boss.prototype.hurt.call(boss, 1, { executeChance: 1, silent: true }));
    assert.equal(boss.alive, true); assert.equal(boss.hp, 9999);
});

test('actual dual projectiles carry proc chance but boss collision receives only ordinary damage/crit fields', () => {
    const e = enemy(); select(e);
    const sh = fire('pistols');
    close(sh.executeChance, .03);
    G.player.stats.crit = 0; sh.crit = 0; sh.precision = false;
    let calls = 0;
    collide(sh, e, () => calls++ === 0 ? .01 : .99);
    assert.equal(e.lastExecute, true); assert.equal(e.alive, false);
    reset();
    let received;
    const boss = { alive: true, hp: 10000, maxHp: 10000, x: 100, y: 0, radius: 26, hits: {},
        hurt(dmg, opts) { received = { dmg, opts }; this.hp -= dmg; } };
    G.boss = boss;
    const bossShot = fire('pistols');
    collide(bossShot, boss);
    assert.ok(received);
    assert.equal(received.opts.executeChance, undefined);
    assert.equal(received.opts.execute, undefined);
    assert.equal(boss.alive, true);
});

test('seeded normal-enemy proc frequency tracks 3% and 8%, independent of target remaining HP', () => {
    G.player.stats.crit = 0;
    for (const chance of [.03, .08]) {
        let seed = 0x4728a31, procs = 0;
        const n = 10000, random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        const e = enemy(100);
        for (let i = 0; i < n; i++) {
            Object.assign(e, { hp: i % 2 ? 5000 : 1, maxHp: 5000, alive: true, lastExecute: false });
            let first = true;
            fixedRandom(() => { if (first) { first = false; return random(); } return .99; },
                () => hitEnemy(e, .01, { executeChance: chance, silent: true }));
            if (e.lastExecute) procs++;
            G.gems.clear(); G.pickups.clear();
        }
        assert.ok(Math.abs(procs / n - chance) < .008, `${chance}: ${procs}/${n}`);
    }
});

test('plague ordinary fire and evolved trail actually carry their disclosed slow into enemy hits', () => {
    for (const evolved of [false, true]) {
        reset('plague');
        const e = enemy(100);
        const w = Object.assign(createWeapon('molotov', 0), { cd: 0, evolved, level: evolved ? 8 : 1 });
        G.weapons = [w]; G.passives = { spread: 1 }; recomputeStats();
        const stats = weaponStats(w);
        close(stats.slow, evolved ? .3 : .2);
        G.player.vx = evolved ? 1 : 0;
        fixedRandom(.99, () => {
            updateWeapons(.01);
            const lob = G.shots.items.slice(0, G.shots.count).find(sh => sh.kind === 'lob');
            assert.ok(lob); close(lob.dur, .35);
            updateShots(.36);
        });
        const fires = G.hazards.items.slice(0, G.hazards.count).filter(h => h.kind === 'fire');
        assert.ok(fires.length >= (evolved ? 2 : 1));
        for (const h of fires) close(h.slow, stats.slow);
        fixedRandom(.99, () => updateHazards(.01));
        close(e.slow, stats.slow); assert.ok(e.slowT > 0);
    }
});
