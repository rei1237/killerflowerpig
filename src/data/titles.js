// 칭호 정의.
// 참고한 구조
// - 캐릭터별 숙련 기록(Risk of Rain 2 마스터리, Brotato 캐릭터별 클리어): 테크마다 출격·최고 도달·누적 처치를 따로 쌓는다.
// - 업적형 해금(Vampire Survivors): 진화·조합·누적 처치 같은 이정표를 달성하면 열린다.
// - 장착형 칭호와 등급 색(메이플스토리·로스트아크 등): 하나를 골라 이름 옆에 표시한다.
// 칭호는 외형 보상이다. 전투 수치를 바꾸지 않아 무기·테크 밸런스에 영향을 주지 않는다.
import { TECHS } from './techs.js';

export const TITLE_GRADES = Object.freeze({
    common: { name: '일반', color: '#c3ccd1' },
    rare: { name: '희귀', color: '#6fb7ff' },
    epic: { name: '영웅', color: '#c58bff' },
    legend: { name: '전설', color: '#ffcf5a' },
});

export const TECH_IDS = Object.freeze(Object.keys(TECHS));
export const ALL_CLEAR_STAGE = 10;

// 테크 숙련 칭호 이름: [첫 출격, STAGE 3 클리어, STAGE 6 클리어, STAGE 10 클리어]
const MASTERY_NAMES = {
    gunline: ['첫 방아쇠', '탄막 숙련병', '탄막 베테랑', '탄막의 군주'],
    bloom: ['견습 정원사', '숙련 정원사', '꽃잎 수호자', '만개의 여왕'],
    plague: ['불씨 견습생', '역병 연금술사', '잿빛 화염술사', '역병의 군주'],
    executioner: ['견습 처형인', '숙련 처형인', '냉혹한 처형인', '심판의 처형자'],
    butcher: ['견습 도살자', '정육 장인', '피의 도살자', '도살장의 왕'],
};
const MASTERY_STEPS = [
    { suffix: 'first', grade: 'common', goal: 0, desc: tech => `${tech.name} 테크로 첫 출격` },
    { suffix: 'stage3', grade: 'rare', goal: 3, desc: tech => `${tech.name} 테크로 STAGE 3 클리어` },
    { suffix: 'stage6', grade: 'epic', goal: 6, desc: tech => `${tech.name} 테크로 STAGE 6 클리어` },
    { suffix: 'stage10', grade: 'legend', goal: ALL_CLEAR_STAGE, desc: tech => `${tech.name} 테크로 STAGE 10 클리어 (엔딩)` },
];

const techStat = (stats, id) => stats.techStats?.[id] || { runs: 0, best: 0, clears: 0, kills: 0 };
const masteryTitles = TECH_IDS.flatMap(techId => MASTERY_STEPS.map((step, i) => ({
    id: `${techId}_${step.suffix}`,
    group: techId,
    name: MASTERY_NAMES[techId]?.[i] || `${TECHS[techId].name} ${i + 1}`,
    grade: step.grade,
    desc: step.desc(TECHS[techId]),
    // [현재, 목표]
    progress: stats => step.goal === 0
        ? [Math.min(1, techStat(stats, techId).runs), 1]
        : [Math.min(step.goal, techStat(stats, techId).best), step.goal],
})));

const techsReaching = (stats, stage) => TECH_IDS.filter(id => techStat(stats, id).best >= stage).length;
const feat = (stats, key) => stats.feats?.[key] || 0;

const milestoneTitles = [
    { id: 'first_sortie', name: '첫 출격', grade: 'common', desc: '아무 테크로나 한 번 출격', progress: s => [Math.min(1, TECH_IDS.reduce((n, id) => n + techStat(s, id).runs, 0)), 1] },
    { id: 'never_give_up', name: '칠전팔기', grade: 'common', desc: '쓰러져도 다시 출격 (게임 오버 7회)', progress: s => [Math.min(7, feat(s, 'deaths')), 7] },
    { id: 'hunter_1k', name: '청토끼 사냥꾼', grade: 'common', desc: '누적 처치 1,000', progress: s => [Math.min(1000, s.kills || 0), 1000] },
    { id: 'hunter_10k', name: '청토끼 학살자', grade: 'rare', desc: '누적 처치 10,000', progress: s => [Math.min(10000, s.kills || 0), 10000] },
    { id: 'hunter_50k', name: '푸른 재앙', grade: 'epic', desc: '누적 처치 50,000', progress: s => [Math.min(50000, s.kills || 0), 50000] },
    { id: 'boss_10', name: '보스 사냥꾼', grade: 'rare', desc: '보스 처치(스테이지 클리어) 10회', progress: s => [Math.min(10, feat(s, 'bossKills')), 10] },
    { id: 'first_evolve', name: '진화의 목격자', grade: 'rare', desc: '무기를 진화시킨 채 스테이지 종료', progress: s => [Math.min(1, feat(s, 'evolved')), 1] },
    { id: 'first_fusion', name: '조합의 장인', grade: 'epic', desc: '최종 조합 무기를 완성', progress: s => [Math.min(1, feat(s, 'fused')), 1] },
    { id: 'absolute', name: '절대 만개', grade: 'legend', desc: '절대 등급 무기 「절대 만개」 완성', progress: s => [Math.min(1, feat(s, 'absolute')), 1] },
    { id: 'all_rounder', name: '만능 전략가', grade: 'epic', desc: `모든 테크(${TECH_IDS.length}종)로 STAGE 3 클리어`, progress: s => [techsReaching(s, 3), TECH_IDS.length] },
    { id: 'legend_pig', name: '전설의 꽃돼지', grade: 'legend', desc: `모든 테크(${TECH_IDS.length}종)로 STAGE 10 클리어`, progress: s => [techsReaching(s, ALL_CLEAR_STAGE), TECH_IDS.length] },
];

export const TITLES = Object.freeze([...milestoneTitles, ...masteryTitles].map(t => Object.freeze({ group: 'milestone', ...t })));
export const TITLE_IDS = new Set(TITLES.map(t => t.id));
export function titleById(id) { return TITLES.find(t => t.id === id) || null; }
export function isTitleEarned(title, stats) {
    const [cur, goal] = title.progress(stats);
    return cur >= goal;
}
