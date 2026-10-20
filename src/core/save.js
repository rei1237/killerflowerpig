import { purchasePetUpgrade } from './pet-upgrades.js';
import { purchaseAccessory, equipAccessory } from './accessories.js';
import { purchaseCosmetic, equipCosmetic } from './cosmetics.js';
import { awardCharacterXP } from './character-progression.js';
import { SHOP } from '../data/shop.js';
import { createGuestAdapter, itemLevel, purchase, validateProgress, openRelicChest, purchaseRelic } from './progression-store.js';
import { recordSettlement } from './titles.js';
export { SHOP };
let storage;
try { storage = globalThis.localStorage; } catch { /* Private-mode storage may be inaccessible. */ }
const adapter = createGuestAdapter(storage);
export const save = adapter.load();
export let lastSaveError = null;
function commit(next) {
    const result = adapter.commit(next);
    lastSaveError = result.ok ? null : result.code;
    if (result.ok) Object.assign(save, next);
    return result.ok;
}
export function persist() { return commit(validateProgress(save)); }
export function upgradeLevel(id) { return itemLevel(save, id); }
export function buyUpgrade(id, expectedLevel = upgradeLevel(id), requestId = `buy:${id}:${expectedLevel}`) {
    const result = purchase(save, { itemId: id, expectedLevel, requestId });
    if (!result.ok) { lastSaveError = result.code; return false; }
    return result.duplicate || commit(result.state);
}
// 칭호: 스테이지 정산 기록 → 새로 얻은 칭호 id 목록. 저장 실패 시에도 메모리에는 반영해 다음 저장에 포함된다.
export function recordTitleProgress(rec) {
    const { state, earned } = recordSettlement(save, rec);
    Object.assign(save, state);
    return earned;
}
export function equipTitle(id) {
    if (id !== null && !save.titles.includes(id)) return false;
    return commit({ ...save, equippedTitle: id, revision: save.revision + 1 });
}
export function equipPet(id) {
    if (id !== null && !save.inventory.includes(id)) return false;
    return commit({ ...save, equippedPet: id, revision: save.revision + 1 });
}
// Local guest reward only. A deployed service must validate a server-owned run/event.
export function earnCoins(amount, eventId) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) return false;
    if (eventId !== undefined && (typeof eventId !== 'string' || !eventId.length || eventId.length > 160)) return false;
    if (eventId && save.receipts.includes(eventId)) return true;
    return commit({ ...save, gold: Math.min(1_000_000_000, save.gold + amount), revision: save.revision + 1,
        receipts: eventId ? [...save.receipts, eventId].slice(-128) : save.receipts });
}
// Non-repeatable chest/result rewards can wait in memory while disk storage is blocked.
// These are not durable until retry succeeds; the UI must disclose this explicitly.
const pendingRewards = new Map();
export function queueCoins(amount, eventId) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000 || typeof eventId !== 'string' || !eventId.length || eventId.length > 160) return false;
    if (pendingRewards.has(eventId) && pendingRewards.get(eventId) !== amount) { lastSaveError = 'REWARD_ID_CONFLICT'; return false; }
    if (earnCoins(amount, eventId)) { pendingRewards.delete(eventId); return true; }
    pendingRewards.set(eventId, amount);
    return false;
}
export function retryPendingCoins() {
    for (const [id, amount] of pendingRewards) if (earnCoins(amount, id)) pendingRewards.delete(id);
    return pendingRewards.size === 0;
}
export function pendingCoinTotal() { return [...pendingRewards.values()].reduce((sum, amount) => sum + amount, 0); }

export function openChest(expectedCount = save.chestCount, requestId = `chest:${expectedCount}`) {
    const result = openRelicChest(save, { expectedCount, requestId });
    if (!result.ok) { lastSaveError = result.code; return result; }
    if (!result.duplicate && !commit(result.state)) return { ok: false, code: lastSaveError };
    return { ok: true, duplicate: !!result.duplicate, reward: result.reward };
}
export function buyRelic(itemId, requestId = `relic:${itemId}`) {
    const result = purchaseRelic(save, { itemId, requestId });
    if (!result.ok) { lastSaveError = result.code; return false; }
    return result.duplicate || commit(result.state);
}

