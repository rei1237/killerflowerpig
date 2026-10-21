import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats } from '../src/game/weapons.js';
import { resetBuild, applyChoice, rollChoices, snapshotBuild, restoreBuild, evolvable, rollChest } from '../src/game/progression.js';
import { resonanceCount, resonanceTier, techChoiceWeight, isFamilyItem } from '../src/game/tech.js';
import { TECHS, WEAPON_TAGS, MISMATCH_DAMAGE, FAMILY_WEIGHT, OFF_FAMILY_NEW_WEAPON_WEIGHT, IMPRINT_LEVELS, techStartingWeapons } from '../src/data/techs.js';
import { WEAPONS, PASSIVES } from '../src/data/weapons.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';
import { previewFusion } from '../src/game/fusion.js';

function startTech(id) {
    resetBuild(); clearWorld();
    G.tech = id;
    createPlayer();
    const t = TECHS[id];
    G.weapons = techStartingWeapons(t).map((weaponId, slot) => createWeapon(weaponId, slot));
    G.passives = { [t.start.passive]: 1 };
    recomputeStats(true);
}
beforeEach(() => { resetBuild(); clearWorld(); createPlayer(); G.mode = 'play'; G.stage = 1; G.events = {}; G.caps = { particles: 0, texts: 0 }; });

test('every tech starts with a real weapon and its evolution partner passive, all inside its family', () => {
    for (const [id, t] of Object.entries(TECHS)) {
        assert.ok(WEAPONS[t.start.weapon] && !WEAPONS[t.start.weapon].fusionOnly, id);
        assert.ok(PASSIVES[t.start.passive], id);
        assert.equal(WEAPONS[t.start.weapon].evolve.with, t.start.passive, `${id}: start passive evolves the start weapon`);
        assert.ok(t.family.weapons.includes(t.start.weapon) && t.family.passives.includes(t.start.passive));
        const starters = techStartingWeapons(t);
        assert.deepEqual(starters, { gunline: ['shotgun', 'rifle'], bloom: ['thorns', 'cannon'], plague: ['molotov', 'gas'], executioner: ['pistols', 'rifle'], butcher: ['sword', 'saw'] }[id]);
        assert.equal(starters.length, 2, `${id}: every tech starts with two weapons`);
        assert.ok(starters.every(w => WEAPONS[w] && !WEAPONS[w].fusionOnly && t.family.weapons.includes(w)), `${id}: starters are family weapons`);
        for (const weaponId of starters) {
            assert.ok(WEAPONS[weaponId] && !WEAPONS[weaponId].fusionOnly && t.family.weapons.includes(weaponId));
            assert.ok(WEAPON_TAGS[weaponId].some(tag => t.tags.includes(tag)), `${id}: ${weaponId} benefits from its own tech`);
        }
        assert.equal(t.family.weapons.length, id === 'butcher' ? 4 : 3); assert.equal(t.family.passives.length, 3);
        assert.equal(t.tiers.length, 3);
        for (const w of t.family.weapons) assert.ok(WEAPON_TAGS[w], `${id}: ${w} tagged`);
        assert.ok(WEAPON_TAGS[t.start.weapon].some(tag => t.tags.includes(tag)), `${id}: start weapon benefits from its own tech`);
    }
    for (const id of Object.keys(WEAPONS)) assert.ok(WEAPON_TAGS[id], `${id} has tags`);
});

test('starting combo opens resonance tier I; tiers II and III need four and six family items', () => {
    startTech('gunline');
    assert.equal(resonanceCount(), 3); assert.equal(resonanceTier(), 1); // 산탄총 + 노획 소총 + 탄창 확장
    applyChoice({ kind: 'passive', id: 'scope', level: 1 });
    assert.equal(resonanceCount(), 4); assert.equal(resonanceTier(), 2);
    applyChoice({ kind: 'weapon', id: 'cannon', level: 1 }); // 다른 계열 무기는 공명에 기여하지 않음
    assert.equal(resonanceCount(), 4);
    applyChoice({ kind: 'weapon', id: 'pistols', level: 1 });
    applyChoice({ kind: 'passive', id: 'focus', level: 1 });
    assert.equal(resonanceCount(), 6); assert.equal(resonanceTier(), 3);
});

