import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats } from '../src/game/weapons.js';
import { resetBuild, applyChoice, rollChoices, snapshotBuild, restoreBuild } from '../src/game/progression.js';
import { resonanceCount, resonanceTier, techChoiceWeight, isFamilyItem } from '../src/game/tech.js';
import { TECHS, WEAPON_TAGS } from '../src/data/techs.js';
import { WEAPONS, PASSIVES } from '../src/data/weapons.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';

function startTech(id) {
    resetBuild(); clearWorld();
    G.tech = id;
    createPlayer();
    const t = TECHS[id];
    G.weapons = [createWeapon(t.start.weapon, 0)];
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
        assert.equal(t.family.weapons.length, 3); assert.equal(t.family.passives.length, 3);
        assert.equal(t.tiers.length, 3);
        for (const w of t.family.weapons) assert.ok(WEAPON_TAGS[w], `${id}: ${w} tagged`);
        assert.ok(WEAPON_TAGS[t.start.weapon].some(tag => t.tags.includes(tag)), `${id}: start weapon benefits from its own tech`);
    }
    for (const id of Object.keys(WEAPONS)) assert.ok(WEAPON_TAGS[id], `${id} has tags`);
});

test('starting combo opens resonance tier I; tiers II and III need four and six family items', () => {
    startTech('gunline');
    assert.equal(resonanceCount(), 2); assert.equal(resonanceTier(), 1);
    applyChoice({ kind: 'weapon', id: 'rifle', level: 1 });
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
    assert.deepEqual(cannonWith, cannonWithout, 'off-tag weapons get nothing');
    G.weapons.pop();
    for (const [kind, id] of [['weapon', 'rifle'], ['passive', 'scope'], ['weapon', 'pistols'], ['passive', 'focus']]) applyChoice({ kind, id, level: 1 });
    assert.equal(resonanceTier(), 3);
    const t3 = weaponStats(G.weapons[0]);
    assert.ok(Math.abs(t3.dmg - shotgunT1.dmg * 1.35) < 1e-9, 'tier II+III damage +15% +20%');
    assert.ok(t3.cd < shotgunT1.cd);
    assert.equal(t3.pierce, shotgunT1.pierce + 1);
});

test('player-wide tier bonuses (HP, regen, armor, crit multiplier) follow resonance', () => {
    startTech('bloom');
    assert.equal(G.player.maxHp, 100 + 20);
    applyChoice({ kind: 'weapon', id: 'cannon', level: 1 });
    applyChoice({ kind: 'passive', id: 'pollen', level: 1 });
    recomputeStats();
    assert.equal(resonanceTier(), 2);
    assert.ok(Math.abs(G.player.stats.regen - (0.3 + 0.5)) < 1e-9);

    startTech('executioner');
    assert.equal(G.player.stats.critMul, 2);
    applyChoice({ kind: 'weapon', id: 'rifle', level: 1 });
    applyChoice({ kind: 'passive', id: 'whet', level: 1 });
    recomputeStats();
    assert.ok(Math.abs(G.player.stats.critMul - 2.6) < 1e-9);

    startTech('butcher');
    for (const [kind, id] of [['weapon', 'shotgun'], ['passive', 'hide']]) applyChoice({ kind, id, level: 1 });
    recomputeStats();
    assert.equal(G.player.stats.armor, 1 + 1, 'hide Lv1 + tier II armor');
    assert.equal(G.player.maxHp, 130);
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
    assert.equal(techChoiceWeight({ kind: 'weapon', id: 'gas', isNew: true }), 1.7);
    assert.equal(techChoiceWeight({ kind: 'passive', id: 'sap', isNew: true }), 1.7);
    assert.equal(techChoiceWeight({ kind: 'weapon', id: 'pistols', isNew: true }), 0.6);
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
    assert.ok(family / total > 0.45, `family share ${family / total}`);
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
