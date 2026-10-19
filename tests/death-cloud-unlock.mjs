import { coinRandom } from '../src/game/coin-drops.js';
coinRandom.next = () => .99;
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEATH_CLOUD_UNLOCK_STAGE, ENEMIES, ELITE, stageScaling } from '../src/data/enemies.js';
import { STAGES } from '../src/data/stages.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { spawnEnemy, hitEnemy, flushExplosions, updateEnemies } from '../src/game/enemies.js';
import { updateHazards } from '../src/game/hazards.js';
import { Boss } from '../src/game/boss.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const active = pool => pool.items.slice(0, pool.count);

function reset(stage, time = 0) {
    clearWorld(); G.supplyDrought = {};
    G.stage = stage; G.time = time; G.clock = time; G.kills = 0; G.lowQ = false;
    G.godMode = false; G.events = {}; G.damageBy = {};
    G.view = { w: 1000, h: 600 };
    G.caps = { enemies: 420, particles: 0, texts: 0, gems: 500, decalScale: 0 };
    G.player = {
        x: 0, y: 0, vx: 0, vy: 0, radius: 12, hp: 1000, maxHp: 1000,
        dead: false, iframes: 0, hurtT: 0, stats: { crit: 0, armor: 0 },
    };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1']) {
        atlases[name] = { walkH: 112, frameCount: () => 8 };
    }
}

function withFixedRandom(fn) {
    const original = Math.random;
    Math.random = () => 0.5;
    try { fn(); } finally { Math.random = original; }
}

function killBloater(stage, elite = false) {
    reset(stage);
    const enemy = spawnEnemy('bloater', 0, 0, { elite, force: true });
    const appearance = { tint: enemy.tint, scale: enemy.scale, radius: enemy.radius };
    let killEvents = 0;
    G.events.kill = () => killEvents++;
    hitEnemy(enemy, enemy.hp + 1, { silent: true });
    assert.equal(enemy.alive, false);
    assert.equal(enemy.state, 'dead');
    assert.equal(G.kills, 1);
    assert.equal(killEvents, 1);
    assert.equal(G.hazards.count, 0, 'death queues the explosion before hazard creation');
    assert.deepEqual({ tint: enemy.tint, scale: enemy.scale, radius: enemy.radius }, appearance);
    assert.equal(G.gems.count, 1);
    close(G.gems.items[0].value, ENEMIES.bloater.xp * stageScaling(stage, 0, STAGES[stage].duration).xp * (elite ? ELITE.xp : 1) * (5 / 3));
    assert.deepEqual(active(G.pickups).map(({ kind, value }) => ({ kind, value })), elite
        ? [{ kind: 'coin', value: 8 }]
        : []);
    flushExplosions();
    const blastDamage = ENEMIES.bloater.explode.dmg * (1 + (stage - 1) * 0.16);
    close(G.player.hp, 1000 - blastDamage, 'immediate explosion remains unchanged');
    assert.equal(hitEnemy(enemy, 100, { silent: true }), 0);
    flushExplosions();
    assert.equal(G.kills, 1);
    assert.equal(killEvents, 1);
    assert.equal(G.gems.count, 1, 'repeated damage or flush cannot duplicate loot');
    return blastDamage;
}

test('actual ordinary and elite bloater deaths leave no acid clouds in stages 1–4', () => withFixedRandom(() => {
    assert.equal(DEATH_CLOUD_UNLOCK_STAGE, 5);
    for (const stage of [1, 2, 3, 4]) {
        for (const elite of [false, true]) {
            killBloater(stage, elite);
            assert.equal(G.hazards.count, 0, `stage ${stage}, elite ${elite}`);
            const afterBlast = G.player.hp;
            G.player.iframes = 0;
            updateHazards(0.31);
            assert.equal(G.player.hp, afterBlast, 'there is no lingering acid damage after the explosion');
        }
    }
}));

