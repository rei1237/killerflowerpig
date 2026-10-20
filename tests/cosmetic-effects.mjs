// Run: node --test tests/cosmetic-effects.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
let failWrite = false;
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { if (failWrite) throw new Error('quota'); storage.set(key, String(value)); },
    removeItem: key => storage.delete(key),
};
globalThis.window = { matchMedia: () => ({ matches: false }) };
const api = await import('../src/core/save.js');
const { defaultProgress, validateProgress, createGuestAdapter } = await import('../src/core/progression-store.js');
const { COSMETICS } = await import('../src/data/cosmetics.js');
const { MAX_MOVE_SPEED } = await import('../src/data/relics.js');
const { G, clearWorld, configureCaps } = await import('../src/game/state.js');
const { createPlayer, recomputeStats, updatePlayer, damagePlayer } = await import('../src/game/player.js');
const { activeOutfit, outfitStats, incomingOutfitDamage, CAPE_SPEED_MULTIPLIER, CAPE_PICKUP_MULTIPLIER, JADE_DAMAGE_MULTIPLIER, MAX_PICKUP_MULTIPLIER } = await import('../src/game/cosmetic-effects.js');
const { dropGem, dropCoin, dropPickup, updatePickups } = await import('../src/game/pickups.js');
const { newRun, continueRun, loadRun } = await import('../src/game/game.js');
const { input } = await import('../src/core/input.js');