// Permanent XP is awarded at stage settlement, never per frame or idle time.
const pendingCharacterRewards = new Map();
export function queueCharacterXP(amount, eventId, expectedCount) {
    const prior = pendingCharacterRewards.get(eventId);
    expectedCount ??= prior?.expectedCount ?? (save.lastCharacterReward?.requestId === eventId ? save.lastCharacterReward.sequence : save.characterRewardCount + pendingCharacterRewards.size);
    if (prior && (prior.amount !== amount || prior.expectedCount !== expectedCount)) { lastSaveError = 'REWARD_ID_CONFLICT'; return false; }
    const intent = prior || { amount, requestId: eventId, expectedCount };
    if (expectedCount > save.characterRewardCount && pendingCharacterRewards.size > 0) {
        if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10000 || typeof eventId !== 'string' || !eventId.length || eventId.length > 160) return false;
        pendingCharacterRewards.set(eventId, intent); lastSaveError = 'PENDING_CHARACTER_REWARD'; return false;
    }
    const result = awardCharacterXP(save, intent);
    if (!result.ok) { lastSaveError = result.code; return false; }
    if (result.duplicate || commit(result.state)) { pendingCharacterRewards.delete(eventId); return true; }
    pendingCharacterRewards.set(eventId, intent); return false;
}
export function retryPendingCharacterXP() {
    for (const [id, intent] of pendingCharacterRewards) queueCharacterXP(intent.amount, id, intent.expectedCount);
    return pendingCharacterRewards.size === 0;
}
export function pendingCharacterXP() { return [...pendingCharacterRewards.values()].reduce((sum, intent) => sum + intent.amount, 0); }

// Premium accessory actions are atomic: do not expose a grant until durable commit succeeds.
function finishAccessoryAction(result) {
    if (!result.ok) { lastSaveError = result.code; return { ok: false, code: result.code }; }
    if (!result.duplicate && !commit(result.state)) return { ok: false, code: lastSaveError };
    lastSaveError = null;
    return { ok: true, duplicate: !!result.duplicate };
}
export function buyAccessory(itemId, expectedRevision = save.revision, requestId = `accessory:${itemId}`) {
    return finishAccessoryAction(purchaseAccessory(save, { itemId, expectedRevision, requestId }));
}
export function setAccessory(itemId, expectedRevision = save.revision) {
    if (expectedRevision !== save.revision) { lastSaveError = 'REVISION_CONFLICT'; return { ok: false, code: lastSaveError }; }
    return finishAccessoryAction(equipAccessory(save, itemId));
}

// Notify runtime subscribers only after an outfit/ornament change is durable.
// This keeps failed writes and repeated requests from applying temporary bonuses.
const cosmeticChangeListeners = new Set();
export function onCosmeticsChanged(listener) {
    cosmeticChangeListeners.add(listener);
    return () => cosmeticChangeListeners.delete(listener);
}
function finishCosmeticAction(result) {
    if (!result.ok) { lastSaveError = result.code; return { ok: false, code: result.code }; }
    if (!result.duplicate && !commit(result.state)) {
        const code = lastSaveError;
        if (code === 'REVISION_CONFLICT') {
            const fresh = adapter.refresh();
            if (fresh.ok) { Object.assign(save, fresh.state); notifyCosmeticsChanged(); }
        }
        return { ok: false, code };
    }
    lastSaveError = null;
    if (!result.duplicate) notifyCosmeticsChanged();
    return { ok: true, duplicate: !!result.duplicate };
}
function notifyCosmeticsChanged() {
    for (const listener of cosmeticChangeListeners) {
        // A view/runtime listener cannot turn a completed purchase into a false
        // transaction failure. The player also reconciles on its next update.
        try { listener(save); } catch (error) { console.error('Cosmetic refresh failed', error); }
    }
}
export function buyCosmetic(itemId, expectedRevision = save.revision, requestId = `cosmetic:${itemId}`) {
    return finishCosmeticAction(purchaseCosmetic(save, { itemId, expectedRevision, requestId }));
}
export function setCosmetic(slot, itemId, expectedRevision = save.revision, requestId = `cosmetic-equip:${slot}:${itemId}:${expectedRevision}`) {
    return finishCosmeticAction(equipCosmetic(save, { slot, itemId, expectedRevision, requestId }));
}

export function buyPetUpgrade(trackId, expectedLevel, expectedRevision = save.revision) {
    const result = purchasePetUpgrade(save, { trackId, expectedLevel, expectedRevision, requestId: `pet-training:${trackId}:${expectedLevel}` });
    if (!result.ok) { lastSaveError = result.code; return { ok: false, code: result.code }; }
    if (!result.duplicate && !commit(result.state)) {
        const code = lastSaveError;
        if (code === 'REVISION_CONFLICT') { const fresh = adapter.refresh(); if (fresh.ok) Object.assign(save, fresh.state); }
        return { ok: false, code };
    }
    lastSaveError = null;
    return { ok: true, duplicate: !!result.duplicate };
}