test('tech weapon bonus applies only to matching tags and grows with tiers', () => {
    startTech('gunline');
    const shotgunT1 = weaponStats(G.weapons[0]);
    G.tech = null;
    const shotgunNoTech = weaponStats(G.weapons[0]);
    G.tech = 'gunline';
    assert.equal(shotgunT1.amount, shotgunNoTech.amount + 1, 'tier I: projectile +1');
    const cannon = createWeapon('cannon', 1);
    G.weapons.push(cannon);
    const cannonWith = weaponStats(cannon);
    G.tech = null; const cannonWithout = weaponStats(cannon); G.tech = 'gunline';
    assert.ok(Math.abs(cannonWith.dmg - cannonWithout.dmg * MISMATCH_DAMAGE) < 1e-9, 'off-tag weapons suffer the mismatch penalty');
    assert.deepEqual({ ...cannonWith, dmg: 0, beamDamage:0, focusBeamDamage:0, beamAutoImpact:0, beamFocusedImpact:0 }, { ...cannonWithout, dmg: 0, beamDamage:0, focusBeamDamage:0, beamAutoImpact:0, beamFocusedImpact:0 }, 'and receive no tech bonus');
    G.weapons.pop();
    for (const [kind, id] of [['weapon', 'rifle'], ['passive', 'scope'], ['weapon', 'pistols'], ['passive', 'focus']]) applyChoice({ kind, id, level: 1 });
    assert.equal(resonanceTier(), 3);
    const t3 = weaponStats(G.weapons[0]);
    assert.ok(Math.abs(t3.dmg - shotgunT1.dmg * 1.35) < 1e-9, 'tier II+III damage +15% +20%');
    assert.ok(t3.cd < shotgunT1.cd);
    assert.equal(t3.pierce, shotgunT1.pierce + 1 + 1, 'tier II pierce +1 and scope Lv1 pierce +1');
});

test('player-wide tier bonuses (HP, regen, armor, crit multiplier) follow resonance', () => {
    startTech('bloom');
    assert.equal(G.player.maxHp, 100 + 20);
    assert.equal(resonanceCount(), 3);
    assert.equal(resonanceTier(), 1, 'two starter weapons and one passive do not skip tier II');
    applyChoice({ kind: 'passive', id: 'pollen', level: 1 });
    recomputeStats();
    assert.equal(resonanceTier(), 2);
    assert.ok(Math.abs(G.player.stats.regen - (0.3 + 0.5)) < 1e-9);

    startTech('executioner');
    assert.equal(G.player.stats.critMul, 3);
    applyChoice({ kind: 'weapon', id: 'rifle', level: 1 });
    applyChoice({ kind: 'passive', id: 'whet', level: 1 });
    recomputeStats();
    assert.ok(Math.abs(G.player.stats.critMul - 3.6) < 1e-9);

    startTech('butcher');
    for (const [kind, id] of [['weapon', 'shotgun'], ['passive', 'hide']]) applyChoice({ kind, id, level: 1 });
    recomputeStats();
    assert.ok(Math.abs(G.player.stats.armor - (0.6 + 1)) < 1e-9, 'hide Lv1 (0.6) + tier II armor');
    assert.equal(G.player.maxHp, 130);
});

test('bloom starter cannon still needs ordinary upgrades, pollen, chest evolution and evolved fusion partners', () => {
    startTech('bloom');
    assert.deepEqual(G.weapons.map(w => [w.id, w.level, w.evolved, w.slot]), [['thorns', 1, false, 0], ['cannon', 1, false, 1]]);
    assert.deepEqual(G.passives, { regen: 1 });
    assert.deepEqual(evolvable(), []);
    assert.equal(previewFusion('lotus_bloom').code, 'ITEM_LEVEL_REQUIRED');
    assert.equal(previewFusion('absolute_bloom').code, 'MISSING_INGREDIENT');
    for (const id of ['thorns', 'cannon']) {
        assert.equal(applyChoice({ kind: 'weapon', id, level: 1 }), false, 'repeated starter grant cannot upgrade an owned weapon');
        const card = rollChoices(99).find(c => c.id === id);
        assert.equal(card.level, 2); assert.equal(!!card.isNew, false);
        for (let level = 2; level <= 8; level++) assert.equal(applyChoice({ kind: 'weapon', id, level }), true);
    }
    assert.deepEqual(evolvable().map(w => w.id), ['thorns'], 'regen does not replace pollen for the cannon');
    assert.equal(previewFusion('lotus_bloom').code, 'EVOLUTION_REQUIRED');
    assert.equal(rollChest(1, () => 0)[0].id, 'thorns');
    assert.deepEqual(evolvable(), []);
    assert.equal(previewFusion('lotus_bloom').code, 'EVOLUTION_REQUIRED');
    applyChoice({ kind: 'passive', id: 'pollen', level: 1 });
    assert.deepEqual(evolvable().map(w => w.id), ['cannon']);
    assert.equal(previewFusion('lotus_bloom').code, 'EVOLUTION_REQUIRED', 'qualifying for a chest is not itself evolution');
    assert.deepEqual(rollChest(1, () => 0).map(r => [r.kind, r.id]), [['evolve', 'cannon']]);
    assert.equal(previewFusion('lotus_bloom').ok, true);
    assert.equal(previewFusion('absolute_bloom').code, 'MISSING_INGREDIENT', 'absolute fusion still needs the third evolved weapon');
});