test('stages 5–10 retain one death cloud with the original geometry, lifetime and damage tick', () => withFixedRandom(() => {
    for (let stage = 5; stage <= 10; stage++) {
        for (const elite of [false, true]) {
            const blastDamage = killBloater(stage, elite);
            assert.equal(G.hazards.count, 1);
            const cloud = G.hazards.items[0];
            assert.equal(cloud.kind, 'acid');
            assert.equal(cloud.x, 0); assert.equal(cloud.y, 0);
            close(cloud.radius, 78 * 0.7);
            assert.equal(cloud.duration, 3.5);
            assert.equal(cloud.tick, 0.3);
            close(cloud.dmg, blastDamage * 0.25);
            G.player.iframes = 0;
            updateHazards(0.01);
            close(G.player.hp, 1000 - blastDamage - blastDamage * 0.25);
            updateHazards(3.5);
            assert.equal(G.hazards.count, 0, 'original cloud lifetime is retained');
        }
    }
}));

test('death-cloud gate preserves direct splash and chain explosions against enemies', () => withFixedRandom(() => {
    for (const stage of [3, 5]) {
        reset(stage);
        G.player.x = 1000;
        const first = spawnEnemy('bloater', 0, 0);
        const second = spawnEnemy('bloater', 20, 0);
        second.hp = 1;
        const nearby = spawnEnemy('hulk', 30, 0);
        const outside = spawnEnemy('hulk', 100, 0);
        const nearbyBefore = nearby.hp;
        const outsideBefore = outside.hp;
        for (const enemy of [first, second, nearby, outside]) G.grid.insert(enemy);
        hitEnemy(first, first.hp + 1, { silent: true });
        flushExplosions();
        const blastDamage = 14 * (1 + (stage - 1) * 0.16);
        assert.equal(second.alive, false);
        assert.equal(G.kills, 2);
        close(nearby.hp, nearbyBefore - 4 * blastDamage);
        assert.equal(outside.hp, outsideBefore);
        assert.equal(G.hazards.count, stage < 5 ? 0 : 2);
        assert.equal(G.gems.count, 2);
        assert.equal(active(G.pickups).filter(p => p.kind === 'coin').reduce((total, p) => total + p.value, 0), 0);
    }
}));

test('all other enemy death types retain their loot and do not gain poison clouds', () => withFixedRandom(() => {
    for (const stage of [3, 5, 10]) {
        for (const type of Object.keys(ENEMIES).filter(type => type !== 'bloater')) {
            reset(stage);
            const enemy = spawnEnemy(type, 500, 0);
            if (!enemy) { assert.ok((ENEMIES[type].ranged && stage < 5) || stage < (ENEMIES[type].unlockStage || 1)); continue; }
            const xp = enemy.xp;
            hitEnemy(enemy, enemy.hp + 1, { silent: true });
            flushExplosions();
            assert.equal(G.hazards.count, 0, `${type} in stage ${stage}`);
            assert.equal(G.gems.count, 1);
            assert.equal(G.gems.items[0].value, xp * (5 / 3));
            assert.deepEqual(active(G.pickups).map(({ kind, value }) => ({ kind, value })), []);
            assert.equal(active(G.enemies).filter(e => e.alive).length, type === 'splitter' ? 3 : 0);
        }
    }
}));

test('acid spitter projectiles and boss acid pools remain separate from the death-cloud gate', () => withFixedRandom(() => {
    reset(5, 60);
    const spitter = spawnEnemy('spitter', 100, 0);
    spitter.shootT = 0;
    updateEnemies(0.01);
    assert.equal(G.enemyShots.count, 1);
    const shot = G.enemyShots.items[0];
    assert.equal(shot.kind, 'acid');
    close(Math.hypot(shot.vx, shot.vy), 170);
    close(shot.dmg, 8 * (1 + 4 * 0.16));
    assert.equal(G.hazards.count, 0);

    reset(4);
    const boss = new Boss(4);
    boss.task_pools();
    assert.equal(G.hazards.count, 4);
    assert.ok(active(G.hazards).every(h => h.kind === 'tcircle'));
    updateHazards(1.3);
    const pools = active(G.hazards);
    assert.equal(pools.length, 4);
    for (const pool of pools) {
        assert.equal(pool.kind, 'acid');
        assert.equal(pool.radius, 48);
        assert.equal(pool.duration, 4);
        assert.equal(pool.tick, 0.4);
        close(pool.dmg, boss.dmg * 0.25);
    }
}));
