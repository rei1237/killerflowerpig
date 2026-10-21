import { FUSION_RECIPES } from '../data/fusions.js';
import { upgradeLevel } from '../core/save.js';
import { bossRewardTier } from '../data/boss-rewards.js';
import { supplyState } from './supply-drops.js';
import { TREASURE_DROPS, treasureCoinValue } from './coin-drops.js';
// 경험치/레벨업, 레벨업 카드 생성, 무기·패시브 적용, 진화, 상자 보상
import { G, emit } from './state.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../data/weapons.js';
import { recomputeStats, healPlayer } from './player.js';
import { createWeapon } from './weapons.js';
import { audio } from '../core/audio.js';
import { techChoiceWeight, imprintAt, isMismatchedWeapon, isFamilyItem } from './tech.js';
import { TECHS, FAMILY_GUARANTEE_EVERY, MISMATCH_DAMAGE } from '../data/techs.js';
import { DIFFICULTIES, difficultyOf } from '../data/difficulty.js';

function copyChoiceSession(session) {
    const copy = { ...session };
    for (const key of ['eligibleIds', 'offeredIds']) if (Array.isArray(session[key])) copy[key] = [...new Set(session[key].filter(id => WEAPONS[id] || PASSIVES[id]))];
    if (Array.isArray(session.choices)) copy.choices = session.choices.slice(0, 3).filter(c => c && (
        (c.kind === 'weapon' && WEAPONS[c.id] && Number.isSafeInteger(c.level) && c.level >= 1 && c.level <= WEAPON_MAX_LEVEL) ||
        (c.kind === 'passive' && PASSIVES[c.id] && Number.isSafeInteger(c.level) && c.level >= 1 && c.level <= PASSIVE_MAX_LEVEL) ||
        (c.kind === 'heal' && c.id === 'meat') || (c.kind === 'gold' && c.id === 'gold')
    )).map(c => {
        const card = { kind: c.kind, id: c.id };
        if (Number.isSafeInteger(c.level)) card.level = c.level;
        for (const key of ['name', 'icon', 'desc', 'evoHint']) if (typeof c[key] === 'string') card[key] = c[key].slice(0, 500);
        if (c.isNew) card.isNew = true;
        if (c.tech) card.tech = true;
        if (c.mismatch) card.mismatch = true;
        if (Number.isFinite(c.weight)) card.weight = c.weight;
        return card;
    });
    return copy;
}

