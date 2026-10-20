import { FUSED_WEAPONS } from './fusions.js';
// 무기 / 패시브 / 진화 정의.
// levels[i] = (i+2)레벨 도달 시 누적 적용되는 보정. cd/area/speed/duration 은 배율 가산(0.1 = +10%).
export const MAX_WEAPONS = 6;
// 보조 아이템(패시브)은 슬롯을 차지하지 않는다: 12종 모두 획득·강화 가능.
export const WEAPON_MAX_LEVEL = 8;
export const PASSIVE_MAX_LEVEL = 5;

export const WEAPONS = {
    shotgun: {
        name: '12게이지 산탄총', icon: '💥', color: '#ffb36b',
        desc: '가장 가까운 적에게 부채꼴 산탄을 퍼붓는다.',
        base: { dmg: 9, cd: 1.0, amount: 5, speed: 540, duration: 0.42, pierce: 2, area: 1, spread: 0.6 },
        levels: [
            { amount: 1, t: '산탄 +1' }, { dmg: 3, t: '피해 +3' }, { cd: -0.1, t: '재장전 -10%' },
            { amount: 2, t: '산탄 +2' }, { pierce: 1, t: '관통 +1' }, { dmg: 4, t: '피해 +4' },
            { amount: 2, cd: -0.1, t: '산탄 +2, 재장전 -10%' },
        ],
        evolve: { with: 'magazine', name: '도살자의 산탄', icon: '🩸', desc: '관통 산탄 + 출혈. 살점이 갈려 나간다.',
            mods: { dmg: 1.35, amount: 1.5, pierce: 3, bleed: 4 } },
    },
    pistols: {
        name: '쌍권총', icon: '🔫', color: '#ffd27a',
        desc: '치명타 특화 초고속 연사. 양손으로 가장 가까운 적에게 탄을 쏟아붓고, 치명타는 3배 피해 (레벨업으로 최대 4배).',
        base: { dmg: 4, cd: 0.3, amount: 1, speed: 720, duration: 0.9, pierce: 1, area: 1, crit: 0.1, critBonus: 0 },
        levels: [
            { amount: 1, t: '탄 +1' }, { critBonus: 0.5, t: '치명타 피해 +50%' }, { amount: 1, dmg: 2, t: '탄 +1, 피해 +2' },
            { crit: 0.1, t: '치명타 확률 +10%' }, { cd: -0.15, crit: 0.1, t: '연사 +15%, 치명타 확률 +10%' }, { dmg: 3, critBonus: 0.5, t: '피해 +3, 치명타 피해 +50%' },
            { amount: 1, crit: 0.1, cd: -0.1, t: '탄 +1, 치명타 확률 +10%, 연사 +10%' },
        ],
        evolve: { with: 'focus', name: '처형인의 쌍권총', icon: '☠️', desc: '연사 +40%, 피해 +30%, 치명타 확률 +30%, 치명타 피해 +80%, 관통 +2. 체력 15% 이하의 적은 즉시 처형.',
            mods: { dmg: 1.3, crit: 0.3, critBonus: 0.8, execute: 0.15, cd: 0.6, pierce: 2 } },
    },
    thorns: {
        name: '연꽃 가시', icon: '🌸', color: '#ff4fa0',
        desc: '날카로운 꽃잎이 몸 주위를 돌며 베어낸다.',
        base: { dmg: 8, cd: 3.6, amount: 2, speed: 3.4, duration: 3.0, area: 1, radius: 68, hitCd: 0.45 },
        levels: [
            { amount: 1, t: '꽃잎 +1' }, { area: 0.15, t: '반경 +15%' }, { dmg: 3, t: '피해 +3' },
            { duration: 0.3, t: '지속 +30%' }, { amount: 1, t: '꽃잎 +1' }, { dmg: 4, t: '피해 +4' },
            { amount: 1, duration: 0.3, t: '꽃잎 +1, 지속 +30%' },
        ],
        evolve: { with: 'regen', name: '피의 연꽃', icon: '🥀', desc: '멈추지 않고 회전하며, 벤 살점으로 체력을 흡수한다.',
            mods: { dmg: 1.4, amount: 1.25, permanent: 1, lifesteal: 0.3 } },
    },
    rifle: {
        name: '노획 소총', icon: '🎯', color: '#e8f0ff',
        desc: '적 무리를 꿰뚫는 고위력 관통탄.',
        base: { dmg: 22, cd: 1.6, amount: 1, speed: 950, duration: 0.8, pierce: 5, area: 1 },
        levels: [
            { dmg: 8, t: '피해 +8' }, { pierce: 3, t: '관통 +3' }, { cd: -0.12, t: '재장전 -12%' },
            { amount: 1, t: '탄 +1' }, { dmg: 10, t: '피해 +10' }, { pierce: 4, t: '관통 +4' },
            { cd: -0.15, amount: 1, t: '탄 +1, 재장전 -15%' },
        ],
        evolve: { with: 'scope', name: '레일 소총', icon: '⚡', desc: '관통 +10 전자기탄. 일직선상의 적을 꿰뚫는다.',
            mods: { dmg: 1.35, pierce: 10, area: 1.3 } },
    },
    molotov: {
        name: '화염병', icon: '🔥', color: '#ff7a1a',
        desc: '적에게 화염병을 던져 불바다를 만든다.',
        base: { dmg: 5, cd: 3.0, amount: 1, speed: 1, duration: 2.6, area: 1, radius: 46, tick: 0.3 },
        levels: [
            { amount: 1, t: '화염병 +1' }, { area: 0.2, t: '범위 +20%' }, { dmg: 2, t: '피해 +2' },
            { duration: 0.35, t: '지속 +35%' }, { amount: 1, t: '화염병 +1' }, { cd: -0.15, t: '재사용 -15%' },
            { dmg: 3, area: 0.15, t: '피해 +3, 범위 +15%' },
        ],
        evolve: { with: 'spread', name: '지옥 불꽃길', icon: '🌋', desc: '걸어간 자리마다 지옥불이 남는다.',
            mods: { dmg: 2, area: 1.6, duration: 2.2, trail: 1 } },
    },
    cannon: {
        name: '꽃잎포', icon: '🌺', color: '#ff69b4',
        desc: '진행 방향으로 꽃잎 광선을 일직선 발사.',
        base: { dmg: 28, cd: 4.6, amount: 1, speed: 1, duration: 0.35, area: 1, length: 520, width: 38 },
        levels: [
            { dmg: 12, t: '피해 +12' }, { area: 0.25, t: '굵기 +25%' }, { cd: -0.12, t: '재사용 -12%' },
            { amount: 1, t: '반대 방향 동시 발사' }, { dmg: 15, t: '피해 +15' }, { cd: -0.15, t: '재사용 -15%' },
            { dmg: 20, area: 0.2, t: '피해 +20, 굵기 +20%' },
        ],
        evolve: { with: 'pollen', name: '개화 꽃잎포', icon: '💮', desc: '네 방향으로 피어나는 진화 꽃잎 광선. 절대 만개의 재료가 된다.',
            mods: { dmg: 1.5, amount: 2, area: 1.25 } },
    },
    gas: {
        name: '독가스 수류탄', icon: '☣️', color: '#7dff4a',
        desc: '독구름이 적을 느리게 하고 녹인다.',
        base: { dmg: 3, cd: 4.5, amount: 1, speed: 1, duration: 20, area: 1, radius: 98, tick: 0.4, slow: 0.4 }, // 독안개 지속 4초 → 20초
        levels: [
            { area: 0.15, t: '범위 +15%' }, { dmg: 2, t: '피해 +2' }, { duration: 0.25, t: '지속 +25%' },
            { amount: 1, t: '수류탄 +1' }, { slow: 0.1, t: '둔화 +10%' }, { cd: -0.15, t: '재사용 -15%' },
            { dmg: 3, amount: 1, t: '피해 +3, 수류탄 +1' },
        ],
        evolve: { with: 'sap', name: '역병 안개', icon: '🦠', desc: '안개가 연이를 따라다니며 모든 것을 부패시킨다.',
            mods: { dmg: 2, area: 1.4, slow: 0.2, follow: 1 } },
    },
    saw: {
        name: '뼈 톱날', icon: '⚙️', color: '#e9dcc0',
        desc: '화면 가장자리에 튕기는 회전 톱날.',
        base: { dmg: 10, cd: 3.4, amount: 1, speed: 360, duration: 3, area: 1, hitCd: 0.3 },
        levels: [
            { amount: 1, t: '톱날 +1' }, { dmg: 4, t: '피해 +4' }, { speed: 0.2, t: '속도 +20%' },
            { duration: 0.3, t: '지속 +30%' }, { amount: 1, t: '톱날 +1' }, { dmg: 5, t: '피해 +5' },
            { amount: 1, area: 0.2, t: '톱날 +1, 크기 +20%' },
        ],
        evolve: { with: 'whet', name: '척추 분쇄기', icon: '🦴', desc: '척추뼈를 이어 만든 거대 톱날. 출혈을 일으킨다.',
            mods: { dmg: 1.8, amount: 2, area: 1.35, bleed: 3 } },
    },
    ...FUSED_WEAPONS,
};

