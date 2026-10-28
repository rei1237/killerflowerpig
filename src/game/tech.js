// 테크 공명: 선택한 테크 계열 아이템을 모을수록 단계별 보너스가 열린다.
// 다른 계열 무기는 테크 보너스를 받지 않으므로, 한 계열에 집중하는 선택이 강해진다.
import { G } from './state.js';
import { TECHS, WEAPON_TAGS, RESONANCE_STEPS, IMPRINT_LEVELS, MISMATCH_DAMAGE, FAMILY_WEIGHT, OFF_FAMILY_NEW_WEAPON_WEIGHT } from '../data/techs.js';
import { FUSION_RECIPES } from '../data/fusions.js';

export function activeTech() { return G.tech ? TECHS[G.tech] || null : null; }

// 융합 결과물은 소모한 계열 무기 수만큼 계속 공명에 기여한다 (융합해도 단계가 떨어지지 않음).
function weaponPoints(tech, id) {
    if (tech.family.weapons.includes(id)) return 1;
    const recipe = FUSION_RECIPES.find(r => r.output === id);
    return recipe ? recipe.inputs.filter(input => tech.family.weapons.includes(input.id)).length : 0;
}

export function resonanceCount(tech = activeTech()) {
    if (!tech) return 0;
    let n = 0;
    for (const w of G.weapons) n += weaponPoints(tech, w.id);
    for (const id of tech.family.passives) if (G.passives[id]) n++;
    return Math.min(RESONANCE_STEPS[RESONANCE_STEPS.length - 1], n);
}

export function resonanceTier(tech = activeTech()) {
    const n = resonanceCount(tech);
    let tier = 0;
    for (const step of RESONANCE_STEPS) if (n >= step) tier++;
    return tier;
}

export function isFamilyItem(id, tech = activeTech()) {
    if (!tech) return false;
    return tech.family.passives.includes(id) || weaponPoints(tech, id) > 0;
}

export function techTagsMatch(weaponId, tech = activeTech()) {
    if (!tech) return false;
    const tags = WEAPON_TAGS[weaponId] || [];
    return tags.some(tag => tech.tags.includes(tag));
}

function sumTiers(tech, tier, key) {
    const out = {};
    for (let i = 0; i < tier; i++) {
        const part = tech.tiers[i][key];
        if (part) for (const k in part) out[k] = (out[k] || 0) + part[k];
    }
    return out;
}

// 무기 레벨에 따라 이미 열린 각인 보정 합계
export function imprintMods(weaponLevel, tech = activeTech()) {
    const out = {};
    if (!tech?.imprints) return out;
    for (const lv of IMPRINT_LEVELS) {
        if (weaponLevel < lv || !tech.imprints[lv]) continue;
        const mod = tech.imprints[lv].mod;
        for (const k in mod) out[k] = (out[k] || 0) + mod[k];
    }
    return out;
}

// 레벨업 카드용: 이 무기가 level 에 도달할 때 열리는 각인 (없으면 null)
export function imprintAt(weaponId, level, tech = activeTech()) {
    if (!tech || !techTagsMatch(weaponId, tech)) return null;
    return tech.imprints?.[level] || null;
}

// weaponStats 결과에 테크 보너스를 적용.
// 태그가 맞는 무기: 공명 단계 보너스 + 무기 레벨 각인. 맞지 않는 무기: 부조화로 피해 감소.
export function applyTechWeaponBonus(weapon, result) {
    const tech = activeTech();
    if (!tech) return result;
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    if (!techTagsMatch(weaponId, tech)) { result.dmg *= MISMATCH_DAMAGE; return result; }
    const b = sumTiers(tech, resonanceTier(tech), 'weapon');
    const level = typeof weapon === 'string' ? 1 : (weapon.level || 1);
    const im = imprintMods(level, tech);
    for (const k in im) b[k] = (b[k] || 0) + im[k];
    if (b.dmg) result.dmg *= 1 + b.dmg;
    result.dmg *= tech.power || 1;
    // 초반 전용 배율: 진화 전 일반 무기에만 (진화·조합·계승 코어 제외)
    const early = typeof weapon !== 'string' && !weapon.evolved && !weapon.sourceId && !FUSION_RECIPES.some(r => r.output === weaponId);
    if (tech.unevolvedPower && early) result.dmg *= tech.unevolvedPower;
    if (b.cd) result.cd *= Math.max(0.5, 1 + b.cd);
    if (b.amount) result.amount += b.amount;
    if (b.area) result.area *= 1 + b.area;
    if (b.duration) result.duration *= 1 + b.duration;
    if (b.pierce && result.pierce) result.pierce += b.pierce;
    if (b.slow) result.slow = Math.min(0.85, (result.slow || 0) + b.slow);
    if (b.crit) result.crit = (result.crit || 0) + b.crit;
    if (b.execute) result.execute = Math.max(result.execute || 0, b.execute);
    if (b.bleed) result.bleed = Math.max(result.bleed || 0, b.bleed);
    if (b.speed) result.speed *= 1 + b.speed;
    return result;
}

// recomputeStats 에서 호출: 캐릭터 전체 보너스
export function applyTechPlayerBonus(stats) {
    const tech = activeTech();
    if (!tech) return stats;
    const base = tech.base || {};
    if (base.maxHp) stats.maxHp += base.maxHp;
    if (base.armor) stats.armor += base.armor;
    if (base.regen) stats.regen += base.regen;
    if (base.speed) stats.speed *= 1 + base.speed;
    if (base.crit) stats.crit += base.crit;
    const b = sumTiers(tech, resonanceTier(tech), 'player');
    if (b.maxHp) stats.maxHp += b.maxHp;
    if (b.regen) stats.regen += b.regen;
    if (b.armor) stats.armor += b.armor;
    if (b.critMul) stats.critMul = (stats.critMul || 3) + b.critMul;
    return stats;
}

// 레벨업 카드 가중치: 계열 아이템 우대, 공명이 시작된 뒤에는 다른 계열 신규 무기 비중 감소
export function techChoiceWeight(card) {
    const tech = activeTech();
    if (!tech) return 1;
    if (isFamilyItem(card.id, tech)) return FAMILY_WEIGHT;
    if (card.kind === 'weapon' && card.isNew) return OFF_FAMILY_NEW_WEAPON_WEIGHT;
    return 1;
}

export function isMismatchedWeapon(weaponId, tech = activeTech()) {
    return !!tech && !techTagsMatch(weaponId, tech);
}

export function techSummary() {
    const tech = activeTech();
    if (!tech) return null;
    const count = resonanceCount(tech), tier = resonanceTier(tech);
    return { id: G.tech, tech, count, tier, next: RESONANCE_STEPS[tier] ?? null };
}
