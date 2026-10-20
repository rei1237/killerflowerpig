import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, COSMETIC_SLOTS } from '../src/data/cosmetics.js';
import { normalizeCosmetics, activeCosmetics, purchaseCosmetic, equipCosmetic, commitCosmeticResult } from '../src/core/cosmetics.js';
import { defaultProgress, validateProgress, createGuestAdapter, LEGACY_KEY } from '../src/core/progression-store.js';
import { accessoryStats } from '../src/core/accessories.js';

const CAPE = 'dusk_lotus_cape', GUARD = 'jade_lotus_guard', HALO = 'dawn_petal_halo';
const memory = () => {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const funded = () => ({
    ...defaultProgress(), gold: 10000, maxClearedStage: 10, maxStage: 10,
    upgrades: { might: 2, maxHp: 3, lotus_gun: 1 }, inventory: ['pet_yeongnyang'], equippedPet: 'pet_yeongnyang',
    accessoryInventory: ['moon_guard'], equippedAccessory: 'moon_guard', relics: ['moon_wings'],
    characterXP: 420, characterRewardCount: 2,
    lastCharacterReward: { requestId: 'xp:1', amount: 200, sequence: 1 },
    titles: ['gunline_first', 'gunline_stage3'], equippedTitle: 'gunline_stage3',
    techStats: { gunline: { runs: 6, best: 4, clears: 3, kills: 220, lastRun: 'run:6' } },
    feats: { deaths: 3, bossKills: 3 }, kills: 340, bestTime: 600, seenStory: { intro: true },
    receipts: ['prior:purchase'], chestPity: 2, chestCount: 3, relicDuplicates: 1,
    lastChest: { itemId: 'moon_wings', requestId: 'prior:chest', duplicate: false, compensation: 0 },
});
const buy = (state, itemId = CAPE, requestId = `buy:${itemId}`) =>
    purchaseCosmetic(state, { itemId, requestId, expectedRevision: state.revision });
const equip = (state, slot, itemId, requestId = `equip:${slot}:${itemId}:${state.revision}`) =>
    equipCosmetic(state, { slot, itemId, requestId, expectedRevision: state.revision });
const originalSystems = state => {
    const { cosmeticInventory, equippedCosmetics, lastCosmeticAction, gold, receipts, revision, ...rest } = state;
    return rest;
};

test('three appearance-only items have stable IDs, independent slots and exact prices/gates', () => {
    assert.deepEqual(COSMETIC_SLOTS, ['outfit', 'ornament']);
    assert.deepEqual(COSMETICS.map(item => item.id), [CAPE, GUARD, HALO]);
    assert.deepEqual(COSMETICS.map(item => item.slot), ['outfit', 'outfit', 'ornament']);
    assert.deepEqual(COSMETICS.map(item => item.price), [1080, 2340, 4800]);
    assert.deepEqual(COSMETICS.map(item => item.unlockStage), [1, 2, 3]);
    for (const item of COSMETICS) {
        assert.match(item.name, /[가-힣]/);
        assert.match(item.desc, /[가-힣]/);
        assert.equal(item.art, `asset/cosmetics/${item.id}-icon.png`);
        if(item.slot==='outfit'){assert.ok(item.bodySprites.normal.startsWith('asset/sprites/'));assert.ok(item.bodySprites.lotus.startsWith('asset/sprites/'));}else assert.equal(item.layerSprite,'asset/sprites/player-halo-layer.png');
        for (const key of ['bonuses', 'stats', 'hp', 'maxHp', 'might', 'speed', 'armor', 'regen']) assert.equal(item[key], undefined);
    }
});

test('all supported old save formats migrate without changing wallet or existing progression', () => {
    const existing = validateProgress(funded());
    const { cosmeticInventory, equippedCosmetics, lastCosmeticAction, ...legacy } = existing;
    for (const version of [undefined, 1, 2, 3, 4, 5]) {
        const migrated = validateProgress({ ...legacy, version });
        assert.deepEqual(migrated, existing);
        assert.deepEqual(migrated.cosmeticInventory, []);
        assert.deepEqual(migrated.equippedCosmetics, { outfit: null, ornament: null });
    }
    for (const key of [LEGACY_KEY, 'kfp.progress.v2.guest', 'kfp.progress.v3.guest', 'kfp.progress.v4.guest', 'kfp.progress.v5.guest']) {
        const storage = memory(), old = JSON.stringify(legacy);
        storage.setItem(key, old);
        const adapter = createGuestAdapter(storage), loaded = adapter.load();
        assert.deepEqual(loaded, existing, key);
        assert.equal(adapter.commit(loaded).ok, true);
        assert.deepEqual(createGuestAdapter(storage).load(), loaded);
        if (key !== adapter.key) assert.equal(storage.getItem(key), old, 'migration preserves source backup');
    }
});

test('normalization deduplicates ownership, rejects wrong slots and drops unknown/prototype keys', () => {
    assert.deepEqual(normalizeCosmetics(), { cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null } });
    assert.deepEqual(normalizeCosmetics(null), normalizeCosmetics());
    const raw = JSON.parse(`{"cosmeticInventory":["${CAPE}","${CAPE}","evil","${HALO}"],"equippedCosmetics":{"outfit":"${CAPE}","ornament":"${HALO}","evil":"${GUARD}","__proto__":{"polluted":true}},"unrecognized":true}`);
    const state = validateProgress(raw);
    assert.deepEqual(state.cosmeticInventory, [CAPE, HALO]);
    assert.deepEqual(state.equippedCosmetics, { outfit: CAPE, ornament: HALO });
    assert.notEqual(state.equippedCosmetics, raw.equippedCosmetics);
    assert.equal(state.unrecognized, undefined);
    assert.equal(Object.prototype.polluted, undefined);
    assert.deepEqual(normalizeCosmetics({ cosmeticInventory: [CAPE, HALO], equippedCosmetics: { outfit: HALO, ornament: CAPE } }).equippedCosmetics, { outfit: null, ornament: null });
    assert.deepEqual(normalizeCosmetics({ cosmeticInventory: [CAPE], equippedCosmetics: { outfit: GUARD, ornament: HALO } }).equippedCosmetics, { outfit: null, ornament: null });
    assert.deepEqual(activeCosmetics(state), { outfit: COSMETICS[0], ornament: COSMETICS[2] });
});

