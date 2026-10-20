import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { ENEMIES, ELITE, stageScaling } from '../src/data/enemies.js';
import { STAGES } from '../src/data/stages.js';
import { DIFFICULTIES } from '../src/data/difficulty.js';
import { CHAMPIONS, CHAMPION_KEYS, ELITE_AFFIX_KEYS, championChance, eliteAffixCount, championDeathBlast, affixRandom, createAffixRandom } from '../src/game/affixes.js';
import { spawnEnemy, hitEnemy, flushExplosions } from '../src/game/enemies.js';
import { treasureRandom } from '../src/game/coin-drops.js';
import { xpForLevel } from '../src/game/progression.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function reset(stage = 3) {
    clearWorld(); G.stage = stage; G.time = 0; G.clock = 0; G.kills = 0; G.lowQ = false; G.events = {}; G.damageBy = {};
    G.caps = { enemies: 252, particles: 0, texts: 0, gems: 500, decalScale: 0 }; G.view = { w: 1000, h: 600 };
    G.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp: 1000, maxHp: 1000, stats: { crit: 0, armor: 0 } };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3']) atlases[name] = { walkH: 112, frameCount: () => 8 };
}
const withRandom = (value, fn) => { const r = Math.random; Math.random = () => value; try { fn(); } finally { Math.random = r; } };

test('champion chance is zero in stage 1 and climbs to about fifteen percent in stage 10', () => {
    assert.equal(championChance(1), 0);
    close(championChance(2), .03); close(championChance(10), .15);
    for (let stage = 3; stage <= 10; stage++) assert.ok(championChance(stage) > championChance(stage - 1));
    assert.deepEqual([1, 4, 5, 8, 9, 10].map(eliteAffixCount), [1, 1, 2, 2, 3, 3]);
});

test('forced champions apply their hp/speed/damage/scale/xp multipliers; noAffix leaves the base enemy untouched', () => withRandom(.5, () => {
    for (const key of CHAMPION_KEYS) {
        reset(4);
        const base = spawnEnemy('shambler', 400, 0, { noAffix: true }), c = CHAMPIONS[key];
        const champ = spawnEnemy('shambler', 400, 0, { champion: key });
        assert.equal(base.champion, null); assert.equal(champ.champion, key);
        close(champ.maxHp, base.maxHp * c.hp); close(champ.hp, champ.maxHp);
        close(champ.speed, base.speed * c.speed); close(champ.dmg, base.dmg * c.dmg);
        close(champ.scale, base.scale * c.scale); close(champ.radius, base.radius * c.scale);
        close(champ.xp, base.xp * c.xp);
    }
}));

test('affix rolls use a dedicated stream: Math.random is never consumed and a stubbed stream decides the variant', () => {
    reset(10);
    const original = Math.random, prior = affixRandom.next; let shared = 0; Math.random = () => { shared++; return .5; };
    try {
        spawnEnemy('shambler', 400, 0, { noAffix: true }); const baseline = shared; // spawnEnemy 자체가 쓰는 공용 난수 횟수
        shared = 0; affixRandom.next = () => .99; // 챔피언 확률 미달 -> 일반 개체
        const plain = spawnEnemy('shambler', 400, 0); assert.equal(plain.champion, null);
        affixRandom.next = () => 0;   // 챔피언 확률 통과, 첫 종류
        const champ = spawnEnemy('shambler', 400, 0); assert.equal(champ.champion, CHAMPION_KEYS[0]);
        const elite = spawnEnemy('shambler', 400, 0, { elite: true }); assert.equal(elite.affixes.length, eliteAffixCount(10));
        assert.equal(shared, baseline * 3, 'variant rolls consumed shared Math.random');
    } finally { Math.random = original; affixRandom.next = prior; }
    const a = createAffixRandom(42), b = createAffixRandom(42);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
});

test('elites roll distinct abilities by stage (1/2/3), keep ELITE multipliers, and barrier is a separate shield', () => withRandom(.5, () => {
    for (const [stage, count] of [[2, 1], [5, 2], [9, 3]]) {
        reset(stage);
        const plain = spawnEnemy('brute', 300, 0, { noAffix: true, elite: true }), elite = spawnEnemy('brute', 300, 0, { elite: true });
        assert.equal(elite.affixes.length, count); assert.equal(new Set(elite.affixes).size, count);
        assert.ok(elite.affixes.every(k => ELITE_AFFIX_KEYS.includes(k)));
        assert.equal(plain.affixes, null);
        close(elite.maxHp, plain.maxHp); close(elite.xp, plain.xp); close(elite.dmg, plain.dmg);
        close(elite.maxHp, ENEMIES.brute.hp * stageScaling(stage, 0, STAGES[stage].duration).hp * ELITE.hp);
    }
    reset(3);
    const e = spawnEnemy('brute', 300, 0, { elite: true, affixes: ['barrier'] });
    close(e.barrier, e.maxHp * .6); close(e.hp, e.maxHp);
    const hp = e.hp, shield = e.barrier;
    hitEnemy(e, shield / 2, { silent: true }); close(e.hp, hp); close(e.barrier, shield / 2);
    hitEnemy(e, shield / 2 + 10, { silent: true }); assert.equal(e.barrier, 0); close(e.hp, hp - 10);
    assert.equal(e.alive, true);
}));

test('volatile champions explode on death for scaled damage; ordinary champions do not', () => withRandom(.5, () => {
    reset(5);
    const prior = treasureRandom.next; treasureRandom.next = () => .99;
    try {
        const blaster = spawnEnemy('shambler', 0, 0, { champion: 'volatile' }), blast = championDeathBlast(blaster);
        assert.equal(blast.r, CHAMPIONS.volatile.blast.radius); close(blast.dmg, CHAMPIONS.volatile.blast.dmg * (1 + (G.stage - 1) * .16));
        assert.equal(championDeathBlast(spawnEnemy('shambler', 0, 0, { champion: 'armored' })), null);
        const hp = G.player.hp; hitEnemy(blaster, blaster.hp + 1, { silent: true }); flushExplosions();
        assert.ok(G.player.hp < hp, 'the blast hurts a nearby player');
    } finally { treasureRandom.next = prior; }
}));

test('champions resist execute thresholds while ordinary enemies do not', () => withRandom(.5, () => {
    reset(3);
    const plain = spawnEnemy('shambler', 300, 0, { noAffix: true }), champ = spawnEnemy('shambler', 300, 0, { champion: 'armored' });
    for (const e of [plain, champ]) e.hp = e.maxHp * .1;
    // 실행(처형)은 확률 방식(executeChance, 상한 8%): 난수를 0으로 고정해 확정 발동시킨다.
    Math.random = () => 0;
    hitEnemy(plain, 1, { silent: true, executeChance: .08 }); hitEnemy(champ, 1, { silent: true, executeChance: .08 });
    assert.equal(plain.alive, false); assert.equal(champ.alive, true);
}));

test('difficulty XP multipliers and the level curve make levelling progressively harder', () => {
    assert.deepEqual(['easy', 'normal', 'hard', 'hell'].map(id => DIFFICULTIES[id].xpMul), [1, 2, 3.2, 5.5]);
    const prior = G.difficulty;
    try {
        G.difficulty = 'easy'; const base = [1, 10, 20, 30].map(xpForLevel);
        for (const id of ['normal', 'hard', 'hell']) { G.difficulty = id; [1, 10, 20, 30].forEach((lv, i) => assert.equal(xpForLevel(lv), Math.round(base[i] * DIFFICULTIES[id].xpMul))); }
    } finally { G.difficulty = prior; }
});
