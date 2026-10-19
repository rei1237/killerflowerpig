import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from './helpers/final-fusion-combat.mjs';
import {FUSION_RECIPES} from '../src/data/fusions.js';
import {WEAPONS} from '../src/data/weapons.js';
import {G} from '../src/game/state.js';
import {previewFusion,fuseItems} from '../src/game/fusion.js';
import {activeWeaponCores,createWeapon,weaponStats,updateWeapons} from '../src/game/weapons.js';
import {snapshotBuild,restoreBuild} from '../src/game/progression.js';
test('all eight final Lv1 fusions exceed two evolved parents in real 30-second boss, scattered and corridor collisions',()=>{
 for(const recipe of FUSION_RECIPES)for(const scene of ['boss','scatter','corridor']){
  const before=simulate(recipe,false,scene),after=simulate(recipe,true,scene);assert.ok(before>0);assert.ok(after>before*1.2,`${recipe.id}/${scene}: ${after}/${before}`);
 }
});
test('every final requires two evolved Lv8 parents, rejects partial evolution, preserves old fused saves and source attribution',()=>{
 for(const recipe of FUSION_RECIPES){
  simulate(recipe,false,'boss');G.weapons[0].evolved=false;assert.equal(previewFusion(recipe.id).code,'EVOLUTION_REQUIRED');G.weapons[0].evolved=true;
  const p=previewFusion(recipe.id);assert.equal(p.ok,true);assert.ok(p.ingredients.every(i=>i.requiredEvolution&&i.requiredLevel===8));assert.equal(p.output.stats.inheritedCores.length,recipe.inputs.length);assert.equal(fuseItems(recipe.id,p.signature).ok,true);
  const snap=snapshotBuild();restoreBuild(snap);assert.equal(G.weapons[0].evolved,false);G.weapons[0].cd=0;updateWeapons(.01);
  assert.equal(activeWeaponCores(false).length,1+recipe.inputs.length);for(const core of G.weapons[0].fusionCores){assert.equal(core.sourceId,recipe.output);assert.equal(core.level,8);assert.equal(core.evolved,true);}
  for(const pool of [G.shots,G.hazards,G.beams])assert.ok(pool.items.slice(0,pool.count).every(x=>x.weapon===recipe.output));
 }
});
test('inherited cores remain bounded, nonrecursive and advance with final item level',()=>{
 simulate(FUSION_RECIPES[0],true,'boss');const item=G.weapons[0],core=item.fusionCores[0],first=weaponStats(core).dmg;item.level=8;activeWeaponCores();assert.ok(weaponStats(core).dmg>first*1.4);
 Object.assign(G.player.stats,{might:100,amount:100,area:100,duration:100,cooldown:.001});
 for(const c of activeWeaponCores().filter(c=>c.sourceId)){const s=weaponStats(c);assert.ok(s.dmg<=600);assert.ok(s.amount<=20);assert.ok(s.area<=3);assert.ok(s.duration<=14);assert.ok(s.cd>=.2);assert.equal(WEAPONS[c.id].fusionOnly,undefined);}
});
test('final cores at the sixth slot retain independent bounded hit channels and pooled typed arrays',()=>{
 const recipe=FUSION_RECIPES.find(r=>r.output==='orbit_saw');simulate(recipe,true,'scatter');
 G.weapons=[...['shotgun','pistols','rifle','gas','molotov'].map((id,i)=>createWeapon(id,i)),Object.assign(createWeapon('orbit_saw',5),{cd:0})];
 for(const e of G.enemies.items.slice(0,G.enemies.count))e.hits=new Float32Array(16).fill(-99);
 for(let i=0;i<120;i++){G.clock+=1/60;updateWeapons(1/60);}
 const cores=G.weapons[5].fusionCores;assert.ok(cores.every(c=>c.slot===5));assert.deepEqual(cores.map(c=>c.coreIndex),[1,2]);assert.ok(G.enemies.items.slice(0,G.enemies.count).some(e=>e.hits.length===24));assert.ok(G.enemies.items.slice(0,G.enemies.count).every(e=>e.hits instanceof Float32Array));
});
test('absolute bloom consumes three evolved inputs atomically, frees two slots and rejects stale/double confirms',()=>{
 const recipe=FUSION_RECIPES.find(r=>r.tier==='absolute');simulate(recipe,false,'boss');G.weapons.push(...['shotgun','rifle','gas'].map((id,i)=>createWeapon(id,i+3)));
 const before=previewFusion(recipe.id);assert.equal(before.slotsAfter,4);assert.equal(before.slotsFreed,2);assert.equal(before.output.tier,'absolute');
 G.weapons[2].evolved=false;assert.equal(fuseItems(recipe.id,before.signature).code,'EVOLUTION_REQUIRED');assert.equal(G.weapons.length,6);G.weapons[2].evolved=true;G.player.stats.might+=.1;assert.equal(fuseItems(recipe.id,before.signature).code,'STALE_PREVIEW');
 const current=previewFusion(recipe.id);assert.equal(fuseItems(recipe.id,current.signature).ok,true);assert.equal(G.weapons.length,4);assert.equal(G.weapons[0].id,'absolute_bloom');assert.equal(fuseItems(recipe.id,current.signature).code,'ALREADY_FUSED');
 const snap=snapshotBuild();restoreBuild(snap);assert.equal(G.weapons[0].id,'absolute_bloom');assert.equal(G.weapons[0].level,1);assert.equal(G.weapons[0].evolved,false);
});
