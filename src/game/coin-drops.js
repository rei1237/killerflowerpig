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
// 보물 상자: 아주 드물게, 어떤 적에게서든 떨어질 수 있다 (엘리트 > 챔피언 > 일반). 필드에는 한 번에 1개만.
export const TREASURE_DROPS = Object.freeze({ ordinary: .0005, champion: .012, elite: .08, maxOnField: 1, bonusPassiveChance: .25 });
// 전용 난수 스트림: 전투·코인·보급 난수를 소비하지 않는다.
export const treasureRandom = { next: createCoinRandom((entropy[0] ^ 0x51ed270b) >>> 0) };
export function treasureDropped(kind, random = treasureRandom.next) {
    const chance = TREASURE_DROPS[kind] ?? 0;
    const roll = random();
    return Number.isFinite(roll) && roll >= 0 && roll < chance;
}
export function coinDropValue(elite, random = coinRandom.next) {
    if (!elite) return 0;
    const roll = random();
    return Number.isFinite(roll) && roll >= 0 && roll < COIN_DROPS.eliteChance ? COIN_DROPS.eliteValue : 0;
}
