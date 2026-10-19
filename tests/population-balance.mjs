import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld, configureCaps, setVisualTier } from '../src/game/state.js';
import { settings } from '../src/core/settings.js';
import { atlases } from '../src/core/assets.js';
import { ENEMIES, ELITE, ENEMY_TOUGHNESS_MULTIPLIER, stageScaling } from '../src/data/enemies.js';
import { STAGES, EVENTS } from '../src/data/stages.js';
import { spawnEnemy, hitEnemy } from '../src/game/enemies.js';
import { Boss } from '../src/game/boss.js';
import { resetSpawner, spawnRate, updateSpawner } from '../src/game/spawner.js';

const oldDensity = [[8,36],[14,56],[26,100],[32,125],[38,150],[45,175],[52,200],[60,225],[68,250],[76,280]];
const previousDensity = [[5,22],[8,34],[16,60],[19,75],[23,90],[27,105],[31,120],[36,135],[41,150],[46,168]];
const newDensity = previousDensity.map(pair => pair.map(n => Math.round(n * .88)));
const caps = [29,43,84,100,116,132,148,164,180,196].map(n => Math.round(n * .88));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const active = pool => pool.items.slice(0, pool.count);

function reset(stage = 1, lowQ = false) {
    clearWorld(); resetSpawner();
    G.stage = stage; G.time = 0; G.clock = 0; G.kills = 0; G.lowQ = lowQ;
    G.events = {}; G.damageBy = {}; G.weapons = []; G.supplyDrought = {};
    G.caps = { enemies: lowQ ? 156 : 252, particles: 0, texts: 0, gems: 500, decalScale: 0 };
    G.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp: 100, maxHp: 100, stats: { crit: 0, armor: 0 } };
    G.view = { w: 1000, h: 600 };
    for (const name of ['rabbit1','rabbit2','rabbit3','boss1','boss2','bossKing']) atlases[name] = { walkH: 112, frameCount: () => 8 };
}

function withFixedRandom(fn) {
    const random = Math.random; Math.random = () => 0.5;
    try { fn(); } finally { Math.random = random; }
}

function originalScaling(stage, time) {
    const beginner = stage === 1 ? { hp: .85, speed: .85, dmg: .7 } : stage === 2 ? { hp: .92, speed: .92, dmg: .85 } : { hp: 1, speed: 1, dmg: 1 };
    const prog = Math.min(1, time / STAGES[stage].duration);
    return {
        hp: (1 + (stage - 1) * .6) * (1 + (stage - 1) * .14) * (1 + prog * .5) * beginner.hp,
        speed: (1 + (stage - 1) * .035) * beginner.speed,
        dmg: (1 + (stage - 1) * .24) * beginner.dmg,
        xp: 1 + (stage - 1) * .15,
    };
}

test('all stage population endpoints fall a further12 percent and late swarms are bounded specialists', () => {
    for (let stage = 1; stage <= 10; stage++) {
        const st = STAGES[stage], old = oldDensity[stage - 1];
        assert.deepEqual(st.density, newDensity[stage - 1]);
        assert.equal(st.enemyCap, caps[stage - 1]);
        for (let index = 0; index < 2; index++) {
            const ratio = st.density[index] / old[index];
            assert.ok(ratio >= .48 && ratio <= .60, `stage ${stage} endpoint ${index}: ${ratio}`);
        }
        assert.equal(st.eventTuning.ringCount, Math.round(Math.round((stage === 1 ? 10 : stage === 2 ? 16 : 18 + stage * 3) * .6) * .88));
        assert.equal(st.eventTuning.swarmCount, stage >= 5 ? Math.min(10, stage + 1) : Math.round(Math.round((stage === 1 ? 12 : stage === 2 ? 20 : 26 + stage * 3) * .6) * .88));
    }
});

test('refill rates track the smaller population without double-scaling the deficit', () => {
    for (let stage = 1; stage <= 10; stage++) {
        const st = STAGES[stage];
        const old = stage === 1 ? { base: 2, gap: .45, max: 5 } : stage === 2 ? { base: 3, gap: .65, max: 8 } : { base: 4, gap: 1.5, max: Infinity };
        for (const fullness of [0, .5, .9]) {
            const oldTarget = oldDensity[stage - 1][0], newTarget = st.density[0];
            const oldRate = Math.min(old.max, old.base + oldTarget * (1 - fullness) * old.gap);
            const rate = spawnRate(st, newTarget, newTarget * fullness);
            assert.ok(rate / oldRate >= .48 && rate / oldRate <= .60, `stage ${stage}, fullness ${fullness}: ${rate / oldRate}`);
        }
    }
});

