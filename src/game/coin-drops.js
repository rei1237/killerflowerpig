// Guest-only earned currency. A future server must authorize rewards itself.
export const COIN_DROPS = Object.freeze({ ordinaryChance: .15, ordinaryValue: 3, eliteValue: 8 });
export function createCoinRandom(seed) {
    let state = (seed >>> 0) || 0x6d2b79f5;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
const entropy = new Uint32Array(1);
if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy);
else entropy[0] = Date.now() >>> 0;
// Dedicated stream: coin rolls never consume combat, supply or cosmetic Math.random draws.
export const coinRandom = { next: createCoinRandom(entropy[0]) };
export function coinDropValue(elite, random = coinRandom.next) {
    if (elite) return COIN_DROPS.eliteValue;
    const roll = random();
    return Number.isFinite(roll) && roll >= 0 && roll < COIN_DROPS.ordinaryChance ? COIN_DROPS.ordinaryValue : 0;
}