export const PASSIVES = {
    magazine: { name: '탄창 확장', icon: '📦', desc: '모든 무기의 투사체 수가 무기 투사체에 비례해 증가 (Lv5 +50%). 투사체가 적은 무기는 남는 비율만큼 피해가 늘어난다.', per: '투사체 +10%' },
    focus: { name: '집중', icon: '👁️', desc: '치명타 확률 +7% (피해 3배)', per: '치명타 +7%' },
    sap: { name: '회전 수액', icon: '🧪', desc: '경험치 획득 +8%', per: '경험치 +8%' },
    scope: { name: '조준경', icon: '🔭', desc: '관통 투사체의 관통 +1 (Lv1·3·5) · 탄속 +5%', per: '관통 +1 (Lv1·3·5) · 탄속 +5%' },
    spread: { name: '확산', icon: '🫧', desc: '공격 범위 +10%', per: '범위 +10%' },
    pollen: { name: '꽃가루 장막', icon: '🌼', desc: '주기적으로 피격 1회를 완전히 막는 꽃가루 보호막. 막을 때 주변 적을 밀쳐낸다 (재충전 12초 → Lv5 6초)', per: '보호막 재충전 단축' },
    whet: { name: '날 연마', icon: '🪓', desc: '모든 피해 +10%', per: '피해 +10%' },
    heart: { name: '썩은 심장', icon: '🫀', desc: '최대 체력 +20', per: '최대 HP +20' },
    regen: { name: '자동 회복 · 재생하는 살점', icon: '🩸', desc: '전투 중 초당 체력 +0.3 자동 회복 (최대 Lv.5)' , per: '재생 +0.3/s' },
    nose: { name: '자석 코', icon: '🐽', desc: '경험치 획득 범위 +30%', per: '범위 +30%' },
    madness: { name: '광기', icon: '🌀', desc: '이동 속도 +7%', per: '이속 +7%' },
    hide: { name: '철갑 피부', icon: '🛡️', desc: '받는 피해 -1 (방어)', per: '방어 +1' },
};

