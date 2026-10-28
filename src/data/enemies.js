// 적 유형. hp/speed/dmg 는 스테이지 배율 적용 전 기본값.
// scale: 아틀라스 걷기 프레임 높이(112px) 대비 출력 배율
export const ENEMIES = {
    shambler: { name: '청토끼', sheet: 'rabbit1', tint: 'normal', scale: 0.52, hp: 10, speed: 44, dmg: 5, xp: 1, radius: 14, mass: 1 },
    runner: { name: '굶주린 청토끼', sheet: 'rabbit1', tint: 'pale', scale: 0.44, hp: 6, speed: 82, dmg: 5, xp: 1, radius: 12, mass: 0.7 },
    brute: { name: '변이 청토끼', sheet: 'rabbit2', tint: 'normal', scale: 0.6, hp: 36, speed: 38, dmg: 10, xp: 3, radius: 17, mass: 1.6 },
    spitter: { name: '산성 토사체', sheet: 'rabbit2', tint: 'toxic', scale: 0.54, hp: 20, speed: 42, dmg: 7, xp: 3, radius: 15, mass: 1,
        ranged: { range: 230, cooldown: 2.6, speed: 170, dmg: 8 } },
    bloater: { name: '팽창체', sheet: 'rabbit1', tint: 'bloat', scale: 0.72, hp: 26, speed: 30, dmg: 8, xp: 4, radius: 19, mass: 1.8,
        explode: { radius: 78, dmg: 14 } },
    splitter: { name: '기생 숙주', sheet: 'rabbit3', tint: 'normal', scale: 0.56, hp: 48, speed: 40, dmg: 11, xp: 5, radius: 16, mass: 1.5,
        split: { type: 'runner', count: 3 } },
    suicider: { name: '돌진 폭발체', sheet: 'rabbit2', tint: 'bloat', scale: 0.53, hp: 18, speed: 58, dmg: 7, xp: 3, radius: 14, mass: 1, unlockStage: 5,
        // 방향을 고정한 돌진 → 움직이지 않는 신관. 넓은 폭발은 원 안에만 피해를 준다.
        charge: { range: 320, warning: 0.85, duration: 0.8, speed: 430, turnRate: 0, fuse: 0.85, radius: 96, dmg: 26, damageCap: 40, shrapnel: 0 } },
    gunner: { name: '탄환 사냥꾼', sheet: 'rabbit3', tint: 'pale', scale: 0.55, hp: 28, speed: 36, dmg: 7, xp: 4, radius: 15, mass: 1.1, unlockStage: 6,
        // 산성탄(단발 곡선 덩어리)과 구별: 붉은 탄환 3발을 부채꼴로 동시 발사. 3발이 모두 맞지 않도록 탄당 피해는 낮춤.
        ranged: { range: 300, cooldown: 2.8, speed: 255, dmg: 6, warning: 0.7, kind: 'bullet', radius: 5, burst: 3, spread: 0.22 } },
    hulk: { name: '사슬 도살자', sheet: 'rabbit3', tint: 'shadow', scale: 0.82, hp: 130, speed: 34, dmg: 16, xp: 10, radius: 22, mass: 3.5 },
};

export const ELITE = { scale: 1.45, hp: 12, xp: 8, dmg: 1.7, speed: 1.12 };
// 엘리트는 절대 그 스테이지 보스보다 강하면 안 된다: 체력(방벽 포함)은 보스 체력의 15%, 접촉 피해는 보스 피해의 80%가 상한.
// (상한 전에는 6~9구역 사슬 도살자 엘리트가 보스 체력의 40~66%, 헬에서는 보스를 넘었다)
export const ELITE_BOSS_CAP = Object.freeze({ hp: 0.15, dmg: 0.8 });
// 필드 엘리트 외형 단계. 초반(1~3구역)은 기존 토끼 몸체에 붉은 색만 입힌다(sheet: null).
// 4구역부터는 최초 버전의 보스 스프라이트로 바뀌고, 7구역부터 끝까지 더 큰 boss2 몸체를 쓴다(왕 스프라이트는 쓰지 않는다).
// (현재 스테이지 보스는 전용 아트를 쓰므로 겹치지 않는다.) size = 토끼 걷기 높이 112px 기준 출력 높이 배율.
export const ELITE_SHEETS = Object.freeze([
    { from: 1, sheet: null, size: 1 },
    { from: 4, sheet: 'boss1', size: 1.15 },
    { from: 7, sheet: 'boss2', size: 1.3 },
]);
export function eliteSheet(stage) {
    let pick = ELITE_SHEETS[0];
    for (const s of ELITE_SHEETS) if (stage >= s.from) pick = s;
    return pick;
}

