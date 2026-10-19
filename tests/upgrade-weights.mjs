import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/game/state.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../src/data/weapons.js';
import { rollChoices, rollChest, resetBuild } from '../src/game/progression.js';

const weapon = (id, level = 1) => ({ id, level, evolved: false });
function withRandom(random, run) {
    const original = Math.random;
    Math.random = typeof random === 'function' ? random : () => random;
    try { return run(); } finally { Math.random = original; }
}
function allChoices() { return withRandom(0, () => rollChoices(99)); }
function seeded(seed = 123456789) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
}

beforeEach(() => {
    resetBuild();
    G.level = 2;
    G.weapons = [weapon('shotgun')];
});

test('only thorns and core HP/regen choices gain base weight', () => {
    const choices = Object.fromEntries(allChoices().map(c => [c.id, c]));
    assert.equal(choices.thorns.weight, 5); // previously 2
    assert.equal(choices.heart.weight, 2.25); // previously 1.5
    assert.equal(choices.regen.weight, 2.25); // previously 1.5
    assert.equal(choices.shotgun.weight, 3);
    for (const id of Object.keys(WEAPONS).filter(id => !['shotgun', 'thorns'].includes(id) && !WEAPONS[id].fusionOnly)) {
        assert.equal(choices[id].weight, 2);
    }
    for (const id of Object.keys(PASSIVES).filter(id => !['heart', 'regen', 'magazine'].includes(id))) {
        assert.equal(choices[id].weight, 1.5);
    }
    assert.equal(choices.magazine.weight, 3.5); // existing evolution bonus +2
});

test('owned essentials retain their boost and add the unchanged evolution bonus afterward', () => {
    G.weapons.push(weapon('thorns'));
    G.passives = { heart: 1, regen: 2, nose: 1 };
    let choices = Object.fromEntries(allChoices().map(c => [c.id, c]));
    assert.equal(choices.thorns.weight, 6); // previously 3
    assert.equal(choices.heart.weight, 3.75); // previously 2.5
    assert.equal(choices.regen.weight, 5.75); // 3.75 + existing +2
    assert.equal(choices.regen.evoHint, WEAPONS.thorns.evolve.name);
    assert.equal(choices.nose.weight, 2.5);
    G.weapons[1].evolved = true;
    choices = Object.fromEntries(allChoices().map(c => [c.id, c]));
    assert.equal(choices.regen.weight, 3.75);
    assert.equal(choices.regen.evoHint, undefined);
});

test('level 4 guarantees one new thorns option, including rerolls and one-card requests', () => {
    G.level = 4;
    for (const random of [0, 0.17, 0.5, 0.999999]) {
        for (const n of [1, 3, 5]) {
            const choices = withRandom(random, () => rollChoices(n));
            assert.equal(choices.length, n);
            assert.equal(choices.filter(c => c.id === 'thorns').length, 1);
            assert.equal(new Set(choices.map(c => c.id)).size, n);
        }
    }
});

test('early guarantee uses the queued upgrade level, including later-stage starts', () => {
    G.level = 9;
    G.pendingLevelUps = 5;
    assert.equal(withRandom(0, () => rollChoices(1))[0].id, 'thorns');
    G.pendingLevelUps = 6; // processing level 3
    assert.equal(withRandom(0, () => rollChoices(1))[0].id, 'shotgun');
    G.level = 6;
    G.pendingLevelUps = 2; // third choice in a stage-2 start
    assert.equal(withRandom(0, () => rollChoices(1))[0].id, 'thorns');
});

test('the guarantee is bounded to level 4 and never forces owned thorns', () => {
    for (const level of [1, 2, 3, 5, 6, 20]) {
        G.level = level;
        assert.equal(withRandom(0, () => rollChoices(1))[0].id, 'shotgun');
    }
    G.level = 4;
    G.weapons.push(weapon('thorns'));
    assert.equal(withRandom(0, () => rollChoices(1))[0].id, 'shotgun');
});

