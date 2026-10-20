// 의상은 소폭의 이동·수집·방어 효과만 제공한다. 장식과 미리보기에는 효과가 없다.
import { COSMETICS } from '../data/cosmetics.js';
import { MAX_MOVE_SPEED } from '../data/relics.js';

export const CAPE_SPEED_MULTIPLIER = 1.04;
export const CAPE_PICKUP_MULTIPLIER = 1.08;
export const JADE_DAMAGE_MULTIPLIER = 0.95;
export const MAX_PICKUP_MULTIPLIER = 1.25;

export function activeOutfit(state) {
    const id = state?.equippedCosmetics?.outfit;
    if (!Array.isArray(state?.cosmeticInventory) || !state.cosmeticInventory.includes(id)) return null;
    return COSMETICS.find(item => item.id === id && item.slot === 'outfit') || null;
}

// Call once on freshly rebuilt stats, after relics/accessories. Never mutate the
// previous player stats or store derived values in progression/run checkpoints.
export function outfitStats(stats, state) {
    const outfit = activeOutfit(state);
    const next = { ...stats };
    if (outfit?.id === 'dusk_lotus_cape') {
        next.speed = Math.min(MAX_MOVE_SPEED, stats.speed * CAPE_SPEED_MULTIPLIER);
        // The established collection multiplier affects XP/coins only, preserving
        // meat/chest/bomb triggers and the shared collection-radius ceiling.
        next.pickupMultiplier = Math.min(MAX_PICKUP_MULTIPLIER, (stats.pickupMultiplier || 1) * CAPE_PICKUP_MULTIPLIER);
    } else if (outfit?.id === 'jade_lotus_guard') {
        next.outfitDamageMultiplier = JADE_DAMAGE_MULTIPLIER;
    }
    return next;
}

// Keep fractional HP (already supported by regeneration) and the original 1 HP
// floor. Mitigation follows flat armor, so it never amplifies armor itself.
export function incomingOutfitDamage(amount, armor, multiplier = 1) {
    const boundedMultiplier = Number.isFinite(multiplier)
        ? Math.max(JADE_DAMAGE_MULTIPLIER, Math.min(1, multiplier)) : 1;
    return Math.max(1, (amount - armor) * boundedMultiplier);
}
