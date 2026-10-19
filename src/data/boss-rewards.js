// Boss-only run rewards. No permanent shop pets, accessories or relics enter this pool.
export const BOSS_REWARD_TIERS = Object.freeze([
    Object.freeze({ minStage:1,maxStage:2,guaranteedCount:2,premiumChance:0.20 }),
    Object.freeze({ minStage:3,maxStage:5,guaranteedCount:3,premiumChance:0.35 }),
    Object.freeze({ minStage:6,maxStage:8,guaranteedCount:5,premiumChance:0.50 }),
    Object.freeze({ minStage:9,maxStage:10,guaranteedCount:5,premiumChance:0.65 }),
]);
export function bossRewardTier(stage) {
    const n=Number.isInteger(stage)?Math.max(1,Math.min(10,stage)):1;
    return {...BOSS_REWARD_TIERS.find(t=>n>=t.minStage&&n<=t.maxStage),stage:n,premiumLevels:2,premiumFallbackCoins:90+10*n};
}
