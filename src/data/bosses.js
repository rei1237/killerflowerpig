export const HUNTER_TUNING = Object.freeze({ warning: .65, secondWarning: .5, dashSpeed: 650, phaseSpeedStep: .08, dashRange: 350, recovery: 1.25,
    // 페이즈별 연속 돌진 예고 시간. 변이: 3연속, 광폭화: 3연속 엇박자(마지막 돌진이 늦게 출발).
    phaseWarnings: [[.65, .5], [.65, .5, .5], [.65, .5, .8]] });
// 9구역은 브루투스 킹 복귀: 적 수 대신 왕의 연속 균열·추적 강타로 압박한다.
// 1구역은 단일 돌진을 배우는 경비병. 헌터의 빠른 추적·연속 돌진은 별도 유지.
// 보스 정의. phases[i] = HP 구간별 패턴 목록 (100-60%, 60-25%, 25-0%)
// 패턴: charge(돌진), ring(원형탄), spiral(나선탄), aimed(조준 부채꼴), summon(소환),
//       각 보스의 signature는 이동·안전 지대·공격 순서가 다른 고유 패턴이다.
//       공통 탄막(ring/aimed)은 변이(60%)·광폭화(25%) 이후 보조 기술로 섞이며,
//       초급 경비병은 모든 페이즈에서 고정 예고/회복. 왕의 균열은 페이즈가 바뀌어도 최소 예고 시간을 보장한다.
export const BOSSES = {
    1: { name: '길목 경비 청토끼', title: '길목을 지키는 파수꾼...', sheet: 'boss1', tint: 'normal', scale: 0.62, hp: 600, speed: 48, dmg: 10,
        pacing: { opening: 3, phaseRest: 2.5, warning: 1.5, dashSpeed: 300, dashRange: 280, safeRecovery: 2.5 },
        signature: 'trainingCharge', signatureHint: '1.5초 예고선 옆으로 피하고, 원형 탄막은 탄 사이 틈으로 빠지세요. 멈춘 동안 공격하세요.',
        // 너무 쉬워서 탄막 추가: 처음부터 돌진과 원형 탄막을 번갈아 쓰고, 60% 이하에서 조준 부채꼴이 더해진다.
        // 1구역용 완화: 원형 탄 70%(페이즈별 10·13·17발)·최대 2연발, 부채꼴 -2발·2연발, 탄속 85%.
        barrage: { density: 0.7, maxVolleys: 2, fanReduce: 2, aimedVolleys: 2, speed: 0.85, interval: 1.2, rest: 0.4 },
        phases: [['trainingCharge', 'ring'], ['trainingCharge', 'ring', 'aimed'], ['trainingCharge', 'ring', 'aimed']] },
    2: { name: '엘리트 청토끼', title: '전투 머신이 다가온다...', sheet: 'boss1', tint: 'elite', scale: 0.64, hp: 2240, speed: 66, dmg: 16,
        signature: 'barrage', signatureHint: '고정된 사격선 옆으로 빠지고 재장전 중 공격하세요.',
        phases: [['barrage'], ['barrage'], ['barrage', 'ring']] },
    3: { name: '헌터 청토끼', title: '냄새를 맡았다...', sheet: 'boss1', tint: 'shadow', scale: 0.64, hp: 4930, speed: 118, dmg: 18, stealth: true,
        // 탄막 완화: 링 탄 수 60%·최대 2연발, 부채꼴 탄 -2(틈 확대)·2연발, 탄속 80%, 연발 간격 1.4배, 패턴 뒤 휴식 +0.8초.
        barrage: { density: 0.6, maxVolleys: 2, fanReduce: 2, aimedVolleys: 2, speed: 0.8, interval: 1.4, rest: 0.8 },
        signature: 'hunt', signatureHint: '두 번의 돌진 예고선을 각각 옆으로 피하고, 멈춰 숨을 고를 때 공격하세요.',
        phases: [['hunt'], ['hunt', 'aimed'], ['hunt', 'ring', 'aimed']] },
    4: { name: '프레데터 알파', title: '저격이다!', sheet: 'boss1', tint: 'toxic', scale: 0.66, hp: 8120, speed: 60, dmg: 20,
        signature: 'lockshot', signatureHint: '조준선이 멈추면 방향을 바꿔 두 번째 저격도 피하세요.',
        phases: [['lockshot'], ['lockshot', 'ring'], ['lockshot', 'ring', 'aimed']] },
    5: { name: '탱크 청토끼', title: '파괴의 병기가 온다...', sheet: 'boss1', tint: 'normal', scale: 0.85, hp: 12750, speed: 48, dmg: 26,
        signature: 'artillery', signatureHint: '전방 포격 원을 벗어나 옆이나 뒤에서 공격하세요.',
        phases: [['artillery'], ['artillery', 'ring'], ['artillery', 'ring', 'aimed']] },
    6: { name: '어보미네이션', title: '강에서 거대한 그림자가...', sheet: 'boss2', tint: 'normal', scale: 0.62, hp: 18000, speed: 52, dmg: 26,
        signature: 'toxicTide', signatureHint: '독 웅덩이 사이 비어 있는 출구로 빠져나가세요.', phaseSummons: true,
        phases: [['toxicTide'], ['toxicTide', 'summon', 'ring'], ['toxicTide', 'summon', 'aimed']] },
    7: { name: '어쌔신 퀸', title: '뒤에서 날카로운 기척이...', sheet: 'boss2', tint: 'shadow', scale: 0.6, hp: 24800, speed: 78, dmg: 28,
        signature: 'crosscut', signatureHint: '교차 칼날 뒤 멈추지 마세요. 분홍 추격 칼날과 그림자 단검이 따라옵니다.',
        phases: [['crosscut'], ['crosscut', 'aimed'], ['crosscut', 'ring', 'aimed']] },
    8: { name: '사이코틱 킹', title: '정신이 흔들린다...', sheet: 'boss2', tint: 'hallu', scale: 0.64, hp: 32550, speed: 58, dmg: 30, hallucinate: true,
        signature: 'echo', signatureHint: '환영의 탄막 틈으로 이동하고 반대쪽 메아리를 대비하세요.',
        phases: [['echo'], ['echo', 'aimed'], ['echo', 'ring']] },
    9: { name: '브루투스 킹', title: '최강의 왕이 눈을 떴다!', sheet: 'bossKing', tint: 'normal', scale: 0.66, hp: 24000, speed: 60, dmg: 34,
        pacing: { opening: 2.6, phaseRest: 2.0 },
        signature: 'faultline', signatureHint: '양옆→중앙→십자 균열을 피하고, 새로 찍히는 왕의 강타 원에서 벗어나세요.',
        phases: [['faultline'], ['faultline', 'ring'], ['faultline', 'aimed']] },
    10: { name: '청토끼 · 시간의 채권자', title: '마지막 계약의 시간이 다가온다...', sheet: 'bossKing', tint: 'elite', scale: 0.76, hp: 168000, speed: 64, dmg: 38, hallucinate: true,
        signature: 'contract', signatureHint: '금화 탄막을 비켜가고 모래시계 계약 원이 찰 때 안에 있지 마세요.',
        phases: [['contract'], ['contract', 'ring'], ['contract', 'ring', 'aimed']] },
};