// Session budget is run-local. Reopening and replaying an event never replenish it.
export function beginChoiceSession(requestId) {
    if (G.choiceSession && !G.choiceSession.closed) return !requestId || requestId === G.choiceSession.id ? copyChoiceSession(G.choiceSession) : null;
    const id = requestId ?? `choice:${(G.choiceEventSerial || 0) + 1}`;
    const serial = /^choice:([1-9]\d*)$/.exec(id)?.[1];
    if (!serial || !Number.isSafeInteger(Number(serial))) return null;
    const n = Number(serial);
    if (n <= (G.choiceClosedThrough || 0)) return { id, closed: true, remaining: 0, revision: 0, budget: 0 };
    G.choiceEventSerial = Math.max(G.choiceEventSerial || 0, n);
    const budget = 1 + upgradeLevel('reroll');
    G.choiceSession = { id, revision: 0, budget, remaining: budget, closed: false };
    G.rerolls = budget;
    return copyChoiceSession(G.choiceSession);
}
export function consumeChoiceReroll(id, revision) {
    const s = G.choiceSession;
    if (!s || s.closed || s.id !== id || s.revision !== revision || s.remaining <= 0) return { ok: false };
    s.remaining--; s.revision++; G.rerolls = s.remaining;
    return { ok: true, session: copyChoiceSession(s) };
}
export function finishChoiceSession(id) {
    const s = G.choiceSession;
    if (!s || s.closed || s.id !== id) return false;
    const offered = new Set(s.offeredIds || []);
    for (const itemId of s.eligibleIds || []) {
        if (weaponOf(itemId) || G.passives[itemId]) { delete G.choiceAbsence[itemId]; continue; }
        G.choiceAbsence[itemId] = offered.has(itemId) ? 0 : Math.min(5, (G.choiceAbsence[itemId] || 0) + 1);
    }
    s.closed = true;
    G.choiceClosedThrough = Math.max(G.choiceClosedThrough || 0, Number(id.split(':')[1]));
    return true;
}
function restoreChoiceState(value) {
    G.choiceAbsence = {};
    for (const [id, misses] of Object.entries(value.choiceAbsence || {})) {
        if ((WEAPONS[id] && !WEAPONS[id].fusionOnly || PASSIVES[id]) && Number.isSafeInteger(misses)) G.choiceAbsence[id] = Math.max(0, Math.min(5, misses));
    }
    G.choiceEventSerial = Math.max(0, Number.isSafeInteger(value.choiceEventSerial) ? value.choiceEventSerial : 0);
    G.choiceClosedThrough = Math.min(G.choiceEventSerial, Math.max(0, Number.isSafeInteger(value.choiceClosedThrough) ? value.choiceClosedThrough : 0));
    G.choiceSession = null;
    const s = value.choiceSession;
    if (s && /^choice:[1-9]\d*$/.test(s.id) && Number(s.id.split(':')[1]) <= G.choiceEventSerial && Number.isSafeInteger(s.budget) && s.budget >= 1 && Number.isSafeInteger(s.remaining) && s.remaining >= 0 && s.remaining <= s.budget && Number.isSafeInteger(s.revision) && s.revision >= 0) {
        G.choiceSession = copyChoiceSession({ ...s, id:s.id, budget:s.budget, remaining:s.remaining, revision:s.revision, closed:!!s.closed || Number(s.id.split(':')[1]) <= G.choiceClosedThrough });
    }
    G.rerolls = G.choiceSession?.remaining ?? 0;
}

export function xpForLevel(lv) {
    // 레벨업 비용: 구간(20, 35)마다 가팔라지는 '쉬움' 기준 곡선 × 난이도 배율.
    // 레벨업은 매우 힘들어야 한다: 5·10·13·18·27레벨부터 단계적으로 가팔라진다.
    const base = 12 + (lv - 1) * 12 + Math.max(0, lv - 4) * 10 + Math.max(0, lv - 9) * 18
        + Math.max(0, lv - 12) * 40 + Math.max(0, lv - 17) * 90 + Math.max(0, lv - 26) * 140;
    return Math.round(base * difficultyOf(G.difficulty).xpMul);
}

export function addXP(v) {
    G.xp += v * (G.player?.stats?.growth || 1);
    while (G.xp >= G.xpNext) {
        G.xp -= G.xpNext;
        G.level++;
        G.xpNext = xpForLevel(G.level);
        G.pendingLevelUps++;
    }
}

export function weaponOf(id) { return G.weapons.find(w => w.id === id); }

