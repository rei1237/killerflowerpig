import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {createPlayer,recomputeStats} from '../src/game/player.js';
import {createWeapon,weaponStats,orbitStats,emberFieldStats,updateWeapons} from '../src/game/weapons.js';
import {applyChoice,resetBuild,snapshotBuild,restoreBuild} from '../src/game/progression.js';
import {FUSION_RECIPES,previewFusion,fuseItems} from '../src/game/fusion.js';
import {WEAPONS} from '../src/data/weapons.js';
const boosts=['magazine','whet','spread','pollen','sap','scope'];
function maxBoosts(){for(const id of boosts)for(let level=1;level<=5;level++)applyChoice({kind:'passive',id,level});}
function reset(){resetBuild();createPlayer();G.mode='play';G.stage=1;G.stageStartTime=1;G.caps={enemies:0,particles:0,texts:0};G.rerolls=0;G.gold=0;G.kills=0;G.events={};}
beforeEach(reset);
test('late weapons inherit all max-level global boosts identically to early weapons',()=>{
 for(const [id,def] of Object.entries(WEAPONS).filter(([,d])=>!d.fusionOnly)){
  reset();applyChoice({kind:'weapon',id,level:1});maxBoosts();const early=weaponStats(G.weapons[0]);
  reset();maxBoosts();applyChoice({kind:'weapon',id,level:1});const late=weaponStats(G.weapons[0]);
  assert.deepEqual(late,early,id);assert.equal(late.amount,def.base.amount+3,id);assert.ok(late.dmg>def.base.dmg);assert.ok(late.area>1);assert.ok(late.cd<def.base.cd);assert.equal(late.pierce,def.base.pierce?def.base.pierce+3:0,id);
 }
});
test('all eight actual fusions inherit boosts regardless of order and restore without double application',()=>{
 for(const r of FUSION_RECIPES){
  const fuse=()=>{G.weapons=r.inputs.map((i,slot)=>Object.assign(createWeapon(i.id,slot),{level:8,evolved:true}));const p=previewFusion(r.id);assert.equal(fuseItems(r.id,p.signature).ok,true);};
  reset();fuse();maxBoosts();const early=weaponStats(G.weapons[0]);reset();maxBoosts();fuse();assert.deepEqual(weaponStats(G.weapons[0]),early,r.id);
  const snap=JSON.parse(JSON.stringify(snapshotBuild()));for(let i=0;i<3;i++){restoreBuild(snap);assert.deepEqual(weaponStats(G.weapons[0]),early,r.id);assert.equal(G.player.stats.amount,3);}
 }
});
test('duplicate or stale passive choices never advance beyond max or erase magazine bonus',()=>{
 for(let level=1;level<=5;level++)applyChoice({kind:'passive',id:'magazine',level});assert.equal(G.player.stats.amount,3);
 assert.equal(applyChoice({kind:'passive',id:'magazine',level:5}),false);assert.equal(applyChoice({kind:'passive',id:'magazine',level:6}),false);
 assert.equal(G.passives.magazine,5);assert.equal(G.player.stats.amount,3);applyChoice({kind:'weapon',id:'pistols',level:1});assert.equal(weaponStats(G.weapons[0]).amount,4);
});
test('hybrid orbit and secondary fire inherit count/duration within existing caps',()=>{
 maxBoosts();for(const id of ['lotus_bloom','orbit_saw']){const w=createWeapon(id,0),s=orbitStats(w,weaponStats(w));assert.equal(s.amount,5);assert.ok(s.duration>=2.8);assert.ok(s.duration<=4.5);}
 const field=emberFieldStats(weaponStats(createWeapon('ember_lance',0)));assert.ok(field.duration>=3);assert.ok(field.duration<=6);assert.equal(field.amount,2);
});
test('loaded passive levels sanitize to known capped records before one recompute',()=>{
 const snap=snapshotBuild();snap.passives={magazine:99,whet:5,spread:-1,sap:'5',bogus:999};restoreBuild(snap);
 assert.deepEqual(G.passives,{magazine:5,whet:5});assert.equal(G.player.stats.amount,3);recomputeStats();assert.equal(G.player.stats.amount,3);
});
test('new ordinary weapons actually emit the boosted count after magazine has reached max',()=>{
 for(const id of ['shotgun','rifle','cannon','molotov','gas','saw','pistols','thorns']){
  reset();G.grid.reset();G.boss=null;G.shots.clear();G.beams.clear();G.enemies.clear();maxBoosts();applyChoice({kind:'weapon',id,level:1});const w=G.weapons[0];w.cd=0;updateWeapons(.01);
  const amount=weaponStats(w).amount;
  if(id==='pistols')assert.equal(w.burst,amount);
  else if(id==='cannon')assert.equal(G.beams.count,amount);
  else if(id==='thorns'){assert.equal(w.s.amount,amount);assert.ok(w.activeT>0);}
  else assert.equal(G.shots.count,amount,id);
 }
});
test('scope adds pierce to piercing shots at Lv1/3/5 and a small reach bonus once; sap multiplies XP gain',async()=>{
 const {addXP}=await import('../src/game/progression.js');
 const cannon=createWeapon('cannon',0),shotgun=createWeapon('shotgun',1);const before=weaponStats(cannon).length,pierce=weaponStats(shotgun).pierce;
 const expected=[0,1,1,2,2,3];
 for(let level=1;level<=5;level++){applyChoice({kind:'passive',id:'scope',level});assert.equal(weaponStats(shotgun).pierce,pierce+expected[level]);}
 assert.equal(weaponStats(cannon).pierce,0,'non-piercing weapons gain nothing');
 assert.ok(Math.abs(weaponStats(cannon).length-before*1.25)<1e-9);recomputeStats();assert.ok(Math.abs(weaponStats(cannon).length-before*1.25)<1e-9);
 G.xp=0;G.xpNext=1e9;addXP(100);assert.equal(G.xp,100);
 for(let level=1;level<=5;level++)applyChoice({kind:'passive',id:'sap',level});
 G.xp=0;addXP(100);assert.ok(Math.abs(G.xp-140)<1e-9);
 for(const id of ['lotus_bloom','orbit_saw']){G.grid.reset();G.boss=null;G.enemies.clear();const w=createWeapon(id,0);w.cd=0;G.weapons=[w];updateWeapons(.01);assert.equal(w.activeT,2.8);}
});
test('shared boost tooltip explains later weapons, caps and non-bullet amount behavior',async()=>{
 const {passiveEffectNote}=await import('../src/ui/item-choice-info.js');const text=passiveEffectNote('magazine');assert.match(text,/나중에/);assert.match(text,/최대 레벨/);assert.match(text,/광선/);assert.match(text,/회전 꽃잎/);assert.match(text,/독구름은 하나/);assert.equal(passiveEffectNote('missing'),'');
});
