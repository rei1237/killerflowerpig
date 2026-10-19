import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGES, EVENTS } from '../src/data/stages.js';
import { BOSSES } from '../src/data/bosses.js';
import { ENEMIES, ELITE, ENEMY_TOUGHNESS_MULTIPLIER, stageScaling } from '../src/data/enemies.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { currentWeights, resetSpawner, updateSpawner } from '../src/game/spawner.js';
import { Boss } from '../src/game/boss.js';

const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/later-stage-balance.json', import.meta.url)));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function reset(stage = 1, time = 0) {
    clearWorld();
    G.stage = stage; G.time = time; G.clock = time; G.lowQ = false;
    G.events = {};
    G.view = { w: 1000, h: 600 };
    G.caps = { enemies: 420, particles: 0, texts: 0, gems: 500, decalScale: 1 };
    G.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 12, hp: 100, maxHp: 100, stats: { crit: 0, armor: 0 } };
    for (const name of ['boss1', 'boss2', 'bossKing', 'rabbit1', 'rabbit2', 'rabbit3']) {
        atlases[name] = { walkH: 112, frameCount: () => 8 };
    }
    resetSpawner();
}

function withFixedRandom(fn) {
    const original = Math.random;
    Math.random = () => 0.5;
    try { fn(); } finally { Math.random = original; }
}

function fillEnemies(count) {
    for (let i = 0; i < count; i++) assert.ok(spawnEnemy('shambler', 500, 0, { force: true }));
}

function runEvent(stage, type, occurrence = 0) {
    reset(stage);
    const events = STAGES[stage].events || EVENTS;
    const matches = events.map((event, index) => ({ ...event, index })).filter(event => event.type === type);
    const event = matches[occurrence];
    G.eventIdx = event.index;
    G.time = event.t;
    updateSpawner(0);
    return G.enemies.items.slice(0, G.enemies.count);
}

test('stage 1 and 2 have bounded density and refill; stage 1 introduces enemy types gradually', () => {
    assert.deepEqual(STAGES[1].density, [4, 19]);
    assert.deepEqual(STAGES[2].density, [7, 30]);
    assert.equal(currentWeights(STAGES[1], 54.999).runner, undefined);
    assert.equal(currentWeights(STAGES[1], 55).runner, 1);
    assert.equal(currentWeights(STAGES[1], 114.999).brute, undefined);
    assert.equal(currentWeights(STAGES[1], 115).brute, 1);
    for (const [stage, count] of [[1, 2], [2, 4]]) {
        reset(stage);
        updateSpawner(1);
        assert.equal(G.enemies.count, count);
        // A long frame cannot overfill the director's current target.
        updateSpawner(10);
        assert.equal(G.enemies.count, STAGES[stage].density[0]);
    }
    reset(1);
    updateSpawner(0.1);
    assert.equal(G.enemies.count, 0);
    resetSpawner();
    updateSpawner(0.1);
    assert.equal(G.enemies.count, 0, 'retry resets fractional spawn credit');
});

test('opening speed and damage remain forgiving while tougher enemies retain base XP values', () => withFixedRandom(() => {
    for (const [stage, multipliers] of [[1, [0.85, 0.85, 0.7]], [2, [0.92, 0.92, 0.85]]]) {
        reset(stage, STAGES[stage].duration / 2);
        const enemy = spawnEnemy('shambler', 400, 0);
        const oldHp = (1 + (stage - 1) * 0.6) * (1 + (stage - 1) * 0.14) * 1.25;
        close(enemy.hp, ENEMIES.shambler.hp * oldHp * multipliers[0] * ENEMY_TOUGHNESS_MULTIPLIER);
        close(enemy.speed, ENEMIES.shambler.speed * (1 + (stage - 1) * 0.035) * multipliers[1]);
        close(enemy.dmg, ENEMIES.shambler.dmg * (1 + (stage - 1) * 0.24) * multipliers[2]);
        close(enemy.xp, ENEMIES.shambler.xp * (1 + (stage - 1) * 0.15));
        assert.equal(enemy.tint, ENEMIES.shambler.tint);
        assert.equal(enemy.scale, ENEMIES.shambler.scale);
    }
}));

test('early caps apply to ordinary, forced, event and boss-summoned enemies', () => {
    for (const [stage, cap] of [[1, 26], [2, 38]]) {
        reset(stage);
        assert.equal(STAGES[stage].enemyCap, cap);
        fillEnemies(cap);
        assert.equal(spawnEnemy('runner', 0, 0), null);
        assert.equal(spawnEnemy('runner', 0, 0, { force: true }), null);
        G.enemies.release(0);
        G.time = (STAGES[stage].events || EVENTS)[0].t;
        updateSpawner(0);
        assert.equal(G.enemies.count, cap, 'ring only fills the remaining slot');
        G.enemies.release(0);
        const boss = new Boss(stage);
        boss.patternSummon(100);
        assert.equal(G.enemies.count, cap, 'summons cannot bypass the early cap');
    }
    reset(3);
    G.caps.enemies = 2;
    fillEnemies(2);
    assert.equal(spawnEnemy('runner', 0, 0), null);
    assert.equal(spawnEnemy('runner', 0, 0, { force: true }), null, 'later forced events also respect the global cap');
});

