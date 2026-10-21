// 시작 테크(빌드 계열). 뱀파이어 서바이버즈의 캐릭터 선택처럼 첫 조합이 이후 성장 방향을 정한다.
// - start: 대표 시작 무기 + 그 무기의 진화 짝 패시브(Lv1). weapons 의 무기 2종을 모두 Lv1로 지급 (모든 테크 무기 2칸으로 시작).
// - family: 이 테크의 '공명' 대상. 보유한 계열 아이템 수(무기·패시브 합산, 최대 6)로 공명 단계가 오른다.
// - tags: 공명 무기 보너스가 적용되는 무기 태그. 다른 계열 무기는 테크 보너스를 받지 않는다.
// - tiers: 공명 2/4/6개에서 누적 적용. weapon.* 는 태그 무기에만, player.* 는 캐릭터 전체에 적용.
// - imprints: 태그 무기 Lv3/5/7 각인 (테크별 성장 방향)

export const WEAPON_TAGS = Object.freeze({
    shotgun: ['projectile'], pistols: ['projectile'], rifle: ['projectile'],
    thorns: ['orbit'], cannon: ['beam'], saw: ['blade'], sword: ['blade'],
    molotov: ['field'], gas: ['field'],
    scatter_rail: ['projectile'], burst_rail: ['projectile'], toxic_scatter: ['projectile', 'field'],
    lotus_bloom: ['orbit', 'beam'], orbit_saw: ['orbit', 'blade'], sword_wheel: ['blade'], venom_saw: ['blade', 'field'],
    plague_fire: ['field'], ember_lance: ['beam', 'field'], absolute_bloom: ['beam', 'orbit', 'field'],
    doom_barrage: ['projectile'], plague_end: ['field', 'beam'], guillotine: ['projectile', 'blade'], carnage_saw: ['blade', 'orbit'],
});

export const RESONANCE_STEPS = Object.freeze([2, 4, 6]);

// 각인(imprint): 테크 태그가 맞는 무기가 Lv3/5/7 에 도달하면 테크마다 다른 방향으로 추가 강화된다.
// 같은 무기라도 어떤 테크로 출격했는지에 따라 성장 방향이 달라진다.
export const IMPRINT_LEVELS = Object.freeze([3, 5, 7]);
// 테크 부조화: 테크 태그가 맞지 않는 무기는 피해가 줄어든다 (섞어 쓰면 손해).
export const MISMATCH_DAMAGE = 0.8;
// 테크 밸런스: 태그가 맞는 무기에 곱하는 피해 배율 (power).
// 공격형 테크(탄막·역병·처형)는 서로 비슷하게, 생존 보너스가 큰 테크(연꽃·도살)는 약 90% 수준으로 맞춘다.
// 계열 루트 빌드(진화 2종 → 최종 조합)를 보스·흩어진 무리·통로·포위 4장면에서 시뮬레이션해 산출.
// 레벨업 카드 가중치
export const FAMILY_WEIGHT = 2.2;
export const OFF_FAMILY_NEW_WEAPON_WEIGHT = 0.35;
// 이 레벨마다 테크 계열 카드 1장을 보장 (후보가 있을 때만)
export const FAMILY_GUARANTEE_EVERY = 4;

