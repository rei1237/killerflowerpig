import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProgress, validateProgress, purchase, createGuestAdapter, createServerAdapter, LEGACY_KEY, SAVE_VERSION } from '../src/core/progression-store.js';
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; };
const funded = () => ({ ...defaultProgress(), gold: 500, maxClearedStage: 10 });
const buy = (s, itemId = 'maxHp', expectedLevel = 0, requestId = 'test-1') => purchase(s, { itemId, expectedLevel, requestId });
test('legacy migration preserves currency, upgrades, records and source backup', () => {
    const storage = memory(); const legacy = { gold: 223, upgrades: { might: 2 }, kills: 120, maxStage: 4, seenStory: { intro: true } };
    storage.setItem(LEGACY_KEY, JSON.stringify(legacy)); const a = createGuestAdapter(storage); const s = a.load();
    assert.equal(s.gold, 223); assert.equal(s.upgrades.might, 2); assert.equal(s.kills, 120); assert.equal(s.version, SAVE_VERSION); assert.equal(s.seenStory.intro, true);
    assert.equal(a.commit(s).ok, true); assert.deepEqual(JSON.parse(storage.getItem(LEGACY_KEY)), legacy); assert.deepEqual(a.load(), s);
});
test('invalid fields are clamped or rejected without prototype pollution', () => {
    const s = validateProgress(JSON.parse('{"gold":-12,"kills":"999","upgrades":{"maxHp":99,"evil":8},"inventory":["pet_yeongnyang","evil"],"equippedPet":"evil"}'));
    assert.equal(s.gold, 0); assert.equal(s.kills, 0); assert.equal(s.upgrades.maxHp, 5); assert.equal(s.upgrades.evil, undefined); assert.equal(s.equippedPet, null);
});
test('purchases are immutable, level-checked and idempotent', () => {
    const s = funded(); const r = buy(s); assert.equal(r.ok, true); assert.equal(s.gold, 500); assert.equal(r.state.gold, 400);
    const repeated = buy(r.state); assert.equal(repeated.duplicate, true); assert.equal(repeated.state.gold, 400);
    assert.equal(buy(r.state, 'maxHp', 0, 'other').code, 'STALE_LEVEL');
    assert.equal(buy(defaultProgress()).code, 'INSUFFICIENT_FUNDS');
    assert.equal(buy(s, 'invented').code, 'UNKNOWN_ITEM');
});
test('pet ownership and active choice survive reload; second purchase cannot charge', () => {
    const r = buy({ ...funded(), gold: 600 }, 'pet_yeongnyang'); assert.equal(r.state.gold, 0); assert.equal(r.state.equippedPet, 'pet_yeongnyang');
    const a = createGuestAdapter(memory()); a.commit(r.state); const s = a.load(); assert.deepEqual(s.inventory, ['pet_yeongnyang']);
    assert.equal(buy(s, 'pet_yeongnyang', 1, 'second').code, 'MAX_LEVEL');
});
test('future or corrupt save is never overwritten, failed storage does not report success', () => {
    for (const raw of ['{bad json', '{"version":99,"gold":300}']) {
        const storage = memory(); const a = createGuestAdapter(storage); storage.setItem(a.key, raw); a.load(); assert.equal(a.commit(funded()).ok, false); assert.equal(storage.getItem(a.key), raw);
    }
    const a = createGuestAdapter({ getItem: () => null, setItem: () => { throw Error('quota'); } }); a.load(); assert.equal(a.commit(funded()).ok, false);
});
test('guest profile namespaces stay separate and do not import another profile legacy', () => {
    const storage = memory(); storage.setItem(LEGACY_KEY, '{"gold":100}'); const a = createGuestAdapter(storage, { profile: 'alice' }); const b = createGuestAdapter(storage, { profile: 'bob' });
    a.commit(funded()); assert.equal(a.load().gold, 500); assert.equal(b.load().gold, 0);
});
test('server contract sends intent only with cookie identity and rejects conflicts', async () => {
    let seen;
    const a = createServerAdapter({ baseUrl: '/api/kfp', fetchImpl: async (...args) => { seen = args; return { ok: true, json: async () => ({ state: funded() }) }; } });
    await a.buy({ itemId: 'maxHp', expectedRevision: 3, requestId: 'unique' });
    assert.equal(seen[0], '/api/kfp/purchases'); assert.equal(seen[1].credentials, 'same-origin');
    const body = JSON.parse(seen[1].body); assert.equal(body.gold, undefined); assert.equal(body.accountId, undefined); assert.equal(body.expectedRevision, 3);
    assert.throws(() => createServerAdapter({ baseUrl: 'https://other.example' }));
    const conflict = createServerAdapter({ baseUrl: '/api', fetchImpl: async () => ({ ok: false, status: 409 }) });
    await assert.rejects(conflict.load(), /REVISION_CONFLICT/);
});
test('save facade does not charge twice or change state on failed disk write', async () => {
    const storage = memory(); globalThis.localStorage = storage;
    const api = await import('../src/core/save.js');
    api.save.maxClearedStage = 10;
    assert.equal(api.earnCoins(500, 'reward-1'), true); api.earnCoins(500, 'reward-1'); assert.equal(api.save.gold, 500);
    assert.equal(api.buyUpgrade('maxHp', 0), true); assert.equal(api.buyUpgrade('maxHp', 0), true); assert.equal(api.save.gold, 400);
    storage.setItem = () => { throw Error('full'); };
    assert.equal(api.buyUpgrade('maxHp', 1), false); assert.equal(api.save.gold, 400); assert.equal(api.upgradeLevel('maxHp'), 1);
    assert.equal(api.equipPet('pet_yeongnyang'), false);
});
test('another tab revision change prevents overwriting its progress', () => {
    const storage = memory(); const a = createGuestAdapter(storage), b = createGuestAdapter(storage);
    a.load(); b.load(); a.commit(funded());
    assert.equal(b.commit(defaultProgress()).code, 'REVISION_CONFLICT'); assert.equal(a.load().gold, 500);
});
