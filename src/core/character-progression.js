// Permanent character growth; deliberately independent of temporary run/build levels.
export const CHARACTER_MAX_LEVEL = 50;
export const CHARACTER_XP_CAP = 49 * 100 + 20 * 49 * 48 / 2;
const safeXP = xp => Number.isSafeInteger(xp) && xp >= 0 ? Math.min(xp, CHARACTER_XP_CAP) : 0;
export function characterProgress(xp = 0) {
    xp = safeXP(xp);
    let level = 1, remaining = xp;
    while (level < CHARACTER_MAX_LEVEL && remaining >= 100 + 20 * (level - 1)) {
        remaining -= 100 + 20 * (level - 1); level++;
    }
    return { level, totalXP: xp, xp: remaining, xpNext: level === CHARACTER_MAX_LEVEL ? 0 : 100 + 20 * (level - 1), maxLevel: CHARACTER_MAX_LEVEL };
}
// 캐릭터 레벨 기본 능력치: 레벨이 오를 때마다 조금씩 (Lv.50에서 체력 +49 · 공격력 +24.5% · 이동 속도 +9.8%).
export const CHARACTER_STAT_PER_LEVEL = Object.freeze({ maxHp: 1, might: 0.005, speed: 0.002 });
export function characterStatBonus(level = 1) {
    const n = Number.isFinite(level) ? Math.max(1, Math.min(CHARACTER_MAX_LEVEL, Math.floor(level))) - 1 : 0;
    return { maxHp: n * CHARACTER_STAT_PER_LEVEL.maxHp, might: n * CHARACTER_STAT_PER_LEVEL.might, speed: n * CHARACTER_STAT_PER_LEVEL.speed };
}
// 구역 클리어마다 받는 캐릭터 경험치: 뒤 구역일수록 많다 (10구역 전체 클리어 1400 → 약 Lv.9).
export const characterStageXP = stage => 30 + 20 * Math.max(1, Math.min(10, Math.floor(stage) || 1));
export function petalStats(level = 1) {
    const n = Number.isFinite(level) ? Math.max(1, Math.min(CHARACTER_MAX_LEVEL, Math.floor(level))) : 1;
    return { level: n, damage: 80 + 12 * (n - 1), radius: Math.min(340, 170 + 4 * (n - 1)) };
}
// Sequence acts as a durable high-water mark: old awards remain rejected even after
// bounded receipt history is pruned. Callers retain expectedCount for retries.
export function awardCharacterXP(state, { amount, requestId, expectedCount }) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10000 || typeof requestId !== 'string' || !requestId.length || requestId.length > 160 || !Number.isSafeInteger(expectedCount) || expectedCount < 0) return { ok: false, code: 'INVALID_REQUEST' };
    if (state.lastCharacterReward?.requestId === requestId) {
        if (state.lastCharacterReward.amount !== amount || state.lastCharacterReward.sequence !== expectedCount) return { ok: false, code: 'REWARD_ID_CONFLICT' };
        return { ok: true, duplicate: true, state };
    }
    if (expectedCount !== (state.characterRewardCount || 0)) return { ok: false, code: 'STALE_CHARACTER_REWARD' };
    if (state.receipts.includes(requestId)) return { ok: false, code: 'USED_REQUEST' };
    const before = characterProgress(state.characterXP).level;
    const next = { ...state, characterXP: safeXP((state.characterXP || 0) + amount), characterRewardCount: expectedCount + 1,
        lastCharacterReward: { requestId, amount, sequence: expectedCount }, revision: state.revision + 1, receipts: [...state.receipts, requestId].slice(-128) };
    return { ok: true, state: next, levelsGained: characterProgress(next.characterXP).level - before };
}
