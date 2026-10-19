import { ACCESSORIES } from '../data/accessories.js';
import { shopAccess } from './shop-access.js';
import { MAX_MOVE_SPEED } from '../data/relics.js';
const validId = id => ACCESSORIES.some(item => item.id === id);
export function normalizeAccessories(raw = {}) {
    const accessoryInventory = ACCESSORIES.filter(item => Array.isArray(raw.accessoryInventory) && raw.accessoryInventory.includes(item.id)).map(item => item.id);
    return { accessoryInventory, equippedAccessory: accessoryInventory.includes(raw.equippedAccessory) ? raw.equippedAccessory : null };
}
export function activeAccessory(state) {
    const data = normalizeAccessories(state);
    return ACCESSORIES.find(item => item.id === data.equippedAccessory) || null;
}
export function purchaseAccessory(state, { itemId, expectedRevision, requestId } = {}) {
    if (!validId(itemId) || typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
    const owned = normalizeAccessories(state);
    // Ownership itself is durable one-time purchase idempotency, even beyond recent receipts.
    if (owned.accessoryInventory.includes(itemId)) return { ok: true, duplicate: true, state };
    if (state.receipts?.includes(requestId)) return { ok: false, code: 'USED_REQUEST' };
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) return { ok: false, code: 'REVISION_CONFLICT' };
    const item = ACCESSORIES.find(entry => entry.id === itemId);
    if (!shopAccess(state, item).unlocked) return { ok: false, code: 'STAGE_LOCKED' };
    if (!Number.isSafeInteger(state.gold) || state.gold < item.price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    const next = { ...state, ...owned, gold: state.gold - item.price, revision: state.revision + 1,
        accessoryInventory: [...owned.accessoryInventory, itemId], equippedAccessory: itemId,
        receipts: [...(state.receipts || []), requestId].slice(-128) };
    return { ok: true, state: next };
}
export function equipAccessory(state, itemId) {
    const owned = normalizeAccessories(state);
    if (itemId !== null && !owned.accessoryInventory.includes(itemId)) return { ok: false, code: 'NOT_OWNED' };
    if (owned.equippedAccessory === itemId) return { ok: true, duplicate: true, state };
    return { ok: true, state: { ...state, ...owned, equippedAccessory: itemId, revision: state.revision + 1 } };
}
// Call on freshly computed stats once, after relic bonuses and before final HP assignment.
export function accessoryStats(stats, state) {
    const item = activeAccessory(state), next = { ...stats };
    if (!item) return next;
    for (const [key, value] of Object.entries(item.bonuses)) {
        if (key === 'pickupMultiplier') next[key] = (stats[key] || 1) * value;
        else next[key] = (stats[key] || 0) + value;
    }
    if (Number.isFinite(next.speed)) next.speed = Math.min(MAX_MOVE_SPEED, next.speed);
    if (Number.isFinite(next.cooldown)) next.cooldown = Math.max(0.4, next.cooldown);
    if (Number.isFinite(next.crit)) next.crit = Math.min(1, Math.max(0, next.crit));
    return next;
}
// Never refill health on equip/unequip; changing slots must not become a free healing loop.
export function accessoryEquipHP(currentHP, newMaxHP) { return Math.max(0, Math.min(currentHP, newMaxHP)); }
// Caller supplies the actual durable adapter commit; this module never bypasses save validation.
export function commitAccessoryResult(result, commit) {
    if (!result.ok || result.duplicate) return result;
    if (!commit(result.state)) return { ok: false, code: 'STORAGE_UNAVAILABLE' };
    return result;
}
