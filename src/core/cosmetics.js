import { COSMETICS, COSMETIC_SLOTS } from '../data/cosmetics.js';
import { shopAccess } from './shop-access.js';

const itemFor = id => COSMETICS.find(item => item.id === id);
const validRequest = id => typeof id === 'string' && id.length > 0 && id.length <= 160;
const validSlot = slot => COSMETIC_SLOTS.includes(slot);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

// Always build fresh, allowlisted objects. Old saves receive empty appearance slots.
export function normalizeCosmetics(raw = {}) {
    const cosmeticInventory = COSMETICS.filter(item => Array.isArray(raw?.cosmeticInventory) && raw.cosmeticInventory.includes(item.id)).map(item => item.id);
    const equippedCosmetics = { outfit: null, ornament: null };
    for (const slot of COSMETIC_SLOTS) {
        const id = raw?.equippedCosmetics?.[slot];
        if (cosmeticInventory.includes(id) && itemFor(id)?.slot === slot) equippedCosmetics[slot] = id;
    }
    return { cosmeticInventory, equippedCosmetics };
}

// Only the last successful cosmetic intent is needed for an exact retry. Older
// request IDs stay in the shared bounded receipt log and cannot apply again.
export function normalizeCosmeticAction(raw, cosmetics = normalizeCosmetics(raw)) {
    const action = raw?.lastCosmeticAction;
    if (!object(action) || !['purchase', 'equip'].includes(action.type) ||
        !validRequest(action.requestId) || !raw.receipts?.includes(action.requestId) ||
        !validSlot(action.slot) || !Number.isSafeInteger(action.revision) || action.revision < 1 ||
        !Number.isSafeInteger(raw.revision) || action.revision > raw.revision) return null;
    if (action.itemId === null) {
        if (action.type !== 'equip') return null;
    } else if (!cosmetics.cosmeticInventory.includes(action.itemId) || itemFor(action.itemId)?.slot !== action.slot) return null;
    return { type: action.type, requestId: action.requestId, slot: action.slot, itemId: action.itemId, revision: action.revision };
}

export function activeCosmetics(state) {
    const { equippedCosmetics } = normalizeCosmetics(state);
    return Object.fromEntries(COSMETIC_SLOTS.map(slot => [slot, itemFor(equippedCosmetics[slot]) || null]));
}

function replayResult(state, type, slot, itemId, requestId) {
    const previous = normalizeCosmeticAction(state);
    if (previous?.requestId === requestId) {
        return previous.type === type && previous.slot === slot && previous.itemId === itemId
            ? { ok: true, duplicate: true, state }
            : { ok: false, code: 'USED_REQUEST' };
    }
    if (state.receipts?.includes(requestId)) return { ok: false, code: 'USED_REQUEST' };
    return null;
}

function nextAction(state, owned, { type, slot, itemId, requestId }) {
    const revision = state.revision + 1;
    return {
        ...state, ...owned, revision,
        equippedCosmetics: { ...owned.equippedCosmetics, [slot]: itemId },
        receipts: [...(state.receipts || []), requestId].slice(-128),
        lastCosmeticAction: { type, slot, itemId, requestId, revision },
    };
}

// Pure, immutable transaction. Ownership is permanent purchase idempotency,
// even if an old receipt has fallen out of the bounded receipt log.
export function purchaseCosmetic(state, { itemId, expectedRevision, requestId } = {}) {
    const item = itemFor(itemId);
    if (!item || !validRequest(requestId)) return { ok: false, code: 'INVALID_REQUEST' };
    const owned = normalizeCosmetics(state);
    if (owned.cosmeticInventory.includes(itemId)) return { ok: true, duplicate: true, state };
    const replay = replayResult(state, 'purchase', item.slot, itemId, requestId);
    if (replay) return replay;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision !== state.revision) return { ok: false, code: 'REVISION_CONFLICT' };
    if (!shopAccess(state, item).unlocked) return { ok: false, code: 'STAGE_LOCKED' };
    if (!Number.isSafeInteger(state.gold) || state.gold < item.price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    const next = nextAction(state, owned, { type: 'purchase', slot: item.slot, itemId, requestId });
    next.gold = state.gold - item.price;
    next.cosmeticInventory = [...owned.cosmeticInventory, itemId];
    return { ok: true, state: next };
}

export function equipCosmetic(state, { slot, itemId, expectedRevision, requestId } = {}) {
    if (!validSlot(slot) || !validRequest(requestId)) return { ok: false, code: 'INVALID_REQUEST' };
    if (itemId !== null && !itemFor(itemId)) return { ok: false, code: 'INVALID_REQUEST' };
    if (itemId !== null && itemFor(itemId).slot !== slot) return { ok: false, code: 'INVALID_SLOT' };
    const owned = normalizeCosmetics(state);
    if (itemId !== null && !owned.cosmeticInventory.includes(itemId)) return { ok: false, code: 'NOT_OWNED' };
    const replay = replayResult(state, 'equip', slot, itemId, requestId);
    if (replay) return replay;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision !== state.revision) return { ok: false, code: 'REVISION_CONFLICT' };
    if (owned.equippedCosmetics[slot] === itemId) return { ok: true, duplicate: true, state };
    return { ok: true, state: nextAction(state, owned, { type: 'equip', slot, itemId, requestId }) };
}

// Callers expose the result only after durable save validation and commit.
export function commitCosmeticResult(result, commit) {
    if (!result.ok || result.duplicate) return result;
    const persisted = commit(result.state);
    if (persisted === false || persisted?.ok === false) return { ok: false, code: persisted?.code || 'STORAGE_UNAVAILABLE' };
    if (persisted !== true && persisted?.ok !== true) return { ok: false, code: 'STORAGE_UNAVAILABLE' };
    return result;
}