// 탄창 확장: 무기 투사체 수에 비례해 증가 (Lv당 +10%). 정수로 못 늘린 나머지 비율은 피해로 환산한다.
export const MAGAZINE_BONUS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export const STARTING_WEAPON = 'shotgun';

// 등급 역전 방지 보정 (피해 배율).
// 규칙: 진화 무기 > 모든 일반 무기 Lv8, 조합 무기 Lv1 > 모든 진화 무기, 절대 등급 Lv1 > 모든 조합 무기 Lv8.
// tests/tier-order.mjs 가 실제 전투 시뮬레이션으로 이 순서를 검증한다.
export const TIER_POWER = Object.freeze({
    evolved: Object.freeze({ thorns: 2.4, cannon: 1.6, gas: 1.75, saw: 1.3 }),
    fused: Object.freeze({ lotus_bloom: 2.4, venom_saw: 2.25, orbit_saw: 2.25, toxic_scatter: 1.15, plague_fire: 0.85, absolute_bloom: 1.1,
        doom_barrage: 1.2, plague_end: 0.95, guillotine: 1.45, carnage_saw: 2.1 }),
});
// 조합 무기가 계승한 코어(sourceId)는 조합 무기의 보정을 함께 받는다.
export function tierPower(w) {
    if (w.sourceId) return TIER_POWER.fused[w.sourceId] || 1;
    if (WEAPONS[w.id]?.fusionOnly) return TIER_POWER.fused[w.id] || 1;
    return w.evolved ? (TIER_POWER.evolved[w.id] || 1) : 1;
}
