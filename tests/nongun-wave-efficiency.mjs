import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS } from '../src/data/weapons.js';
import { SAW_VISUAL_CAP, ORBIT_VISUAL_CAP } from '../src/game/weapons.js';
import './helpers/fixed-variants.mjs'; // 변이·보물 난수 스트림 고정 (벤치마크 재현성)
import { runFiniteWave, summarizeWaves, withBeforeData, waveConfiguration, WAVE_PHASES } from '../tools/nongun-wave-qa.mjs';

const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/nongun-data-before.json', import.meta.url)));
const cache = new Map();
function paired(id, phase, scene, { route = false, oneCast = false } = {}) {
    const key = [id, phase, scene, route, oneCast].join(':');
    if (!cache.has(key)) {
        const run = () => [1, 7, 13].map(seed => runFiniteWave({ id, phase, scene, route, oneCast, seed }));
        cache.set(key, { before: summarizeWaves(withBeforeData(run)), after: summarizeWaves(run()) });
    }
    return cache.get(key);
}

test('all ordinary gun definitions and existing crit modifiers are exactly unchanged', () => {
    for (const id of ['shotgun', 'pistols', 'rifle']) assert.deepEqual(WEAPONS[id], baseline.weapons[id]);
    for (const id of ['saw', 'sword', 'molotov', 'gas', 'thorns']) {
        assert.equal(WEAPONS[id].base.crit, baseline.weapons[id].base.crit);
        assert.equal(WEAPONS[id].evolve.mods.crit, baseline.weapons[id].evolve.mods.crit);
        assert.equal(WEAPONS[id].evolve.mods.critBonus, baseline.weapons[id].evolve.mods.critBonus);
    }
});

test('wave comparisons have equal item budgets and legal evolved prerequisites', () => {
    for (const [phase, investment] of [['base', 3], ['mid', 14], ['evolved', 31]]) {
        for (const tech of ['gunline', 'executioner', 'bloom', 'plague', 'butcher']) {
            const config = waveConfiguration(tech, phase, true);
            assert.equal(config.investment, investment);
            assert.equal(config.evolutionRewards, phase === 'evolved' ? 2 : 0);
        }
    }
    for (const [phase, investment] of [['base', 2], ['mid', 6], ['evolved', 13]]) {
        for (const id of ['saw', 'sword', 'molotov', 'gas', 'thorns']) assert.equal(waveConfiguration(id, phase).investment, investment);
    }
});

for (const phase of ['base', 'mid']) for (const scene of ['dense', 'spread', 'moving']) {
    test(`saw ${phase}/${scene} clears sparse finite waves faster without extra overlapping ticks`, () => {
        const { before, after } = paired('saw', phase, scene);
        assert.equal(after.cleared, after.runs);
        assert.ok(after.meanClearTime < before.meanClearTime * (phase === 'base' && scene === 'moving' ? .9 : .8), `${before.meanClearTime} -> ${after.meanClearTime}`);
        assert.ok(after.peakShots <= SAW_VISUAL_CAP * 2, 'only current volley plus existing .15s retiring volley');
    });
}

test('mid saw first-volley spread coverage reaches more distinct finite enemies', () => {
    const { before, after } = paired('saw', 'mid', 'spread', { oneCast: true });
    assert.ok(after.meanUniqueTargets >= before.meanUniqueTargets * 1.25, `${before.meanUniqueTargets} -> ${after.meanUniqueTargets}`);
    assert.ok(after.meanKills > before.meanKills);
});

for (const scene of ['dense', 'spread', 'moving']) test(`Plague mid ${scene} improves equal-budget finite clear time by at least 15%`, () => {
    const { before, after } = paired('plague', 'mid', scene, { route: true });
    assert.equal(after.cleared, after.runs);
    assert.ok(after.meanClearTime < before.meanClearTime * .85, `${before.meanClearTime} -> ${after.meanClearTime}`);
});

for (const id of ['molotov', 'gas']) for (const phase of WAVE_PHASES) {
    test(`${id} ${phase} improves real moving-wave clear time`, () => {
        const { before, after } = paired(id, phase, 'moving');
        assert.equal(after.cleared, after.runs);
        assert.ok(after.meanClearTime < before.meanClearTime, `${before.meanClearTime} -> ${after.meanClearTime}`);
        assert.ok(after.peakFields <= (id === 'gas' ? 6 : 40), 'unchanged finite field/fade/trail budget');
    });
}

test('modest sword growth helps the real Butcher route without changing its melee cadence', () => {
    const { before, after } = paired('butcher', 'mid', 'moving', { route: true });
    assert.ok(after.meanClearTime < before.meanClearTime * .9);
    assert.equal(WEAPONS.sword.base.cd, baseline.weapons.sword.base.cd);
    assert.ok(WEAPONS.sword.base.radius <= 110);
    assert.equal(WEAPONS.sword.base.amount, 1);
});

test('consumable thorns clears the moving finite wave within its measured charge budget', () => {
    // User explicitly replaced continuous ticking with single-use/regrowing
    // petals. Its early/mid burst-versus-sustain tradeoff is reported separately,
    // not concealed by comparing old damage under the new runtime.
    const after = summarizeWaves([1, 7, 13].map(seed => runFiniteWave({ id: 'thorns', phase: 'mid', scene: 'moving', seed })));
    assert.equal(after.cleared, 3); assert.ok(after.meanClearTime <= 30);
    assert.equal(WEAPONS.thorns.base.radius, 68);
    assert.equal(WEAPONS.thorns.base.dmg, 54); assert.equal(WEAPONS.thorns.base.regrow, 1.6);
    assert.equal(WEAPONS.saw.base.hitCd, baseline.weapons.saw.base.hitCd);
    assert.equal(SAW_VISUAL_CAP, 6); assert.equal(ORBIT_VISUAL_CAP, 8);
});

for (const tech of ['gunline', 'executioner']) test(`${tech} actual moving-wave control is unchanged`, () => {
    const { before, after } = paired(tech, 'mid', 'moving', { route: true });
    assert.deepEqual(after, before);
});
