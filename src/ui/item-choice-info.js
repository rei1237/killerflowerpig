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
// Tooltip copy for run-global offensive boosts, including weapons acquired later.
export function passiveEffectNote(id) {
    const shared='이번 작전의 현재 무기와 나중에 얻거나 조합한 무기에 계속 적용됩니다. 최대 레벨에서도 효과가 유지되며 개별 무기의 상한을 넘지는 않습니다.';
    if(id==='magazine')return `${shared} 탄·광선·투척물·회전 꽃잎의 수가 무기 투사체 수에 비례해 늘어납니다(Lv5 +50%). 투사체가 적은 무기는 정수로 못 늘린 비율만큼 피해가 늘어납니다. 영구 추적형 독구름은 하나로 유지됩니다.`;
    if(id==='sap')return `${shared} 보석과 보스 보상을 포함한 모든 경험치 획득량이 늘어 레벨업이 빨라집니다.`;
    if(id==='scope')return `${shared} 산탄·권총·소총처럼 관통하는 탄이 적을 더 많이 꿰뚫고, 탄속이 조금 빨라집니다.`;
    if(id==='pollen')return '피격을 한 번 대신 막아 주는 보호막이 주기적으로 차오릅니다. 막는 순간 주변 적을 밀쳐내며, 준비되면 연이 주위에 금빛 고리가 보입니다.';
    if(['whet','spread','focus'].includes(id))return shared;
    return '';
}
