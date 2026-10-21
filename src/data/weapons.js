import { FUSED_WEAPONS } from './fusions.js';
// 무기 / 패시브 / 진화 정의.
// levels[i] = (i+2)레벨 도달 시 누적 적용되는 보정. cd/area/speed/duration 은 배율 가산(0.1 = +10%).
export const MAX_WEAPONS = 6;
// 보조 아이템(패시브)은 슬롯을 차지하지 않는다: 12종 모두 획득·강화 가능.
export const WEAPON_MAX_LEVEL = 8;
export const PASSIVE_MAX_LEVEL = 5;
// Applied once to actual Cannon-family beam impacts, after stat caps/passives.
// Mixed final weapons keep their non-beam damage unchanged.
export const CANNON_IMPACT_MULTIPLIER = 2;
export const CANNON_MISMATCH_DAMAGE = .95;

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
            mods: { dmg: 1.35, amount: 1.5, pierce: 3, bleed: 4, duration: 1.3 } },
    },
    pistols: {
        name: '쌍권총', icon: '🔫', color: '#ffd27a',
        desc: '치명타 특화 초고속 연사. 양손으로 가장 가까운 적에게 탄을 쏟아붓고, 기본 치명타 확률 15%, 피해 3.25배 (레벨업으로 최대 4.25배).',
        base: { dmg: 4, cd: 0.3, amount: 1, speed: 720, duration: 0.9, pierce: 1, area: 1, crit: 0.15, critBonus: 0.25 },
        levels: [
            { amount: 1, t: '탄 +1' }, { critBonus: 0.5, t: '치명타 피해 +50%' }, { amount: 1, dmg: 2, t: '탄 +1, 피해 +2' },
            { crit: 0.1, t: '치명타 확률 +10%' }, { cd: -0.15, crit: 0.1, t: '연사 +15%, 치명타 확률 +10%' }, { dmg: 3, critBonus: 0.5, t: '피해 +3, 치명타 피해 +50%' },
            { amount: 1, crit: 0.1, cd: -0.1, t: '탄 +1, 치명타 확률 +10%, 연사 +10%' },
        ],
        evolve: { with: 'focus', name: '처형인의 쌍권총', icon: '☠️', desc: '연사 +40%, 피해 +30%, 치명타 확률 +30%, 치명타 피해 +80%, 관통 +2. 처형자 테크에서는 일반 적 확률 처형과 전용 치명타 보너스.',
            mods: { dmg: 1.3, crit: 0.3, critBonus: 0.8, cd: 0.6, pierce: 2 } },
    },
    thorns: {
        name: '연꽃 가시', icon: '🌸', color: '#ff4fa0',
        desc: '가시 꽃잎이 몸 주위를 돈다. 꽃잎 하나가 적에 닿거나 적 탄환을 막으면 사라지며 그 자리에서 터져 주변에도 피해를 주고(꽃잎 파열), 각각 1.6초 후 재생한다. 준비된 꽃잎 1개당 받는 피해 -4% (최대 20%). 꽃잎이 늘고 빨리 자랄수록 공격과 방어가 함께 강해진다.',
        base: { dmg: 54, cd: 3.3, amount: 2, speed: 3.4, duration: 3.0, area: 1, radius: 68, hitCd: 0.45, regrow: 1.6 },
        levels: [
            { amount: 1, t: '가시 꽃잎 +1' }, { area: 0.15, t: '반경 +15%' }, { dmg: 18, regrow: -0.4, t: '접촉 피해 +18, 기본 재생 -0.4초' },
            { dmg: 6, t: '접촉 피해 +6' }, { amount: 1, t: '가시 꽃잎 +1' }, { dmg: 18, t: '접촉 피해 +18' },
            { amount: 1, t: '가시 꽃잎 +1' },
        ],
        evolve: { with: 'regen', name: '피의 연꽃', icon: '🥀', desc: '강한 접촉 피해와 흡혈. 재생 간격 15% 단축 (Lv.8 기본 1.02초). 꽃잎 파열 피해 +15%p·범위 +25%, 꽃잎 1개당 받는 피해 -5% (최대 30%).',
            mods: { dmg: 1.4, amount: 1.25, permanent: 1, lifesteal: 0.3, regrow: 0.85 } },
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
        base: { dmg: 8, cd: 2.65, amount: 1, speed: 1, duration: 2.6, area: 1, radius: 60, tick: 0.3 },
        levels: [
            { amount: 1, t: '화염병 +1' }, { area: 0.2, t: '범위 +20%' }, { dmg: 3, t: '피해 +3' },
            { duration: 0.35, t: '지속 +35%' }, { amount: 1, t: '화염병 +1' }, { cd: -0.15, t: '재사용 -15%' },
            { dmg: 4, area: 0.15, t: '피해 +4, 범위 +15%' },
        ],
        evolve: { with: 'spread', name: '지옥 불꽃길', icon: '🌋', desc: '걸어간 자리마다 지옥불이 남는다.',
            mods: { dmg: 2, area: 1.6, duration: 2.2, trail: 1 } },
    },
    cannon: {
        name: '꽃잎포', icon: '🌺', color: '#ff69b4',
        desc: '다수 적 자동 조준 또는 한 표적 집중 사격. 광선 피해 2배 강화: 테크·장비 보정 전 Lv1 분산 88 / 집중 96.8. 다른 테크의 광선 피해 감소는 5%만 적용. 모든 등급과 추가 발수 효과를 포함해 광선은 최대 3개. 분산 피해율 100%→65%, 집중 총 피해는 강화 광선 1개 기준 1발 1.1배 / 2발 2.2배 / 3발 3.3배.',
        base: { dmg: 44, cd: 2.6, amount: 1, speed: 1, duration: 0.35, area: 1, length: 520, width: 44 },
        levels: [
            { dmg: 12, width: 2, length: 20, amount: 1, cd: -0.09, t: '광선 기본 피해 +24 · 광선 +1 · 굵기 +2 · 사거리 +20 · 간격 -9% · 분산 95%' },
            { dmg: 4, width: 2, length: 20, area: 0.25, cd: -0.09, t: '광선 기본 피해 +8 · 굵기 +2 · 사거리 +20 · 범위 +25% · 간격 -9% · 분산 90%' },
            { dmg: 8, width: 2, length: 20, amount: 1, cd: -0.09, t: '광선 기본 피해 +16 · 광선 +1 · 굵기 +2 · 사거리 +20 · 간격 -9% · 분산 85%' },
            { dmg: 6, width: 2, length: 20, cd: -0.09, t: '광선 기본 피해 +12 · 굵기 +2 · 사거리 +20 · 간격 -9% · 분산 80%' },
            { dmg: 10, width: 2, length: 20, cd: -0.09, t: '광선 기본 피해 +20 · 굵기 +2 · 사거리 +20 · 간격 -9% · 분산 75%' },
            { dmg: 8, width: 2, length: 20, cd: -0.09, t: '광선 기본 피해 +16 · 굵기 +2 · 사거리 +20 · 간격 -9% · 분산 70%' },
            { dmg: 8, width: 2, length: 20, area: 0.2, cd: -0.09, t: '광선 기본 피해 +16 · 굵기 +2 · 사거리 +20 · 범위 +20% · 간격 -9% · 분산 65%' },
        ],
        evolve: { with: 'pollen', name: '개화 꽃잎포', icon: '💮', desc: '재발사 간격 15% 단축과 피해·범위 강화. 광선 피해 2배 강화 유지. 진화해도 광선은 최대 3개. 분산 피해율 65%, 집중 총 피해는 강화 광선 1개 기준 최대 3.3배. 초과 발수를 피해로 바꾸지 않는다.',
            mods: { dmg: 1.5, area: 1.25, cd: 0.85 } },
    },
    gas: {
        name: '독가스 수류탄', icon: '☣️', color: '#7dff4a',
        desc: '독구름이 적을 느리게 하고 녹인다.',
        base: { dmg: 6, cd: 3.8, amount: 1, speed: 1, duration: 20, area: 1, radius: 106, tick: 0.4, slow: 0.4 },
        levels: [
            { area: 0.15, t: '범위 +15%' }, { dmg: 3, t: '피해 +3' }, { duration: 0.25, t: '지속 +25%' },
            { amount: 1, t: '수류탄 +1' }, { slow: 0.1, t: '둔화 +10%' }, { cd: -0.15, t: '재사용 -15%' },
            { dmg: 4, amount: 1, t: '피해 +4, 수류탄 +1' },
        ],
        evolve: { with: 'sap', name: '역병 안개', icon: '🦠', desc: '안개가 연이를 따라다니며 모든 것을 부패시킨다.',
            mods: { dmg: 2, area: 1.4, slow: 0.2, follow: 1 } },
    },
    saw: {
        name: '뼈 톱날', icon: '⚙️', color: '#e9dcc0',
        desc: '화면 가장자리에 튕기는 회전 톱날.',
        base: { dmg: 18, cd: 2.8, amount: 1, speed: 410, duration: 3.2, area: 1, hitCd: 0.3 },
        levels: [
            { amount: 1, t: '톱날 +1' }, { dmg: 7, t: '피해 +7' }, { speed: 0.2, cd: -0.08, t: '속도 +20%, 재사용 -8%' },
            { duration: 0.3, area: 0.15, t: '지속 +30%, 크기 +15%' }, { amount: 1, t: '톱날 +1' }, { dmg: 9, t: '피해 +9' },
            { amount: 1, area: 0.25, cd: -0.08, t: '톱날 +1, 크기 +25%, 재사용 -8%' },
        ],
        evolve: { with: 'whet', name: '척추 분쇄기', icon: '🦴', desc: '척추뼈를 이어 만든 거대 톱날. 출혈을 일으킨다.',
            mods: { dmg: 1.8, amount: 2, area: 1.35, bleed: 3 } },
    },
    sword: {
        name: '도살검', icon: '🗡️', color: '#ffd8df',
        desc: '가까운 적을 향해 넓게 베는 근접 무기. 근접의 위험을 감수하는 대신 치명타(기본 20%, 피해 3.5배)가 터진다. 피해·공격 간격·베기 범위·치명타가 성장한다.',
        // 근접 보상: 무기 고유 치명타. 치명타 베기는 붉은 참격으로 표시된다.
        base: { dmg: 28, cd: 0.95, amount: 1, speed: 1, duration: 0.18, area: 1, radius: 110, crit: 0.2, critBonus: 0.5 },
        levels: [
            { dmg: 8, t: '베기 피해 +8' }, { cd: -0.08, crit: 0.05, t: '공격 간격 -8%, 치명타 확률 +5%' }, { area: 0.15, t: '베기 범위 +15%' },
            { dmg: 10, t: '베기 피해 +10' }, { cd: -0.08, crit: 0.05, t: '공격 간격 -8%, 치명타 확률 +5%' }, { dmg: 12, critBonus: 0.5, t: '베기 피해 +12, 치명타 피해 +50%' },
            { area: 0.15, cd: -0.08, t: '베기 범위 +15%, 공격 간격 -8%' },
        ],
        evolve: { with: 'whet', name: '핏빛 연꽃검', icon: '⚔️', desc: '피해와 범위가 커지고 더 빠르게 베며 출혈을 남긴다. 치명타 확률 +10%, 치명타 피해 +50%. 척추 분쇄기와 학살자의 검륜으로 조합할 수 있다.',
            mods: { dmg: 1.55, cd: 0.82, area: 1.25, bleed: 4, crit: 0.1, critBonus: 0.5 } },
    },
    ...FUSED_WEAPONS,
};

