import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons, orbitStats } from '../src/game/weapons.js';
import { updateThornCharges, THORN_SWEEP_SEGMENTS, thornBurstRatio, thornGuardReduction, interceptEnemyShot, THORN_GUARD } from '../src/game/thorn-charges.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { resetBuild, snapshotBuild, restoreBuild, rollChest } from '../src/game/progression.js';
import { save } from '../src/core/save.js';
import { atlases, fx } from '../src/core/assets.js';
import { drawWeaponOrbit, createWeaponVfxFrame } from '../src/game/weapon-vfx.js';
import { WEAPONS } from '../src/data/weapons.js';
import { Boss } from '../src/game/boss.js';
import * as await_damage from '../src/game/player.js';

function setup() {
    resetBuild(); clearWorld();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        equippedCosmetics: {}, equippedPet: null });
    Object.assign(G, { tech: null, stage: 1, time: 0, clock: 1, mode: 'play', kills: 0, gold: 0,
        events: {}, damageBy: {}, caps: { enemies: 100, particles: 0, texts: 0, gems: 100, pickups: 30, decalScale: 0 }, lowQ: true });
    atlases.rabbit1 = { walkH: 112, frameCount: () => 8 };
    createPlayer(); G.weapons = [Object.assign(createWeapon('thorns', 0), { cd: 0 })];
    updateWeapons(0);
    return G.weapons[0];
}
function enemy(x = 68, y = -8, hp = 10000) {
    const e = spawnEnemy('runner', x, y);
    Object.assign(e, { hp, maxHp: hp, motionVX: 0, motionVY: 0 });
    return e;
}
function tick(w, dt = 0) {
    G.clock += dt;
    return updateThornCharges(w, orbitStats(w, weaponStats(w)), dt);
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test.beforeEach(setup);

test('a petal deals full damage to exactly one overlapping enemy, bursts on its neighbour, then disappears', () => {
    const w = G.weapons[0], first = enemy(), second = enemy();
    const damage = weaponStats(w).dmg, burst = damage * thornBurstRatio(w);
    tick(w);
    // 직접 적중은 1명, 겹친 이웃은 꽃잎 파열 피해만 받는다.
    close(first.hp, first.maxHp - damage); close(second.hp, second.maxHp - burst);
    assert.ok(burst < damage * .25);
    assert.equal(w.thornState.slots.filter(s => s.ready).length, 1);
    for (let i = 0; i < 20; i++) tick(w, .01);
    close(first.hp, first.maxHp - damage); close(second.hp, second.maxHp - burst);
});

test('lethal contact consumes the petal before kill callbacks and cannot directly hit a second body (only its burst)', () => {
    const w = G.weapons[0], first = enemy(68, -8, 1), second = enemy();
    let consumedDuringCallback = false;
    G.events.kill = () => { consumedDuringCallback = !w.thornState.slots[0].ready; };
    tick(w);
    assert.equal(first.alive, false); assert.equal(consumedDuringCallback, true);
    // 두 번째 몸체는 직접 적중이 아니라 꽃잎 파열 피해만 받는다.
    close(second.hp, second.maxHp - weaponStats(w).dmg * thornBurstRatio(w));
});

test('each petal regrows on its own deadline without refreshing the spent timer every update', () => {
    const w = G.weapons[0], e = enemy(); tick(w);
    const due = w.thornState.slots[0].readyAt; e.x = 1000;
    tick(w, .4); close(w.thornState.slots[0].readyAt, due);
    tick(w, due - G.clock - .01); assert.equal(w.thornState.slots[0].ready, false);
    tick(w, .02); assert.equal(w.thornState.slots[0].ready, true);
    assert.equal(w.thornState.slots[1].ready, true);
});

test('one overlapping enemy consumes only one petal per core/update, including a 30-second stalled frame', () => {
    const w = G.weapons[0], e = enemy(0, 80); e.radius = 100;
    tick(w); const after = e.hp, angle = w.angle;
    G.clock += 30; updateWeapons(30);
    close(after - e.hp, weaponStats(w).dmg);
    assert.ok(w.angle - angle <= 3.4 * .25 + 1e-9);
    assert.equal(w.thornState.slots.filter(slot => !slot.ready).length, 1);
    assert.ok(w.thornState.slots.filter(slot => !slot.ready).every(slot => slot.readyAt > G.clock));
});

test('swept relative motion catches a fast crossing even when both endpoint circles miss', () => {
    const w = G.weapons[0], e = enemy(156, -8);
    e.motionVX = 1760; // previous x=-20, final x156; crosses x68 at dt .1
    tick(w, .1);
    close(e.maxHp - e.hp, weaponStats(w).dmg);
    assert.equal(w.thornState.slots[0].ready, false);
});

test('swept orbit catches a midpoint contact and never extends beyond the visible radius', () => {
    for (const outside of [false, true]) {
        const w = setup(); w.angle = -.4; delete w.thornState; tick(w);
        const e = enemy(outside ? 81.01 : 68, -19); e.radius = 1;
        w.angle = .4; tick(w, .25);
        close(e.maxHp - e.hp, outside ? 0 : weaponStats(w).dmg);
    }
    assert.equal(THORN_SWEEP_SEGMENTS, 64);
});

test('pooled enemy reuse cannot bypass a spent charge or retain an old hit identity', () => {
    const w = G.weapons[0], previous = enemy(); tick(w);
    G.enemies.release(0); const next = enemy();
    assert.equal(next, previous);
    tick(w, .1); close(next.hp, next.maxHp);
    tick(w, 1.71); close(next.maxHp - next.hp, weaponStats(w).dmg);
});

test('boss contact consumes before hurt and respects the same independent regeneration', () => {
    const w = G.weapons[0]; let calls = 0;
    G.boss = { id: -1, x: 68, y: -8, radius: 12, alive: true, hurt(damage) {
        calls++; assert.equal(w.thornState.slots[0].ready, false); close(damage, weaponStats(w).dmg);
    } };
    tick(w); tick(w, .1); assert.equal(calls, 1);
    tick(w, 1.71); assert.equal(calls, 2);
});

test('blocked boss contact consumes a petal but never grants free lifesteal', () => {
    const w = G.weapons[0]; w.evolved = true; updateWeapons(0); G.player.hp = 50;
    G.boss = { id: -1, x: 68, y: -8, radius: 12, alive: true, hp: 100000, maxHp: 100000,
        phase: 0, invuln: 1, hurt: Boss.prototype.hurt };
    tick(w); close(G.player.hp, 50); close(G.boss.hp, 100000);
    assert.equal(w.thornState.slots[0].ready, false);
    G.boss.invuln = 0; tick(w, weaponStats(w).regrow + .01);
    close(G.player.hp, 50.3); assert.ok(G.boss.hp < 100000);
});

test('a boss overlapping the whole ring cannot consume multiple petals in one update', () => {
    const w = G.weapons[0]; let hits = 0;
    G.boss = { id: -1, x: 0, y: 80, radius: 100, alive: true, hurt() { hits++; return 1; } };
    tick(w); assert.equal(hits, 1);
    assert.equal(w.thornState.slots.filter(slot => slot.ready).length, 1);
});

test('level growth adds only new charges and evolution preserves existing spent deadlines', () => {
    const w = G.weapons[0], e = enemy(); tick(w); e.x = 1000;
    const due = w.thornState.slots[0].readyAt;
    w.level = 2; updateWeapons(0);
    assert.equal(w.thornState.slots.length, 3); close(w.thornState.slots[0].readyAt, due);
    assert.equal(w.thornState.slots[0].ready, false); assert.equal(w.thornState.slots[2].ready, true);
    w.level = 8; G.passives = { regen: 1 }; recomputeStats(); updateWeapons(0);
    assert.equal(rollChest(1, () => 0)[0].kind, 'evolve'); updateWeapons(0);
    close(w.thornState.slots[0].readyAt, due); assert.equal(w.thornState.slots[0].ready, false);
    assert.equal(w.thornState.slots.length, 6);
});

test('restore and player replacement start fresh while independent inherited cores never share charges', () => {
    const w = G.weapons[0]; enemy(); tick(w);
    const snapshot = snapshotBuild(); restoreBuild(snapshot); updateWeapons(0);
    assert.notEqual(G.weapons[0].thornState, w.thornState);
    G.enemies.clear(); const current = G.weapons[0]; createPlayer(); updateWeapons(0);
    assert.ok(current.thornState.slots.every(slot => slot.ready));
    const core = Object.assign(createWeapon('thorns', 1), { level: 8, evolved: true, sourceId: 'carnage_saw', coreIndex: 1 });
    G.weapons.push(core); updateWeapons(0);
    assert.notEqual(current.thornState, core.thornState);
    assert.notEqual(current.thornState.slots[0], core.thornState.slots[0]);
    current.thornState.slots[0].ready = false;
    assert.equal(core.thornState.slots[0].ready, true);
});

test('same-player stage advance resets spent slots and never sweeps a stale teleport path', () => {
    const w = G.weapons[0], previous = enemy(); tick(w);
    assert.equal(w.thornState.slots[0].ready, false);
    G.enemies.clear(); const bystander = enemy(250, -8);
    G.stage++; G.stageStartTime = G.clock; G.player.x = 500;
    G.clock += .1; updateWeapons(.1);
    close(bystander.hp, bystander.maxHp);
    assert.ok(w.thornState.slots.every(slot => slot.ready));
    assert.equal(w.thornState.x, 500); assert.equal(w.thornState.stage, G.stage);
});

test('regrowth is 1.6→1.2 from Lv4→1.02 evolved, with cooldown applied once and a safe floor', () => {
    const w = G.weapons[0]; close(weaponStats(w).regrow, 1.6);
    w.level = 4; close(weaponStats(w).regrow, 1.2);
    w.level = 8; close(weaponStats(w).regrow, 1.2);
    w.evolved = true; close(weaponStats(w).regrow, 1.02);
    G.player.stats.cooldown = .5; close(weaponStats(w).regrow, .51);
    G.player.stats.cooldown = .001; close(weaponStats(w).regrow, .35);
    G.player.stats.cooldown = 1; G.tech = 'bloom'; G.passives = { regen: 1, pollen: 1, heart: 1 }; recomputeStats();
    close(weaponStats(w).regrow, 1.02 * .78);
    assert.equal(weaponStats(w).duration, 0);
    assert.match(WEAPONS.thorns.desc, /하나.*사라/); assert.match(WEAPONS.thorns.evolve.desc, /재생/);
});

test('renderer uses the same ready mask without changing it or closing the missing slot', () => {
    const w = G.weapons[0]; enemy(); tick(w);
    const moves = [], ctx = new Proxy({ translate(x, y) { moves.push([x, y]); } }, {
        get(target, key) { return key in target ? target[key] : () => {}; }, set(target, key, value) { target[key] = value; return true; },
    });
    fx.petal = { width: 26, height: 26 };
    const state = JSON.stringify(w.thornState.slots);
    drawWeaponOrbit(ctx, w, orbitStats(w, weaponStats(w)), G.player, createWeaponVfxFrame(true, G.clock));
    assert.equal(moves.length, 1); close(moves[0][0], -68); close(moves[0][1], -20);
    assert.equal(JSON.stringify(w.thornState.slots), state);
});

// ── 연꽃 수호 · 꽃잎 파열 ──
test('a ready petal blocks an enemy bullet, is consumed, and regrows; spent petals block nothing', () => {
    const w = G.weapons[0];
    const state = tick(w), s = orbitStats(w, weaponStats(w));
    const a = state.angle, r = s.radius * s.area;
    const shot = { x: state.x + Math.cos(a) * r, y: state.y - 20 + Math.sin(a) * r * .8, radius: 5 };
    assert.equal(interceptEnemyShot(shot), true);
    assert.equal(state.slots[0].ready, false);
    // 같은 자리, 이미 소모된 꽃잎은 막지 못한다 (다른 꽃잎이 그 자리에 없으면).
    const again = { ...shot };
    const readyBefore = state.slots.filter(x => x.ready).length;
    interceptEnemyShot(again);
    assert.ok(state.slots.filter(x => x.ready).length >= readyBefore - 1);
    tick(w, s.regrow + .01);
    assert.equal(state.slots[0].ready, true, 'regrows after its regrow time');
    // 꽃잎과 먼 탄은 그대로 지나간다.
    assert.equal(interceptEnemyShot({ x: state.x + 400, y: state.y, radius: 5 }), false);
});

test('bloom guard: damage reduction grows with ready petals and upgrades, is capped, and drops while petals regrow', () => {
    const w = G.weapons[0];
    tick(w);
    const ready = w.thornState.slots.filter(x => x.ready).length;
    close(thornGuardReduction(), Math.min(THORN_GUARD.cap, ready * THORN_GUARD.perPetal));
    // 꽃잎을 모두 소모하면 보호가 사라진다
    for (const slot of w.thornState.slots) { slot.ready = false; slot.readyAt = G.clock + 5; }
    assert.equal(thornGuardReduction(), 0);
    // 업그레이드(Lv8)·진화로 꽃잎이 늘면 더 강해진다
    w.level = 8; tick(w, 6); const lv8 = thornGuardReduction();
    w.evolved = true; tick(w, 6); const evo = thornGuardReduction();
    assert.ok(lv8 > ready * THORN_GUARD.perPetal - 1e-9 && lv8 <= THORN_GUARD.cap + 1e-9);
    assert.ok(evo > lv8 && evo <= THORN_GUARD.evolvedCap + 1e-9);
    // 실제 피격에 적용된다
    const p = G.player; p.iframes = 0; p.hp = 100; const before = p.hp;
    const { damagePlayer } = await_damage;
    damagePlayer(20, p.x + 10, p.y);
    close(before - p.hp, 20 * (1 - evo));
});

test('petal burst grows with level and evolution but hits a bounded number of neighbours', () => {
    const w = G.weapons[0];
    const lv1 = thornBurstRatio(w); w.level = 8; const lv8 = thornBurstRatio(w);
    assert.ok(lv8 > lv1);
    w.level = 1; tick(w);
    const victim = enemy(), crowd = Array.from({ length: 8 }, () => enemy());
    tick(w);
    const burned = crowd.filter(e => e.hp < e.maxHp).length;
    assert.ok(victim.hp < victim.maxHp);
    assert.ok(burned >= 1 && burned <= THORN_GUARD.burstTargets, `burst hit ${burned}`);
});
