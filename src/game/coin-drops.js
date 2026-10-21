// Guest earned currency. Future servers must authorize each kill/boss reward.
export const COIN_DROPS = Object.freeze({ ordinaryChance: 0, ordinaryValue: 0, eliteChance: .8, eliteValue: 10 });
export const COIN_TIERS = Object.freeze({
 weak:Object.freeze({chance:0,value:0}), dangerous:Object.freeze({chance:.15,value:2}),
 strong:Object.freeze({chance:.30,value:3}), heavy:Object.freeze({chance:.55,value:5}),
 elite:Object.freeze({chance:.8,value:10}),
});
export function coinTier(enemy){
 if(enemy===true||enemy?.elite)return COIN_TIERS.elite;
 const type=typeof enemy==='string'?enemy:enemy?.type;
 if(type==='hulk')return COIN_TIERS.heavy;
 if(['brute','bloater','splitter'].includes(type))return COIN_TIERS.strong;
 if(['spitter','suicider','gunner'].includes(type))return COIN_TIERS.dangerous;
 return COIN_TIERS.weak;
}
export const bossCoinValue = stage => 20 + 5 * Math.max(1,Math.min(10,Number.isInteger(stage)?stage:1));
export const bossCoinReceipt = (runId,stage) => typeof runId==='string'&&runId.length>0&&runId.length<=96?`boss-bounty:${runId}:${stage}`:undefined;
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
// 드롭: 일반 0.01% · 챔피언 0.2% · 엘리트 2.5% (이전 0.05%/1.2%/8%), 스테이지당 최대 1개, 필드에도 1개.
// 열면: 코인 확정(coinBase + coinPerStage×스테이지, 보스 현상금의 약 절반) · 강화는 upgradeChance 확률로 1회 · 새 보조 아이템은 bonusPassiveChance.
// 보스 보상(현상금 + 확정 강화 여러 개)보다 항상 작아야 한다 (tests/boss-rewards.mjs).
export const TREASURE_DROPS = Object.freeze({ ordinary: .0001, champion: .002, elite: .025, maxOnField: 1, maxPerStage: 1,
    coinBase: 10, coinPerStage: 3, upgradeChance: .5, bonusPassiveChance: .05 });
export const treasureCoinValue = stage => TREASURE_DROPS.coinBase + TREASURE_DROPS.coinPerStage * Math.max(1, Math.min(10, Number.isInteger(stage) ? stage : 1));
// 전용 난수 스트림: 전투·코인·보급 난수를 소비하지 않는다.
export const treasureRandom = { next: createCoinRandom((entropy[0] ^ 0x51ed270b) >>> 0) };
export function treasureDropped(kind, random = treasureRandom.next) {
    const chance = TREASURE_DROPS[kind] ?? 0;
    const roll = random();
    return Number.isFinite(roll) && roll >= 0 && roll < chance;
}
export function coinDropValue(enemy, random = coinRandom.next) {
    const tier=coinTier(enemy);if(!tier.chance)return 0;
    const roll=random();return Number.isFinite(roll)&&roll>=0&&roll<tier.chance?tier.value:0;
}