test('fused outputs keep the resonance of the family parents they consumed', () => {
    startTech('gunline');
    G.weapons = [createWeapon('scatter_rail', 0)];
    const recipe = FUSION_RECIPES.find(r => r.output === 'scatter_rail');
    assert.ok(recipe.inputs.every(i => TECHS.gunline.family.weapons.includes(i.id)));
    assert.equal(resonanceCount(), 2 + 1, 'two consumed family weapons + magazine');
    assert.ok(isFamilyItem('scatter_rail'));
    assert.ok(!isFamilyItem('plague_fire'));
});

test('level-up weights favour the chosen family and fade off-family new weapons once committed', () => {
    startTech('plague');
    assert.equal(techChoiceWeight({ kind: 'weapon', id: 'gas', isNew: true }), FAMILY_WEIGHT);
    assert.equal(techChoiceWeight({ kind: 'passive', id: 'sap', isNew: true }), FAMILY_WEIGHT);
    assert.equal(techChoiceWeight({ kind: 'weapon', id: 'pistols', isNew: true }), OFF_FAMILY_NEW_WEAPON_WEIGHT);
    assert.equal(techChoiceWeight({ kind: 'passive', id: 'nose', isNew: true }), 1);
    G.tech = null;
    assert.equal(techChoiceWeight({ kind: 'weapon', id: 'pistols', isNew: true }), 1, 'no tech keeps legacy weights');
    G.tech = 'plague';
    const origRandom = Math.random;
    let family = 0, total = 0;
    try {
        let seed = 7; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        for (let i = 0; i < 400; i++) for (const c of rollChoices(3)) { total++; if (isFamilyItem(c.id)) family++; }
    } finally { Math.random = origRandom; }
    assert.ok(family / total > 0.55, `family share ${family / total}`);
});

test('tech survives checkpoint snapshot/restore and resetBuild clears it', () => {
    startTech('butcher');
    const snap = snapshotBuild();
    assert.equal(snap.tech, 'butcher');
    resetBuild();
    assert.equal(G.tech, null);
    restoreBuild(snap);
    assert.equal(G.tech, 'butcher');
    restoreBuild({ ...snap, tech: 'not-a-tech' });
    assert.equal(G.tech, null, 'unknown tech ids are dropped');
});

test('imprints make the same weapon grow in a tech-specific direction at Lv3/5/7', () => {
    const at = (tech, id, level) => { startTech(tech); const w = Object.assign(createWeapon(id, 0), { level }); G.weapons = [w]; G.passives = {}; recomputeStats(); return weaponStats(w); };
    for (const lv of IMPRINT_LEVELS) for (const id of Object.keys(TECHS)) assert.ok(TECHS[id].imprints[lv]?.label, `${id} Lv${lv}`);
    // 산탄총 Lv8: 탄막 사수는 투사체·관통, 도살자는 출혈·피해, 처형자(투사체 태그)는 치명·처형으로 성장
    const gun = at('gunline', 'shotgun', 8), butcher = at('butcher', 'shotgun', 8), exe = at('executioner', 'shotgun', 8);
    G.tech = null; recomputeStats(); const plain = weaponStats(Object.assign(createWeapon('shotgun', 0), { level: 8 }));
    assert.equal(gun.amount, plain.amount + 2); assert.equal(gun.pierce, plain.pierce + 2);
    assert.ok(Math.abs(butcher.dmg - plain.dmg * MISMATCH_DAMAGE) < 1e-9, 'shotgun is off-tag for the butcher (blade/orbit)');
    assert.ok(exe.crit >= 0.16); assert.equal(exe.executeChance, 0, 'shotgun does not inherit the pistol-only execution identity');
    const below = at('gunline', 'shotgun', 2), lv3 = at('gunline', 'shotgun', 3);
    G.tech = null; recomputeStats(); const p2 = weaponStats(Object.assign(createWeapon('shotgun', 0), { level: 2 })), p3 = weaponStats(Object.assign(createWeapon('shotgun', 0), { level: 3 }));
    assert.equal(below.amount - p2.amount, 0); assert.equal(lv3.amount - p3.amount, 1, 'Lv3 imprint adds exactly one projectile');
    // 레벨업 카드에 이번 레벨의 각인이 표시된다
    startTech('gunline'); G.weapons[0].level = 2;
    const card = rollChoices(99).find(c => c.id === 'shotgun');
    assert.match(card.desc, /탄막 각인 I/);
});