// 융합 재료로 소모된 무기: 기록된 소모 목록 + 현재 보유한 융합 무기의 레시피 재료 (구버전 저장 호환)
export function isConsumedMaterial(id) {
    if (G.consumedItems?.has(id)) return true;
    return G.weapons.some(w => WEAPONS[w.id]?.fusionOnly && FUSION_RECIPES.some(r => r.output === w.id && r.inputs.some(i => i.id === id)));
}

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
            if (weaponOf(id) || G.banished.has(id) || WEAPONS[id].fusionOnly || isConsumedMaterial(id)) continue;
            const def = WEAPONS[id];
            out.push({ kind: 'weapon', id, level: 1, weight: 2, name: def.name, icon: def.icon, desc: def.desc, isNew: true });
        }
    }
    for (const id in PASSIVES) {
        const lv = G.passives[id] || 0;
        if (lv >= PASSIVE_MAX_LEVEL || G.banished.has(id)) continue;
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
    // 최종 무기를 만든 뒤에는 아직 얻지 못한 아이템이 우선 등장 (재료 무기는 위에서 이미 제외)
    if (G.consumedItems?.size) for (const c of out) if (c.isNew) c.weight *= 2;
    // 시작 테크: 계열 아이템 우대, 다른 계열 신규 무기는 덜 등장. 무기 카드에는 이번 레벨의 각인/부조화를 표시
    for (const c of out) {
        const w = techChoiceWeight(c);
        c.weight *= w;
        if (w > 1) c.tech = true;
        if (c.kind !== 'weapon') continue;
        const im = imprintAt(c.id, c.level);
        if (im) c.desc = `${c.desc} · ✦ ${im.label}`;
        if (isMismatchedWeapon(c.id)) { c.mismatch = true; if (c.isNew) c.desc = `${c.desc} · ⚠ 테크 부조화: 피해 -${Math.round((1 - MISMATCH_DAMAGE) * 100)}%`; }
    }
    for (const c of out) {
        if (c.kind === 'weapon' && WEAPONS[c.id].fusionOnly) { c.weight *= 0.25; continue; }
        if (!c.isNew) continue;
        c.weight *= 1.2 * (1 + 0.08 * Math.min(5, Math.max(0, G.choiceAbsence?.[c.id] || 0)));
        // 파트너 가중치는 2종 최종 조합에만 (절대 무기 3종 조합은 카드 분포를 바꾸지 않음)
        if (c.kind === 'weapon' && FUSION_RECIPES.some(recipe => recipe.tier !== 'absolute' && !weaponOf(recipe.output) && recipe.inputs.some(input => input.id === c.id) && recipe.inputs.some(input => input.id !== c.id && weaponOf(input.id)))) c.weight *= 1.35;
    }
    return out;
}

export function rollChoices(n = 3) {
    const pool = candidates();
    const picks = [];
    const session = G.choiceSession && !G.choiceSession.closed ? G.choiceSession : null;
    if (session) session.eligibleIds = [...new Set([...(session.eligibleIds || []), ...pool.filter(c => c.isNew).map(c => c.id)])];
    // 세 번째 레벨업(Lv.4)에는 미보유 연꽃 가시를 한 자리 보장한다.
    // 한 번에 여러 레벨이 올라도 현재 처리 중인 선택 화면의 레벨을 사용한다.
    // 후보 풀 안에서만 고르므로 금지·최대 레벨·무기 슬롯 제한을 우회하지 않는다.
    const choiceLevel = G.level - G.pendingLevelUps;
    if (n > 0 && choiceLevel === 4) {
        const thorns = pool.findIndex(c => c.id === 'thorns' && c.isNew);
        if (thorns >= 0) picks.push(pool.splice(thorns, 1)[0]);
    }
    // Offer automatic regeneration before early passive slots fill. This is an
    // offer guarantee only: never bypass bans, slot limits, max level or ownership.
    const regenProtected = choiceLevel === 5 || choiceLevel === 10;
    if (picks.length < n && regenProtected) {
        const regen = pool.findIndex(c => c.kind === 'passive' && c.id === 'regen' && c.isNew);
        if (regen >= 0) picks.push(pool.splice(regen, 1)[0]);
    }
    // 테크 방향성: 일정 레벨마다 계열 카드 1장을 보장 (후보 풀 안에서만, 슬롯·최대 레벨 제한을 우회하지 않음)
    if (G.tech && picks.length < n && choiceLevel % FAMILY_GUARANTEE_EVERY === 0 && !picks.some(c => isFamilyItem(c.id))) {
        const family = pool.filter(c => isFamilyItem(c.id) && !(c.kind === 'weapon' && WEAPONS[c.id].fusionOnly));
        if (family.length) {
            let r = Math.random() * family.reduce((sum, c) => sum + c.weight, 0);
            const chosen = family.find(c => (r -= c.weight) < 0) || family[family.length - 1];
            picks.push(pool.splice(pool.indexOf(chosen), 1)[0]);
        }
    }
    // Three-card screens retain a normal growth route alongside discovery.
    // Guaranteed thorns/regen occupy at most two slots; fused upgrades stay rare.
    if (n >= 3 && picks.length < n) {
        const growth = pool.filter(c => !c.isNew && (c.kind === 'passive' || c.kind === 'weapon' && !WEAPONS[c.id].fusionOnly));
        if (growth.length) {
            let r = Math.random() * growth.reduce((sum, c) => sum + c.weight, 0);
            const chosen = growth.find(c => (r -= c.weight) < 0) || growth[growth.length - 1];
            picks.push(pool.splice(pool.indexOf(chosen), 1)[0]);
        }
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
    if (session) session.offeredIds = [...new Set([...(session.offeredIds || []), ...picks.map(c => c.id)])];
    return picks;
}

export function applyChoice(c) {
    if (c.kind === 'weapon') {
        const w = weaponOf(c.id);
        if (!WEAPONS[c.id]) return false;
        if (w) { if (w.level >= WEAPON_MAX_LEVEL || c.level !== w.level + 1) return false; w.level++; }
        else { if (G.weapons.length >= MAX_WEAPONS || WEAPONS[c.id].fusionOnly || c.level !== 1) return false; G.weapons.push(createWeapon(c.id, G.weapons.length)); }
    } else if (c.kind === 'passive') {
        if (!PASSIVES[c.id]) return false;
        const level = G.passives[c.id] || 0;
        if (level >= PASSIVE_MAX_LEVEL || c.level !== level + 1) return false;
        G.passives[c.id] = level + 1;
        recomputeStats();
    } else if (c.kind === 'heal') {
        healPlayer(50);
    } else if (c.kind === 'gold') {
        G.gold += 4;
    }
    audio.sfx('levelup');
    return true;
}

export function evolvable() {
    return G.weapons.filter(w => !w.evolved && w.level >= WEAPON_MAX_LEVEL && WEAPONS[w.id].evolve && G.passives[WEAPONS[w.id].evolve.with]);
}

// 상자 보상: 진화 우선 → 보유 아이템 레벨업 → 골드
export function rollChest(count, random = Math.random) {
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
            const c = ups[(random() * ups.length) | 0];
            const fromLevel = c.level - 1;
            applyChoice(c);
            rewards.push({ ...c, fromLevel, levelsGained: 1, desc: `Lv.${c.level} — ${c.desc}` });
        } else {
            const g = 3 + G.stage;
            G.gold += g;
            rewards.push({ kind: 'gold', id: 'gold', name: '피 묻은 금화', icon: '🪙', desc: `골드 +${g}` });
        }
    }
    return rewards;
}