// 팽창체 사망 후 남는 산성 장판만 후반에 해금. 즉시 폭발은 그대로 유지한다.
export const DEATH_CLOUD_UNLOCK_STAGE = 5;
// All ordinary ranged spawn routes, including elite/forced/summoned mobs.
export const RANGED_UNLOCK_STAGE = 5;
// 총탄·산성탄을 쏘는 일반 적은 동시에 이 수까지만. 넘으면 같은 자리에 근접 청토끼가 대신 나온다.
export const MAX_RANGED_ALIVE = 6;

// Fewer bodies, sturdier individual enemies; movement/contact damage are unchanged.
// 1.62 → 1.9: 전반적으로 적이 너무 약하다는 피드백 반영.
export const ENEMY_TOUGHNESS_MULTIPLIER = 1.9;
// 접촉·탄 피해 전반 강화.
export const ENEMY_DAMAGE_MULTIPLIER = 1.15;
// 일반 청토끼(엘리트 제외) 강화: 적 수를 POPULATION_SCALE(0.7)로 줄인 만큼 한 마리가 더 단단하고 아프다.
// 경험치도 줄어든 수만큼 올려 레벨업 속도는 그대로 둔다.
export const MOB_STRENGTH = Object.freeze({ hp: 1.4, dmg: 1.1, xp: 1 / 0.7 });
// Fixed stage budgets, never derived from the player’s current damage/equipment.
// 희소 조정(적 수 ↓, 개체 체력·경험치 ↑)을 되돌렸다: 개체 수를 다시 늘리고(POPULATION_BOOST + 대군 이벤트)
// 개체당 경험치는 STAGE_XP_YIELD 로 낮춘다. 기존 이름은 유지하되 중립(1배) 값이다.
export const SPARSE_ENEMY_HP = Object.freeze([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
export const SPARSE_ENEMY_XP = Object.freeze([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
// 보스가 살아 있는 동안 일반 적 경험치 배율 (보스 체력이 커져 전투가 길어도 레벨업이 폭주하지 않게)
export const BOSS_FIGHT_XP_MULTIPLIER = 0.5;

const BEGINNER_SCALING = {
    1: { hp: 0.95, speed: 0.9, dmg: 0.85 },
    2: { hp: 1, speed: 0.95, dmg: 0.95 },
};
// 스테이지 안에서 시간이 지날수록 적이 단단해지는 비율. 집중하지 않은 빌드는 후반 웨이브를 못 따라간다.
export const IN_STAGE_HP_RAMP = 0.7;
const STANDARD_SCALING = { hp: 1, speed: 1, dmg: 1 };
// 초반 압박 강화: 초기 구역 적이 너무 쉽게 녹는다는 피드백. 1~4구역 일반 적·엘리트를 더 단단하고 아프게 만들고,
// 후반 곡선이 이미 가파른 5구역부터는 영향이 없다 (스테이지 경계에서 강도가 역전되지 않도록 점감).
export const EARLY_STAGE_PRESSURE = Object.freeze({
    1: Object.freeze({ hp: 1.45, speed: 1.06, dmg: 1.3 }),
    2: Object.freeze({ hp: 1.35, speed: 1.05, dmg: 1.22 }),
    3: Object.freeze({ hp: 1.22, speed: 1.03, dmg: 1.12 }),
    4: Object.freeze({ hp: 1.1, speed: 1.01, dmg: 1.05 }),
});
export const earlyPressure = stage => EARLY_STAGE_PRESSURE[stage] || STANDARD_SCALING;

// 스테이지별 배율
// 적 한 마리당 경험치 배율. 개체 수를 늘린 만큼 낮춰서 레벨업 속도를 억제한다.
export const STAGE_XP_YIELD = 0.55;
// 4스테이지 이후 스테이지당 추가 강화 (late = stage - 3)
export const LATE_STAGE_SCALING = Object.freeze({ hp: 0.22, speed: 0.02, dmg: 0.1 });
export function stageScaling(stage, t, duration) {
    const prog = Math.min(1, t / duration), late = Math.max(0, stage - 3);
    // Opening grace remains gentle; fixed sparse-stage HP and per-kill XP budgets follow below.
    const beginner = BEGINNER_SCALING[stage] || STANDARD_SCALING, early = earlyPressure(stage);
    return {
        // Equipment never changes this curve: permanent upgrades and good builds retain their power.
        hp: (1 + (stage - 1) * 0.6) * (1 + (stage - 1) * 0.14) * (1 + prog * IN_STAGE_HP_RAMP) * beginner.hp * ENEMY_TOUGHNESS_MULTIPLIER * SPARSE_ENEMY_HP[stage] * (1 + late * LATE_STAGE_SCALING.hp) * early.hp,
        speed: (1 + (stage - 1) * 0.035 + late * LATE_STAGE_SCALING.speed) * beginner.speed * early.speed,
        dmg: (1 + (stage - 1) * 0.24 + late * LATE_STAGE_SCALING.dmg) * beginner.dmg * ENEMY_DAMAGE_MULTIPLIER * early.dmg,
        xp: (1 + (stage - 1) * 0.15) * SPARSE_ENEMY_XP[stage] * STAGE_XP_YIELD,
    };
}
