import { G, emit } from './state.js';
import { WEAPONS, MAX_WEAPONS } from '../data/weapons.js';
import { FUSION_RECIPES } from '../data/fusions.js';
import { createWeapon, weaponStats, orbitStats, emberFieldStats } from './weapons.js';
export { FUSION_RECIPES };
const signature = recipeId => JSON.stringify([recipeId, G.player?.stats, G.stage, G.stageStartTime, G.fusionRevision || 0, G.weapons.map(w => [w.id, w.level, !!w.evolved, w.slot])]);
export function previewFusion(recipeId) {
    const recipe = FUSION_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { ok: false, code: 'UNKNOWN_RECIPE' };
    const ingredients = recipe.inputs.map(input => {
        const owned = G.weapons.find(w => w.id === input.id), def = WEAPONS[input.id];
        return { id: input.id, name: owned?.evolved ? def.evolve.name : def.name, level: owned?.level || 0, requiredLevel: input.level, requiredEvolution: true, evolved: !!owned?.evolved };
    });
    const def = WEAPONS[recipe.output], candidate = createWeapon(recipe.output, 0);
    const stats = weaponStats(candidate);
    stats.inheritedCores = recipe.inputs.map(input => {
        const core = Object.assign(createWeapon(input.id, 0), { level: 8, evolved: true, sourceId: recipe.output, fusionLevel: 1 });
        return { id: input.id, name: WEAPONS[input.id].evolve.name, desc: WEAPONS[input.id].evolve.desc, stats: weaponStats(core) };
    });
    stats.coreDamageMultiplier = recipe.tier === 'absolute' ? 1.65 : 1.35;
    if (['lotus_bloom', 'orbit_saw'].includes(recipe.output)) {
        const orbit = orbitStats(candidate, stats);
        Object.assign(stats, { orbitDamage: orbit.dmg, orbitAmount: orbit.amount, orbitRadius: orbit.radius * orbit.area, orbitDuration: orbit.duration });
    }
    if (recipe.output === 'ember_lance') {
        const field = emberFieldStats(stats);
        Object.assign(stats, { fieldDamage: field.dmg, fieldAmount: field.amount, fieldRadius: field.radius * field.area, fieldDuration: field.duration, fieldTick: field.tick });
    }
    let code = null;
    if (new Set(G.weapons.map(w => w.id)).size !== G.weapons.length) code = 'INVALID_INVENTORY';
    else if (G.weapons.some(w => w.id === recipe.output)) code = 'ALREADY_FUSED';
    else if (ingredients.some(i => !i.level)) code = 'MISSING_INGREDIENT';
    else if (ingredients.some(i => i.level < i.requiredLevel)) code = 'ITEM_LEVEL_REQUIRED';
    else if (ingredients.some(i => !i.evolved)) code = 'EVOLUTION_REQUIRED';
    else if (G.weapons.length > MAX_WEAPONS || G.weapons.length - recipe.inputs.length + 1 > MAX_WEAPONS) code = 'CAPACITY';
    return { ok: !code, code, signature: signature(recipeId), ingredients,
        output: { id: recipe.output, name: def.name, desc: def.desc, level: 1, tier: recipe.tier || 'final', stats }, slotsFreed: recipe.inputs.length - 1, slotsAfter: G.weapons.length - recipe.inputs.length + 1 };
}
function removeOwnedEffects(pool, ids) {
    for (let i = pool.count - 1; i >= 0; i--) if (ids.has(pool.items[i].weapon)) { pool.items[i].alive = false; pool.release(i); }
}
export function fuseItems(recipeId, expectedSignature) {
    if (!['play', 'boss'].includes(G.mode) || !G.player || G.player.dead) return { ok: false, code: 'NOT_PLAYING' };
    const preview = previewFusion(recipeId);
    if (!preview.ok) return preview;
    if (typeof expectedSignature !== 'string' || expectedSignature !== preview.signature) return { ok: false, code: 'STALE_PREVIEW' };
    const consumed = new Set(preview.ingredients.map(i => i.id));
    const first = G.weapons.findIndex(w => consumed.has(w.id));
    const next = G.weapons.filter(w => !consumed.has(w.id));
    const result = createWeapon(preview.output.id, first);
    next.splice(Math.min(first, next.length), 0, result);
    // All checks precede this single inventory replacement. Never mutate one input
    // before the other has been verified; repeated confirmation sees ALREADY_FUSED.
    G.weapons = next;
    // 융합 재료로 쓴 무기는 이번 런에서 다시 레벨업 선택지에 나오지 않는다.
    if (!(G.consumedItems instanceof Set)) G.consumedItems = new Set();
    for (const id of consumed) G.consumedItems.add(id);
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.weapons.forEach((w, i) => { w.slot = i; });
    for (const pool of [G.shots, G.hazards, G.beams]) removeOwnedEffects(pool, consumed);
    for (let i = 0; i < G.shots.count; i++) {
        const sh = G.shots.items[i], owner = G.weapons.find(w => w.id === sh.weapon);
        if (owner) sh.slot = owner.slot;
    }
    for (let i = 0; i < G.enemies.count; i++) {
        const enemy = G.enemies.items[i];
        // spawnEnemy reuses this Float32Array and calls .fill on pooled objects.
        // Preserve its type and identity while resetting remapped hit channels.
        if (!(enemy.hits instanceof Float32Array)) enemy.hits = new Float32Array(16);
        enemy.hits.fill(-99);
    }
    if (G.boss) G.boss.hits = {};
    emit('itemsFused', { recipeId, itemId: result.id });
    return { ok: true, item: result, output: preview.output, slotsAfter: G.weapons.length };
}
