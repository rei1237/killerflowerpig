// Premium direct purchases. Existing starter upgrades, pet and relic ownership stay separate.
export const ACCESSORIES = Object.freeze([
    { id: 'moon_guard', name: '달빛 수호 망토', unlockStage: 3, price: 540, image: 'asset/items/moon_guard.webp', desc: '최대 HP +40 · 방어 +1', bonuses: { maxHp: 40, armor: 1 } },
    { id: 'astral_lens', name: '별자리 정밀 렌즈', unlockStage: 4, price: 780, image: 'asset/items/astral_lens.webp', desc: '치명타 확률 +8%p · 투사체 속도 +20%', bonuses: { crit: 0.08, projSpeed: 0.20 } },
    { id: 'constellation_hourglass', name: '성운 모래시계', unlockStage: 5, price: 1080, image: 'asset/items/constellation_hourglass.webp', desc: '무기 재사용 대기 배율 -10%p · 최소 40%', bonuses: { cooldown: -0.10 } },
    { id: 'pollen_lantern', name: '별꽃 등불', unlockStage: 6, price: 1440, image: 'asset/items/pollen_lantern.webp', desc: '공격 범위 +20% · 경험치·코인 수집 반경 +25%', bonuses: { area: 0.20, pickupMultiplier: 1.25 } },
    { id: 'comet_boots', name: '혜성 발걸음 장화', unlockStage: 7, price: 1800, image: 'asset/items/comet_boots.webp', desc: '기본 이동 속도 +15% · 초당 HP +0.4 · 이동 상한 유지', bonuses: { speed: 20.25, regen: 0.4 } },
    { id: 'royal_star_crown', name: '영냥이 왕별 왕관', unlockStage: 9, price: 2640, image: 'asset/items/royal_star_crown.webp', desc: '피해 배율 +25%p · 최대 HP +20', bonuses: { might: 0.25, maxHp: 20 } },
]);
export const ACCESSORY_SLOT_LIMIT = 1;