test('purchase is immutable, auto-equips only its slot and preserves all other systems', () => {
    const start = funded(), before = structuredClone(start);
    let state = start;
    for (const item of [CAPE, HALO, GUARD]) {
        const result = buy(state, item);
        assert.equal(result.ok, true);
        assert.notEqual(result.state, state);
        assert.deepEqual(originalSystems(result.state), originalSystems(before));
        state = result.state;
    }
    assert.deepEqual(start, before);
    assert.equal(state.gold, 1780);
    assert.equal(state.revision, 3);
    assert.deepEqual(state.equippedCosmetics, { outfit: GUARD, ornament: HALO });
    assert.deepEqual(state.cosmeticInventory, [CAPE, HALO, GUARD]);
    assert.equal(state.accessoryInventory.length, 1);
    assert.deepEqual(validateProgress(state).equippedCosmetics, state.equippedCosmetics);
});

test('invalid IDs, revisions, request IDs, stage locks and insufficient funds cannot debit', () => {
    const state = funded(), before = structuredClone(state);
    assert.equal(buy(state, 'invented').code, 'INVALID_REQUEST');
    for (const requestId of ['', 4, null, 'x'.repeat(161)]) assert.equal(buy(state, CAPE, requestId).code, 'INVALID_REQUEST');
    for (const expectedRevision of [undefined, -1, 0.5, 1, '0']) {
        assert.equal(purchaseCosmetic(state, { itemId: CAPE, requestId: 'valid', expectedRevision }).code, 'REVISION_CONFLICT');
    }
    for (const item of COSMETICS) {
        assert.equal(buy({ ...state, maxClearedStage: item.unlockStage - 1 }, item.id).code, 'STAGE_LOCKED');
        assert.equal(buy({ ...state, gold: item.price - 1 }, item.id).code, 'INSUFFICIENT_FUNDS');
        assert.equal(buy({ ...state, gold: item.price, maxClearedStage: item.unlockStage }, item.id).state.gold, 0);
    }
    assert.deepEqual(state, before);
});