const CAPE = 'dusk_lotus_cape', JADE = 'jade_lotus_guard', HALO = 'dawn_petal_halo';
const owns = outfit => ({ cosmeticInventory: [CAPE, JADE, HALO], equippedCosmetics: { outfit, ornament: HALO } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);
function seed(appearance = owns(null), extra = {}) {
    failWrite = false;
    storage.clear();
    Object.assign(api.save, defaultProgress(), { gold: 10000, maxClearedStage: 10, maxStage: 10 }, appearance, extra);
    assert.equal(api.persist(), true);
    configureCaps();
    clearWorld();
    G.passives = {}; G.tech = null; G.weapons = []; G.events = {};
    G.clock = 20; G.mode = 'play'; G.paused = false; G.godMode = false;
    G.view = { w: 1000, h: 600 };
    input.move.x = input.move.y = 0;
    createPlayer();
}
test.beforeEach(() => seed());

test('catalog Korean descriptions expose the exact bounded effects and visual-only ornament', () => {
    assert.equal(CAPE_SPEED_MULTIPLIER, 1.04);
    assert.equal(CAPE_PICKUP_MULTIPLIER, 1.08);
    assert.equal(JADE_DAMAGE_MULTIPLIER, 0.95);
    assert.equal(MAX_PICKUP_MULTIPLIER, 1.25);
    assert.match(COSMETICS[0].effectDesc, /이동 속도 \+4%.*경험치·코인 수집 범위 \+8%.*상한/);
    assert.match(COSMETICS[1].effectDesc, /받는 피해 5% 감소.*최소 피해 1/);
    assert.match(COSMETICS[2].effectDesc, /외형 장식.*능력치 변화 없음/);
});

test('effects require a recognized, owned outfit in its own slot', () => {
    const base = { speed: 135, magnet: 70, might: 1, maxHp: 100 };
    const plain = outfitStats(base, {});
    for (const state of [
        null, {}, { cosmeticInventory: [], equippedCosmetics: { outfit: CAPE } },
        { cosmeticInventory: [CAPE], equippedCosmetics: { outfit: JADE } },
        { cosmeticInventory: [HALO], equippedCosmetics: { outfit: HALO } },
        { cosmeticInventory: [CAPE], equippedCosmetics: { ornament: CAPE } },
        { cosmeticInventory: 'dusk_lotus_cape', equippedCosmetics: { outfit: CAPE } },
        { cosmeticInventory: ['unknown'], equippedCosmetics: { outfit: 'unknown' } },
    ]) {
        assert.equal(activeOutfit(state), null);
        assert.deepEqual(outfitStats(base, state), plain);
    }
    assert.equal(activeOutfit(owns(CAPE)), COSMETICS[0]);
    assert.deepEqual(base, { speed: 135, magnet: 70, might: 1, maxHp: 100 });
});

test('outfit stat derivation changes only its utility fields and never the input object', () => {
    const base = { speed: 135, magnet: 70, might: 1.7, maxHp: 140, regen: 0.6, armor: 2, crit: .2, cooldown: .9, amount: 3, area: 1.3, duration: 1, projSpeed: 1.2, pierce: 1 };
    const before = structuredClone(base);
    const cape = outfitStats(base, owns(CAPE));
    assert.deepEqual(cape, { ...base, speed: 140.4, pickupMultiplier: 1.08 });
    assert.deepEqual(outfitStats(base, owns(JADE)), { ...base, outfitDamageMultiplier: .95 });
    assert.deepEqual(outfitStats(base, owns(null)), base);
    assert.deepEqual(base, before);
});

test('cape respects existing movement and collection caps with relics/passives/accessories', () => {
    const capped = outfitStats({ speed: 240, pickupMultiplier: 1.25 }, owns(CAPE));
    assert.equal(capped.speed, MAX_MOVE_SPEED);
    assert.equal(capped.pickupMultiplier, MAX_PICKUP_MULTIPLIER);
    seed(owns(CAPE), { relics: ['star_wings'], upgrades: { speed: 3 }, accessoryInventory: ['comet_boots', 'pollen_lantern'], equippedAccessory: 'comet_boots' });
    G.passives = { madness: 5 };
    recomputeStats();
    assert.equal(G.player.stats.speed, 243);
    api.save.equippedAccessory = 'pollen_lantern';
    recomputeStats();
    assert.equal(G.player.stats.pickupMultiplier, 1.25);
    const stats = structuredClone(G.player.stats);
    for (let i = 0; i < 20; i++) recomputeStats();
    assert.deepEqual(G.player.stats, stats);
});

test('durable active/paused equip switches immediately, never stack, and cannot heal', () => {
    const original = structuredClone(G.player.stats);
    G.player.hp = 37;
    G.paused = true;
    for (const mode of ['play', 'boss', 'clearing']) {
        G.mode = mode;
        for (const outfit of [CAPE, CAPE, JADE, null, CAPE, null]) {
            assert.equal(api.setCosmetic('outfit', outfit).ok, true);
            close(G.player.stats.speed, outfit === CAPE ? 140.4 : 135);
            assert.equal(G.player.stats.outfitDamageMultiplier, outfit === JADE ? .95 : undefined);
            assert.equal(G.player.maxHp, 100);
            assert.equal(G.player.hp, 37);
            assert.equal(G.player.radius, 10);
            const expected = structuredClone(G.player.stats);
            recomputeStats(); recomputeStats();
            assert.deepEqual(G.player.stats, expected);
            assert.equal(G.player.hp, 37);
        }
    }
    assert.deepEqual(G.player.stats, original);
    assert.equal(api.save.gold, 10000);
});

test('failed purchase/equip, stale revision, and duplicate purchase never change live bonuses or HP', () => {
    seed({ cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null } });
    G.player.hp = 37;
    const before = structuredClone(G.player);
    failWrite = true;
    assert.equal(api.buyCosmetic(CAPE).code, 'STORAGE_UNAVAILABLE');
    assert.deepEqual(G.player, before);
    assert.equal(api.save.gold, 10000);
    failWrite = false;
    assert.equal(api.buyCosmetic(CAPE).ok, true);
    close(G.player.stats.speed, 140.4);
    assert.equal(G.player.hp, 37);
    assert.equal(api.save.gold, 8920);
    assert.equal(api.setCosmetic('outfit', JADE).code, 'NOT_OWNED');
    assert.equal(api.setCosmetic('outfit', null, 0).code, 'REVISION_CONFLICT');
    failWrite = true;
    assert.equal(api.setCosmetic('outfit', null).code, 'STORAGE_UNAVAILABLE');
    close(G.player.stats.speed, 140.4);
    failWrite = false;
    assert.equal(api.setCosmetic('outfit', null).ok, true);
    assert.equal(api.buyCosmetic(CAPE, 0).duplicate, true);
    assert.equal(api.save.equippedCosmetics.outfit, null);
    assert.equal(G.player.stats.speed, 135);
    assert.equal(G.player.hp, 37);
    assert.equal(api.save.gold, 8920);
});

