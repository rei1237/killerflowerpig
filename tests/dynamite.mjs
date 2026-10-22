import { coinRandom, treasureRandom } from '../src/game/coin-drops.js';
coinRandom.next = () => .99;
treasureRandom.next = () => .99;
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { supplyState, rollSupplies, SUPPLY_RULES } from '../src/game/supply-drops.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { dropPickup, updatePickups, drawPickups } from '../src/game/pickups.js';
import { Boss } from '../src/game/boss.js';

function reset() {
    clearWorld();
    Object.assign(G, { stage: 1, time: 0, clock: 0, kills: 0, gold: 0, supplyDrought: supplyState(), lowQ: false, godMode: false,
        events: {}, damageBy: {}, weapons: [], passives: {}, level: 1, xp: 0, xpNext: 4, pendingLevelUps: 0, banished: new Set(),
        caps: { enemies: 420, particles: 0, texts: 0, gems: 500, decalScale: 0 }, view: { w: 1000, h: 600 } });
    G.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp: 100, maxHp: 100, dead: false, iframes: 0, hurtT: 0,
        stats: { crit: 0, armor: 0, magnet: 70, greed: 1 } };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1', 'boss2', 'bossKing']) atlases[name] = { walkH: 112, frameCount: () => 8 };
}

test('dynamite is rarer than before (0.05% per kill)', () => {
    assert.equal(SUPPLY_RULES.bombChance, .0005);
    let bombs = 0; const hit = () => 0.0004;
    // only the bomb roll is low: heal/magnet rolls are consumed first
    const rolls = [.99, .99, .0005 * .5]; let i = 0;
    for (const kind of rollSupplies(supplyState(), { hpRatio: 1 }, () => rolls[i++ % 3]).kinds) if (kind === 'bomb') bombs++;
    assert.equal(bombs, 1);
    i = 0; assert.ok(!rollSupplies(supplyState(), { hpRatio: 1 }, () => [.99, .99, .002][i++ % 3]).kinds.includes('bomb'));
});

test('dynamite kills every ordinary mob on the field (even off-screen) but never elites, champions or the boss', () => {
    reset();
    const mobs = [spawnEnemy('shambler', 80, 0, { noAffix: true }), spawnEnemy('shambler', 3000, -2500, { noAffix: true }), spawnEnemy('shambler', -900, 40, { noAffix: true })];
    const elite = spawnEnemy('shambler', 100, 100, { elite: true, noAffix: true });
    const champion = spawnEnemy('shambler', -100, 100, { noAffix: true }); champion.champion = true;
    assert.ok(mobs.every(Boolean) && elite && champion);
    const boss = new Boss(1); boss.x = 200; boss.y = 0; G.boss = boss;
    const hp = boss.hp;
    const bomb = dropPickup('bomb', 0, 0);
    const before = G.pickups.count;
    updatePickups(.016);
    assert.ok(mobs.every(e => !e.alive), 'all ordinary mobs die, on and off screen');
    assert.ok(elite.alive && champion.alive, 'elites and champions survive');
    assert.ok(boss.alive && boss.hp === hp, 'the boss is untouched');
    assert.equal(G.kills, mobs.length);
    assert.ok(!G.pickups.items.slice(0, G.pickups.count).some(p => p.kind === 'bomb'), 'the dynamite is consumed and no chained dynamite appears');
    assert.ok(G.pickups.count <= before);
});

test('dynamite pickup draws with a shockwave without needing a sprite', () => {
    const grad = { addColorStop() {} }, c2d = new Proxy({}, { get: (_, k) => k === 'createRadialGradient' ? () => grad : () => {}, set: () => true });
    globalThis.document = { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => c2d }) };
    reset(); dropPickup('bomb', 20, 0);
    const calls = []; const ctx = new Proxy({}, { get: (_, k) => k === 'drawImage' ? (...a) => calls.push(a) : () => {}, set: () => true });
    assert.doesNotThrow(() => drawPickups(ctx, -500, -500, 500, 500));
    updatePickups(.016);
    assert.doesNotThrow(() => drawPickups(ctx, -500, -500, 500, 500));
});
