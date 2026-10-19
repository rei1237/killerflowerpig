export const HUNTER_TUNING = Object.freeze({ warning: .65, secondWarning: .5, dashSpeed: 650, phaseSpeedStep: .08, dashRange: 350, recovery: 1.25 });
// 이전 성장 경제 보정은 HP만 조정(1단계1400, 이후+40~60%). 헌터는 별도 요청으로 빠른 추적·2연속 돌진 적용.
// 보스 정의. phases[i] = HP 구간별 패턴 목록 (100-60%, 60-25%, 25-0%)
// 패턴: charge(돌진), ring(원형탄), spiral(나선탄), aimed(조준 부채꼴), summon(소환),
//       각 보스의 signature는 이동·안전 지대·공격 순서가 다른 고유 패턴이다.
//       공통 패턴은 보조 기술로만 쓰며, 페이즈가 올라가도 예고 시간은 줄이지 않는다.
export const BOSSES = {
    1: { name: '알파 청토끼', title: '지면이 고동친다...', sheet: 'boss1', tint: 'normal', scale: 0.62, hp: 1400, speed: 48, dmg: 10,
        pacing: { opening: 3, phaseRest: 2.2, recovery: 1.5, chargeWarning: 1.15, chargeSpeed: 480, summons: 0.6 },
        signature: 'charge', signatureHint: '돌진 선 옆으로 피한 뒤 긴 빈틈을 노리세요.', phaseSummons: true,
        phases: [['charge', 'summon'], ['charge', 'ring', 'summon'], ['charge', 'ring', 'aimed']] },
    2: { name: '엘리트 청토끼', title: '전투 머신이 다가온다...', sheet: 'boss1', tint: 'elite', scale: 0.64, hp: 2240, speed: 66, dmg: 16,
        signature: 'barrage', signatureHint: '고정된 사격선 옆으로 빠지고 재장전 중 공격하세요.',
        phases: [['barrage'], ['barrage'], ['barrage']] },
    3: { name: '헌터 청토끼', title: '냄새를 맡았다...', sheet: 'boss1', tint: 'shadow', scale: 0.64, hp: 4930, speed: 118, dmg: 18, stealth: true,
        signature: 'hunt', signatureHint: '두 번의 돌진 예고선을 각각 옆으로 피하고, 멈춰 숨을 고를 때 공격하세요.',
        phases: [['hunt'], ['hunt'], ['hunt']] },
    4: { name: '프레데터 알파', title: '저격이다!', sheet: 'boss1', tint: 'toxic', scale: 0.66, hp: 8120, speed: 60, dmg: 20,
        signature: 'lockshot', signatureHint: '조준선이 멈추면 방향을 바꿔 두 번째 저격도 피하세요.',
        phases: [['lockshot'], ['lockshot'], ['lockshot']] },
    5: { name: '탱크 청토끼', title: '파괴의 병기가 온다...', sheet: 'boss1', tint: 'normal', scale: 0.85, hp: 12750, speed: 48, dmg: 26,
        signature: 'artillery', signatureHint: '전방 포격 원을 벗어나 옆이나 뒤에서 공격하세요.',
        phases: [['artillery'], ['artillery'], ['artillery']] },
    6: { name: '어보미네이션', title: '강에서 거대한 그림자가...', sheet: 'boss2', tint: 'normal', scale: 0.62, hp: 18000, speed: 52, dmg: 26,
        signature: 'toxicTide', signatureHint: '독 웅덩이 사이 비어 있는 출구로 빠져나가세요.', phaseSummons: true,
        phases: [['toxicTide'], ['toxicTide', 'summon'], ['toxicTide', 'summon']] },
    7: { name: '어쌔신 퀸', title: '뒤에서 날카로운 기척이...', sheet: 'boss2', tint: 'shadow', scale: 0.6, hp: 24800, speed: 78, dmg: 28,
        signature: 'crosscut', signatureHint: '첫 칼날을 피한 뒤 교차하는 두 번째 선도 확인하세요.',
        phases: [['crosscut'], ['crosscut'], ['crosscut']] },
    8: { name: '사이코틱 킹', title: '정신이 흔들린다...', sheet: 'boss2', tint: 'hallu', scale: 0.64, hp: 32550, speed: 58, dmg: 30, hallucinate: true,
        signature: 'echo', signatureHint: '환영의 탄막 틈으로 이동하고 반대쪽 메아리를 대비하세요.',
        phases: [['echo'], ['echo'], ['echo']] },
    9: { name: '브루투스 킹', title: '최강의 왕이 눈을 떴다!', sheet: 'bossKing', tint: 'normal', scale: 0.66, hp: 44800, speed: 60, dmg: 34,
        signature: 'faultline', signatureHint: '양옆 균열 사이로 피한 뒤 중앙 강타 전에 옆으로 이동하세요.',
        phases: [['faultline'], ['faultline', 'slam'], ['faultline', 'slam']] },
    10: { name: '청토끼 · 시간의 채권자', title: '마지막 계약의 시간이 다가온다...', sheet: 'bossKing', tint: 'elite', scale: 0.76, hp: 67200, speed: 64, dmg: 38, hallucinate: true,
        signature: 'contract', signatureHint: '금화 탄막을 비켜가고 모래시계 계약 원이 찰 때 안에 있지 마세요.',
        phases: [['contract'], ['contract'], ['contract']] },
};

export const PHASE_THRESHOLDS = [0.6, 0.25];

// 보스 체력 배율. hp 값은 기준치이며 실제 전투 체력은 hp × BOSS_HP_MULTIPLIER.
export const BOSS_HP_MULTIPLIER = 10;
export const bossMaxHp = stage => (BOSSES[stage]?.hp || 0) * BOSS_HP_MULTIPLIER;