test('ornament equip does not refresh stats and fresh frame reconciliation handles replaced saves', () => {
    const stats = G.player.stats;
    assert.equal(api.setCosmetic('ornament', null).ok, true);
    assert.equal(G.player.stats, stats);
    assert.equal(api.setCosmetic('ornament', HALO).ok, true);
    assert.equal(G.player.stats, stats);
    G.player.hp = 37;
    Object.assign(api.save, owns(CAPE));
    updatePlayer(0);
    close(G.player.stats.speed, 140.4);
    assert.equal(G.player.hp, 37);
    Object.assign(api.save, owns(null));
    updatePlayer(0);
    assert.equal(G.player.stats.speed, 135);
    assert.equal(G.player.hp, 37);
});

test('cape changes actual movement distance by four percent without altering collision radius', () => {
    input.move.x = 1;
    updatePlayer(.1);
    const ordinary = G.player.x;
    assert.equal(api.setCosmetic('outfit', CAPE).ok, true);
    G.player.x = 0;
    updatePlayer(.1);
    close(G.player.x, ordinary * 1.04);
    assert.equal(G.player.radius, 10);
    assert.equal(api.setCosmetic('outfit', null).ok, true);
    G.player.x = 0;
    updatePlayer(.1);
    close(G.player.x, ordinary);
});

test('cape extends actual XP/coin attraction only, and unequip removes the extra range', () => {
    const probe = () => {
        clearWorld();
        dropGem(88, -14, 1);
        const gem = G.gems.items[0]; gem.x = 88; gem.y = -14;
        const coin = dropCoin(110, -14, 3);
        const chest = dropPickup('chest', 44, -14);
        const bomb = dropPickup('bomb', 44, -14);
        const meat = dropPickup('meat', 44, -14);
        G.player.hp = 37;
        updatePickups(.001);
        return [gem.pull, coin.pull, chest.pull, bomb.pull, meat.pull];
    };
    assert.deepEqual(probe(), [false, false, false, false, false]);
    assert.equal(api.setCosmetic('outfit', CAPE).ok, true);
    assert.deepEqual(probe(), [true, true, false, false, false]);
    assert.equal(G.player.stats.magnet, 70);
    assert.equal(api.setCosmetic('outfit', null).ok, true);
    assert.deepEqual(probe(), [false, false, false, false, false]);
});

test('jade incoming damage preserves five-percent floating reduction after armor and minimum one', () => {
    const cases = [
        [1, 0, 1, 1], [5, 0, 5, 4.75], [10, 0, 10, 9.5], [20, 0, 20, 19],
        [1, 3, 1, 1], [5, 3, 2, 1.9], [10, 3, 7, 6.65], [20, 3, 17, 16.15],
        [20, 19, 1, 1], [20, 30, 1, 1],
    ];
    for (const [amount, armor, plain, guarded] of cases) {
        close(incomingOutfitDamage(amount, armor), plain);
        close(incomingOutfitDamage(amount, armor, .95), guarded);
    }
    assert.equal(incomingOutfitDamage(20, 0, -5), 19);
    assert.equal(incomingOutfitDamage(20, 0, NaN), 20);
    assert.equal(incomingOutfitDamage(20, 0, Infinity), 20);
    assert.equal(incomingOutfitDamage(20, 0, 8), 20);
});

test('real player damage uses jade mitigation and records a clock-based defensive accent', () => {
    for (const armor of [0, 3]) for (const amount of [1, 5, 10, 20]) for (const outfit of [null, JADE]) {
        assert.equal(api.setCosmetic('outfit', outfit).ok, true);
        const p = G.player;
        p.hp = 100; p.iframes = 0; p.hurtT = 0; p.barrier = false; p.stats.armor = armor;
        p.outfitGuardHitAt = -Infinity;
        assert.equal(damagePlayer(amount, 20, 20), true);
        close(100 - p.hp, Math.max(1, (amount - armor) * (outfit ? .95 : 1)));
        assert.equal(p.iframes, .5);
        assert.equal(p.outfitGuardHitAt, outfit ? G.clock : -Infinity);
    }
});

