import test from 'node:test';
import assert from 'node:assert/strict';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
globalThis.window ??= { matchMedia: () => ({ matches: false }) };
const { characterStatBonus, characterStageXP, characterProgress, CHARACTER_MAX_LEVEL } = await import('../src/core/character-progression.js');
const { G, configureCaps } = await import('../src/game/state.js');
configureCaps();
const { save } = await import('../src/core/save.js');
const { createPlayer } = await import('../src/game/player.js');
const { awardStageCharacterXP } = await import('../src/game/game.js');

test('character level adds small base stats, capped at level 50', () => {
    assert.deepEqual(characterStatBonus(1), { maxHp: 0, might: 0, speed: 0 });
    const b10 = characterStatBonus(10);
    assert.equal(b10.maxHp, 9); assert.ok(Math.abs(b10.might - 0.045) < 1e-9); assert.ok(Math.abs(b10.speed - 0.018) < 1e-9);
    assert.deepEqual(characterStatBonus(999), characterStatBonus(CHARACTER_MAX_LEVEL));
    assert.ok(characterStatBonus(CHARACTER_MAX_LEVEL).might <= 0.25);
});

test('player base stats follow the saved character level', () => {
    const prev = save.characterXP;
    G.passives = {};
    try {
        save.characterXP = 0; createPlayer();
        const base = { ...G.player.stats };
        save.characterXP = 1360; // 100+120+...+240 → Lv.9
        assert.equal(characterProgress(save.characterXP).level, 9);
        createPlayer();
        assert.equal(G.player.maxHp, base.maxHp + 8);
        assert.ok(G.player.stats.might > base.might && G.player.stats.speed > base.speed);
    } finally { save.characterXP = prev; }
});

test('stage clear grants character XP once per run and stage', () => {
    const prev = { xp: save.characterXP, count: save.characterRewardCount, last: save.lastCharacterReward, receipts: save.receipts };
    try {
        createPlayer();
        G.runId = 'test-run'; G.stage = 3;
        const start = save.characterXP;
        assert.equal(awardStageCharacterXP(), true);
        assert.equal(save.characterXP, start + characterStageXP(3));
        awardStageCharacterXP();
        assert.equal(save.characterXP, start + characterStageXP(3), 'retrying the same clear does not grant twice');
        let total = 0; for (let s = 1; s <= 10; s++) total += characterStageXP(s);
        assert.equal(characterProgress(total).level, 9, 'one full run reaches about Lv.9');
    } finally { Object.assign(save, { characterXP: prev.xp, characterRewardCount: prev.count, lastCharacterReward: prev.last, receipts: prev.receipts }); }
});
