export const HUNTER_TUNING = Object.freeze({ warning: .65, secondWarning: .5, dashSpeed: 650, phaseSpeedStep: .08, dashRange: 350, recovery: 1.25,
    // 페이즈별 연속 돌진 예고 시간. 변이: 3연속, 광폭화: 3연속 엇박자(마지막 돌진이 늦게 출발).
    phaseWarnings: [[.65, .5], [.65, .5, .5], [.65, .5, .8]] });
// 기존 1구역 알파의 패턴·능력치는 9구역으로 이동하고 기준 체력을 13000으로 조정 (실제 291200, 9구역 2융합 전투 시간 기준).
// 1구역은 단일 돌진을 배우는 경비병. 헌터의 빠른 추적·연속 돌진은 별도 유지.
// 보스 정의. phases[i] = HP 구간별 패턴 목록 (100-60%, 60-25%, 25-0%)
// 패턴: charge(돌진), ring(원형탄), spiral(나선탄), aimed(조준 부채꼴), summon(소환),
//       각 보스의 signature는 이동·안전 지대·공격 순서가 다른 고유 패턴이다.
//       공통 탄막(ring/aimed)은 변이(60%)·광폭화(25%) 이후 보조 기술로 섞이며,
//       초급 경비병은 모든 페이즈에서 고정 예고/회복. 이동한 알파는 기존 페이즈 배율을 유지한다.
export const BOSSES = {
    1: { name: '길목 경비 청토끼', title: '길목을 지키는 파수꾼...', sheet: 'boss1', tint: 'normal', scale: 0.62, hp: 600, speed: 48, dmg: 10,
        pacing: { opening: 3, phaseRest: 2.5, warning: 1.5, dashSpeed: 300, dashRange: 280, safeRecovery: 2.5 },
        signature: 'trainingCharge', signatureHint: '1.5초 예고선 옆으로 피하고, 2.5초 멈춘 동안 공격하세요.',
        phases: [['trainingCharge'], ['trainingCharge'], ['trainingCharge']] },
    2: { name: '엘리트 청토끼', title: '전투 머신이 다가온다...', sheet: 'boss1', tint: 'elite', scale: 0.64, hp: 2240, speed: 66, dmg: 16,
        signature: 'barrage', signatureHint: '고정된 사격선 옆으로 빠지고 재장전 중 공격하세요.',
        phases: [['barrage'], ['barrage'], ['barrage', 'ring']] },
    3: { name: '헌터 청토끼', title: '냄새를 맡았다...', sheet: 'boss1', tint: 'shadow', scale: 0.64, hp: 4930, speed: 118, dmg: 18, stealth: true,
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
    9: { name: '알파 청토끼', title: '지면이 고동친다...', sheet: 'boss1', tint: 'normal', scale: 0.62, artStage: 1, hp: 13000, speed: 48, dmg: 10,
        pacing: { opening: 3, phaseRest: 2.2, recovery: 1.5, chargeWarning: 1.15, chargeSpeed: 480, summons: 0.6 },
        signature: 'charge', signatureHint: '돌진 선 옆으로 피한 뒤 긴 빈틈을 노리세요.', phaseSummons: true,
        phases: [['charge', 'summon'], ['charge', 'ring', 'summon'], ['charge', 'ring', 'aimed']] },
    10: { name: '청토끼 · 시간의 채권자', title: '마지막 계약의 시간이 다가온다...', sheet: 'bossKing', tint: 'elite', scale: 0.76, hp: 168000, speed: 64, dmg: 38, hallucinate: true,
        signature: 'contract', signatureHint: '금화 탄막을 비켜가고 모래시계 계약 원이 찰 때 안에 있지 마세요.',
        phases: [['contract'], ['contract', 'ring'], ['contract', 'ring', 'aimed']] },
};

export const PHASE_THRESHOLDS = [0.6, 0.25];

// 보스 체력 배율. hp 값은 기준치이며 실제 전투 체력은 hp × BOSS_HP_MULTIPLIER. (×10에서 30% 하향)
export const BOSS_HP_MULTIPLIER = 7;
// 무기 진화 단계에 맞춘 4스테이지 이후 보스 체력 추가 배율 (진화 → 조합 → 절대 무기 화력 증가에 비례).
// 1~3스테이지는 1배(기존 유지). 10스테이지 최종 보스는 기본 체력 자체도 크게 높다.
export const BOSS_EVOLUTION_HP = Object.freeze({ 4: 1.6, 5: 1.8, 6: 2.2, 7: 2.5, 8: 2.8, 9: 3.2, 10: 2.4 });
// 실제 전투 체력 (도감 표시와 보스 생성이 같은 값을 쓰도록)
export const bossMaxHp = stage => (BOSSES[stage]?.hp || 0) * BOSS_HP_MULTIPLIER * (BOSS_EVOLUTION_HP[stage] || 1);