test('barrier/iframes/god mode do not consume HP or trigger jade hit accent; lethal floor still kills', () => {
    assert.equal(api.setCosmetic('outfit', JADE).ok, true);
    const p = G.player;
    p.hp = 37; p.barrier = true; p.stats.barrierCd = 12;
    assert.equal(damagePlayer(20, 1, 1), true);
    assert.equal(p.hp, 37); assert.equal(p.barrier, false); assert.equal(p.barrierT, 12);
    assert.equal(p.outfitGuardHitAt, -Infinity);
    assert.equal(damagePlayer(20, 1, 1), false);
    assert.equal(p.hp, 37); assert.equal(p.outfitGuardHitAt, -Infinity);
    p.iframes = 0; G.godMode = true;
    assert.equal(damagePlayer(20, 1, 1), true);
    assert.equal(p.hp, 37); assert.equal(p.outfitGuardHitAt, -Infinity);
    G.godMode = false; p.iframes = 0; p.hp = .5; p.stats.armor = 100;
    assert.equal(damagePlayer(1, 1, 1), true);
    assert.equal(p.hp, 0); assert.equal(p.dead, true);
    assert.equal(damagePlayer(20, 1, 1), false);
});

test('changing away from jade clears its accent without healing or changing accessory/relic bonuses', () => {
    seed(owns(JADE), { accessoryInventory: ['moon_guard'], equippedAccessory: 'moon_guard', relics: ['star_wings'] });
    const base = structuredClone(G.player.stats);
    G.player.hp = 37;
    damagePlayer(20, 1, 1);
    const hurtHP = G.player.hp;
    assert.equal(G.player.outfitGuardHitAt, G.clock);
    assert.equal(api.setCosmetic('outfit', CAPE).ok, true);
    assert.equal(G.player.outfitGuardHitAt, -Infinity);
    assert.equal(G.player.hp, hurtHP);
    assert.equal(G.player.maxHp, 160);
    for (const key of ['might', 'armor', 'maxHp', 'regen', 'cooldown', 'crit', 'amount']) assert.equal(G.player.stats[key], base[key]);
    assert.equal(api.setCosmetic('outfit', JADE).ok, true);
    assert.equal(G.player.hp, hurtHP);
    assert.deepEqual(G.player.stats, base);
});

test('reload and actual run continue rebuild one equipped effect without persisting derived stats', () => {
    seed(owns(CAPE));
    newRun(1);
    close(G.player.stats.speed, 140.4);
    const snapshot = loadRun();
    assert.ok(snapshot);
    assert.equal(snapshot.outfitDamageMultiplier, undefined);
    assert.equal(snapshot.pickupMultiplier, undefined);
    const loaded = createGuestAdapter(localStorage).load();
    assert.equal(loaded.equippedCosmetics.outfit, CAPE);
    assert.equal(loaded.outfitDamageMultiplier, undefined);
    Object.assign(api.save, loaded);
    createPlayer();
    close(G.player.stats.speed, 140.4);
    assert.equal(continueRun(snapshot), true);
    close(G.player.stats.speed, 140.4);
    assert.equal(G.player.hp, 100, 'continue retains the existing stage-start full-heal rule');
    G.player.hp = 37;
    assert.equal(api.setCosmetic('outfit', JADE).ok, true);
    assert.equal(G.player.hp, 37);
    Object.assign(api.save, createGuestAdapter(localStorage).load());
    assert.equal(continueRun(snapshot), true);
    assert.equal(G.player.stats.speed, 135);
    assert.equal(G.player.stats.outfitDamageMultiplier, .95);
    assert.equal(api.setCosmetic('outfit', null).ok, true);
    assert.equal(continueRun(snapshot), true);
    assert.equal(G.player.stats.outfitDamageMultiplier, undefined);
    assert.equal(G.player.stats.pickupMultiplier, undefined);
    assert.equal(validateProgress({ ...api.save, outfitDamageMultiplier: .1, pickupMultiplier: 100 }).outfitDamageMultiplier, undefined);
});
