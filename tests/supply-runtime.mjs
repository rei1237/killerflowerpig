import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { ENEMIES, RANGED_UNLOCK_STAGE } from '../src/data/enemies.js';
import { STAGES } from '../src/data/stages.js';
import { supplyState } from '../src/game/supply-drops.js';
import { spawnEnemy, hitEnemy, updateEnemies } from '../src/game/enemies.js';
import { dropPickup, updatePickups } from '../src/game/pickups.js';
import { resetBuild, snapshotBuild, restoreBuild } from '../src/game/progression.js';
import { currentWeights } from '../src/game/spawner.js';
import { Boss } from '../src/game/boss.js';

const active = pool => pool.items.slice(0, pool.count);
const field = kind => active(G.pickups).filter(pickup => pickup.kind === kind);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function reset(stage = 1, hp = 100) {
    clearWorld();
    G.stage = stage; G.time = 0; G.clock = 0; G.kills = 0; G.gold = 0;
    G.supplyDrought = supplyState(); G.lowQ = false; G.godMode = false;
    G.events = {}; G.damageBy = {}; G.rerolls = 2;
    G.weapons = []; G.passives = {}; G.level = 1; G.xp = 0; G.xpNext = 4;
    G.pendingLevelUps = 0; G.banished = new Set();
    G.caps = { enemies: 420, particles: 0, texts: 0, gems: 500, decalScale: 0 };
    G.view = { w: 1000, h: 600 };
    G.player = {
        x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp, maxHp: 100,
        dead: false, iframes: 0, hurtT: 0,
        stats: { crit: 0, armor: 0, magnet: 70, greed: 1 },
    };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1', 'boss2', 'bossKing']) {
        atlases[name] = { walkH: 112, frameCount: () => 8 };
    }
}

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try { fn(); } finally { Math.random = original; }
}

function kill(elite = false) {
    const enemy = spawnEnemy('shambler', 500, 0, { elite });
    assert.ok(enemy);
    const index = G.enemies.count - 1;
    hitEnemy(enemy, enemy.hp + 1, { silent: true });
    assert.equal(enemy.alive, false);
    assert.equal(hitEnemy(enemy, 100, { silent: true }), 0, 'a dead enemy cannot roll supplies twice');
    // Release the corpse as the real enemy-update loop does after its death animation.
    G.enemies.release(index);
}

test('real ordinary kills carry drought to healthy heal30 and magnet60 without duplicate death rewards', () => withRandom(0.99, () => {
    reset();
    let killEvents = 0;
    G.events.kill = () => killEvents++;
    for (let count = 1; count <= 60; count++) {
        kill();
        assert.equal(field('meat').length, Math.floor(count / 30));
        assert.equal(field('magnet').length, count === 60 ? 1 : 0);
        assert.equal(field('chest').length, 0);
        assert.equal(field('bomb').length, 0);
        assert.equal(G.supplyDrought.heal, count % 30);
        assert.equal(G.supplyDrought.magnet, count % 60);
    }
    assert.equal(G.kills, 60);
    assert.equal(killEvents, 60);
    assert.equal(G.gems.count, 60);
    assert.equal(field('coin').reduce((total, coin) => total + coin.value, 0), 180);
}));

test('real low-HP kills guarantee healing at12 and recovery resets only the low-HP drought', () => withRandom(0.99, () => {
    reset(1, 40);
    for (let count = 1; count <= 11; count++) kill();
    assert.deepEqual(G.supplyDrought, { heal: 11, low: 11, magnet: 11 });
    assert.equal(field('meat').length, 0);
    G.player.hp = 41;
    kill();
    assert.deepEqual(G.supplyDrought, { heal: 12, low: 0, magnet: 12 });
    G.player.hp = 40;
    for (let count = 1; count <= 11; count++) kill();
    assert.equal(field('meat').length, 0);
    kill();
    assert.equal(field('meat').length, 1);
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 24 });
}));

test('one real ordinary kill can drop healing and magnet independently while elite kills leave drought untouched', () => {
    reset();
    withRandom(0.01, () => kill());
    assert.equal(field('meat').length, 1);
    assert.equal(field('magnet').length, 1);
    assert.equal(field('bomb').length, 0);
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 0 });
    G.supplyDrought = { heal: 29, low: 11, magnet: 59 };
    const drought = G.supplyDrought;
    withRandom(0, () => kill(true));
    assert.equal(G.supplyDrought, drought, 'elite kills do not even replace the ordinary drought state');
    assert.deepEqual(G.supplyDrought, { heal: 29, low: 11, magnet: 59 });
    assert.equal(field('meat').length, 1);
    assert.equal(field('magnet').length, 1);
    assert.equal(field('bomb').length, 0);
    assert.equal(field('chest').length, 1);
    assert.equal(field('coin').reduce((total, coin) => total + coin.value, 0), 27);
});