// 보물 상자: 코인 확정, 강화(진화 우선) 1회 확정, 새 보조 아이템은 낮은 확률.
// (이전에는 강화 2회 확정이라 같은 무기가 한 번에 2레벨 오르는 일이 있었다)
export function rollTreasure(random = Math.random, bonusChance = TREASURE_DROPS.bonusPassiveChance, upgradeChance = TREASURE_DROPS.upgradeChance) {
    const coins = Math.max(1, Math.round(treasureCoinValue(G.stage) * (G.player?.stats?.greed || 1)));
    G.gold += coins;
    const rewards = [{ kind: 'gold', id: 'gold', name: '보물 코인', icon: '🪙', desc: `코인 +${coins}` }];
    if (random() < upgradeChance) rewards.push(...rollChest(1, random));
    if (random() < bonusChance) {
        const fresh = candidates().filter(c => c.kind === 'passive' && c.isNew);
        if (fresh.length) {
            const c = fresh[(random() * fresh.length) | 0];
            applyChoice(c);
            rewards.push({ ...c, fromLevel: 0, levelsGained: 1, isNew: true, desc: `신규 획득 — ${c.desc}` });
        }
    }
    return rewards;
}

// The UI gives one stable ID to an opened boss chest. Retrying that session
// returns its original result without rolling, upgrading or adding coins again.
const bossRewardReceipts = new Map();
export function rollBossChest(requestId, random = Math.random) {
    if (typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
    if (bossRewardReceipts.has(requestId)) return { ...JSON.parse(JSON.stringify(bossRewardReceipts.get(requestId))), duplicate: true };
    const tier = bossRewardTier(G.stage, difficultyOf(G.difficulty));
    const premiumWon = random() < tier.premiumChance;
    const rewards = rollChest(tier.guaranteedCount, random);
    if (premiumWon) {
        const eligible = G.weapons.filter(w => WEAPONS[w.id] && w.level < WEAPON_MAX_LEVEL && !G.banished.has(w.id));
        if (eligible.length) {
            const w = eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))];
            const fromLevel = w.level;
            w.level = Math.min(WEAPON_MAX_LEVEL, w.level + tier.premiumLevels);
            const def = WEAPONS[w.id], name = w.evolved && def.evolve ? def.evolve.name : def.name;
            rewards.push({ kind: 'weapon', id: w.id, name, icon: def.icon, fromLevel, level: w.level,
                levelsGained: w.level - fromLevel, premium: true, rewardName: '연꽃 정밀 강화재', rewardIconId: 'premium_upgrade',
                desc: `${name} Lv.${fromLevel} → Lv.${w.level} · +${w.level - fromLevel} 강화, 최대 8` });
        } else {
            G.gold += tier.premiumFallbackCoins;
            rewards.push({ kind: 'gold', id: 'gold', name: '만렙 회수금', rewardName: '만렙 회수금', rewardIconId: 'gold', icon: '🪙', premium: true,
                amount: tier.premiumFallbackCoins, desc: `강화 가능한 무기 없음 · 골드 +${tier.premiumFallbackCoins}` });
        }
    }
    const result = { ok: true, rewards, tier, premiumWon, duplicate: false };
    bossRewardReceipts.set(requestId, JSON.parse(JSON.stringify(result)));
    return result;
}