export const TECHS = Object.freeze({
    gunline: {
        strength: '전방 집중 화력·관통에 강함', weakness: '뒤쪽 포위에 약하고 별도 생존 보너스가 없음',
        name: '탄막 사수', icon: '🎯', color: '#9fd3ff', power: 1.0,
        summary: '산탄과 관통탄으로 화면을 쓸어버리는 투사체 테크',
        start: { weapon: 'shotgun', weapons: ['shotgun', 'rifle'], passive: 'magazine' },
        family: { weapons: ['shotgun', 'rifle', 'pistols'], passives: ['magazine', 'scope', 'focus'] },
        tags: ['projectile'],
        route: ['산탄총 + 탄창 확장 → 도살자의 산탄', '노획 소총 + 조준경 → 레일 소총', '두 진화 → 관통 산탄포 (쌍권총 진화까지 3종 → 절대 무기 종말의 탄막)'],
        imprints: {
            3: { label: '탄막 각인 I · 투사체 +1', mod: { amount: 1 } },
            5: { label: '탄막 각인 II · 관통 +2 · 탄속 +20%', mod: { pierce: 2, speed: 0.2 } },
            7: { label: '탄막 각인 III · 투사체 +1 · 재장전 -10%', mod: { amount: 1, cd: -0.1 } },
        },
        tiers: [
            { label: '투사체 무기 탄 +1', weapon: { amount: 1 } },
            { label: '투사체 관통 +1 · 피해 +15%', weapon: { pierce: 1, dmg: 0.15 } },
            { label: '투사체 피해 +20% · 재장전 -15%', weapon: { dmg: 0.2, cd: -0.15 } },
        ],
    },
    bloom: {
        strength: '최대 3발이 겹치는 일직선 광선·강화 집중 사격·접촉 소모형 가시·재생', weakness: '자동 광선은 한 방향 일직선만 공격·보스에게는 광선 중복 없이 1발, 소모된 가시는 다시 자랄 때까지 빈틈이 생김',
        name: '연꽃 정원', icon: '🌸', color: '#ffb3d6', power: 2.6,
        summary: '회전 꽃잎과 광선으로 버티며 성장하는 생존 테크',
        start: { weapon: 'thorns', weapons: ['thorns', 'cannon'], passive: 'regen' },
        family: { weapons: ['thorns', 'cannon', 'saw'], passives: ['regen', 'pollen', 'heart'] },
        tags: ['orbit', 'beam'],
        route: ['연꽃 가시 + 재생하는 살점 → 피의 연꽃', '꽃잎포 + 꽃가루 → 개화 꽃잎포', '두 진화 → 만개 연꽃포 (화염병 추가 시 절대 만개)'],
        imprints: {
            3: { label: '개화 각인 I · 범위 +15%', mod: { area: 0.15 } },
            5: { label: '개화 각인 II · 지속 +25% · 재사용 -10%', mod: { duration: 0.25, cd: -0.1 } },
            7: { label: '개화 각인 III · 범위 +20% · 피해 +20%', mod: { area: 0.2, dmg: 0.2 } },
        },
        tiers: [
            { label: '최대 체력 +20', player: { maxHp: 20 } },
            { label: '회전·광선 재사용 -12% · 재생 +0.5/s', weapon: { cd: -0.12 }, player: { regen: 0.5 } },
            { label: '회전·광선 피해 +35% · 범위 +15%', weapon: { dmg: 0.35, area: 0.15 } },
        ],
    },
    plague: {
        strength: '빠른 투척·지속 장판·둔화로 통로 장악', weakness: '진화 전 근접·원거리 압박에 약하고 장판 이탈 시 지속 피해가 끊김',
        name: '역병 화염', icon: '🔥', color: '#ffb36b', power: 0.85,
        summary: '빠른 투척과 지속 장판·둔화로 통로를 장악하는 테크',
        start: { weapon: 'molotov', weapons: ['molotov', 'gas'], passive: 'spread' },
        family: { weapons: ['molotov', 'gas', 'cannon'], passives: ['spread', 'sap', 'hide'] },
        tags: ['field'],
        route: ['화염병 + 확산 → 지옥 불꽃길', '독가스 수류탄 + 회전 수액 → 역병 안개', '두 진화 → 역병 화염병 (꽃잎포 진화까지 3종 → 절대 무기 역병 종언)'],
        imprints: {
            3: { label: '역병 각인 I · 장판 지속 +25%', mod: { duration: 0.25 } },
            5: { label: '역병 각인 II · 장판 피해 +25% · 범위 +20% · 둔화 +10%', mod: { dmg: 0.25, area: 0.2, slow: 0.1 } },
            7: { label: '역병 각인 III · 장판 피해 +30%', mod: { dmg: 0.3 } },
        },
        tiers: [
            { label: '투척 +1 · 장판 지속 +20% · 재사용 -15% · 둔화 +20%', weapon: { amount: 1, duration: 0.2, cd: -0.15, slow: 0.2 } },
            { label: '장판 범위 +15% · 둔화 +10%', weapon: { area: 0.15, slow: 0.1 } },
            { label: '장판 피해 +35%', weapon: { dmg: 0.35 } },
        ],
    },
    executioner: {
        strength: '쌍권총 치명타 Lv1 3.25배→4배(배율 +0.75) · 집중 조준 치명타 +12%p · 일반 적 3~8% 확률 즉사', weakness: '처형은 보스·정예에게 적용되지 않고 방어 보너스가 없음',
        name: '처형자', icon: '☠️', color: '#e6c6ff', power: 0.82,
        summary: '쌍권총 치명타·집중 조준과 체력 무관 확률 처형의 정밀 테크',
        start: { weapon: 'pistols', weapons: ['pistols', 'rifle'], passive: 'focus' },
        family: { weapons: ['pistols', 'rifle', 'saw'], passives: ['focus', 'whet', 'madness'] },
        tags: ['projectile', 'blade'],
        route: ['쌍권총 + 집중 → 처형인의 쌍권총', '노획 소총 + 조준경 → 레일 소총', '두 진화 → 연쇄 관통권총 (뼈 톱날 진화까지 3종 → 절대 무기 심판의 단두대)'],
        imprints: {
            3: { label: '처형 각인 I · 치명타 +8%', mod: { crit: 0.08 } },
            5: { label: '처형 각인 II · 치명타 +8% · 피해 +15% · 쌍권총 처형 +2%p', mod: { crit: 0.08, dmg: 0.15 } },
            7: { label: '처형 각인 III · 피해 +15%', mod: { dmg: 0.15 } },
        },
        tiers: [
            { label: '사격·톱날 치명타 +10% · 재사용 -8%', weapon: { crit: 0.1, cd: -0.08 } },
            { label: '모든 치명타 피해 3배 → 3.6배', player: { critMul: 0.6 } },
            { label: '쌍권총 일반 적 처형 +3%p · 피해 +15%', weapon: { dmg: 0.15 } },
        ],
    },
    butcher: {
        strength: '검의 넓은 근접 베기·예측 조준 톱날·출혈과 방어', weakness: '후속 반사는 지형·거리 영향을 받고 먼 단일 적 추적은 약함',
        name: '도살자', icon: '🪚', color: '#ff8f8f', power: 2.0,
        summary: '검과 예측 조준 톱날을 각각 성장시키고 조합하는 근접 전사 테크',
        start: { weapon: 'sword', weapons: ['sword', 'saw'], passive: 'whet' },
        family: { weapons: ['sword', 'saw', 'shotgun', 'thorns'], passives: ['whet', 'hide', 'heart'] },
        tags: ['blade', 'orbit'],
        route: ['도살검 + 날 연마 → 핏빛 연꽃검', '뼈 톱날 + 날 연마 → 척추 분쇄기', '두 진화 Lv.8 → 학살자의 검륜 (무기 슬롯 2칸 → 1칸)', '기존 톱날·산탄총·연꽃 가시의 세 진화 → 절대 무기 학살 톱니바퀴'],
        imprints: {
            3: { label: '도살 각인 I · 적중 시 출혈', mod: { bleed: 3 } },
            5: { label: '도살 각인 II · 피해 +25%', mod: { dmg: 0.25 } },
            7: { label: '도살 각인 III · 크기 +20% · 피해 +20% · 출혈 강화', mod: { area: 0.2, dmg: 0.2, bleed: 5 } },
        },
        tiers: [
            { label: '검·톱날·회전 출혈 · 재사용 -15%', weapon: { bleed: 3, cd: -0.15 } },
            { label: '최대 체력 +30 · 방어 +1', player: { maxHp: 30, armor: 1 } },
            { label: '검·톱날·회전 피해 +35% · 검 베기 폭 확대 · 톱날/꽃잎 +1', weapon: { dmg: 0.35, amount: 1 } },
        ],
    },
});

export const DEFAULT_TECH = 'gunline';

// The single-weapon field remains the primary weapon/evolution partner.
// Only new-run initialization grants this list; checkpoint restoration never does.
export function techStartingWeapons(tech) {
    return [...new Set(tech?.start.weapons || (tech?.start.weapon ? [tech.start.weapon] : []))];
}
