import { shopAccess } from './shop-access.js';
import { RELICS, RELIC_CHEST, rollRelic } from '../data/relics.js';
import { SHOP, CATALOG_VERSION } from '../data/shop.js';
import { CHARACTER_XP_CAP } from './character-progression.js';
export const SAVE_VERSION = 4;
export const LEGACY_KEY = 'kfp.save.v1';
const MAX = 1_000_000_000;
const integer = (v, fallback = 0, max = MAX) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, max) : fallback;
const clone = v => JSON.parse(JSON.stringify(v));
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export function defaultProgress() {
    return { characterXP: 0, characterRewardCount: 0, lastCharacterReward: null, maxClearedStage: 0, version: SAVE_VERSION, revision: 0, catalogVersion: CATALOG_VERSION, gold: 0, upgrades: {}, inventory: [], equippedPet: null, maxStage: 1, bestTime: 0, kills: 0, seenStory: {}, receipts: [], relics: [], chestPity: 0, chestCount: 0, relicDuplicates: 0, lastChest: null };
}
export function validateProgress(raw) {
    if (!object(raw)) throw new Error('INVALID_PROGRESS');
    if (raw.version != null && raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== SAVE_VERSION) throw new Error('UNSUPPORTED_SAVE_VERSION');
    const s = defaultProgress();
    for (const key of ['gold', 'revision', 'kills', 'bestTime']) s[key] = integer(raw[key]);
    s.characterXP = integer(raw.characterXP, 0, CHARACTER_XP_CAP);
    s.characterRewardCount = integer(raw.characterRewardCount);
    s.maxClearedStage = integer(raw.maxClearedStage, Math.max(0, integer(raw.maxStage, 1, 10) - 1), 10);
    if (object(raw.lastCharacterReward) && typeof raw.lastCharacterReward.requestId === 'string' && raw.lastCharacterReward.requestId.length > 0 && raw.lastCharacterReward.requestId.length <= 160 && Number.isSafeInteger(raw.lastCharacterReward.sequence) && raw.lastCharacterReward.sequence === s.characterRewardCount - 1) {
        s.lastCharacterReward = { requestId: raw.lastCharacterReward.requestId, amount: integer(raw.lastCharacterReward.amount, 0, 10000), sequence: raw.lastCharacterReward.sequence };
    }
    s.maxStage = Math.max(1, integer(raw.maxStage, 1, 10));
    for (const item of SHOP.filter(i => i.kind !== 'pet')) {
        const level = integer(raw.upgrades?.[item.id], 0, item.max);
        if (level) s.upgrades[item.id] = level;
    }
    s.inventory = SHOP.filter(i => i.kind === 'pet' && Array.isArray(raw.inventory) && raw.inventory.includes(i.id)).map(i => i.id);
    s.equippedPet = s.inventory.includes(raw.equippedPet) ? raw.equippedPet : null;
    if (object(raw.seenStory)) for (const [k, v] of Object.entries(raw.seenStory)) if (/^[\w-]{1,80}$/.test(k) && v === true) s.seenStory[k] = true;
    s.receipts = Array.isArray(raw.receipts) ? raw.receipts.filter(r => typeof r === 'string' && r.length <= 160).slice(-128) : [];
    s.relics = RELICS.filter(r => Array.isArray(raw.relics) && raw.relics.includes(r.id)).map(r => r.id);
    s.chestPity = integer(raw.chestPity, 0, RELIC_CHEST.pityAt - 1);
    s.chestCount = integer(raw.chestCount);
    s.relicDuplicates = integer(raw.relicDuplicates);
    if (object(raw.lastChest) && RELICS.some(r => r.id === raw.lastChest.itemId) && typeof raw.lastChest.requestId === 'string' && raw.lastChest.requestId.length <= 160) {
        s.lastChest = { itemId: raw.lastChest.itemId, requestId: raw.lastChest.requestId, duplicate: raw.lastChest.duplicate === true, compensation: integer(raw.lastChest.compensation, 0, 90) };
    }
    return s;
}
export function itemLevel(state, id) { return SHOP.find(i => i.id === id)?.kind === 'pet' ? Number(state.inventory.includes(id)) : state.upgrades[id] || 0; }
// Pure transaction: callers commit the returned state only after durable storage succeeds.
export function purchase(state, { itemId, expectedLevel, requestId }) {
    if (typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
    if (state.receipts.includes(requestId)) return { ok: true, duplicate: true, state };
    const item = SHOP.find(i => i.id === itemId);
    if (!item) return { ok: false, code: 'UNKNOWN_ITEM' };
    const level = itemLevel(state, itemId);
    if (level !== expectedLevel) return { ok: false, code: 'STALE_LEVEL' };
    if (level >= item.max) return { ok: false, code: 'MAX_LEVEL' };
    if (!shopAccess(state, item).unlocked) return { ok: false, code: 'STAGE_LOCKED' };
    if (state.gold < item.cost[level]) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    const next = clone(state);
    next.gold -= item.cost[level];
    if (item.kind === 'pet') { next.inventory.push(itemId); next.equippedPet = itemId; }
    else next.upgrades[itemId] = level + 1;
    next.revision++;
    next.receipts = [...next.receipts, requestId].slice(-128);
    return { ok: true, state: next };
}
// One immutable state transition for debit, random reward, compensation and pity.
export function openRelicChest(state, { expectedCount, requestId }, random = Math.random) {
    if (typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
    if (state.lastChest?.requestId === requestId) return { ok: true, duplicate: true, state, reward: state.lastChest };
    if (state.receipts.includes(requestId)) return { ok: false, code: 'USED_REQUEST' };
    if (expectedCount !== state.chestCount) return { ok: false, code: 'STALE_CHEST' };
    if (!shopAccess(state, RELIC_CHEST).unlocked) return { ok: false, code: 'STAGE_LOCKED' };
    if (state.gold < RELIC_CHEST.cost) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    const item = rollRelic(random(), state.chestPity);
    const next = clone(state), duplicate = next.relics.includes(item.id);
    const compensation = duplicate ? item.duplicateCoins : 0;
    next.gold = next.gold - RELIC_CHEST.cost + compensation;
    if (!duplicate) next.relics.push(item.id);
    else next.relicDuplicates++;
    next.chestCount++; next.chestPity = item.tier === 'epic' ? 0 : next.chestPity + 1;
    next.revision++; next.receipts = [...next.receipts, requestId].slice(-128);
    next.lastChest = { itemId: item.id, requestId, duplicate, compensation };
    return { ok: true, state: next, reward: next.lastChest };
}
export function purchaseRelic(state, { itemId, requestId }) {
    if (typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
    const item = RELICS.find(r => r.id === itemId);
    if (!item) return { ok: false, code: 'UNKNOWN_ITEM' };
    if (state.relics.includes(itemId)) return { ok: true, duplicate: true, state };
    if (state.receipts.includes(requestId)) return { ok: false, code: 'USED_REQUEST' };
    if (!shopAccess(state, item).unlocked) return { ok: false, code: 'STAGE_LOCKED' };
    if (state.gold < item.price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    const next = clone(state); next.gold -= item.price; next.relics.push(itemId); next.revision++;
    next.receipts = [...next.receipts, requestId].slice(-128);
    return { ok: true, state: next };
}
export function createGuestAdapter(storage, { profile = 'guest' } = {}) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(profile)) throw new Error('INVALID_PROFILE');
    const key = `kfp.progress.v4.${profile}`;
    let writable = true;
    let storedRevision = 0;
    return {
        mode: 'guest', key,
        load() {
            let raw;
            try { raw = storage?.getItem(key); } catch { writable = false; return defaultProgress(); }
            if (raw) {
                try { const state = validateProgress(JSON.parse(raw)); storedRevision = state.revision; return state; }
                catch { writable = false; return defaultProgress(); } // Never overwrite unknown/corrupt saves.
            }
            try {
                for (const version of [3, 2]) {
                    const previous = storage?.getItem(`kfp.progress.v${version}.${profile}`);
                    if (previous) return validateProgress(JSON.parse(previous));
                }
            } catch { writable = false; return defaultProgress(); }
            if (profile === 'guest') {
                try {
                    const legacy = storage?.getItem(LEGACY_KEY);
                    if (legacy) return validateProgress(JSON.parse(legacy));
                } catch { writable = false; }
            }
            return defaultProgress();
        },
        commit(state) {
            if (!writable || !storage) return { ok: false, code: 'STORAGE_UNAVAILABLE' };
            try {
                const current = storage.getItem(key);
                if (current && JSON.parse(current).revision !== storedRevision) return { ok: false, code: 'REVISION_CONFLICT' };
                const next = validateProgress(state);
                // Also version direct metadata persist() calls, not only economy transactions.
                next.revision = Math.max(storedRevision + 1, next.revision);
                storage.setItem(key, JSON.stringify(next));
                storedRevision = next.revision;
                state.revision = next.revision;
                return { ok: true };
            }
            catch { return { ok: false, code: 'STORAGE_UNAVAILABLE' }; }
        },
    };
}
// Future online seam: session cookies establish account ownership; never send a balance.
// This adapter is deliberately not enabled by the guest game.
export function createServerAdapter({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
    if (typeof baseUrl !== 'string' || !baseUrl.startsWith('/') || baseUrl.startsWith('//')) throw new Error('SAME_ORIGIN_API_REQUIRED');
    const base = baseUrl.replace(/\/$/, '');
    async function request(path, body) {
        const response = await fetchImpl(`${base}${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!response.ok) throw new Error(response.status === 409 ? 'REVISION_CONFLICT' : `PROGRESSION_HTTP_${response.status}`);
        const result = await response.json();
        if (!object(result) || result.state?.version !== SAVE_VERSION || !Number.isSafeInteger(result.state?.gold) || result.state.gold < 0 || !Number.isSafeInteger(result.state?.revision) || result.state.revision < 0) throw new Error('INVALID_SERVER_STATE');
        return validateProgress(result.state);
    }
    const validIntent = ({ expectedRevision, requestId }) => Number.isSafeInteger(expectedRevision) && expectedRevision >= 0 && typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 160;
    return { mode: 'server', load: () => request('/progress'),
        openChest: intent => {
            if (!validIntent(intent)) throw new Error('INVALID_REQUEST');
            return request('/relic-chests', { expectedRevision: intent.expectedRevision, requestId: intent.requestId, catalogVersion: CATALOG_VERSION });
        },
        buyRelic: intent => {
            if (!validIntent(intent) || !RELICS.some(r => r.id === intent.itemId)) throw new Error('INVALID_REQUEST');
            return request('/relic-purchases', { itemId: intent.itemId, expectedRevision: intent.expectedRevision, requestId: intent.requestId, catalogVersion: CATALOG_VERSION });
        },
        buy: ({ itemId, expectedRevision, requestId }) => {
            if (!SHOP.some(i => i.id === itemId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof requestId !== 'string' || !requestId.length || requestId.length > 160) throw new Error('INVALID_REQUEST');
            return request('/purchases', { itemId, expectedRevision, requestId, catalogVersion: CATALOG_VERSION });
        },
    };
}
