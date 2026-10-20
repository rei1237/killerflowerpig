import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateWeapon, TIER_SCENES } from './helpers/tier-power.mjs';
import { WEAPONS } from '../src/data/weapons.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';

// Compare upgrades along the recipes that actually consume them. A strong new
// cannon level curve must not require buffing unrelated pistols/gas merely to
// keep every evolved weapon above the strongest normal weapon in the game.
// Keep three equally weighted normalized scenes and 10% / 5% margins; each
// denominator is now the compared ingredient/path, so an unrelated cannon
// buff cannot silently change the importance of gas corridor coverage. The
// separate final-fusion-combat and boss-durability tests remain unchanged.
const normalIds=Object.keys(WEAPONS).filter(id=>!WEAPONS[id].fusionOnly);
const cache=new Map();
const raw=(id,level,evolved=false)=>{
    const key=`${id}:${level}:${evolved}`;
    if(!cache.has(key))cache.set(key,Object.fromEntries(TIER_SCENES.map(scene=>[scene,simulateWeapon(id,level,evolved,scene)])));
    return cache.get(key);
};
const improvement=(after,before)=>TIER_SCENES.reduce((sum,scene)=>sum+after[scene]/Math.max(1,before[scene]),0)/TIER_SCENES.length;
const describe=result=>Object.fromEntries(TIER_SCENES.map(scene=>[scene,+result[scene].toFixed(1)]));

for(const id of normalIds)test(`evolved ${id} exceeds its own max-level ordinary weapon by 10%`,()=>{
    const ordinary=raw(id,8),evolved=raw(id,8,true);
    assert.ok(improvement(evolved,ordinary)>1.1,`${id}: evolved ${JSON.stringify(describe(evolved))} vs ordinary ${JSON.stringify(describe(ordinary))}`);
});
for(const recipe of FUSION_RECIPES.filter(recipe=>recipe.tier!=='absolute'))test(`fusion ${recipe.output} Lv1 exceeds each consumed evolved ingredient by 10%`,()=>{
    const fused=raw(recipe.output,1);
    for(const input of recipe.inputs){const ingredient=raw(input.id,8,true);
        assert.ok(improvement(fused,ingredient)>1.1,`${recipe.output} ${JSON.stringify(describe(fused))} <= ${input.id} ${JSON.stringify(describe(ingredient))}`);
    }
});
for(const recipe of FUSION_RECIPES.filter(recipe=>recipe.tier==='absolute'))test(`absolute ${recipe.output} Lv1 retains its route premium (Bloom trades some specialized AoE for boss power)`,()=>{
    const inputs=new Set(recipe.inputs.map(input=>input.id));
    const related=FUSION_RECIPES.filter(other=>other.tier!=='absolute'&&other.inputs.every(input=>inputs.has(input.id)));
    assert.ok(related.length>0,`${recipe.output}: no comparable recipe route`);
    const absolute=raw(recipe.output,1);
    for(const fusion of related){const previous=raw(fusion.output,8);
        // Bloom retains boss superiority and broad utility, without restoring
        // the previously rejected overwhelming AoE advantage over specialists.
        assert.ok(recipe.output==='absolute_bloom' ? absolute.boss>previous.boss && improvement(absolute,previous)>.95 : improvement(absolute,previous)>1.05,`${recipe.output} ${JSON.stringify(describe(absolute))} <= ${fusion.output} ${JSON.stringify(describe(previous))}`);
    }
});