test('duplicate purchases never charge or re-equip, even with stale revisions or evicted receipts', () => {
    let state = buy(buy(funded(), CAPE).state, GUARD).state;
    const result = purchaseCosmetic(state, { itemId: CAPE, expectedRevision: 0, requestId: `buy:${CAPE}` });
    assert.equal(result.duplicate, true);
    assert.equal(result.state, state);
    assert.equal(result.state.equippedCosmetics.outfit, GUARD);
    state = { ...state, receipts: [] };
    assert.equal(buy(state, CAPE, 'new-request').state.gold, state.gold);
    assert.equal(buy(buy(funded(), CAPE, 'shared-id').state, GUARD, 'shared-id').code, 'USED_REQUEST');
});

test('equip validates slot, ownership and revision while supporting independent equip/unequip', () => {
    let state = funded();
    assert.equal(equip(state, 'weapon', null).code, 'INVALID_REQUEST');
    assert.equal(equip(state, 'outfit', 'unknown').code, 'INVALID_REQUEST');
    assert.equal(equip(state, 'outfit', HALO).code, 'INVALID_SLOT');
    assert.equal(equip(state, 'outfit', CAPE).code, 'NOT_OWNED');
    assert.equal(equipCosmetic(state, { slot: 'outfit', itemId: null, requestId: '', expectedRevision: 0 }).code, 'INVALID_REQUEST');
    for (const item of [CAPE, GUARD, HALO]) state = buy(state, item).state;
    const paidGold = state.gold;
    state = equip(state, 'outfit', CAPE).state;
    assert.deepEqual(state.equippedCosmetics, { outfit: CAPE, ornament: HALO });
    state = equip(state, 'outfit', null).state;
    assert.deepEqual(state.equippedCosmetics, { outfit: null, ornament: HALO });
    state = equip(state, 'ornament', null).state;
    assert.deepEqual(state.equippedCosmetics, { outfit: null, ornament: null });
    assert.equal(equip(state, 'ornament', null).duplicate, true);
    assert.equal(state.gold, paidGold);
    assert.equal(equipCosmetic(state, { slot: 'outfit', itemId: CAPE, requestId: 'stale', expectedRevision: 0 }).code, 'REVISION_CONFLICT');
    assert.deepEqual(originalSystems(state), originalSystems(funded()));
});

test('exact equip retries survive reload and reused intents cannot undo a later selection', () => {
    let state = buy(buy(funded(), CAPE).state, GUARD).state;
    const intent = { slot: 'outfit', itemId: CAPE, expectedRevision: state.revision, requestId: 'equip-original' };
    state = equipCosmetic(state, intent).state;
    const storage = memory(), adapter = createGuestAdapter(storage);
    assert.equal(adapter.commit(state).ok, true);
    state = createGuestAdapter(storage).load();
    assert.equal(equipCosmetic(state, intent).duplicate, true);
    assert.equal(equipCosmetic(state, { ...intent, itemId: null }).code, 'USED_REQUEST');
    state = equip(state, 'outfit', GUARD).state;
    assert.equal(equipCosmetic(state, intent).code, 'USED_REQUEST');
    assert.equal(state.equippedCosmetics.outfit, GUARD);
    assert.equal(state.gold, 6580);
    assert.equal(validateProgress({ ...state, lastCosmeticAction: { ...state.lastCosmeticAction, itemId: HALO } }).lastCosmeticAction, null);
});

