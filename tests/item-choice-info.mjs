import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {choiceInfo,relatedFusionInfo} from '../src/ui/item-choice-info.js';
import {createWeapon} from '../src/game/weapons.js';
import {resetBuild,snapshotBuild,restoreBuild,rollChoices} from '../src/game/progression.js';
import {FUSION_RECIPES} from '../src/game/fusion.js';
const item=(id,level=1,slot=0)=>Object.assign(createWeapon(id,slot),{level});
beforeEach(()=>{resetBuild();G.stage=1;G.player={hp:100,stats:{might:1,cooldown:1,amount:0,area:1,duration:1,projSpeed:1}};});
test('card levels use live items, not stale choice metadata; new and max labels are explicit',()=>{
 const choice={kind:'weapon',id:'cannon',level:8};assert.deepEqual(choiceInfo(choice),{currentLevel:0,nextLevel:1,levelText:'신규 Lv.1'});
 G.weapons=[item('cannon',3)];assert.deepEqual(choiceInfo(choice),{currentLevel:3,nextLevel:4,levelText:'Lv.3 → Lv.4'});
 G.weapons[0].level=8;assert.equal(choiceInfo(choice).levelText,'Lv.8 · MAX');
 G.passives.heart=4;assert.equal(choiceInfo({kind:'passive',id:'heart'}).levelText,'Lv.4 → Lv.5');G.passives.heart=5;assert.match(choiceInfo({kind:'passive',id:'heart'}).levelText,/MAX/);
 assert.equal(choiceInfo({kind:'heal',id:'meat'}).levelText,'즉시 효과');
});
test('all eight recipe details carry actual counterpart levels, requirements and effects',()=>{
 for(const recipe of FUSION_RECIPES){
  G.weapons=recipe.inputs.map((v,i)=>Object.assign(item(v.id,8,i),{evolved:true}));
  const related=relatedFusionInfo(recipe.inputs[0].id),p=related.find(v=>v.output.id===recipe.output);
  assert.ok(p.ok,recipe.id);assert.ok(p.output.name);assert.ok(p.output.desc);assert.ok(p.output.stats.dmg>0);
  assert.ok(p.ingredients.every(v=>v.level===8 && v.requiredLevel===8 && v.requiredEvolution && v.evolved));
  G.weapons[1].level=4;assert.equal(relatedFusionInfo(recipe.inputs[0].id).find(v=>v.output.id===recipe.output).code,'ITEM_LEVEL_REQUIRED');
 }
 assert.equal(relatedFusionInfo('gas').length,3);assert.deepEqual(relatedFusionInfo('heart'),[]);
});
test('restored builds and rerolls read fresh choice levels and recipe readiness without mutations',()=>{
 G.weapons=[item('cannon',8),item('thorns',8,1)];G.weapons.forEach(w=>w.evolved=true);const snapshot=snapshotBuild();G.weapons=[];restoreBuild(snapshot);
 const before=JSON.stringify({weapons:G.weapons,passives:G.passives});
 for(let n=0;n<5;n++){for(const c of rollChoices(99)){const info=choiceInfo(c);assert.ok(info.nextLevel>=info.currentLevel);}assert.ok(relatedFusionInfo('cannon').find(p=>p.output.id==='lotus_bloom').ok);}
 assert.equal(JSON.stringify({weapons:G.weapons,passives:G.passives}),before);
 G.weapons.pop();assert.equal(relatedFusionInfo('cannon').find(p=>p.output.id==='lotus_bloom').code,'MISSING_INGREDIENT');
});