test('enemy HP rises11.7 percent from the previous1.45 tuning while speed, damage, collision and original appearance are unchanged', () => withFixedRandom(() => {
    assert.equal(ENEMY_TOUGHNESS_MULTIPLIER, 1.62);
    for (let stage = 1; stage <= 10; stage++) {
        for (const progress of [0, .5, 1]) {
            reset(stage); G.time = STAGES[stage].duration * progress;
            const old = originalScaling(stage, G.time), scaling = stageScaling(stage, G.time, STAGES[stage].duration);
            close(scaling.hp, old.hp * 1.62);
            for (const key of ['speed','dmg','xp']) close(scaling[key], old[key]);
            for (const [id, def] of Object.entries(ENEMIES)) {
                for (const elite of [false, true]) {
                    G.enemies.clear();
                    const enemy = spawnEnemy(id, 100, 0, { elite, force: true });
                    if ((def.ranged && stage < 5) || stage < (def.unlockStage || 1)) { assert.equal(enemy, null); continue; }
                    close(enemy.hp, def.hp * old.hp * 1.62 * (elite ? ELITE.hp : 1));
                    close(enemy.speed, def.speed * old.speed * (elite ? ELITE.speed : 1));
                    close(enemy.dmg, def.dmg * old.dmg * (elite ? ELITE.dmg : 1));
                    close(enemy.radius, def.radius * (elite ? ELITE.scale : 1));
                    close(enemy.scale, def.scale * (elite ? ELITE.scale : 1));
                    assert.equal(enemy.tint, elite ? 'elite' : def.tint);
                    assert.equal(enemy.atlas, atlases[def.sheet]);
                }
            }
        }
    }
}));

test('fixed-damage kill-count and HP-per-DPS proxies reflect sturdier individual targets', () => withFixedRandom(() => {
    for (const stage of [1, 2, 5, 10]) {
        reset(stage);
        const beforeHp = ENEMIES.shambler.hp * originalScaling(stage, 0).hp;
        const enemy = spawnEnemy('shambler', 500, 0);
        close(enemy.hp / 40, beforeHp / 40 * 1.62);
        const expectedHits = Math.ceil(enemy.hp / 9);
        let hits = 0;
        while (enemy.alive && hits < 1000) { hitEnemy(enemy, 9, { silent: true }); hits++; }
        assert.equal(hits, expectedHits);
        assert.ok(hits >= Math.ceil(beforeHp / 9));
    }
}));

test('configureCaps reduces only enemy budget and visual-tier changes cannot alter it', () => {
    const quality = settings.quality;
    try {
        settings.quality = 'high'; configureCaps();
        assert.deepEqual(G.caps, { enemies: 252, particles: 650, texts: 64, gems: 500, decalScale: 1 });
        settings.quality = 'low'; configureCaps();
        assert.deepEqual(G.caps, { enemies: 156, particles: 260, texts: 36, gems: 300, decalScale: .6 });
        const before = { ...G.caps }; setVisualTier(0); setVisualTier(2);
        assert.deepEqual(G.caps, before);
    } finally { settings.quality = quality; }
});

test('ordinary, elite, force, special events and boss summons all obey the tighter central limit', () => {
    for (let stage = 1; stage <= 10; stage++) {
        for (const lowQ of [false, true]) {
            reset(stage, lowQ);
            const cap = Math.min(STAGES[stage].enemyCap, G.caps.enemies);
            for (let count = 0; count < cap; count++) assert.ok(spawnEnemy('shambler', 500, 0));
            for (const opts of [{}, { force: true }, { elite: true }, { force: true, elite: true }, { force: true, hpMul: .7 }]) assert.equal(spawnEnemy('runner', 500, 0, opts), null);
            const boss = new Boss(stage); boss.patternSummon(100);
            assert.equal(G.enemies.count, cap);
            G.time = (STAGES[stage].events || EVENTS)[0].t;
            updateSpawner(0);
            assert.equal(G.enemies.count, cap);
            G.enemies.release(0);
            boss.patternSummon(100);
            assert.equal(G.enemies.count, cap, 'exactly the remaining slot is available');
        }
    }
});

test('splitter offspring cannot overrun the limit even when the corpse still occupies its slot', () => withFixedRandom(() => {
    for (const stage of [1, 5, 10]) {
        reset(stage);
        const cap = STAGES[stage].enemyCap;
        const parent = spawnEnemy('splitter', 500, 0, { force: true });
        while (G.enemies.count < cap - 1) spawnEnemy('shambler', 900, 0);
        hitEnemy(parent, parent.hp + 1, { silent: true });
        assert.equal(G.enemies.count, cap);
        assert.equal(active(G.enemies).filter(enemy => enemy.alive && enemy.type === 'runner').length, 1);
    }
}));

test('long refill frames honor reduced density, boss relief and low-quality headroom in every stage', () => {
    for (let stage = 1; stage <= 10; stage++) {
        for (const lowQ of [false, true]) {
            for (const boss of [false, true]) {
                reset(stage, lowQ);
                G.time = STAGES[stage].duration;
                G.eventIdx = (STAGES[stage].events || EVENTS).length;
                G.boss = boss ? {} : null;
                const target = Math.min(STAGES[stage].density[1] * (lowQ ? .85 : 1) * (boss ? .35 : 1), G.caps.enemies - 12, STAGES[stage].enemyCap);
                updateSpawner(100);
                assert.equal(G.enemies.count, Math.ceil(target));
                updateSpawner(100);
                assert.equal(G.enemies.count, Math.ceil(target), 'unchanged target cannot add more enemies');
            }
        }
    }
});

test('actual timed rings and rushes use their reduced counts without changing the event schedule', () => {
    for (let stage = 1; stage <= 10; stage++) {
        for (const [type, field] of [['ring','ringCount'], ['swarm','swarmCount']]) {
            reset(stage);
            const events = STAGES[stage].events || EVENTS;
            G.eventIdx = events.findIndex(event => event.type === type);
            G.time = events[G.eventIdx].t;
            updateSpawner(0);
            assert.equal(G.enemies.count, STAGES[stage].eventTuning[field]);
            updateSpawner(0);
            assert.equal(G.enemies.count, STAGES[stage].eventTuning[field]);
        }
    }
});
