// 난이도: 적은 절대 약해지지 않는다. 난이도가 오를수록 '아이템 레벨업'이 비싸진다.
// - xpMul: 레벨업(선택) 1회에 필요한 경험치 배율 (쉬움 = 현재 곡선 기준)
// - chestPenalty: 보스 상자 확정 강화 개수 감소량 (최소 1개는 보장)
// - premiumMul: 보스 상자 정밀 강화(+2) 확률 배율
export const DIFFICULTIES = Object.freeze({
    easy: { name: '쉬움', icon: '🌱', xpMul: 1, chestPenalty: 0, premiumMul: 1,
        desc: '현재 기본 난이도. 장비가 빠르게 성장합니다.' },
    normal: { name: '보통', icon: '⚔️', xpMul: 2.0, chestPenalty: 1, premiumMul: 0.7,
        desc: '레벨업 경험치 ×2 · 보스 상자 강화 -1. 몰려오는 대군 속에서도 테크 집중이 필요합니다.' },
    hard: { name: '어려움', icon: '🔥', xpMul: 3.2, chestPenalty: 2, premiumMul: 0.45,
        desc: '레벨업 경험치 ×3.2 · 보스 상자 강화 -2. 한 테크에 모든 걸 걸어야 합니다.' },
    hell: { name: '헬', icon: '☠️', xpMul: 5.5, chestPenalty: 3, premiumMul: 0.25,
        desc: '레벨업 경험치 ×5.5 · 보스 상자 강화 최소화. 모든 선택이 생사를 가릅니다.' },
});
export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard', 'hell']);
export const DEFAULT_DIFFICULTY = 'easy';
export const difficultyOf = id => DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
