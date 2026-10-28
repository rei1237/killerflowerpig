// 난이도: 적은 절대 약해지지 않는다. 난이도가 오를수록 '아이템 레벨업'이 비싸지고 청토끼가 강해진다.
// - xpMul: 레벨업(선택) 1회에 필요한 경험치 배율 (쉬움 = 현재 곡선 기준)
// - chestPenalty: 보스 상자 확정 강화 개수 감소량 (최소 1개는 보장)
// - premiumMul: 보스 상자 정밀 강화(+2) 확률 배율
// - enemy: 모든 필드 청토끼의 체력/접촉·탄 피해/이동 속도 배율, champion = 챔피언 변이 확률 배율
// - elite: 엘리트(보스 스프라이트) 추가 배율. affixes = 능력 개수 추가, count = 엘리트 이벤트 동시 출현 추가
// - boss: 스테이지 보스 체력/피해 배율
export const DIFFICULTIES = Object.freeze({
    easy: { name: '쉬움', icon: '🌱', xpMul: 1, chestPenalty: 0, premiumMul: 1,
        enemy: { hp: 1, dmg: 1, speed: 1, champion: 1 }, elite: { hp: 1, dmg: 1, affixes: 0, count: 0 }, boss: { hp: 1, dmg: 1 },
        desc: '기본 난이도. 장비가 빠르게 성장합니다.' },
    normal: { name: '보통', icon: '⚔️', xpMul: 2.0, chestPenalty: 1, premiumMul: 0.7,
        enemy: { hp: 1.3, dmg: 1.15, speed: 1.04, champion: 1.4 }, elite: { hp: 1.35, dmg: 1.15, affixes: 0, count: 0 }, boss: { hp: 1.15, dmg: 1.1 },
        desc: '레벨업 경험치 ×2 · 보스 상자 강화 -1 · 청토끼 체력 ×1.3, 엘리트 추가 강화. 몰려오는 대군 속에서도 테크 집중이 필요합니다.' },
    hard: { name: '어려움', icon: '🔥', xpMul: 3.2, chestPenalty: 2, premiumMul: 0.45,
        enemy: { hp: 1.7, dmg: 1.3, speed: 1.08, champion: 1.8 }, elite: { hp: 1.6, dmg: 1.25, affixes: 1, count: 0 }, boss: { hp: 1.3, dmg: 1.2 },
        desc: '레벨업 경험치 ×3.2 · 보스 상자 강화 -2 · 청토끼 체력 ×1.7, 엘리트 능력 +1. 한 테크에 모든 걸 걸어야 합니다.' },
    hell: { name: '헬', icon: '☠️', xpMul: 5.5, chestPenalty: 3, premiumMul: 0.25,
        enemy: { hp: 2.3, dmg: 1.5, speed: 1.12, champion: 2.4 }, elite: { hp: 2, dmg: 1.4, affixes: 2, count: 1 }, boss: { hp: 1.5, dmg: 1.35 },
        desc: '레벨업 경험치 ×5.5 · 보스 상자 강화 최소화 · 청토끼 체력 ×2.3, 엘리트 능력 +2·출현 +1. 모든 선택이 생사를 가릅니다.' },
});
// 2P 협동 압박: 두 사람이 싸우는 만큼 적이 2배 넘게 몰려오고 더 단단하고 아프다 (모든 난이도 위에 곱한다).
// - count: 목표 밀도·대군/포위/러시 규모·구역 동시 상한 배율. caps: 기기 성능 상한(G.caps.enemies) 배율.
// - hp/dmg/speed: 모든 필드 적(엘리트 포함). eliteCount: 엘리트 이벤트 동시 출현 추가. boss: 보스 체력/피해.
// - xp: 적이 2배 이상이라 한 마리당 경험치를 줄여 레벨업 속도가 1.3배 정도로만 빨라지게 한다.
export const COOP_PRESSURE = Object.freeze({ count: 2.2, caps: 1.6, hp: 1.5, dmg: 1.25, speed: 1.05, eliteCount: 1, boss: Object.freeze({ hp: 1.4, dmg: 1.15 }), xp: 0.6 });
export const coopPressure = () => G_COOP.on ? COOP_PRESSURE : null;
// state.js 를 직접 가져오면 순환 참조가 생기므로 G.coop 값을 여기로 동기화한다 (game.js setCoop).
export const G_COOP = { on: false };
export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard', 'hell']);
export const DEFAULT_DIFFICULTY = 'easy';
export const difficultyOf = id => DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
