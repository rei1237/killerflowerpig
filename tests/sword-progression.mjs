import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats, activeWeaponCores } from '../src/game/weapons.js';
import { resetBuild, applyChoice, rollChoices, snapshotBuild, restoreBuild, evolvable, rollChest, isConsumedMaterial } from '../src/game/progression.js';
import { previewFusion, fuseItems } from '../src/game/fusion.js';
import { isFamilyItem, resonanceCount, resonanceTier } from '../src/game/tech.js';
import { newRun, continueRun, loadRun, startStage } from '../src/game/game.js';
import { WEAPONS, MAX_WEAPONS, TIER_POWER } from '../src/data/weapons.js';
import { TECHS, WEAPON_TAGS, techStartingWeapons } from '../src/data/techs.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';
import { save } from '../src/core/save.js';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
};
globalThis.window = { matchMedia: () => ({ matches: false }) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { hardwareConcurrency: 8 } });
beforeEach(() => {
    storage.clear(); resetBuild(); clearWorld();
    save.upgrades = {}; save.equippedPet = null; save.equippedCosmetics = {};
    Object.assign(G, { mode: 'play', stage: 1, clock: 1, events: {}, caps: { particles: 0, texts: 0 }, gold: 0 });
    createPlayer(); recomputeStats();
});
const inventory = () => G.weapons.map(w => [w.id, w.level, w.evolved, w.slot]);
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} != ${expected}`);
function twoParents(level = 8, evolved = true) {
    G.weapons = ['sword', 'saw'].map((id, slot) => Object.assign(createWeapon(id, slot), { level, evolved }));
    G.passives = { whet: 1 }; recomputeStats();
}

test('sword has eight real growth levels, a defined evolution and an ordinary weapon slot', () => {
    assert.equal(WEAPONS.sword.fusionOnly, undefined);
    assert.equal(WEAPONS.sword.levels.length, 7);
    assert.equal(WEAPONS.sword.evolve.with, 'whet');
    assert.equal(WEAPONS.sword.evolve.name, '핏빛 연꽃검');
    const expected = [
        // 무기 밸런스: 기본 베기 피해 28 → 19, Lv2 +8 → +12 (진화 보정 TIER_POWER.evolved.sword 로 후반 유지)
        [19, .95, 1], [31, .95, 1], [31, .874, 1], [31, .874, 1.15],
        [41, .874, 1.15], [41, .798, 1.15], [53, .798, 1.15], [53, .722, 1.30],
    ];
    for (let level = 1; level <= 8; level++) {
        const stats = weaponStats(Object.assign(createWeapon('sword', 0), { level }));
        near(stats.dmg, expected[level - 1][0]); near(stats.cd, expected[level - 1][1]); near(stats.area, expected[level - 1][2]);
        assert.equal(stats.radius, 110); assert.equal(stats.amount, 1);
    }
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 1 }), true);
    assert.deepEqual(inventory(), [['sword', 1, false, 0]]);
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 1 }), false);
});

test('every tech may roll and acquire sword, while the fused output is never an ordinary new card', () => {
    for (const tech of Object.keys(TECHS)) {
        resetBuild(); G.tech = tech; G.weapons = [createWeapon('rifle', 0)];
        const choices = rollChoices(99);
        const sword = choices.find(choice => choice.id === 'sword');
        assert.ok(sword?.isNew, tech); assert.equal(sword.level, 1);
        assert.ok(!choices.some(choice => choice.id === 'sword_wheel'), tech);
        assert.equal(applyChoice(sword), true);
        assert.equal(G.weapons.length, 2);
        assert.equal(applyChoice({ kind: 'weapon', id: 'sword_wheel', level: 1 }), false);
    }
});

test('sword obeys the same six-slot capacity and incremental upgrade rules as every weapon', () => {
    G.weapons = ['shotgun', 'pistols', 'rifle', 'thorns', 'gas', 'saw'].map(createWeapon);
    assert.equal(G.weapons.length, MAX_WEAPONS);
    assert.ok(!rollChoices(99).some(choice => choice.id === 'sword'));
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 1 }), false);
    G.weapons.pop();
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 1 }), true);
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 3 }), false);
    for (let level = 2; level <= 8; level++) assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level }), true);
    assert.equal(applyChoice({ kind: 'weapon', id: 'sword', level: 9 }), false);
});

test('whet unlocks both sword and saw evolution only at Lv8; the real chest performs each evolution', () => {
    twoParents(7, false);
    assert.deepEqual(evolvable(), []);
    for (const id of ['sword', 'saw']) applyChoice({ kind: 'weapon', id, level: 8 });
    G.passives = {}; assert.deepEqual(evolvable(), []);
    applyChoice({ kind: 'passive', id: 'whet', level: 1 });
    assert.deepEqual(evolvable().map(w => w.id), ['sword', 'saw']);
    assert.equal(previewFusion('sword_wheel').code, 'EVOLUTION_REQUIRED');
    assert.deepEqual(rollChest(1, () => 0).map(reward => [reward.kind, reward.id]), [['evolve', 'sword']]);
    assert.equal(previewFusion('sword_wheel').code, 'EVOLUTION_REQUIRED');
    assert.deepEqual(rollChest(1, () => 0).map(reward => [reward.kind, reward.id]), [['evolve', 'saw']]);
    assert.equal(previewFusion('sword_wheel').ok, true);
});

test('sword evolution applies its explicit damage, cadence, area and bleed exactly once', () => {
    const w = Object.assign(createWeapon('sword', 0), { level: 8 }), normal = weaponStats(w);
    w.evolved = true; const evolved = weaponStats(w);
    near(evolved.dmg / normal.dmg, 1.55 * 1.35 * TIER_POWER.evolved.sword);
    near(evolved.cd / normal.cd, .82);
    near(evolved.area / normal.area, 1.25);
    assert.equal(evolved.bleed, 4);
});

test('sword final requires both evolved Lv8 ingredients and fuses atomically from two slots to one', () => {
    twoParents(7, true);
    assert.equal(previewFusion('sword_wheel').code, 'ITEM_LEVEL_REQUIRED');
    for (const w of G.weapons) w.level = 8;
    G.weapons[1].evolved = false;
    const before = JSON.stringify(snapshotBuild());
    assert.equal(fuseItems('sword_wheel', '').code, 'EVOLUTION_REQUIRED');
    assert.equal(JSON.stringify(snapshotBuild()), before);
    G.weapons[1].evolved = true;
    const preview = previewFusion('sword_wheel');
    assert.equal(preview.output.name, '학살자의 검륜');
    assert.equal(preview.slotsFreed, 1); assert.equal(preview.slotsAfter, 1);
    assert.ok(preview.ingredients.every(item => item.requiredLevel === 8 && item.requiredEvolution));
    assert.deepEqual(preview.output.stats.inheritedCores.map(core => core.id), ['sword', 'saw']);
    assert.equal(fuseItems('sword_wheel', preview.signature).ok, true);
    assert.deepEqual(inventory(), [['sword_wheel', 1, false, 0]]);
    assert.equal(fuseItems('sword_wheel', preview.signature).code, 'ALREADY_FUSED');
    assert.deepEqual(activeWeaponCores().map(core => [core.id, core.sourceId || null]), [['sword_wheel', null], ['sword', 'sword_wheel'], ['saw', 'sword_wheel']]);
    assert.ok(isConsumedMaterial('sword') && isConsumedMaterial('saw'));
    assert.ok(!rollChoices(99).some(choice => ['sword', 'saw'].includes(choice.id)));
});

test('actual new Butcher run grants exactly sword+saw Lv1+whet Lv1, with three resonance points', () => {
    newRun(1, 'butcher');
    assert.deepEqual(techStartingWeapons(TECHS.butcher), ['sword', 'saw']);
    assert.deepEqual(inventory(), [['sword', 1, false, 0], ['saw', 1, false, 1]]);
    assert.deepEqual(G.passives, { whet: 1 });
    assert.equal(resonanceCount(), 3); assert.equal(resonanceTier(), 1);
    assert.ok(isFamilyItem('sword') && isFamilyItem('sword_wheel'));
    assert.deepEqual(WEAPON_TAGS.sword, ['blade']);
    applyChoice({ kind: 'weapon', id: 'sword', level: 2 });
    startStage(2); startStage(3);
    assert.deepEqual(inventory(), [['sword', 2, false, 0], ['saw', 1, false, 1]]);
    newRun(5, 'butcher');
    assert.deepEqual(inventory(), [['sword', 1, false, 0], ['saw', 1, false, 1]]);
    assert.deepEqual(G.passives, { whet: 1 });
});

test('old saw-only checkpoints and new sword/fused checkpoints restore exactly without starter injection', () => {
    newRun(1, 'butcher');
    const current = loadRun();
    const builds = [
        { weapons: [{ id: 'saw', level: 4, evolved: false }], passives: { whet: 2 } },
        { weapons: [{ id: 'sword', level: 6, evolved: false }, { id: 'saw', level: 3, evolved: false }], passives: { whet: 2, hide: 1 } },
        { weapons: [{ id: 'sword', level: 8, evolved: true }, { id: 'saw', level: 8, evolved: true }], passives: { whet: 3 } },
        { weapons: [{ id: 'sword_wheel', level: 4, evolved: false }], passives: { whet: 3 }, consumedItems: ['sword', 'saw'] },
    ];
    for (const build of builds) {
        const checkpoint = { ...current, ...build };
        for (let attempt = 0; attempt < 2; attempt++) {
            assert.equal(continueRun(checkpoint), true);
            assert.deepEqual(snapshotBuild().weapons, build.weapons);
            assert.deepEqual(G.passives, build.passives);
        }
        const snap = snapshotBuild(); resetBuild(); restoreBuild(snap);
        assert.deepEqual(snapshotBuild().weapons, build.weapons);
        if (build.consumedItems) assert.deepEqual([...G.consumedItems], build.consumedItems);
    }
});

test('new sword affinity preserves all old Butcher weapons and all five absolute recipes', () => {
    assert.deepEqual(TECHS.butcher.family.weapons, ['sword', 'saw', 'shotgun', 'thorns']);
    const actual = Object.fromEntries(FUSION_RECIPES.filter(recipe => recipe.tier === 'absolute').map(recipe => [recipe.id, recipe.inputs.map(input => input.id)]));
    assert.deepEqual(actual, {
        absolute_bloom: ['cannon', 'thorns', 'molotov'], doom_barrage: ['shotgun', 'rifle', 'pistols'],
        plague_end: ['molotov', 'gas', 'cannon'], guillotine: ['pistols', 'rifle', 'saw'], carnage_saw: ['saw', 'shotgun', 'thorns'],
    });
});
