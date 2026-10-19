import { G, emit } from './state.js';
import { WEAPONS, MAX_WEAPONS } from '../data/weapons.js';
import { FUSION_RECIPES } from '../data/fusions.js';
import { createWeapon, weaponStats, orbitStats } from './weapons.js';
export { FUSION_RECIPES };
const signature = recipeId => JSON.stringify([recipeId, G.player?.stats, G.stage, G.stageStartTime, G.fusionRevision || 0, G.weapons.map(w => [w.id, w.level, !!w.evolved, w.slot])]);
export function previewFusion(recipeId) {
    const recipe = FUSION_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { ok: false, code: 'UNKNOWN_RECIPE' };
    const ingredients = recipe.inputs.map(input => {
        const owned = G.weapons.find(w => w.id === input.id), def = WEAPONS[input.id];
        return { id: input.id, name: owned?.evolved ? def.evolve.name : def.name, level: owned?.level || 0, requiredLevel: input.level, evolved: !!owned?.evolved };
    });
    const def = WEAPONS[recipe.output], candidate = createWeapon(recipe.output, 0);
    const stats = weaponStats(candidate);
    if (recipe.output === 'lotus_bloom') {
        const orbit = orbitStats(candidate, stats);
        Object.assign(stats, { orbitDamage: orbit.dmg, orbitAmount: orbit.amount, orbitRadius: orbit.radius * orbit.area, orbitDuration: 2.8 });
    }
    let code = null;
    if (new Set(G.weapons.map(w => w.id)).size !== G.weapons.length) code = 'INVALID_INVENTORY';
    else if (G.weapons.some(w => w.id === recipe.output)) code = 'ALREADY_FUSED';
    else if (ingredients.some(i => !i.level)) code = 'MISSING_INGREDIENT';
    else if (ingredients.some(i => i.level < i.requiredLevel)) code = 'ITEM_LEVEL_REQUIRED';
    else if (G.weapons.length > MAX_WEAPONS || G.weapons.length - 1 > MAX_WEAPONS) code = 'CAPACITY';
    return { ok: !code, code, signature: signature(recipeId), ingredients,
        output: { id: recipe.output, name: def.name, desc: def.desc, level: 1, stats }, slotsAfter: G.weapons.length - 1 };
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
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    G.weapons.forEach((w, i) => { w.slot = i; });
    for (const pool of [G.shots, G.hazards, G.beams]) removeOwnedEffects(pool, consumed);
    for (let i = 0; i < G.shots.count; i++) {
        const sh = G.shots.items[i], owner = G.weapons.find(w => w.id === sh.weapon);
        if (owner) sh.slot = owner.slot;
    }
    for (let i = 0; i < G.enemies.count; i++) G.enemies.items[i].hits = {};
    if (G.boss) G.boss.hits = {};
    emit('itemsFused', { recipeId, itemId: result.id });
    return { ok: true, item: result, output: preview.output, slotsAfter: G.weapons.length };
}
