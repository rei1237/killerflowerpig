// 경험치/레벨업, 레벨업 카드 생성, 무기·패시브 적용, 진화, 상자 보상
import { G, emit } from './state.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../data/weapons.js';
import { recomputeStats, healPlayer } from './player.js';
import { createWeapon } from './weapons.js';
import { audio } from '../core/audio.js';

export function xpForLevel(lv) {
    return Math.round(4 + (lv - 1) * 4 + Math.max(0, lv - 20) * 7 + Math.max(0, lv - 40) * 12);
}

export function addXP(v) {
    G.xp += v;
    while (G.xp >= G.xpNext) {
        G.xp -= G.xpNext;
        G.level++;
        G.xpNext = xpForLevel(G.level);
        G.pendingLevelUps++;
    }
}

export function weaponOf(id) { return G.weapons.find(w => w.id === id); }

// 레벨업 선택지 후보
function candidates() {
    const out = [];
    for (const w of G.weapons) {
        if (w.level < WEAPON_MAX_LEVEL && !G.banished.has(w.id)) {
            const def = WEAPONS[w.id];
            out.push({ kind: 'weapon', id: w.id, level: w.level + 1, weight: 3,
                name: w.evolved ? def.evolve.name : def.name, icon: w.evolved ? def.evolve.icon : def.icon,
                desc: def.levels[w.level - 1].t });
        }
    }
    if (G.weapons.length < MAX_WEAPONS) {
        for (const id in WEAPONS) {
            if (weaponOf(id) || G.banished.has(id) || WEAPONS[id].fusionOnly) continue;
            const def = WEAPONS[id];
            out.push({ kind: 'weapon', id, level: 1, weight: 2, name: def.name, icon: def.icon, desc: def.desc, isNew: true });
        }
    }
    const pCount = Object.keys(G.passives).length;
    for (const id in PASSIVES) {
        const lv = G.passives[id] || 0;
        if (lv >= PASSIVE_MAX_LEVEL || G.banished.has(id)) continue;
        if (!lv && pCount >= MAX_PASSIVES) continue;
        const def = PASSIVES[id];
        out.push({ kind: 'passive', id, level: lv + 1, weight: lv ? 2.5 : 1.5,
            name: def.name, icon: def.icon, desc: lv ? def.per : def.desc, isNew: !lv });
    }
    // 핵심 생존 선택지 우대. 상점 희귀도/천장 및 상자 보상 확률과는 별개다.
    for (const c of out) {
        if (c.id === 'thorns') c.weight *= c.isNew ? 2.5 : 2;
        else if (c.kind === 'passive' && (c.id === 'heart' || c.id === 'regen')) c.weight *= 1.5;
    }
    // 진화 힌트: 미진화 무기의 짝 패시브 가중치 증가 (기존 +2 유지)
    for (const c of out) {
        if (c.kind !== 'passive') continue;
        for (const w of G.weapons) {
            if (!w.evolved && WEAPONS[w.id].evolve?.with === c.id) { c.weight += 2; c.evoHint = WEAPONS[w.id].evolve.name; }
        }
    }
    return out;
}

export function rollChoices(n = 3) {
    const pool = candidates();
    const picks = [];
    // 세 번째 레벨업(Lv.4)에는 미보유 연꽃 가시를 한 자리 보장한다.
    // 한 번에 여러 레벨이 올라도 현재 처리 중인 선택 화면의 레벨을 사용한다.
    // 후보 풀 안에서만 고르므로 금지·최대 레벨·무기 슬롯 제한을 우회하지 않는다.
    const choiceLevel = G.level - G.pendingLevelUps;
    if (n > 0 && choiceLevel === 4) {
        const thorns = pool.findIndex(c => c.id === 'thorns' && c.isNew);
        if (thorns >= 0) picks.push(pool.splice(thorns, 1)[0]);
    }
    while (picks.length < n && pool.length) {
        let total = 0;
        for (const c of pool) total += c.weight;
        let r = Math.random() * total;
        let idx = 0;
        for (; idx < pool.length; idx++) { r -= pool[idx].weight; if (r <= 0) break; }
        picks.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
    }
    if (!picks.length) {
        picks.push({ kind: 'heal', id: 'meat', name: '야전 응급 키트', icon: '🍖', desc: '체력 50 회복' });
        picks.push({ kind: 'gold', id: 'gold', name: '피 묻은 금화', icon: '🪙', desc: '골드 +40' });
    }
    return picks;
}

