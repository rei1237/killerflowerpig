// Guest-only earned currency. A future server must authorize rewards itself.
// 금화는 네임드(엘리트) 적에게서만 드물게 떨어진다. 일반 적은 금화를 떨어뜨리지 않는다.
export const COIN_DROPS = Object.freeze({ ordinaryChance: 0, ordinaryValue: 0, eliteChance: .3, eliteValue: 6 });
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
    if (!elite) return 0;
    const roll = random();
    return Number.isFinite(roll) && roll >= 0 && roll < COIN_DROPS.eliteChance ? COIN_DROPS.eliteValue : 0;
}