test('stage 1 leaves a 70-second learning window and smaller events run only once', () => {
    reset(1, 69.999);
    updateSpawner(0);
    assert.equal(G.enemies.count, 0);
    assert.equal(G.eventIdx, 0);
    assert.deepEqual(STAGES[1].events, [
        { t: 70, type: 'ring' }, { t: 90, type: 'elite' },
        { t: 115, type: 'swarm' }, { t: 140, type: 'ring' },
    ]);
    assert.equal(runEvent(1, 'ring').length, 5);
    updateSpawner(0);
    assert.equal(G.enemies.count, 5);
    assert.equal(runEvent(2, 'ring').length, 9);
    assert.equal(runEvent(1, 'swarm').length, 6);
    assert.equal(runEvent(2, 'swarm').length, 11);
    withFixedRandom(() => {
        for (const [stage, multiplier] of [[1, 1.15], [2, 1.3], [3, 1.5]]) {
            const swarm = runEvent(stage, 'swarm');
            const scaling = stageScaling(stage, G.time, STAGES[stage].duration);
            close(swarm[0].speed, ENEMIES.runner.speed * scaling.speed * multiplier);
        }
        for (const [stage, hpMultiplier] of [[1, 0.65], [2, 0.8], [3, 1]]) {
            const [elite] = runEvent(stage, 'elite');
            assert.equal(elite.elite, true);
            close(elite.hp, elite.def.hp * stageScaling(stage, G.time, STAGES[stage].duration).hp * ELITE.hp * hpMultiplier);
            close(elite.xp, elite.def.xp * stageScaling(stage, G.time, STAGES[stage].duration).xp * ELITE.xp);
        }
    });
});

test('first boss keeps slower, visibly matched charge warnings after the requested HP increase', () => withFixedRandom(() => {
    reset(1);
    const boss = new Boss(1);
    assert.equal(boss.hp, 1400);
    assert.equal(boss.speed, 48);
    assert.equal(boss.dmg, 10);
    assert.equal(boss.attackT, 3);
    close(boss.radius, 112 * 0.62 * 0.32);
    for (const phase of [0, 1, 2]) {
        G.hazards.clear();
        boss.phase = phase; boss.x = -200; boss.y = 0;
        const task = boss.task_charge();
        const warning = 1.15 / Math.sqrt(boss.phaseMul);
        close(G.hazards.items[0].delay, warning);
        task.t = warning - 0.001;
        task.step(0.1, task);
        assert.equal(boss.x, -200);
        task.t = warning + 0.001;
        task.step(0.1, task);
        close(boss.x, -152);
        boss.endTask(1.4);
        close(boss.attackT, 1.4 / boss.phaseMul * 1.5);
    }
}));

test('first boss phase transitions and summons allow time to recover', () => {
    reset(1);
    const boss = new Boss(1);
    boss.enterPhase(1);
    assert.equal(boss.attackT, 2.2);
    assert.equal(G.enemies.count, 4);
    G.enemies.clear();
    boss.enterPhase(2);
    assert.equal(boss.attackT, 2.2);
    assert.equal(G.enemies.count, 5);
    G.enemies.clear();
    boss.phase = 0;
    const task = boss.task_summon();
    task.t = 0.61;
    task.step(0.01, task);
    assert.equal(G.enemies.count, 2);
});

test('later-stage damage, speed, event timing and legacy charges remain while population and HP are rebalanced', () => withFixedRandom(() => {
    assert.deepEqual(EVENTS, baseline.events);
    for (let stage = 3; stage <= 10; stage++) {
        const { duration, weights, density } = STAGES[stage];
        const old = baseline.stages[stage];
        assert.equal(duration, old.duration);
        assert.deepEqual(weights.map(([t, w]) => [t, Object.fromEntries(Object.entries(w).filter(([id]) => !['suicider','gunner'].includes(id)))]), old.weights);
        assert.deepEqual(density, old.density.map(count => Math.round(Math.round(count * 0.6) * .88)));
        assert.ok(STAGES[stage].enemyCap > density[1]);
        assert.equal(STAGES[stage].events, undefined);
        for (const t of [0, duration / 2, duration, duration + 10]) {
            const prog = Math.min(1, t / duration);
            assert.deepEqual(stageScaling(stage, t, duration), {
                hp: (1 + (stage - 1) * 0.6) * (1 + (stage - 1) * 0.14) * (1 + prog * 0.5) * ENEMY_TOUGHNESS_MULTIPLIER,
                speed: 1 + (stage - 1) * 0.035,
                dmg: 1 + (stage - 1) * 0.24,
                xp: 1 + (stage - 1) * 0.15,
            });
        }
    }
    for (let stage = 2; stage <= 10; stage++) {
        const { speed, dmg } = BOSSES[stage];
        const old = baseline.bosses[stage];
        // Requested Hunter speed is the only later movement exception.
        assert.deepEqual({ speed, dmg }, { speed: stage === 3 ? 118 : old.speed, dmg: old.dmg });
        assert.equal(BOSSES[stage].pacing, undefined);
        reset(stage);
        const boss = new Boss(stage);
        assert.equal(boss.attackT, 2.2);
        boss.x = -200; boss.y = 0;
        const task = boss.task_charge();
        close(G.hazards.items[0].delay, 0.75);
        task.t = 0.751;
        task.step(0.1, task);
        close(boss.x, -138);
        boss.endTask(1.4);
        close(boss.attackT, 1.4);
        G.enemies.clear();
        boss.enterPhase(1);
        assert.equal(boss.attackT, 1.4);
        assert.equal(G.enemies.count, BOSSES[stage].phaseSummons ? 5 : 0);
    }
    reset(3);
    updateSpawner(1);
    assert.equal(G.enemies.count, 14, 'later director also stops at its reduced target during long frames');
    assert.equal(runEvent(3, 'ring').length, 14);
    assert.equal(runEvent(3, 'swarm').length, 18);
}));