test('real field caps retain pending supplies and collection releases one slot of each kind', () => withRandom(0.99, () => {
    reset(1, 20);
    for (let count = 0; count < 3; count++) dropPickup('meat', 700 + count * 20, 0);
    for (let count = 0; count < 2; count++) dropPickup('magnet', 800 + count * 20, 0);
    G.supplyDrought = { heal: 30, low: 12, magnet: 60 };
    for (let count = 0; count < 5; count++) kill();
    assert.equal(field('meat').length, 3);
    assert.equal(field('magnet').length, 2);
    assert.deepEqual(G.supplyDrought, { heal: 30, low: 12, magnet: 60 });
    const meat = field('meat')[0], magnet = field('magnet')[0];
    meat.x = magnet.x = G.player.x;
    meat.y = magnet.y = G.player.y - 14;
    updatePickups(0);
    assert.equal(G.player.hp, 50, 'the actual healing pickup is collected');
    assert.equal(field('meat').length, 2);
    assert.equal(field('magnet').length, 1);
    assert.ok(active(G.gems).every(gem => gem.pull), 'the actual magnet pickup activates');
    assert.deepEqual(G.supplyDrought, { heal: 30, low: 12, magnet: 60 }, 'collection does not lose pending drought');
    kill();
    assert.equal(field('meat').length, 3);
    assert.equal(field('magnet').length, 2);
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 0 });
}));

test('run snapshots clone supply drought, restore it independently and reset it for a fresh build', () => withRandom(0.99, () => {
    reset();
    for (let count = 0; count < 17; count++) kill();
    const original = G.supplyDrought;
    const snapshot = snapshotBuild();
    assert.deepEqual(snapshot.supplyDrought, { heal: 17, low: 0, magnet: 17 });
    assert.notEqual(snapshot.supplyDrought, original);
    original.heal = 29;
    assert.equal(snapshot.supplyDrought.heal, 17);
    const persisted = JSON.parse(JSON.stringify(snapshot));
    resetBuild();
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 0 });
    restoreBuild(persisted);
    assert.deepEqual(G.supplyDrought, { heal: 17, low: 0, magnet: 17 });
    assert.notEqual(G.supplyDrought, persisted.supplyDrought);
    persisted.supplyDrought.heal = 30;
    assert.equal(G.supplyDrought.heal, 17);
    // A loaded run continues its guarantee rather than restarting the count.
    G.pickups.clear();
    for (let count = 0; count < 12; count++) kill();
    assert.equal(field('meat').length, 0);
    kill();
    assert.equal(field('meat').length, 1);
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 30 });
}));

test('legacy and malformed run snapshots normalize drought without inheriting another run', () => {
    reset();
    const snapshot = snapshotBuild();
    delete snapshot.supplyDrought;
    G.supplyDrought = { heal: 29, low: 11, magnet: 59 };
    restoreBuild(snapshot);
    assert.deepEqual(G.supplyDrought, { heal: 0, low: 0, magnet: 0 });
    restoreBuild({ ...snapshot, supplyDrought: { heal: 999, low: -1, magnet: NaN } });
    assert.deepEqual(G.supplyDrought, { heal: 30, low: 0, magnet: 0 });
});

test('ranged audit: boss summons cannot introduce ranged enemies before stage5; later summons retain them', () => {
    assert.equal(RANGED_UNLOCK_STAGE, 5);
    for (let stage = 1; stage <= 10; stage++) {
        reset(stage);
        const table = currentWeights(STAGES[stage], STAGES[stage].duration);
        let previous = 0;
        for (const [id, weight] of Object.entries(table)) {
            if (id === 'spitter') break;
            previous += weight;
        }
        const total = Object.values(table).reduce((sum, weight) => sum + weight, 0);
        const random = stage >= 5 ? (previous + table.spitter / 2) / total : 0.5;
        withRandom(random, () => {
            const boss = new Boss(stage);
            boss.patternSummon(10);
        });
        assert.equal(G.enemies.count, stage === 1 ? 6 : 10);
        assert.ok(active(G.enemies).every(enemy => stage < 5 ? !enemy.def.ranged : enemy.type === 'spitter'));
    }
});

test('ranged audit: stage5+ tables, forced/elite spawns and projectile timing retain the late-game values', () => withRandom(0.5, () => {
    const before = JSON.stringify(STAGES);
    for (let stage = 5; stage <= 10; stage++) {
        for (const [time, table] of STAGES[stage].weights) assert.equal(currentWeights(STAGES[stage], time), table);
        for (const opts of [{}, { force: true }, { elite: true }, { force: true, elite: true }]) {
            reset(stage);
            const spitter = spawnEnemy('spitter', 100, 0, opts);
            assert.ok(spitter);
            spitter.shootT = 0;
            updateEnemies(0.01);
            assert.equal(G.enemyShots.count, 1);
            const shot = G.enemyShots.items[0];
            assert.equal(shot.kind, 'acid');
            close(Math.hypot(shot.vx, shot.vy), ENEMIES.spitter.ranged.speed);
            close(shot.dmg, 8 * (1 + (stage - 1) * 0.16));
            close(spitter.shootT, 2.6 * 1.025);
        }
    }
    assert.equal(JSON.stringify(STAGES), before, 'table filtering and summons cannot rewrite stage data');
}));