test('failed durable purchase/equip commits expose no ownership, wallet or equipped changes', () => {
    const state = funded(), before = structuredClone(state);
    assert.deepEqual(commitCosmeticResult(buy(state), () => false), { ok: false, code: 'STORAGE_UNAVAILABLE' });
    assert.deepEqual(commitCosmeticResult(buy(state), () => ({ ok: false, code: 'REVISION_CONFLICT' })), { ok: false, code: 'REVISION_CONFLICT' });
    assert.deepEqual(state, before);
    const owned = buy(state).state, ownedBefore = structuredClone(owned);
    assert.equal(commitCosmeticResult(equip(owned, 'outfit', null), () => false).code, 'STORAGE_UNAVAILABLE');
    assert.deepEqual(owned, ownedBefore);
    const storage = memory(), first = createGuestAdapter(storage), second = createGuestAdapter(storage);
    const one = first.load(), two = second.load();
    assert.equal(first.commit({ ...one, gold: 2000, maxClearedStage: 3 }).ok, true);
    const stale = buy({ ...two, gold: 2000, maxClearedStage: 3 });
    assert.equal(commitCosmeticResult(stale, next => second.commit(next)).code, 'REVISION_CONFLICT');
    assert.deepEqual(createGuestAdapter(storage).load().cosmeticInventory, []);
});

test('save facade commits purchase/equipment atomically, reloads and preserves errors on failure', async () => {
    const storage = memory(), adapter = createGuestAdapter(storage);
    assert.equal(adapter.commit(funded()).ok, true);
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = storage;
    try {
        const api = await import(`../src/core/save.js?cosmetic-test=${Date.now()}`);
        const original = structuredClone(api.save);
        assert.equal(api.buyCosmetic(CAPE).ok, true);
        assert.equal(api.save.gold, 8920);
        assert.equal(api.save.equippedCosmetics.outfit, CAPE);
        assert.equal(api.buyCosmetic(CAPE, original.revision).duplicate, true);
        assert.equal(api.setCosmetic('outfit', null).ok, true);
        assert.deepEqual(createGuestAdapter(storage).load(), api.save);
        const persisted = structuredClone(api.save);
        const setItem = storage.setItem;
        storage.setItem = () => { throw new Error('quota exceeded'); };
        assert.deepEqual(api.buyCosmetic(GUARD), { ok: false, code: 'STORAGE_UNAVAILABLE' });
        assert.deepEqual(api.save, persisted);
        assert.deepEqual(api.setCosmetic('outfit', CAPE), { ok: false, code: 'STORAGE_UNAVAILABLE' });
        assert.deepEqual(api.save, persisted);
        assert.equal(api.lastSaveError, 'STORAGE_UNAVAILABLE');
        storage.setItem = setItem;
        assert.equal(api.setCosmetic('outfit', CAPE).ok, true);
        assert.equal(api.lastSaveError, null);
        assert.deepEqual(originalSystems(api.save), originalSystems(original));
        const reload = await import(`../src/core/save.js?cosmetic-reload=${Date.now()}`);
        assert.deepEqual(reload.save, api.save);
    } finally {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    }
});

test('cosmetic transactions preserve HP and the independent stat-accessory calculations', () => {
    const state = { ...funded(), hp: 21, maxHp: 140 };
    const base = { maxHp: 100, might: 1, armor: 0, speed: 135, crit: 0, cooldown: 1, area: 1, projSpeed: 1, regen: 0 };
    const stats = accessoryStats(base, state);
    let changed = state;
    for (const item of [CAPE, GUARD, HALO]) changed = buy(changed, item).state;
    for (const itemId of [CAPE, null, GUARD, null, CAPE]) {
        changed = equip(changed, 'outfit', itemId).state;
        assert.equal(changed.hp, 21);
        assert.equal(changed.maxHp, 140);
        assert.deepEqual(accessoryStats(base, changed), stats);
    }
});
