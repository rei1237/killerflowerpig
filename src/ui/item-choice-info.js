// Read live loadout on every call: rerolls, fusion and restored builds must never
// render levels copied from an obsolete choice card. No DOM or state mutations.
import { G } from '../game/state.js';
import { WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../data/weapons.js';
import { FUSION_RECIPES, previewFusion } from '../game/fusion.js';
export function choiceInfo(choice) {
    let currentLevel = 0, nextLevel = 0;
    if (choice.kind === 'weapon' || choice.kind === 'evolve') {
        currentLevel = G.weapons.find(w => w.id === choice.id)?.level || 0;
        nextLevel = choice.kind === 'evolve' ? currentLevel : Math.min(WEAPON_MAX_LEVEL, currentLevel + 1);
    } else if (choice.kind === 'passive') {
        currentLevel = G.passives[choice.id] || 0;
        nextLevel = Math.min(PASSIVE_MAX_LEVEL, currentLevel + 1);
    }
    const levelText = choice.kind === 'evolve' ? `Lv.${currentLevel} · 진화` : !nextLevel ? '즉시 효과' : !currentLevel ? `신규 Lv.${nextLevel}` : currentLevel === nextLevel ? `Lv.${currentLevel} · MAX` : `Lv.${currentLevel} → Lv.${nextLevel}`;
    return { currentLevel, nextLevel, levelText };
}
export function relatedFusionInfo(itemId) {
    return FUSION_RECIPES.filter(recipe => recipe.output === itemId || recipe.inputs.some(input => input.id === itemId)).map(recipe => previewFusion(recipe.id));
}
