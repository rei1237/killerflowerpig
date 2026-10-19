import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats } from '../src/game/weapons.js';
import { WEAPONS, PASSIVES, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../src/data/weapons.js';
import { FUSION_RECIPES, previewFusion, fuseItems } from '../src/game/fusion.js';
import { resetBuild, rollChoices, applyChoice, rollChest, beginChoiceSession, consumeChoiceReroll, finishChoiceSession, snapshotBuild, restoreBuild } from '../src/game/progression.js';
import { listExchangeTargets, previewExchange, exchangeItem, exchangeRemaining } from '../src/game/loadout-exchange.js';
const base = Object.keys(WEAPONS).filter(id => !WEAPONS[id].fusionOnly);
const passiveIds = Object.keys(PASSIVES);
const w = (id, level = 1, slot = 0) => Object.assign(createWeapon(id, slot), { level });
const swap = (kind, from, to) => exchangeItem(kind, from, to, previewExchange(kind, from, to).signature);
beforeEach(() => { resetBuild(); clearWorld(); createPlayer(); G.mode = 'play'; G.paused = true; G.events = {}; G.gold = 0; });
test('full slots expose missing ordinary items without mutation, consuming only the confirmed item', () => {
 G.weapons = base.slice(0,6).map((id,i) => w(id,8,i)); G.weapons[0].evolved = true;
 const target = base[6], before = JSON.stringify(snapshotBuild());
 const p = previewExchange('weapon',base[0],target);
 assert.equal(p.ok,true); assert.equal(p.removed.level,8); assert.equal(p.removed.evolved,true); assert.equal(p.replacement.level,1);
 assert.equal(JSON.stringify(snapshotBuild()),before); assert.ok(listExchangeTargets('weapon').some(x=>x.id===target));
 const keep = G.weapons.slice(1); assert.equal(exchangeItem('weapon',base[0],target,p.signature).ok,true);
 assert.equal(G.weapons.length,6); assert.equal(G.weapons[0].level,1); assert.equal(G.weapons[0].evolved,false); assert.deepEqual(G.weapons.slice(1),keep);
 assert.equal(exchangeItem('weapon',base[0],target,p.signature).ok,false);
});
test('stale previews, invalid requests, banishment, death and active choice sessions cannot mutate or refill budgets', () => {
 G.weapons = base.slice(0,6).map((id,i)=>w(id,1,i)); const from=base[0],to=base[6];
 const p=previewExchange('weapon',from,to); G.weapons[1].level++;
 assert.equal(exchangeItem('weapon',from,to,p.signature).code,'STALE_PREVIEW');
 assert.equal(exchangeItem('weapon',from,to).code,'STALE_PREVIEW');
 assert.equal(previewExchange('weapon',from,FUSION_RECIPES[0].output).code,'FUSION_ONLY');
 G.banished.add(to); assert.equal(previewExchange('weapon',from,to).code,'BANISHED'); G.banished.clear();
 const s=beginChoiceSession(); consumeChoiceReroll(s.id,s.revision); const budget=G.rerolls;
 assert.equal(previewExchange('weapon',from,to).code,'CHOICE_ACTIVE'); assert.equal(G.rerolls,budget); finishChoiceSession(s.id);
 G.player.dead=true; assert.equal(swap('weapon',from,to).code,'NOT_PLAYING'); G.player.dead=false;
 const old=previewExchange('weapon',from,to); const snap=snapshotBuild(); restoreBuild(snap);
 assert.equal(exchangeItem('weapon',from,to,old.signature).code,'STALE_PREVIEW');
 G.weapons.pop(); assert.equal(previewExchange('weapon',from,to).code,'SLOTS_NOT_FULL');
});
test('weapon exchange clears owned effects and hit channels while preserving typed pooled buffers and unrelated effects',()=>{
 G.weapons=base.slice(0,6).map((id,i)=>w(id,1,i)); const from=base[0],to=base[6];
 for(const pool of [G.shots,G.hazards,G.beams]) { pool.spawn().weapon=from; pool.spawn().weapon=base[1]; }
 const enemy=G.enemies.spawn(); const hits=enemy.hits=new Float32Array(16).fill(5); G.boss={hits:{0:9}};
 assert.equal(swap('weapon',from,to).ok,true);
 for(const pool of [G.shots,G.hazards,G.beams]) {assert.equal(pool.count,1);assert.equal(pool.items[0].weapon,base[1]);}
 assert.equal(enemy.hits,hits); assert.ok(hits.every(x=>x===-99)); assert.deepEqual(G.boss.hits,{});
});
test('passive exchange recomputes stats, never heals for free, and persists through snapshots',()=>{
 const ids=passiveIds.filter(id=>id!=='heart').slice(0,6); G.passives=Object.fromEntries(ids.map(id=>[id,5])); recomputeStats(); G.player.hp=30;
 assert.equal(swap('passive',ids[0],'heart').ok,true); assert.equal(G.player.hp,30); assert.equal(G.passives.heart,1); assert.equal(Object.keys(G.passives).length,6);
 const snap=JSON.parse(JSON.stringify(snapshotBuild())); restoreBuild(snap); assert.deepEqual(G.passives,snap.passives);
 G.player.hp=150; assert.equal(swap('passive','heart',ids[0]).code,'EXCHANGE_SPENT');
});
test('every recipe is reachable from full slots missing a partner; fusion outputs upgrade all seven levels',()=>{
 assert.equal(base.length,8); assert.equal(FUSION_RECIPES.length,9);
 for(const recipe of FUSION_RECIPES){
  resetBuild(); const ids=recipe.inputs.map(x=>x.id),b=ids.at(-1);
  const starters=[...ids.slice(0,-1),...base.filter(id=>!ids.includes(id))].slice(0,6);
  G.weapons=starters.map((id,i)=>w(id,8,i));
  assert.equal(previewFusion(recipe.id).code,'MISSING_INGREDIENT');
  assert.equal(swap('weapon',G.weapons[5].id,b).ok,true);
  for(let lv=2;lv<=8;lv++)assert.equal(applyChoice(rollChoices(99).find(c=>c.id===b)),true);
  assert.equal(previewFusion(recipe.id).code,'EVOLUTION_REQUIRED');
  G.passives=Object.fromEntries(ids.map(id=>[WEAPONS[id].evolve.with,1]));
  rollChest(8);
  const p=previewFusion(recipe.id); assert.equal(p.ok,true); assert.equal(fuseItems(recipe.id,p.signature).ok,true);
  for(let lv=2;lv<=WEAPON_MAX_LEVEL;lv++) { const c=rollChoices(99).find(c=>c.id===recipe.output); assert.equal(c.level,lv); assert.equal(applyChoice(c),true); }
  assert.ok(!rollChoices(99).some(c=>c.id===recipe.output)); assert.ok(Number.isFinite(weaponStats(G.weapons.find(x=>x.id===recipe.output)).dmg));
 }
});
test('all eight base weapons upgrade to maximum and evolve through existing chest after missing passive exchange',()=>{
 for(const id of base){
  resetBuild(); G.weapons=[w(id)];
  assert.equal(WEAPONS[id].levels.length,WEAPON_MAX_LEVEL-1); assert.ok(PASSIVES[WEAPONS[id].evolve.with]);
  for(let lv=2;lv<=WEAPON_MAX_LEVEL;lv++)assert.equal(applyChoice(rollChoices(99).find(c=>c.id===id)),true);
  const partner=WEAPONS[id].evolve.with; const ids=passiveIds.filter(x=>x!==partner).slice(0,6); G.passives=Object.fromEntries(ids.map(x=>[x,5]));
  assert.equal(swap('passive',ids[0],partner).ok,true);
  assert.equal(rollChest(1)[0].kind,'evolve'); assert.equal(G.weapons[0].evolved,true);
 }
});
test('all twelve passives can be acquired by full-slot exchange then upgraded to maximum',()=>{
 assert.equal(passiveIds.length,12);
 for(const id of passiveIds){
  resetBuild(); G.weapons=[w('cannon')]; const ids=passiveIds.filter(x=>x!==id).slice(0,6); G.passives=Object.fromEntries(ids.map(x=>[x,5]));
  assert.equal(swap('passive',ids[0],id).ok,true);
  for(let lv=2;lv<=PASSIVE_MAX_LEVEL;lv++) {const c=rollChoices(99).find(c=>c.id===id);assert.equal(c.level,lv);assert.equal(applyChoice(c),true);}
  assert.ok(!rollChoices(99).some(c=>c.id===id));
 }
});

test('one shared exchange per run persists across checkpoints and resets only for a new run',()=>{
 G.weapons=base.slice(0,6).map((id,i)=>w(id,5,i)); G.passives=Object.fromEntries(passiveIds.slice(0,6).map(id=>[id,5]));
 const checkpoint=snapshotBuild();assert.equal(exchangeRemaining(),1);
 const passivePreview=previewExchange('passive',passiveIds[0],passiveIds[6]);assert.equal(passivePreview.ok,true);
 const p=previewExchange('weapon',base[0],base[6]);assert.equal(exchangeRemaining(),1);
 assert.equal(exchangeItem('weapon',base[0],base[6],p.signature).remaining,0);
 assert.equal(exchangeItem('passive',passiveIds[0],passiveIds[6],passivePreview.signature).code,'EXCHANGE_SPENT');
 const saved=snapshotBuild();assert.equal(saved.loadoutExchangesUsed,1);
 G.stage++;assert.equal(exchangeRemaining(),0);restoreBuild(checkpoint);assert.equal(exchangeRemaining(),0);
 resetBuild();assert.equal(exchangeRemaining(),1);restoreBuild(saved);assert.equal(exchangeRemaining(),0);
 resetBuild();assert.equal(exchangeRemaining(),1);
});