export function applyChoice(c) {
    if (c.kind === 'weapon') {
        const w = weaponOf(c.id);
        if (!WEAPONS[c.id]) return false;
        if (w) { if (w.level >= WEAPON_MAX_LEVEL || c.level !== w.level + 1) return false; w.level++; }
        else { if (G.weapons.length >= MAX_WEAPONS || WEAPONS[c.id].fusionOnly || c.level !== 1) return false; G.weapons.push(createWeapon(c.id, G.weapons.length)); }
    } else if (c.kind === 'passive') {
        G.passives[c.id] = (G.passives[c.id] || 0) + 1;
        recomputeStats();
    } else if (c.kind === 'heal') {
        healPlayer(50);
    } else if (c.kind === 'gold') {
        G.gold += 40;
    }
    audio.sfx('levelup');
}

export function evolvable() {
    return G.weapons.filter(w => !w.evolved && w.level >= WEAPON_MAX_LEVEL && WEAPONS[w.id].evolve && G.passives[WEAPONS[w.id].evolve.with]);
}

// 상자 보상: 진화 우선 → 보유 아이템 레벨업 → 골드
export function rollChest(count) {
    const rewards = [];
    for (let i = 0; i < count; i++) {
        const evo = evolvable().filter(w => !rewards.some(r => r.id === w.id && r.kind === 'evolve'));
        if (evo.length) {
            const w = evo[0];
            const ev = WEAPONS[w.id].evolve;
            w.evolved = true;
            rewards.push({ kind: 'evolve', id: w.id, name: ev.name, icon: ev.icon, desc: ev.desc });
            continue;
        }
        const ups = candidates().filter(c => !c.isNew);
        if (ups.length) {
            const c = ups[(Math.random() * ups.length) | 0];
            applyChoice(c);
            rewards.push({ ...c, desc: `Lv.${c.level} — ${c.desc}` });
        } else {
            const g = 30 + G.stage * 10;
            G.gold += g;
            rewards.push({ kind: 'gold', id: 'gold', name: '피 묻은 금화', icon: '🪙', desc: `골드 +${g}` });
        }
    }
    return rewards;
}

export function resetBuild() {
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.weapons = [];
    G.passives = {};
    G.level = 1;
    G.xp = 0;
    G.xpNext = xpForLevel(1);
    G.pendingLevelUps = 0;
    G.banished = new Set();
}

// 스테이지 시작 시점의 빌드 스냅샷 (사망 시 해당 스테이지 재도전용 / 이어하기 저장)
export function snapshotBuild() {
    return {
        stage: G.stage,
        level: G.level, xp: G.xp,
        weapons: G.weapons.map(w => ({ id: w.id, level: w.level, evolved: w.evolved })),
        passives: { ...G.passives },
        gold: G.gold,
        rerolls: G.rerolls,
        kills: G.kills,
    };
}

export function restoreBuild(s) {
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.stage = s.stage;
    G.level = s.level;
    G.xp = s.xp;
    G.xpNext = xpForLevel(s.level);
    G.weapons = s.weapons.filter(w => WEAPONS[w.id]).slice(0, MAX_WEAPONS).map((w, i) => Object.assign(createWeapon(w.id, i), { level: Math.max(1, Math.min(WEAPON_MAX_LEVEL, Number.isSafeInteger(w.level) ? w.level : 1)), evolved: !!w.evolved && !!WEAPONS[w.id].evolve }));
    G.passives = { ...s.passives };
    G.gold = s.gold;
    G.rerolls = s.rerolls;
    G.kills = s.kills || 0;
    G.pendingLevelUps = 0;
    recomputeStats(true);
    emit('buildRestored');
}
