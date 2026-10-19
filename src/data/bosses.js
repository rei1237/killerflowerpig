// 보스 정의. phases[i] = HP 구간별 패턴 목록 (100-60%, 60-25%, 25-0%)
// 패턴: charge(돌진), ring(원형탄), spiral(나선탄), aimed(조준 부채꼴), summon(소환),
//       pools(산성 장판), slam(내려찍기), snipe(조준선 저격), blink(순간이동)
export const BOSSES = {
    1: { name: '알파 청토끼', title: '지면이 고동친다...', sheet: 'boss1', tint: 'normal', scale: 0.62, hp: 520, speed: 48, dmg: 10,
        pacing: { opening: 3, phaseRest: 2.2, recovery: 1.5, chargeWarning: 1.15, chargeSpeed: 480, summons: 0.6 },
        phases: [['charge', 'summon'], ['charge', 'ring', 'summon'], ['charge', 'ring', 'aimed']] },
    2: { name: '엘리트 청토끼', title: '전투 머신이 다가온다...', sheet: 'boss1', tint: 'elite', scale: 0.64, hp: 1600, speed: 66, dmg: 16,
        phases: [['aimed', 'charge'], ['aimed', 'charge', 'ring'], ['aimed', 'ring', 'charge', 'summon']] },
    3: { name: '헌터 청토끼', title: '냄새를 맡았다...', sheet: 'boss1', tint: 'shadow', scale: 0.64, hp: 3400, speed: 72, dmg: 18, stealth: true,
        phases: [['charge', 'aimed'], ['charge', 'aimed', 'summon'], ['blink', 'charge', 'ring']] },
    4: { name: '프레데터 알파', title: '저격이다!', sheet: 'boss1', tint: 'toxic', scale: 0.66, hp: 5600, speed: 60, dmg: 20,
        phases: [['snipe', 'summon'], ['snipe', 'aimed', 'summon'], ['snipe', 'ring', 'aimed', 'pools']] },
    5: { name: '탱크 청토끼', title: '파괴의 병기가 온다...', sheet: 'boss1', tint: 'normal', scale: 0.85, hp: 8500, speed: 48, dmg: 26,
        phases: [['ring', 'slam'], ['ring', 'slam', 'spiral'], ['spiral', 'slam', 'charge', 'ring']] },
    6: { name: '어보미네이션', title: '강에서 거대한 그림자가...', sheet: 'boss2', tint: 'normal', scale: 0.62, hp: 12000, speed: 52, dmg: 26,
        phases: [['pools', 'ring'], ['pools', 'ring', 'summon'], ['pools', 'spiral', 'summon', 'slam']] },
    7: { name: '어쌔신 퀸', title: '뒤에서 날카로운 기척이...', sheet: 'boss2', tint: 'shadow', scale: 0.6, hp: 16000, speed: 78, dmg: 28,
        phases: [['blink', 'aimed'], ['blink', 'aimed', 'charge'], ['blink', 'charge', 'spiral', 'aimed']] },
    8: { name: '사이코틱 킹', title: '정신이 흔들린다...', sheet: 'boss2', tint: 'hallu', scale: 0.64, hp: 21000, speed: 58, dmg: 30, hallucinate: true,
        phases: [['spiral', 'pools'], ['spiral', 'pools', 'blink'], ['spiral', 'blink', 'ring', 'summon']] },
    9: { name: '브루투스 킹', title: '최강의 왕이 눈을 떴다!', sheet: 'bossKing', tint: 'normal', scale: 0.66, hp: 28000, speed: 60, dmg: 34,
        phases: [['spiral', 'ring', 'charge'], ['spiral', 'ring', 'charge', 'summon', 'slam'], ['spiral', 'slam', 'charge', 'pools', 'ring']] },
    10: { name: '청토끼 · 시간의 채권자', title: '마지막 계약의 시간이 다가온다...', sheet: 'bossKing', tint: 'elite', scale: 0.76, hp: 42000, speed: 64, dmg: 38, hallucinate: true,
        phases: [['spiral', 'ring', 'charge', 'summon'], ['spiral', 'snipe', 'pools', 'charge', 'slam'], ['spiral', 'ring', 'blink', 'snipe', 'pools', 'slam', 'summon']] },
};

export const PHASE_THRESHOLDS = [0.6, 0.25];
