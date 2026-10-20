import { treasureRandom } from '../src/game/coin-drops.js'; treasureRandom.next = () => .99; // 보물 상자 굴림 고정: 처치가 섞인 테스트가 난수 때문에 흔들리지 않게
import {TIER_POWER,tierPower} from '../src/data/weapons.js';
import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {createWeapon,weaponStats,updateWeapons,updateShots,orbitStats} from '../src/game/weapons.js';
import {previewFusion,fuseItems,FUSION_RECIPES} from '../src/game/fusion.js';
import {rollChoices,snapshotBuild,restoreBuild,resetBuild} from '../src/game/progression.js';
import {save} from '../src/core/save.js';
import {WEAPONS} from '../src/data/weapons.js';
import {FUSED_WEAPONS} from '../src/data/fusions.js';
// Unique-attack unit tests isolate the fusion attack; full inherited cores have separate combat tests.
const weapon=(id,level=8,slot=0)=>Object.assign(createWeapon(id,slot),{level,evolved:!!WEAPONS[id].evolve&&level===8,fusionCores:WEAPONS[id].fusionOnly?[]:null});
beforeEach(()=>{
 resetBuild();G.mode='play';G.paused=true;G.stage=1;G.stageStartTime=1;G.clock=1;G.lowQ=true;G.caps={particles:100,texts:10};
 G.player={x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,hp:100,maxHp:100,radius:12,dead:false,stats:{might:1,cooldown:1,amount:0,area:1,duration:1,projSpeed:1,crit:0}};
 G.enemies.clear();G.shots.clear();G.beams.clear();G.hazards.clear();G.boss=null;G.grid.reset();G.events={};
});
test('recipes lock missing/low-level inputs and expose explicit stats preview without mutation',()=>{
 assert.equal(previewFusion('lotus_bloom').code,'MISSING_INGREDIENT');
 G.weapons=[weapon('cannon',4,0),weapon('thorns',5,1)];const before=JSON.stringify(G.weapons),p=previewFusion('lotus_bloom');
 assert.equal(p.code,'ITEM_LEVEL_REQUIRED');assert.equal(p.ingredients[0].requiredLevel,8);assert.equal(p.output.stats.dmg,50*TIER_POWER.fused.lotus_bloom);assert.ok(Math.abs(p.output.stats.orbitDamage-14*TIER_POWER.fused.lotus_bloom)<1e-9);assert.equal(JSON.stringify(G.weapons),before);
 assert.equal(fuseItems('lotus_bloom',p.signature).ok,false);assert.equal(G.weapons.length,2);
});
test('fusion atomically consumes two, frees full slot, rejects duplicate click and cleans old effects',()=>{
 G.weapons=['cannon','thorns','pistols','rifle','gas','saw'].map((id,i)=>weapon(id,8,i));
 const old=G.shots.spawn();old.weapon='cannon';const h=G.hazards.spawn();h.weapon='thorns';
 const p=previewFusion('lotus_bloom');assert.equal(p.ok,true);const r=fuseItems('lotus_bloom',p.signature);
 assert.equal(r.ok,true);assert.equal(G.weapons.length,5);assert.equal(G.weapons[0].id,'lotus_bloom');assert.equal(G.weapons[0].level,1);
 assert.deepEqual(G.weapons.map(w=>w.slot),[0,1,2,3,4]);assert.equal(G.shots.count,0);assert.equal(G.hazards.count,0);
 assert.equal(fuseItems('lotus_bloom',p.signature).code,'ALREADY_FUSED');assert.equal(G.weapons.length,5);
});
test('stale/evolved changes, overcapacity, invalid inventory and dead confirmation cannot consume',()=>{
 G.weapons=[weapon('shotgun'),weapon('rifle',8,1)];const p=previewFusion('scatter_rail');G.weapons[0].slot=5;
 assert.equal(fuseItems('scatter_rail',p.signature).code,'STALE_PREVIEW');assert.equal(G.weapons.length,2);
 const fresh=previewFusion('scatter_rail');assert.equal(fresh.ingredients[0].name,WEAPONS.shotgun.evolve.name);
 G.player.dead=true;assert.equal(fuseItems('scatter_rail',fresh.signature).code,'NOT_PLAYING');G.player.dead=false;
 G.weapons.push(...['pistols','gas','saw','thorns','cannon'].map((id,i)=>weapon(id,8,i+2)));assert.equal(previewFusion('scatter_rail').code,'CAPACITY');
 G.weapons=[weapon('shotgun'),weapon('rifle'),weapon('rifle')];assert.equal(previewFusion('scatter_rail').code,'INVALID_INVENTORY');
});
test('fusions never appear as unowned random drops, but acquired fusion levels upgrade',()=>{
 G.weapons=[weapon('shotgun',1)];let choices=rollChoices(99);for(const recipe of FUSION_RECIPES)assert.ok(!choices.some(c=>c.id===recipe.output));
 G.weapons=[weapon('lotus_bloom',1)];choices=rollChoices(99);assert.equal(choices.find(c=>c.id==='lotus_bloom').level,2);
});
test('ordinary cannon stats depend on item level, not archived character XP; growth caps hold',()=>{
 const w=weapon('cannon',1);save.characterXP=0;const first=weaponStats(w);save.characterXP=28420;assert.deepEqual(weaponStats(w),first);
 w.level=8;assert.ok(weaponStats(w).dmg>first.dmg);assert.ok(weaponStats(w).area>first.area);
 for(const recipe of FUSION_RECIPES){const f=weapon(recipe.output,8);G.player.stats.amount=100;G.player.stats.area=100;const s=weaponStats(f);assert.ok(s.amount<=12);assert.ok(s.area<=2);assert.ok(s.dmg<=(recipe.tier==='absolute'?420:220)*tierPower(f)+1e-9);}
});
test('lotus fusion actually fires piercing beam and activates damaging orbit together',()=>{
 const w=weapon('lotus_bloom',1);w.cd=0;G.weapons=[w];let damage=0;
 G.boss={alive:true,x:120,y:20,radius:20,hits:{},hurt(dmg){damage+=dmg;}};
 updateWeapons(.01);assert.ok(G.beams.count>0);assert.ok(damage>=50);assert.equal(w.activeT,2.8);assert.equal(orbitStats(w,w.s).amount,3);
 G.boss.x=Math.cos(w.angle+.034)*90;G.boss.y=Math.sin(w.angle+.034)*90*.8;G.clock=2;
 updateWeapons(.01);assert.ok(damage>50,'orbit adds close-range damage after beam');
});
test('scatter fusion really creates spread with piercing bullets; plague lands slow-burning field',()=>{
 let w=weapon('scatter_rail',1);w.cd=0;G.weapons=[w];updateWeapons(.01);
 assert.equal(G.shots.count,7);assert.ok(G.shots.items.slice(0,7).every(s=>s.pierce===FUSED_WEAPONS.scatter_rail.base.pierce));assert.ok(new Set(G.shots.items.slice(0,7).map(s=>s.angle)).size>1);
 G.shots.clear();w=weapon('plague_fire',1);w.cd=0;G.weapons=[w];updateWeapons(.01);assert.equal(G.shots.count,2);updateShots(.6);
 assert.equal(G.hazards.count,2);assert.ok(G.hazards.items.slice(0,2).every(h=>h.kind==='fire' && Math.abs(h.dmg-9*TIER_POWER.fused.plague_fire)<1e-9 && h.slow===FUSED_WEAPONS.plague_fire.base.slow && h.radius===FUSED_WEAPONS.plague_fire.base.radius));
});
test('fused loadout and item levels survive run snapshot restore without touching wallet/archive',()=>{
 G.weapons=[weapon('lotus_bloom',6),weapon('pistols',3,1)];G.rerolls=2;G.gold=10;G.kills=3;
 const original={gold:save.gold,xp:save.characterXP};const snap=JSON.parse(JSON.stringify(snapshotBuild()));G.weapons=[];restoreBuild(snap);
 assert.equal(G.weapons[0].id,'lotus_bloom');assert.equal(G.weapons[0].level,6);assert.equal(G.weapons[0].evolved,false);assert.deepEqual({gold:save.gold,xp:save.characterXP},original);
});
test('preview signature binds exact recipe and damage modifiers',()=>{
 G.weapons=['cannon','thorns','shotgun','rifle'].map((id,i)=>weapon(id,8,i));
 const p=previewFusion('lotus_bloom');assert.equal(fuseItems('scatter_rail',p.signature).code,'STALE_PREVIEW');
 G.player.stats.might=1.5;assert.equal(fuseItems('lotus_bloom',p.signature).code,'STALE_PREVIEW');assert.equal(G.weapons.length,4);
});
test('eight distinct recipes each lock low levels, consume two once, and restore output',()=>{
 assert.equal(FUSION_RECIPES.length,13);assert.equal(new Set(FUSION_RECIPES.map(r=>r.output)).size,13);
 for(const recipe of FUSION_RECIPES){
  G.weapons=recipe.inputs.map((x,i)=>weapon(x.id,4,i));assert.equal(previewFusion(recipe.id).code,'ITEM_LEVEL_REQUIRED');
  G.weapons.forEach(w=>{w.level=8;w.evolved=true;});const p=previewFusion(recipe.id);assert.equal(p.ok,true,recipe.id);
  assert.equal(fuseItems(recipe.id,p.signature).ok,true);assert.equal(G.weapons.length,1);assert.equal(G.weapons[0].id,recipe.output);
  assert.equal(fuseItems(recipe.id,p.signature).ok,false);const snap=JSON.parse(JSON.stringify(snapshotBuild()));restoreBuild(snap);
  assert.equal(G.weapons[0].id,recipe.output);assert.equal(G.weapons[0].level,1);
 }
});
test('burst rail produces timed piercing rounds without replacing unfinished bursts',()=>{
 const w=weapon('burst_rail',1);w.cd=0;G.weapons=[w];updateWeapons(.01);assert.equal(w.burst,4);assert.equal(G.shots.count,0);
 for(let i=0;i<4;i++)updateWeapons(.08);
 assert.equal(G.shots.count,4);assert.equal(w.burst,0);assert.ok(G.shots.items.slice(0,4).every(s=>s.pierce===FUSED_WEAPONS.burst_rail.base.pierce && Math.abs(s.dmg-10*TIER_POWER.fused.burst_rail)<1e-9));
});
test('new toxic bullets and bouncing saws apply real slow on collision',()=>{
 for(const id of ['toxic_scatter','venom_saw']){const slow=FUSED_WEAPONS[id].base.slow;
  G.shots.clear();G.grid.reset();const w=weapon(id,1);w.cd=0;G.weapons=[w];updateWeapons(.01);
  const shot=G.shots.items[0];shot.x=40;shot.y=0;shot.vx=0;shot.vy=0;
  const e={id:99,x:40,y:10,radius:10,alive:true,hp:1000,maxHp:1000,mass:1,kx:0,ky:0,slow:0,slowT:0,hits:{}};G.grid.insert(e);
  updateShots(0);assert.ok(e.hp<1000);assert.equal(e.slow,slow);assert.equal(e.slowT,.5);
  if(id==='venom_saw'){assert.equal(shot.kind,'saw');assert.equal(shot.bounce,true);assert.equal(shot.hitCd,.4);}
 }
});
test('ember lance fires beam and lasting fire field, both with its own damage attribution',()=>{
 const w=weapon('ember_lance',1);w.cd=0;G.weapons=[w];let dmg=0;G.boss={alive:true,x:120,y:20,radius:20,hits:{},hurt(v){dmg+=v;}};
 updateWeapons(.01);const tp=TIER_POWER.fused.ember_lance;assert.ok(dmg>=48*tp-1e-9);assert.equal(G.beams.count,1);assert.equal(G.shots.count,1);updateShots(.6);
 assert.equal(G.hazards.count,1);const h=G.hazards.items[0];assert.equal(h.kind,'fire');assert.equal(h.duration,3);assert.equal(h.radius,54);assert.ok(Math.abs(h.dmg-48*tp*.16)<1e-9);assert.equal(h.weapon,'ember_lance');
 const p=previewFusion('ember_lance');assert.equal(p.output.stats.fieldDamage,h.dmg);assert.equal(p.output.stats.fieldDuration,h.duration);
});
test('orbit saw fires bouncing blades while activating its separate damaging orbit',()=>{
 const w=weapon('orbit_saw',1);w.cd=0;G.weapons=[w];updateWeapons(.01);assert.equal(G.shots.count,2);assert.equal(w.activeT,2.8);
 assert.ok(G.shots.items.slice(0,2).every(s=>s.kind==='saw' && s.bounce));let damage=0;
 G.boss={alive:true,x:Math.cos(.034)*78,y:Math.sin(.034)*78*.8,radius:20,hits:{},hurt(v){damage+=v;}};
 updateWeapons(.01);assert.ok(damage>0);assert.equal(orbitStats(w,w.s).amount,3);assert.ok(Math.abs(orbitStats(w,w.s).dmg-10.8*TIER_POWER.fused.orbit_saw)<1e-9);
});
test('all expanded fusion caps hold under maximum item and extreme passive bonuses',()=>{
 Object.assign(G.player.stats,{amount:100,might:100,area:100,duration:100,cooldown:.01});
 for(const recipe of FUSION_RECIPES){const w=weapon(recipe.output,8);const s=weaponStats(w);assert.ok(s.dmg<=(recipe.tier==='absolute'?420:220)*tierPower(w)+1e-9);assert.ok(s.area<=2);assert.ok(s.cd>=.5);assert.ok(s.amount<=(WEAPONS[w.id].amountCap ||12));assert.ok(s.duration<=6);assert.ok(s.slow<=.65);}
});
test('all eight fusions preserve live enemy hit buffers through release and pooled respawn',async()=>{
 const {spawnEnemy}=await import('../src/game/enemies.js');const {ENEMIES}=await import('../src/data/enemies.js');
 const type=Object.keys(ENEMIES).find(id=>!ENEMIES[id].ranged);G.caps.enemies=420;G.time=0;
 for(const recipe of FUSION_RECIPES){
  G.enemies.clear();const e=spawnEnemy(type,50,50,{force:true});assert.ok(e);const buffer=e.hits;
  G.weapons=recipe.inputs.map((input,i)=>weapon(input.id,8,i));const preview=previewFusion(recipe.id);
  assert.equal(fuseItems(recipe.id,preview.signature).ok,true);
  G.enemies.release(0);
  let reused;assert.doesNotThrow(()=>{reused=spawnEnemy(type,70,70,{force:true});},`${recipe.id}: pooled respawn`);
  assert.equal(reused,e);assert.equal(reused.hits,buffer);assert.ok(reused.hits instanceof Float32Array);assert.ok([...reused.hits].every(v=>v===-99));
 }
});