export function resetBuild() {
    G.loadoutExchangesUsed = 0;
    restoreChoiceState({});
    bossRewardReceipts.clear();
    G.supplyDrought = supplyState();
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.tech = null;
    G.consumedItems = new Set();
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
        loadoutExchangesUsed: G.loadoutExchangesUsed > 0 ? 1 : 0,
        choiceAbsence: { ...G.choiceAbsence },
        choiceEventSerial: G.choiceEventSerial, choiceClosedThrough: G.choiceClosedThrough,
        choiceSession: G.choiceSession ? copyChoiceSession(G.choiceSession) : null,
        supplyDrought: supplyState(G.supplyDrought),
        stage: G.stage,
        tech: G.tech || null,
        difficulty: G.difficulty,
        consumedItems: [...(G.consumedItems || [])],
        level: G.level, xp: G.xp,
        weapons: G.weapons.map(w => ({ id: w.id, level: w.level, evolved: w.evolved })),
        passives: { ...G.passives },
        gold: G.gold,
        rerolls: G.rerolls,
        kills: G.kills,
    };
}

export function restoreBuild(s) {
    G.loadoutExchangesUsed = G.loadoutExchangesUsed > 0 || s.loadoutExchangesUsed > 0 ? 1 : 0;
    G.supplyDrought = supplyState(s.supplyDrought);
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.stage = s.stage;
    G.tech = TECHS[s.tech] ? s.tech : null;
    G.difficulty = DIFFICULTIES[s.difficulty] ? s.difficulty : 'easy';
    G.consumedItems = new Set((Array.isArray(s.consumedItems) ? s.consumedItems : []).filter(id => WEAPONS[id] && !WEAPONS[id].fusionOnly));
    G.level = s.level;
    G.xp = s.xp;
    G.xpNext = xpForLevel(s.level);
    G.weapons = s.weapons.filter(w => WEAPONS[w.id]).slice(0, MAX_WEAPONS).map((w, i) => Object.assign(createWeapon(w.id, i), { level: Math.max(1, Math.min(WEAPON_MAX_LEVEL, Number.isSafeInteger(w.level) ? w.level : 1)), evolved: !!w.evolved && !!WEAPONS[w.id].evolve }));
    G.passives = {};
    for (const id of Object.keys(PASSIVES)) {
        const level = s.passives?.[id];
        if (Number.isSafeInteger(level) && level > 0) G.passives[id] = Math.min(PASSIVE_MAX_LEVEL, level);
    }
    G.gold = s.gold;
    restoreChoiceState(s);
    G.kills = s.kills || 0;
    G.pendingLevelUps = 0;
    recomputeStats(true);
    emit('buildRestored');
}