export const PASSIVES = {
    magazine: { name: '탄창 확장', icon: '📦', desc: '모든 무기의 투사체 수가 무기 투사체에 비례해 증가 (Lv5 +50%). 투사체가 적은 무기는 남는 비율만큼 피해가 늘어난다. 꽃잎포 계열은 최대 3개이며 초과분 피해 전환 없음.', per: '투사체 +10%' },
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
// 규칙: 진화는 해당 일반 무기 Lv8보다, 조합 Lv1은 해당 진화 재료보다,
// 절대 Lv1은 같은 재료 계통의 조합 Lv8보다 강해진다. 서로 다른 역할의 모든 무기를 한 줄로 비교하지 않는다.
// tests/tier-order.mjs 가 실제 전투 시뮬레이션으로 각 성장 경로를 검증한다.
export const TIER_POWER = Object.freeze({
    // 척추 분쇄기(saw) 1.3 → 0.95: 무한 관통·화면 반사로 대군 상대 화력이 도살자 테크 보정과 겹쳐 붕괴를 일으켰다.
    // 개화 꽃잎포(cannon) 1.6 → 0.9: 대군 화력이 다른 진화 무기의 3배여서 그 위의 조합 무기를 끝없이 끌어올렸다.
    evolved: Object.freeze({ thorns: 2.4, cannon: 0.9, gas: 1.75, saw: 0.95, shotgun: 2.1, rifle: 4.0, molotov: 1.15 }),
    // 최종(조합·절대) 무기 하향: 진화 < 조합(Lv1) < 조합(Lv8) < 절대(Lv1) 순서는 유지하되 전반적으로 낮춘다.
    fused: Object.freeze({
        // 2차 대폭 하향: 절대 무기는 이전 '최종' 화력대로, 최종 무기는 그보다 아래로 한 등급씩 내렸다.
        // (1차: 학살자의 검륜·맹독 회전톱·심판의 단두대·역병 종언 개별 하향 후, 최종 ×0.55 · 절대 ×0.7)
        lotus_bloom: 0.33, venom_saw: 1.98, orbit_saw: 1.4, sword_wheel: 1.21, toxic_scatter: 1.9, plague_fire: 0.53,
        scatter_rail: 1.9, burst_rail: 1.173, ember_lance: 0.12,
        absolute_bloom: 0.477, doom_barrage: 1.414, plague_end: 0.189, guillotine: 1.54, carnage_saw: 1.538 }),
    // 조합 무기 안에 계승된 꽃잎포 코어 배율(진화 꽃잎포 보정에 곱한다). 절대 > 최종 순서는 유지.
    retainedCannon: Object.freeze({ final: 1.1, absolute: 1.3 }),
});
// 조합 무기가 계승한 코어(sourceId)는 조합 무기의 보정을 함께 받는다.
export function tierPower(w) {
    // A retained cannon is the same evolved core in every fusion; owner-specific
    // old compensation must not invert final vs absolute power.
    if (w.sourceId && w.id === 'cannon') return TIER_POWER.evolved.cannon * (TIER_POWER.retainedCannon[WEAPONS[w.sourceId]?.tier === 'absolute' ? 'absolute' : 'final'] || 1);
    if (w.sourceId) return TIER_POWER.fused[w.sourceId] || 1;
    if (WEAPONS[w.id]?.fusionOnly) return TIER_POWER.fused[w.id] || 1;
    return w.evolved ? (TIER_POWER.evolved[w.id] || 1) : 1;
}
