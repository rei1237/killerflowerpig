import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { ELITE, ELITE_BOSS_CAP, eliteSheet } from '../src/data/enemies.js';
import { BOSSES, bossMaxHp } from '../src/data/bosses.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/data/difficulty.js';
import { eliteAffixCount } from '../src/game/affixes.js';
import { spawnEnemy } from '../src/game/enemies.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function reset(stage, difficulty) {
    clearWorld(); G.stage = stage; G.time = 0; G.clock = 0; G.difficulty = difficulty; G.lowQ = false; G.events = {};
    G.caps = { enemies: 252, particles: 0, texts: 0, gems: 500, decalScale: 0 }; G.view = { w: 1000, h: 600 };
    G.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp: 1000, maxHp: 1000, stats: { crit: 0, armor: 0 } };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3']) atlases[name] = { walkH: 112, frameCount: () => 6 };
    atlases.boss1 = { walkH: 110, frameCount: () => 6 };
    atlases.boss2 = { walkH: 193, frameCount: () => 6 };
    atlases.bossKing = { walkH: 192, frameCount: () => 6 };
}
const withRandom = (fn) => { const r = Math.random; Math.random = () => .5; try { return fn(); } finally { Math.random = r; } };
// 풀 객체는 재사용되므로 비교에 필요한 값만 복사해 둔다.
const spawn = (stage, difficulty, opts) => withRandom(() => {
    reset(stage, difficulty);
    const e = spawnEnemy('brute', 300, 0, { force: true, ...opts });
    return { ...e, affixes: e.affixes && [...e.affixes] };
});

test('every difficulty strengthens ordinary and elite rabbits monotonically; easy is the neutral base', () => {
    const e = DIFFICULTIES.easy;
    assert.deepEqual([e.enemy.hp, e.enemy.dmg, e.enemy.speed, e.elite.hp, e.elite.dmg, e.boss.hp], [1, 1, 1, 1, 1, 1]);
    for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
        const prev = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]], cur = DIFFICULTIES[DIFFICULTY_ORDER[i]];
        for (const group of ['enemy', 'elite', 'boss']) for (const key of Object.keys(cur[group])) assert.ok(cur[group][key] >= prev[group][key], `${DIFFICULTY_ORDER[i]} ${group}.${key}`);
        assert.ok(cur.enemy.hp > prev.enemy.hp && cur.elite.hp > prev.elite.hp);
    }
});

test('spawned enemies carry the difficulty hp/damage/speed multipliers, elites get an extra layer', () => {
    for (const stage of [2, 6]) {
        const base = spawn(stage, 'easy', { noAffix: true });
        // 상한 전 원시값: 일반 개체 × 엘리트 배율
        const baseElite = { rawHp: base.maxHp * ELITE.hp, rawDmg: base.dmg * ELITE.dmg };
        for (const id of DIFFICULTY_ORDER) {
            const d = DIFFICULTIES[id];
            const ordinary = spawn(stage, id, { noAffix: true }), elite = spawn(stage, id, { elite: true, noAffix: true });
            close(ordinary.maxHp, base.maxHp * d.enemy.hp); close(ordinary.dmg, base.dmg * d.enemy.dmg); close(ordinary.speed, base.speed * d.enemy.speed);
            const hpCap = bossMaxHp(stage) * d.boss.hp * ELITE_BOSS_CAP.hp, dmgCap = BOSSES[stage].dmg * (1 + (stage - 1) * 0.05) * d.boss.dmg * ELITE_BOSS_CAP.dmg;
            const rawHp = Math.min(baseElite.rawHp, Infinity) * d.enemy.hp * d.elite.hp, rawDmg = baseElite.rawDmg * d.enemy.dmg * d.elite.dmg;
            close(elite.maxHp, Math.min(rawHp, hpCap)); close(elite.dmg, Math.min(rawDmg, dmgCap));
        }
    }
});

test('early field elites keep the rabbit body with only a red tint; later stages switch to the original boss sprites', () => {
    for (const stage of [1, 2, 3]) {
        assert.equal(eliteSheet(stage).sheet, null);
        const elite = spawn(stage, 'easy', { elite: true });
        assert.equal(elite.atlas, atlases.rabbit2); assert.equal(elite.bossSprite, false); assert.equal(elite.tint, 'elite');
        close(elite.scale, 0.6 * ELITE.scale);
    }
    for (const [stage, sheet] of [[4, 'boss1'], [6, 'boss1'], [7, 'boss2'], [8, 'boss2'], [9, 'boss2'], [10, 'boss2']]) {
        assert.equal(eliteSheet(stage).sheet, sheet);
        const elite = spawn(stage, 'easy', { elite: true });
        assert.equal(elite.atlas, atlases[sheet]); assert.equal(elite.bossSprite, true); assert.equal(elite.tint, 'normal');
        assert.ok(elite.scale * elite.atlas.walkH > 112 * 0.6 * ELITE.scale, 'boss-sprite elite is drawn taller than the tinted elite');
        assert.equal(elite.affixes.length, eliteAffixCount(stage));
        assert.equal(spawn(stage, 'hell', { elite: true }).affixes.length, Math.min(4, eliteAffixCount(stage) + DIFFICULTIES.hell.elite.affixes));
        const ordinary = spawn(stage, 'easy', { noAffix: true });
        assert.equal(ordinary.bossSprite, false); assert.equal(ordinary.atlas, atlases.rabbit2);
    }
});

test('no elite is ever stronger than its stage boss: HP (with barrier) <= 15% and contact damage <= 80%, berserk included', () => {
    for (const id of DIFFICULTY_ORDER) for (let stage = 1; stage <= 10; stage++) {
        const d = DIFFICULTIES[id];
        const hpCap = bossMaxHp(stage) * d.boss.hp * ELITE_BOSS_CAP.hp, bossDmg = BOSSES[stage].dmg * (1 + (stage - 1) * 0.05) * d.boss.dmg;
        for (const type of ['hulk', 'splitter', 'brute']) {
            const e = withRandom(() => { reset(stage, id); const x = spawnEnemy(type, 300, 0, { force: true, elite: true, affixes: ['barrier', 'berserk'] }); return x && { ...x }; });
            if (!e) continue;
            assert.ok(e.maxHp + e.barrierMax <= hpCap + 1e-6, `${id}/${stage}/${type} hp`);
            assert.ok(e.dmg <= bossDmg * ELITE_BOSS_CAP.dmg + 1e-9, `${id}/${stage}/${type} dmg`);
            assert.ok(Math.min(e.dmg * 1.4, e.dmgCap) <= bossDmg + 1e-9, 'berserk stays at or below boss damage');
        }
    }
});
