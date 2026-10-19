// Unlocks are based on cleared progression, never the current run/replay selection.
export function highestClearedStage(state) {
    return Number.isSafeInteger(state?.maxClearedStage) ? Math.max(0, Math.min(10, state.maxClearedStage)) : 0;
}
export function shopAccess(state, item) {
    const requiredStage = Number.isSafeInteger(item?.unlockStage) ? item.unlockStage : 0;
    return { unlocked: highestClearedStage(state) >= requiredStage, requiredStage,
        message: requiredStage ? `STAGE ${requiredStage} 클리어 후 해금` : '처음부터 구매 가능' };
}
