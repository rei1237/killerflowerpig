import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, sawAimDirection, bodyDist2, sweptBodyDist2 } from '../src/game/weapons.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { Boss } from '../src/game/boss.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { save } from '../src/core/save.js';
import { atlases, images } from '../src/core/assets.js';

const close = (a, b, message = '') => assert.ok(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
const vectorClose = (a, b) => a.forEach((n, i) => close(n, b[i]));
function fixedRandom(value, run) {
    const original = Math.random;
    Math.random = typeof value === 'function' ? value : () => value;
    try { return run(); } finally { Math.random = original; }
}
function reset(tech = 'butcher') {
    resetBuild(); clearWorld(); clearFocus();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null }, equippedPet: null });
    Object.assign(G, { tech, mode: 'play', stage: 1, clock: 10, time: 0, paused: false, godMode: true,
        kills: 0, gold: 0, damageBy: {}, events: {}, lowQ: true,
        caps: { particles: 0, texts: 0, gems: 500, enemies: 100, decalScale: 0 },
        view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    atlases.rabbit1 = { walkH: 112, frameCount: () => 8 };
    delete images.playerFire;
    createPlayer();
    // These tests isolate the projectile from the companion's independent arc.
    G.player.swordCooldown = Infinity;
}
function enemy(x = 250, y = 0, extra = {}) {
    const e = fixedRandom(.99, () => spawnEnemy('runner', x, y, { hpMul: 10000 }));
    Object.assign(e, extra);
    G.grid.insert(e);
    return e;
}
function fire({ level = 1, slot = 0, coreIndex = 0, id = 'saw', sourceId } = {}) {
    const w = Object.assign(createWeapon(id, slot), { level, cd: 0, fusionCores: [], coreIndex, sourceId });
    G.weapons = [w]; G.passives = {}; recomputeStats();
    G.player.stats.crit = 0;
    fixedRandom(.99, () => updateWeapons(.001));
    const shots = G.shots.items.slice(0, G.shots.count).filter(sh => sh.kind === 'saw');
    assert.ok(shots.length > 0, 'real saw firing produced projectiles');
    return { w, shots, stats: weaponStats(w) };
}
function step(dt) {
    G.clock += dt;
    fixedRandom(.99, () => updateShots(dt));
}
function horizontalShot(sh, { x = -90, y = -12, speed = 1800 } = {}) {
    Object.assign(sh, { x, y, vx: speed, vy: 0, life: 10, bounce: false, knock: 0, bleed: 0 });
}

test.beforeEach(() => reset());

test('intercept matches a stationary body and a constant-velocity crossing within one second', () => {
    const p = { x: 0, y: 0 };
    vectorClose(sawAimDirection(p, { x: 180, y: -10, radius: 12 }, 360), [1, 0]);
    const target = { x: 180, y: -10, radius: 12, motionVX: 0, motionVY: 180 };
    const direction = sawAimDirection(p, target, 360);
    vectorClose(direction, [Math.sqrt(.75), .5]);
    const time = 180 / (360 * direction[0]);
    close(360 * direction[1] * time, target.motionVY * time);
    close(Math.hypot(...direction), 1);
});

test('intercept uses recorded displacement velocity, supports the linear case, and bounds prediction to one second', () => {
    const p = { x: 0, y: 0 };
    vectorClose(sawAimDirection(p, { x: 180, y: -10, radius: 12, motionVX: -360, motionVY: 0 }, 360), [1, 0]);
    const target = { x: 1000, y: -10, radius: 12, motionVX: 0, motionVY: 100, vx: 999, vy: 999 };
    const n = Math.hypot(1000, 100);
    vectorClose(sawAimDirection(p, target, 360), [1000 / n, 100 / n]);
    vectorClose(sawAimDirection(p, { x: 180, y: -10, radius: 12, motionVX: 800, motionVY: 0 }, 360), [1, 0]);
    vectorClose(sawAimDirection(p, { x: 180, y: -10, radius: 12, vx: 0, vy: 180 }, 360), [Math.sqrt(.75), .5]);
});

test('swept distance is the existing vertical capsule, including degenerate and crossing segments', () => {
    const target = { x: 0, y: 0, radius: 12, scale: 1, atlas: { walkH: 100 } };
    close(sweptBodyDist2(target, -80, -50, 80, -50), 0);
    close(sweptBodyDist2(target, 0, -120, 0, 20), 0);
    close(sweptBodyDist2(target, -80, -80, 80, -80), 49);
    close(sweptBodyDist2(target, -80, 20, 80, 20), 32 ** 2);
    for (const [x, y] of [[0, 0], [40, -40], [-30, -90]]) {
        close(sweptBodyDist2(target, x, y, x, y), bodyDist2(target, x, y));
    }
    close(sweptBodyDist2(target, -100, -100, 100, 100), sweptBodyDist2(target, 100, 100, -100, -100));
});

test('first butcher saw targets the selected moving enemy; remaining saws retain ricochet spread', () => {
    enemy(150, -100);
    const focus = enemy(270, 80, { motionVX: 0, motionVY: 100 });
    assert.equal(tapFocusAt(focus.x, focus.y - focus.radius), focus);
    const { shots, stats } = fire({ level: 2 });
    vectorClose([shots[0].vx / stats.speed, shots[0].vy / stats.speed], sawAimDirection(G.player, focus, stats.speed));
    assert.equal(shots.length, 2);
    close(shots[1].angle, .99 * Math.PI * 2 - Math.PI * 2);
    assert.notEqual(shots[0].angle, shots[1].angle);
});

test('focus does not home an existing saw or extend its acquisition range', () => {
    const near = enemy(170, -100), far = enemy(650, 80);
    tapFocusAt(far.x, far.y - far.radius);
    const { shots, stats } = fire();
    const sh = shots[0], vx = sh.vx, vy = sh.vy;
    vectorClose([vx / stats.speed, vy / stats.speed], sawAimDirection(G.player, near, stats.speed));
    clearFocus(); tapFocusAt(near.x, near.y - near.radius);
    near.x = -100; near.y = 200; near.motionVX = 500;
    step(.05);
    close(sh.vx, vx); close(sh.vy, vy);
});

test('non-butcher saws retain their random opening and consume the same spread RNG draw', () => {
    reset('gunline'); enemy(220, 0);
    const { shots } = fire();
    close(shots[0].angle, .99 * Math.PI * 2 - Math.PI * 2);
});

for (const dt of [1 / 60, .1]) {
    test(`a real saw hits a crossed body once at dt=${dt}, even when both endpoints miss`, () => {
        const e = enemy(0, 0, { scale: .3 });
        const { shots } = fire(); const sh = shots[0];
        horizontalShot(sh, { speed: 180 / dt });
        const radius = sh.radius + e.radius, hp = e.hp;
        assert.ok(bodyDist2(e, sh.x, sh.y) > radius ** 2);
        assert.ok(bodyDist2(e, sh.x + sh.vx * dt, sh.y) > radius ** 2);
        step(dt);
        close(hp - e.hp, sh.dmg);
    });
}

test('midpoint broad phase covers a fast path whose endpoint query would omit the enemy', () => {
    const e = enemy(0, 0);
    const { shots } = fire(); const sh = shots[0], hp = e.hp;
    horizontalShot(sh, { x: -400, speed: 8000 });
    assert.equal(G.grid.query(400, 33, sh.radius + 95, []).includes(e), false);
    step(.1);
    close(hp - e.hp, sh.dmg);
});

test('swept collision cannot award damage just outside the existing visible radius', () => {
    const e = enemy(0, 0, { scale: .3 });
    const { shots } = fire(); const sh = shots[0], hp = e.hp;
    horizontalShot(sh, { y: -e.radius + e.radius + sh.radius + .01 });
    step(.1);
    close(e.hp, hp);
    close(G.damageBy.saw || 0, 0);
});

test('repeat crossings obey hit cooldown, including multiple saws in the same core', () => {
    const e = enemy(0, 0);
    const { shots } = fire({ level: 2 }), hp = e.hp;
    for (const sh of shots) horizontalShot(sh);
    step(.1);
    close(hp - e.hp, shots[0].dmg);
    for (const sh of shots) horizontalShot(sh);
    step(.1);
    close(hp - e.hp, shots[0].dmg);
    for (const sh of shots) horizontalShot(sh);
    G.clock += shots[0].hitCd;
    step(.1);
    close(hp - e.hp, shots[0].dmg * 2);
});

test('separate slots and inherited cores keep independent saw hit channels', () => {
    const e = enemy(0, 0), hp = e.hp;
    const first = fire({ slot: 0 }).shots[0];
    horizontalShot(first);
    step(.1);
    const second = fire({ slot: 1 }).shots.at(-1);
    horizontalShot(second, { speed: 18000 });
    step(.01);
    const third = fire({ slot: 1, coreIndex: 1, sourceId: 'carnage_saw' }).shots.at(-1);
    horizontalShot(third, { speed: 18000 });
    step(.01);
    close(hp - e.hp, first.dmg + second.dmg + third.dmg);
});

test('real boss hurt obeys swept contact and repeat cooldown', () => {
    const { shots } = fire(), sh = shots[0];
    G.boss = { x: 0, y: 0, radius: 22, scale: .8, atlas: { walkH: 100 },
        alive: true, hp: 100000, maxHp: 100000, invuln: 0, phase: 0, hits: {}, hurt: Boss.prototype.hurt };
    const hp = G.boss.hp;
    horizontalShot(sh, { y: -30 });
    step(.1); close(hp - G.boss.hp, sh.dmg);
    horizontalShot(sh, { y: -30 });
    step(.1); close(hp - G.boss.hp, sh.dmg);
    G.clock += sh.hitCd;
    horizontalShot(sh, { y: -30 });
    step(.1); close(hp - G.boss.hp, sh.dmg * 2);
});

test('enemy motion records slow and knockback and resets on pooled reuse and distant recycling', () => {
    const e = enemy(250, 0, { speed: 100, slow: .5, slowT: 1, kx: 20, ky: 30 });
    const x = e.x, y = e.y;
    fixedRandom(.99, () => updateEnemies(.1));
    close(e.motionVX, -30); close(e.motionVY, 30);
    close(e.x - x, e.motionVX * .1); close(e.y - y, e.motionVY * .1);
    const id = e.id; e.motionVX = 900; e.motionVY = -900;
    e.hits.fill(G.clock);
    G.enemies.release(0); G.grid.clear();
    const reused = enemy(250, 0);
    assert.equal(reused, e); assert.notEqual(reused.id, id);
    close(reused.motionVX, 0); close(reused.motionVY, 0);
    assert.ok([...reused.hits].every(time => time === -99), 'new enemy generation has no inherited hit cooldown');
    reused.x = 3000; reused.motionVX = 900; reused.motionVY = -900;
    fixedRandom(.99, () => updateEnemies(.1));
    close(reused.motionVX, 0); close(reused.motionVY, 0);
});

test('a charge stopping partway through a frame records actual travel rather than full dash speed', () => {
    G.stage = 5;
    atlases.rabbit2 = atlases.rabbit1;
    const e = fixedRandom(.99, () => spawnEnemy('suicider', 46, 0, { hpMul: 10000 }));
    Object.assign(e, { rolePhase: 'dash', roleT: .4, aimX: -1, aimY: 0 });
    const x = e.x, y = e.y;
    fixedRandom(.99, () => updateEnemies(.1));
    close(e.motionVX, (e.x - x) / .1); close(e.motionVY, (e.y - y) / .1);
    assert.ok(Math.abs(e.motionVX) > 0 && Math.abs(e.motionVX) < e.def.charge.speed);
});

test('live boss movement supplies lead velocity; stationary patterns, teleporting and death reset it', () => {
    atlases.boss1 = { walkH: 112, frameCount: () => 8 };
    const boss = G.boss = fixedRandom(.99, () => new Boss(1));
    Object.assign(boss, { x: 250, y: 100, attackT: 100 });
    const x = boss.x, y = boss.y;
    fixedRandom(.99, () => boss.update(.1));
    close(boss.motionVX, (boss.x - x) / .1);
    close(boss.motionVY, (boss.y - y) / .1);
    close(Math.hypot(boss.motionVX, boss.motionVY), boss.speed);
    assert.ok(boss.motionVX < 0 && boss.motionVY < 0);
    boss.task = { t: 0, step() {} };
    boss.update(.1);
    close(boss.motionVX, 0); close(boss.motionVY, 0);
    boss.task = { t: 0, step() { boss.x += 400; } };
    boss.update(.1);
    close(boss.motionVX, 0); close(boss.motionVY, 0);
    boss.motionVX = 500; boss.motionVY = -500; boss.alive = false;
    boss.update(.1);
    close(boss.motionVX, 0); close(boss.motionVY, 0);
});

test('a reused projectile starts its sweep at the new muzzle, never at its previous life position', () => {
    const e = enemy(0, 120);
    const { shots } = fire(), original = shots[0];
    original.x = 0; original.y = 300; original.life = 0;
    step(0); assert.equal(G.shots.count, 0);
    const { shots: next } = fire();
    assert.equal(next[0], original);
    const hp = e.hp;
    next[0].vx = 360; next[0].vy = 0;
    step(.01); close(e.hp, hp);
});
