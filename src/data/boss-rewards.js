// 보스 처치 경험치: 젬 개수 × 개당 값. (24개 → 16개로 줄여 보스 직후 레벨업 폭주를 완화)
export const BOSS_XP_GEMS = 16;
export const bossGemValue = stage => 5 + stage * 2;
// Boss-only run rewards. No permanent shop pets, accessories or relics enter this pool.
export const BOSS_REWARD_TIERS = Object.freeze([
    Object.freeze({ minStage:1,maxStage:2,guaranteedCount:2,premiumChance:0.20 }),
    Object.freeze({ minStage:3,maxStage:5,guaranteedCount:3,premiumChance:0.35 }),
    Object.freeze({ minStage:6,maxStage:8,guaranteedCount:5,premiumChance:0.50 }),
    Object.freeze({ minStage:9,maxStage:10,guaranteedCount:5,premiumChance:0.65 }),
]);
// 난이도가 오르면 확정 강화 개수가 줄고(최소 1) 정밀 강화 확률이 낮아진다. 쉬움은 표 그대로.
export function bossRewardTier(stage, difficulty = { chestPenalty: 0, premiumMul: 1 }) {
    const n=Number.isInteger(stage)?Math.max(1,Math.min(10,stage)):1;
    const base=BOSS_REWARD_TIERS.find(t=>n>=t.minStage&&n<=t.maxStage);
    return {...base,guaranteedCount:Math.max(1,base.guaranteedCount-(difficulty.chestPenalty||0)),premiumChance:base.premiumChance*(difficulty.premiumMul??1),
        stage:n,premiumLevels:2,premiumFallbackCoins:90+10*n};
}
