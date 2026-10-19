// Stable IDs are part of the save/API contract. Never reuse an ID for another item.
export const SHOP = [
    { id: 'maxHp', unlockStage: 0, icon: '🌌', name: '영냥이 별자리 망토', desc: '최대 HP +10', cost: [100, 200, 350, 550, 800], max: 5, kind: 'upgrade' },
    { id: 'might', unlockStage: 1, icon: '🔮', name: '영냥이 보랏빛 구슬', desc: '모든 피해 +5%', cost: [150, 300, 500, 750, 1100], max: 5, kind: 'upgrade' },
    { id: 'speed', unlockStage: 0, icon: '🐾', name: '영냥이 분홍 발바닥', desc: '이동 속도 +4%', cost: [120, 240, 420], max: 3, kind: 'upgrade' },
    { id: 'magnet', unlockStage: 0, icon: '🌙', name: '영냥이 초승달 모자', desc: '경험치·코인 획득 범위 +10%', cost: [80, 160, 300], max: 3, kind: 'upgrade' },
    { id: 'reroll', unlockStage: 1, icon: '✨', name: '영냥이 별빛 부적', desc: '레벨업 리롤 +1', cost: [250, 600], max: 2, kind: 'upgrade' },
    { id: 'greed', unlockStage: 2, icon: '🐟', name: '영냥이 생선 간식 주머니', desc: '골드 획득 +10%', cost: [100, 250, 500], max: 3, kind: 'upgrade' },
    { id: 'pet_yeongnyang', unlockStage: 2, icon: '🐈', name: '동행 펫 · 영냥이', desc: '상점 전용! 0.9초마다 최대 3마리에게 별빛 공격 · 넓은 코인 수집 · 6초마다 HP +3. 자동 동행!', cost: [180], max: 1, kind: 'pet' },
];
export const CATALOG_VERSION = 3;
