import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {createWeapon,weaponStats,updateWeapons,updateShots,orbitStats} from '../src/game/weapons.js';
import {previewFusion,fuseItems,FUSION_RECIPES} from '../src/game/fusion.js';
import {rollChoices,snapshotBuild,restoreBuild,resetBuild} from '../src/game/progression.js';
import {save} from '../src/core/save.js';
import {WEAPONS} from '../src/data/weapons.js';
const weapon=(id,level=5,slot=0)=>Object.assign(createWeapon(id,slot),{level});
beforeEach(()=>{
 resetBuild();G.mode='play';G.paused=true;G.stage=1;G.stageStartTime=1;G.clock=1;G.lowQ=true;G.caps={particles:100,texts:10};
 G.player={x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,hp:100,maxHp:100,radius:12,dead:false,stats:{might:1,cooldown:1,amount:0,area:1,duration:1,projSpeed:1,crit:0}};
 G.enemies.clear();G.shots.clear();G.beams.clear();G.hazards.clear();G.boss=null;G.grid.reset();G.events={};
});
test('recipes lock missing/low-level inputs and expose explicit stats preview without mutation',()=>{
 assert.equal(previewFusion('lotus_bloom').code,'MISSING_INGREDIENT');
 G.weapons=[weapon('cannon',4,0),weapon('thorns',5,1)];const before=JSON.stringify(G.weapons),p=previewFusion('lotus_bloom');
 assert.equal(p.code,'ITEM_LEVEL_REQUIRED');assert.equal(p.ingredients[0].requiredLevel,5);assert.equal(p.output.stats.dmg,50);assert.equal(p.output.stats.orbitDamage,14.000000000000002);assert.equal(JSON.stringify(G.weapons),before);
 assert.equal(fuseItems('lotus_bloom',p.signature).ok,false);assert.equal(G.weapons.length,2);
});
test('fusion atomically consumes two, frees full slot, rejects duplicate click and cleans old effects',()=>{
 G.weapons=['cannon','thorns','pistols','rifle','gas','saw'].map((id,i)=>weapon(id,5,i));
 const old=G.shots.spawn();old.weapon='cannon';const h=G.hazards.spawn();h.weapon='thorns';
 const p=previewFusion('lotus_bloom');assert.equal(p.ok,true);const r=fuseItems('lotus_bloom',p.signature);
 assert.equal(r.ok,true);assert.equal(G.weapons.length,5);assert.equal(G.weapons[0].id,'lotus_bloom');assert.equal(G.weapons[0].level,1);
 assert.deepEqual(G.weapons.map(w=>w.slot),[0,1,2,3,4]);assert.equal(G.shots.count,0);assert.equal(G.hazards.count,0);
 assert.equal(fuseItems('lotus_bloom',p.signature).code,'ALREADY_FUSED');assert.equal(G.weapons.length,5);
});
test('stale/evolved changes, overcapacity, invalid inventory and dead confirmation cannot consume',()=>{
 G.weapons=[weapon('shotgun'),weapon('rifle',5,1)];const p=previewFusion('scatter_rail');G.weapons[0].evolved=true;
 assert.equal(fuseItems('scatter_rail',p.signature).code,'STALE_PREVIEW');assert.equal(G.weapons.length,2);
 const fresh=previewFusion('scatter_rail');assert.equal(fresh.ingredients[0].name,WEAPONS.shotgun.evolve.name);
 G.player.dead=true;assert.equal(fuseItems('scatter_rail',fresh.signature).code,'NOT_PLAYING');G.player.dead=false;
 G.weapons.push(...['pistols','gas','saw','thorns','cannon'].map((id,i)=>weapon(id,5,i+2)));assert.equal(previewFusion('scatter_rail').code,'CAPACITY');
 G.weapons=[weapon('shotgun'),weapon('rifle'),weapon('rifle')];assert.equal(previewFusion('scatter_rail').code,'INVALID_INVENTORY');
});
test('fusions never appear as unowned random drops, but acquired fusion levels upgrade',()=>{
 G.weapons=[weapon('shotgun',1)];let choices=rollChoices(99);for(const recipe of FUSION_RECIPES)assert.ok(!choices.some(c=>c.id===recipe.output));
 G.weapons=[weapon('lotus_bloom',1)];choices=rollChoices(99);assert.equal(choices.find(c=>c.id==='lotus_bloom').level,2);
});
test('ordinary cannon stats depend on item level, not archived character XP; growth caps hold',()=>{
 const w=weapon('cannon',1);save.characterXP=0;const first=weaponStats(w);save.characterXP=28420;assert.deepEqual(weaponStats(w),first);
 w.level=8;assert.ok(weaponStats(w).dmg>first.dmg);assert.ok(weaponStats(w).area>first.area);
 for(const recipe of FUSION_RECIPES){const f=weapon(recipe.output,8);G.player.stats.amount=100;G.player.stats.area=100;const s=weaponStats(f);assert.ok(s.amount<=12);assert.ok(s.area<=2);assert.ok(s.dmg<=220);}
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
 assert.equal(G.shots.count,7);assert.ok(G.shots.items.slice(0,7).every(s=>s.pierce===6));assert.ok(new Set(G.shots.items.slice(0,7).map(s=>s.angle)).size>1);
 G.shots.clear();w=weapon('plague_fire',1);w.cd=0;G.weapons=[w];updateWeapons(.01);assert.equal(G.shots.count,2);updateShots(.6);
 assert.equal(G.hazards.count,2);assert.ok(G.hazards.items.slice(0,2).every(h=>h.kind==='fire' && h.dmg===9 && h.slow===.45 && h.radius===72));
});
test('fused loadout and item levels survive run snapshot restore without touching wallet/archive',()=>{
 G.weapons=[weapon('lotus_bloom',6),weapon('pistols',3,1)];G.rerolls=2;G.gold=10;G.kills=3;
 const original={gold:save.gold,xp:save.characterXP};const snap=JSON.parse(JSON.stringify(snapshotBuild()));G.weapons=[];restoreBuild(snap);
 assert.equal(G.weapons[0].id,'lotus_bloom');assert.equal(G.weapons[0].level,6);assert.equal(G.weapons[0].evolved,false);assert.deepEqual({gold:save.gold,xp:save.characterXP},original);
});
test('preview signature binds exact recipe and damage modifiers',()=>{
 G.weapons=['cannon','thorns','shotgun','rifle'].map((id,i)=>weapon(id,5,i));
 const p=previewFusion('lotus_bloom');assert.equal(fuseItems('scatter_rail',p.signature).code,'STALE_PREVIEW');
 G.player.stats.might=1.5;assert.equal(fuseItems('lotus_bloom',p.signature).code,'STALE_PREVIEW');assert.equal(G.weapons.length,4);
});