export const PHASE_THRESHOLDS = [0.6, 0.25];

// 보스 체력 배율. hp 값은 기준치이며 실제 전투 체력은 hp × BOSS_HP_MULTIPLIER. (×10에서 30% 하향)
export const BOSS_HP_MULTIPLIER = 7;
// 무기 진화 단계에 맞춘 4스테이지 이후 보스 체력 추가 배율 (진화 → 조합 → 절대 무기 화력 증가에 비례).
// 1~3스테이지는 1배(기존 유지). 10스테이지 최종 보스는 기본 체력 자체도 크게 높다.
// 구역마다 보급품 3개로 후반 장비가 더 일찍 모이므로 5구역부터 약 15% 상향, 9구역 왕은 광폭 단계가 짧아지지 않게 +40% (이전 5:1.15 6:1.4 7:1.5 8:1.7 9:2.0 10:1.2).
// 경험치 레벨업 3배(배율 ×2.5)로 빌드가 빨리 강해져 9구역 왕만 2.8→3.3 (광폭 단계 보장).
export const BOSS_EVOLUTION_HP = Object.freeze({ 4: 1.0, 5: 1.3, 6: 1.6, 7: 1.7, 8: 1.95, 9: 3.3, 10: 1.38 });
// 실제 전투 체력 (도감 표시와 보스 생성이 같은 값을 쓰도록)
export const bossMaxHp = stage => (BOSSES[stage]?.hp || 0) * BOSS_HP_MULTIPLIER * (BOSS_EVOLUTION_HP[stage] || 1);

// 보스 정지 후 재정지 면역 시간 (초). 연꽃 가시가 보스를 묶어 두지 못하게 한다.
export const BOSS_STUN = Object.freeze({ immunity: 2.5 });
