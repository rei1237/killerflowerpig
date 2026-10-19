// 시작 테크(빌드 계열). 뱀파이어 서바이버즈의 캐릭터 선택처럼 첫 조합이 이후 성장 방향을 정한다.
// - start: 시작 무기 + 그 무기의 진화 짝 패시브(Lv1)
// - family: 이 테크의 '공명' 대상. 보유한 계열 아이템 수(무기·패시브 합산, 최대 6)로 공명 단계가 오른다.
// - tags: 공명 무기 보너스가 적용되는 무기 태그. 다른 계열 무기는 테크 보너스를 받지 않는다.
// - tiers: 공명 2/4/6개에서 누적 적용. weapon.* 는 태그 무기에만, player.* 는 캐릭터 전체에 적용.
// - imprints: 태그 무기 Lv3/5/7 각인 (테크별 성장 방향)

export const WEAPON_TAGS = Object.freeze({
    shotgun: ['projectile'], pistols: ['projectile'], rifle: ['projectile'],
    thorns: ['orbit'], cannon: ['beam'], saw: ['blade'],
    molotov: ['field'], gas: ['field'],
    scatter_rail: ['projectile'], burst_rail: ['projectile'], toxic_scatter: ['projectile', 'field'],
    lotus_bloom: ['orbit', 'beam'], orbit_saw: ['orbit', 'blade'], venom_saw: ['blade', 'field'],
    plague_fire: ['field'], ember_lance: ['beam', 'field'], absolute_bloom: ['beam', 'orbit', 'field'],
});

export const RESONANCE_STEPS = Object.freeze([2, 4, 6]);

// 각인(imprint): 테크 태그가 맞는 무기가 Lv3/5/7 에 도달하면 테크마다 다른 방향으로 추가 강화된다.
// 같은 무기라도 어떤 테크로 출격했는지에 따라 성장 방향이 달라진다.
export const IMPRINT_LEVELS = Object.freeze([3, 5, 7]);
// 테크 부조화: 테크 태그가 맞지 않는 무기는 피해가 줄어든다 (섞어 쓰면 손해).
export const MISMATCH_DAMAGE = 0.8;
// 레벨업 카드 가중치
export const FAMILY_WEIGHT = 2.2;
export const OFF_FAMILY_NEW_WEAPON_WEIGHT = 0.35;
// 이 레벨마다 테크 계열 카드 1장을 보장 (후보가 있을 때만)
export const FAMILY_GUARANTEE_EVERY = 4;

export const TECHS = Object.freeze({
    gunline: {
        name: '탄막 사수', icon: '🎯', color: '#9fd3ff',
        summary: '산탄과 관통탄으로 화면을 쓸어버리는 투사체 테크',
        start: { weapon: 'shotgun', passive: 'magazine' },
        family: { weapons: ['shotgun', 'rifle', 'pistols'], passives: ['magazine', 'scope', 'focus'] },
        tags: ['projectile'],
        route: ['산탄총 + 탄창 확장 → 도살자의 산탄', '노획 소총 + 조준경 → 레일 소총', '두 진화 → 관통 산탄포'],
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
        name: '연꽃 정원', icon: '🌸', color: '#ffb3d6',
        summary: '회전 꽃잎과 광선으로 버티며 성장하는 생존 테크',
        start: { weapon: 'thorns', passive: 'regen' },
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
        name: '역병 화염', icon: '🔥', color: '#ffb36b',
        summary: '불길과 독구름 장판으로 무리를 녹이는 지역 장악 테크',
        start: { weapon: 'molotov', passive: 'spread' },
        family: { weapons: ['molotov', 'gas', 'cannon'], passives: ['spread', 'sap', 'hide'] },
        tags: ['field'],
        route: ['화염병 + 확산 → 지옥 불꽃길', '독가스 수류탄 + 회전 수액 → 역병 안개', '두 진화 → 역병 화염병'],
        imprints: {
            3: { label: '역병 각인 I · 장판 지속 +25%', mod: { duration: 0.25 } },
            5: { label: '역병 각인 II · 범위 +20% · 둔화 +10%', mod: { area: 0.2, slow: 0.1 } },
            7: { label: '역병 각인 III · 장판 피해 +30%', mod: { dmg: 0.3 } },
        },
        tiers: [
            { label: '장판 지속 +20%', weapon: { duration: 0.2 } },
            { label: '장판 범위 +15% · 둔화 +10%', weapon: { area: 0.15, slow: 0.1 } },
            { label: '장판 피해 +35%', weapon: { dmg: 0.35 } },
        ],
    },
    executioner: {
        name: '처형자', icon: '☠️', color: '#e6c6ff',
        summary: '치명타를 쌓아 약해진 적을 즉시 끝내는 정밀 테크',
        start: { weapon: 'pistols', passive: 'focus' },
        family: { weapons: ['pistols', 'rifle', 'saw'], passives: ['focus', 'whet', 'madness'] },
        tags: ['projectile', 'blade'],
        route: ['쌍권총 + 집중 → 처형인의 쌍권총', '노획 소총 + 조준경 → 레일 소총', '두 진화 → 연쇄 관통권총'],
        imprints: {
            3: { label: '처형 각인 I · 치명타 +8%', mod: { crit: 0.08 } },
            5: { label: '처형 각인 II · 치명타 +8% · 피해 +15%', mod: { crit: 0.08, dmg: 0.15 } },
            7: { label: '처형 각인 III · 체력 8% 이하 처형 · 피해 +15%', mod: { execute: 0.08, dmg: 0.15 } },
        },
        tiers: [
            { label: '사격·톱날 치명타 +10%', weapon: { crit: 0.1 } },
            { label: '모든 치명타 피해 2배 → 2.6배', player: { critMul: 0.6 } },
            { label: '체력 10% 이하 일반 적 처형 · 피해 +15%', weapon: { execute: 0.1, dmg: 0.15 } },
        ],
    },
    butcher: {
        name: '도살자', icon: '🪚', color: '#ff8f8f',
        summary: '톱날과 출혈로 살점을 갈아내는 근접 난전 테크',
        start: { weapon: 'saw', passive: 'whet' },
        family: { weapons: ['saw', 'shotgun', 'thorns'], passives: ['whet', 'hide', 'heart'] },
        tags: ['blade', 'orbit'],
        route: ['뼈 톱날 + 날 연마 → 척추 분쇄기', '연꽃 가시 + 재생하는 살점 → 피의 연꽃', '두 진화 → 연꽃 톱니진'],
        imprints: {
            3: { label: '도살 각인 I · 적중 시 출혈', mod: { bleed: 3 } },
            5: { label: '도살 각인 II · 피해 +25%', mod: { dmg: 0.25 } },
            7: { label: '도살 각인 III · 크기 +20% · 피해 +20% · 출혈 강화', mod: { area: 0.2, dmg: 0.2, bleed: 5 } },
        },
        tiers: [
            { label: '톱날·회전 공격에 출혈 부여', weapon: { bleed: 3 } },
            { label: '최대 체력 +30 · 방어 +1', player: { maxHp: 30, armor: 1 } },
            { label: '톱날·회전 피해 +35% · 톱날/꽃잎 +1', weapon: { dmg: 0.35, amount: 1 } },
        ],
    },
});

export const DEFAULT_TECH = 'gunline';
