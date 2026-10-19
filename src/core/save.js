// 메타 진행(영구 강화, 골드, 해금) 저장
const KEY = 'kfp.save.v1';

export const SHOP = [
    { id: 'maxHp', name: '썩지 않는 심장', desc: '최대 HP +10', cost: [100, 200, 350, 550, 800], max: 5 },
    { id: 'might', name: '피 묻은 개머리판', desc: '모든 피해 +5%', cost: [150, 300, 500, 750, 1100], max: 5 },
    { id: 'speed', name: '도망자의 발굽', desc: '이동 속도 +4%', cost: [120, 240, 420], max: 3 },
    { id: 'magnet', name: '굶주린 코', desc: '획득 범위 +10%', cost: [80, 160, 300], max: 3 },
    { id: 'reroll', name: '찢어진 부적', desc: '레벨업 리롤 +1', cost: [250, 600], max: 2 },
    { id: 'greed', name: '탐욕', desc: '골드 획득 +10%', cost: [100, 250, 500], max: 3 },
];

const DEFAULT = { gold: 0, upgrades: {}, maxStage: 1, bestTime: 0, kills: 0, seenStory: {} };

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return structuredClone(DEFAULT);
}

export const save = load();

export function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function upgradeLevel(id) { return save.upgrades[id] || 0; }

export function buyUpgrade(id) {
    const item = SHOP.find(s => s.id === id);
    const lv = upgradeLevel(id);
    if (!item || lv >= item.max) return false;
    const cost = item.cost[lv];
    if (save.gold < cost) return false;
    save.gold -= cost;
    save.upgrades[id] = lv + 1;
    persist();
    return true;
}