test('weighted draws preserve unique choices and never mutate the build', () => {
    const before = structuredClone({ weapons: G.weapons, passives: G.passives, banished: G.banished, level: G.level });
    withRandom(seeded(), () => {
        for (let i = 0; i < 1000; i++) {
            const choices = rollChoices();
            assert.equal(choices.length, 3);
            assert.equal(new Set(choices.map(c => c.id)).size, 3);
        }
    });
    assert.deepEqual({ weapons: G.weapons, passives: G.passives, banished: G.banished, level: G.level }, before);
});

test('seeded sampling follows exact weights without starving other choices', () => {
    const weights = Object.fromEntries(allChoices().map(c => [c.id, c.weight]));
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const counts = Object.fromEntries(Object.keys(weights).map(id => [id, 0]));
    const samples = 50000;
    withRandom(seeded(), () => {
        for (let i = 0; i < samples; i++) counts[rollChoices(1)[0].id]++;
    });
    for (const id in weights) {
        assert.ok(Math.abs(counts[id] / samples - weights[id] / totalWeight) < 0.006, `${id}: ${counts[id]}/${samples}`);
        assert.ok(counts[id] > 0);
    }
    assert.ok(counts.thorns > counts.pistols * 2);
    assert.ok(counts.heart > counts.nose * 1.25);
    assert.ok(counts.regen > counts.nose * 1.25);
});

test('full weapon/passive slots exclude new essentials but retain owned upgrades', () => {
    G.level = 4;
    G.weapons = Object.keys(WEAPONS).filter(id => id !== 'thorns').slice(0, MAX_WEAPONS).map(id => weapon(id));
    G.passives = Object.fromEntries(Object.keys(PASSIVES).filter(id => !['heart', 'regen'].includes(id)).slice(0, MAX_PASSIVES).map(id => [id, 1]));
    const choices = allChoices();
    assert.equal(choices.length, MAX_WEAPONS + MAX_PASSIVES);
    assert.ok(choices.every(c => !c.isNew));
    assert.ok(!choices.some(c => ['thorns', 'heart', 'regen'].includes(c.id)));
    G.weapons[1] = weapon('thorns');
    assert.equal(allChoices().find(c => c.id === 'thorns').weight, 6);
});

test('banished essentials are excluded even from the level-4 guarantee', () => {
    G.level = 4;
    G.banished = new Set(['thorns', 'heart', 'regen']);
    assert.ok(!allChoices().some(c => G.banished.has(c.id)));
    G.weapons.push(weapon('thorns'));
    G.passives = { heart: 1, regen: 1 };
    assert.ok(!allChoices().some(c => G.banished.has(c.id)));
});

test('max-level essentials are excluded and exhausted builds keep medical-kit/gold fallback', () => {
    G.level = 4;
    G.weapons = Object.keys(WEAPONS).slice(0, MAX_WEAPONS).map(id => weapon(id, WEAPON_MAX_LEVEL));
    G.passives = { heart: PASSIVE_MAX_LEVEL, regen: PASSIVE_MAX_LEVEL, magazine: PASSIVE_MAX_LEVEL, focus: PASSIVE_MAX_LEVEL, sap: PASSIVE_MAX_LEVEL, scope: PASSIVE_MAX_LEVEL };
    assert.deepEqual(rollChoices().map(c => [c.kind, c.id, c.name]), [
        ['heal', 'meat', '야전 응급 키트'], ['gold', 'gold', '피 묻은 금화'],
    ]);
});

test('combat chest upgrade selection stays uniform despite run-choice weights', () => {
    G.weapons.push(weapon('thorns'));
    const rewards = withRandom(0.49, () => rollChest(1));
    assert.equal(rewards[0].id, 'shotgun');
    assert.equal(G.weapons[0].level, 2);
    assert.equal(G.weapons[1].level, 1);
});
