import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSSES, bossMaxHp } from '../src/data/bosses.js';
import { Boss } from '../src/game/boss.js';
import { BossSheetCache } from '../src/game/boss-sheets.js';
import { BOSS_ART, BOSS_SHEETS, drawBossArtwork, drawBossSpriteSheet } from '../src/game/boss-appearance.js';
import { bestiaryEntries } from '../src/data/bestiary.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, images, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { TECHS, techStartingWeapons } from '../src/data/techs.js';
import { createPlayer, recomputeStats, updatePlayer } from '../src/game/player.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { updateHazards } from '../src/game/hazards.js';
import { clearFocus } from '../src/game/targeting.js';
import { resetBuild } from '../src/game/progression.js';
import { save } from '../src/core/save.js';
import { input } from '../src/core/input.js';

const previousBosses=JSON.parse(readFileSync(new URL('./fixtures/bosses-before-relocation.json',import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const originalAlpha={name:'알파 청토끼',title:'지면이 고동친다...',sheet:'boss1',tint:'normal',scale:.62,hp:1400,speed:48,dmg:10,
 pacing:{opening:3,phaseRest:2.2,recovery:1.5,chargeWarning:1.15,chargeSpeed:480,summons:.6},
 signature:'charge',signatureHint:'돌진 선 옆으로 피한 뒤 긴 빈틈을 노리세요.',phaseSummons:true,
 phases:[['charge','summon'],['charge','ring','summon'],['charge','ring','aimed']]};
function reset(stage=1,tech='gunline'){
 resetBuild();clearWorld();clearFocus();
 Object.assign(save,{upgrades:{},relics:[],accessoryInventory:[],equippedAccessory:null,cosmeticInventory:[],equippedCosmetics:{outfit:null,ornament:null},equippedPet:null});
 Object.assign(G,{stage,tech,difficulty:'easy',time:0,clock:0,mode:'boss',godMode:false,events:{},damageBy:{},lowQ:true,view:{w:1000,h:600},caps:{enemies:252,particles:0,texts:0,gems:500,pickups:50,decalScale:0}});
 G.camera.x=G.camera.y=0;input.move.x=input.move.y=0;
 for(const [id,data] of Object.entries(SPRITES))atlases[id]={walkH:data.walkH,frameCount:()=>8,draw(){}};
 fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};images.playerFire={width:3072,height:256};
 createPlayer();G.player.x=180;
 G.weapons=techStartingWeapons(TECHS[tech]).map((id,slot)=>createWeapon(id,slot));
 G.passives={[TECHS[tech].start.passive]:1};recomputeStats(true);
 const b=new Boss(stage);b.x=b.y=0;b.attackT=100;G.boss=b;return b;
}
function begin(b){b.startPattern();return b.task;}
function tick(b,dt){G.clock+=dt;updatePlayer(dt);updateHazards(dt);b.update(dt);}
function advance(b,time,dt=1/60){for(let elapsed=0;elapsed<time-1e-9;elapsed+=dt)tick(b,Math.min(dt,time-elapsed));}

// A captured definition, not a copy of the new runtime's expected fields.
test('stage 9 is the exact former Alpha definition with only base HP and art lookup changed',()=>{
 assert.deepEqual(BOSSES[9],{...originalAlpha,hp:13000,artStage:1});
 const b=reset(9);assert.equal(b.maxHp,13000*7*3.2);assert.equal(b.artStage,1);assert.equal(b.speed,48);assert.equal(b.dmg,14);
 assert.equal(b.def.signature,'charge');assert.equal(b.attackT,100);
 assert.equal(bestiaryEntries().find(e=>e.id==='boss-9').image,BOSS_ART[1].src);
 assert.match(bestiaryEntries().find(e=>e.id==='boss-1').pattern,/소환·탄막이 없습니다/);
});

test('stages 2 through 8 and stage 10 retain every definition field unchanged',()=>{
 for(const stage of [2,3,4,5,6,7,8,10])assert.deepEqual(BOSSES[stage],previousBosses[stage]);
});

test('stage 1 has no summons, bullets or phase acceleration at the selected beginner HP',()=>{
 const b=reset();assert.equal(b.maxHp,4200);assert.equal(b.maxHp,bossMaxHp(1));
 for(const phase of [0,1,2]){
  b.phase=phase;assert.deepEqual(b.def.phases[phase],['trainingCharge']);
  if(phase)b.enterPhase(phase);
  assert.equal(G.enemies.count,0);assert.equal(b.speed,48);
  begin(b);assert.equal(G.hazards.count,1);assert.equal(G.hazards.items[0].delay,1.5);
  G.player.x=180;G.player.y=200;advance(b,5.1);
  assert.equal(G.enemies.count,0);assert.equal(G.enemyShots.count,0);
 }
});

test('beginner lock remains fixed, every phase gets the complete tell, and long frames cannot skip it',()=>{
 for(const phase of [0,1,2])for(const dt of [1/60,.1]){
  const b=reset();b.phase=phase;const task=begin(b);const angle=task.angle;
  G.player.y=200;advance(b,1.49,dt);close(b.x,0);close(b.y,0);assert.equal(task.angle,angle);
  tick(b,.02);close(b.x,0);close(b.y,0);assert.equal(task.phase,'dash');
  tick(b,dt);assert.ok(b.x>0&&b.x<=300*dt+1e-7);close(b.y,0);
 }
 const b=reset();const task=begin(b);tick(b,10);close(b.x,0);assert.equal(task.phase,'dash');
});

test('beginner dash collision is swept, stops on one hit and grants 2.5s stationary contact-safe recovery',()=>{
 for(const dt of [1/60,.1,.6]){
  const b=reset(),hp=G.player.hp;begin(b);advance(b,1.5);
  for(let i=0;i<100&&b.task.phase!=='recover';i++)tick(b,dt);
  assert.equal(G.player.hp,hp-10);assert.equal(b.task.phase,'recover');
  const position=[b.x,b.y];G.player.x=b.x;G.player.y=b.y;G.player.iframes=0;
  advance(b,2.49);assert.deepEqual([b.x,b.y],position);assert.equal(G.player.hp,hp-10);
  tick(b,.02);assert.equal(b.task,null);assert.equal(G.enemyShots.count,0);assert.equal(G.enemies.count,0);
 }
});

test('beginner dodge just outside the fully drawn lane is safe in every phase',()=>{
 for(const phase of [0,1,2]){
  const b=reset();b.phase=phase;const task=begin(b),hp=G.player.hp;
  G.player.y=task.radius+.01;advance(b,2.5,.1);
  assert.equal(G.player.hp,hp);assert.equal(b.task.phase,'recover');assert.equal(G.enemyShots.count,0);
 }
});

test('beginner warnings and delayed dashes are canceled on phase, death, player replacement and stage change',()=>{
 for(const change of ['phase','death','player','stage']){
  const b=reset();begin(b);const warning=G.hazards.items[0],callback=warning.onFire;
  if(change==='phase')b.enterPhase(1);if(change==='death')b.die();
  if(change==='player')G.player={...G.player};if(change==='stage')G.stage=2;
  b.update(.01);const position=[b.x,b.y],shots=G.enemyShots.count;callback(warning);
  assert.deepEqual([b.x,b.y],position);assert.equal(G.enemyShots.count,shots);
  if(change==='player'||change==='stage')assert.equal(b.task,null,'stale dash is discarded');
  assert.ok(!G.hazards.items.slice(0,G.hazards.count).some(h=>h.onFire?.bossOwner===b));
 }
});

test('stage 9 prefetch resolves current Alpha plus actual stage 10, then evicts Alpha at stage 10',async()=>{
 const requested=[],canceled=[];
 const cache=new BossSheetCache(src=>{requested.push(src);return {promise:Promise.resolve({width:1024,height:512}),cancel(){canceled.push(src);}};});
 await cache.prepare(9);assert.deepEqual(requested,[BOSS_SHEETS[1].src,BOSS_SHEETS[10].src]);assert.equal(cache.entries.size,2);
 assert.ok(cache.get(1));assert.ok(cache.get(10));assert.equal(cache.get(9),null);
 await cache.prepare(10);assert.equal(cache.entries.size,1);assert.deepEqual(canceled,[BOSS_SHEETS[1].src]);assert.equal(requested.length,2);
});

test('relocated Alpha uses original full-body and pose metadata without changing collision radius',()=>{
 const b=reset(9),draws=[],ctx=new Proxy({globalAlpha:1,drawImage:(...a)=>draws.push(a)},{get:(o,k)=>k in o?o[k]:()=>{}}),radius=b.radius;
 const portrait={width:512,height:512},sheet={width:1024,height:512};
 drawBossArtwork(ctx,b,0,portrait);close(draws[0][3],512*radius*3.2/BOSS_ART[1].height);
 drawBossSpriteSheet(ctx,b,sheet);close(draws[1][7],256*radius*3.2/BOSS_SHEETS[1].bodyHeight);assert.equal(b.radius,radius);
});

// Actual starter stats and weapon collision, finite HP, no god mode/healing or
// artificial damage. This only proves one readable dodge policy, not clear rate.
for(const tech of Object.keys(TECHS))test(`${tech}: actual starter can sidestep and punish the beginner for up to 60s`,t=>{
 const original=Math.random;let rng=7;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 try{
  const b=reset(1,tech);b.attackT=3;let starts=0;
  const start=b.startPattern.bind(b);b.startPattern=()=>{starts++;return start();};
  for(let frame=0;frame<60*60&&b.alive&&!G.player.dead;frame++){
   const dx=G.player.x-b.x,dy=G.player.y-b.y,d=Math.hypot(dx,dy)||1;
   // Circle the boss, gently correcting to 100px. Every tech uses this same
   // policy and its real movement speed; no position teleportation.
   const radial=Math.max(-1,Math.min(1,(100-d)/60));
   let mx=-dy/d+dx/d*radial,my=dx/d+dy/d*radial;const norm=Math.hypot(mx,my);
   input.move.x=mx/norm;input.move.y=my/norm;
   const dt=1/60;G.clock+=dt;updatePlayer(dt);G.camera.x=G.player.x;G.camera.y=G.player.y;
   updateWeapons(dt);updateShots(dt);updateHazards(dt);b.update(dt);
   assert.equal(G.enemies.count,0);assert.equal(G.enemyShots.count,0);
  }
  assert.equal(G.player.dead,false);assert.ok(G.player.hp>0);assert.ok(starts>=(tech==='bloom'?2:5));
  const damage=Object.values(G.damageBy).reduce((a,n)=>a+n,0);
  assert.ok(damage>0,`${tech}: real starter damage must connect`);
  t.diagnostic(JSON.stringify({tech,seconds:+G.clock.toFixed(3),starts,hp:G.player.hp,maxHp:G.player.maxHp,damage:+damage.toFixed(2)}));
 }finally{Math.random=original;input.move.x=input.move.y=0;}
});

// Equal level-8/9 investment, not an overpowered late-game fixture.
const { measureBeginnerBoss } = await import('../tools/beginner-boss-qa.mjs');
for(const tech of Object.keys(TECHS))test(`${tech}: early grown build clears after real warning/dash/recovery windows`,()=>{
 for(const seed of [1,7,13]){
  const r=measureBeginnerBoss({tech,seed,maxSeconds:90});
  assert.equal(r.killed,true);assert.equal(r.playerAlive,true);assert.ok(r.seconds<60);
  assert.ok(r.firstStart>=3,'opening warning remains available');
  if(tech!=='bloom')assert.ok(r.firstDash>=4.5&&r.dashes>=1,'other unchanged builds still experience a real dash');
  // Requested 3× Cannon damage can interrupt beginner phases before a dash.
  // Dedicated phase tests above still enforce the complete warning duration.
  if(r.shortestCompleteWarning!==null)assert.ok(r.shortestCompleteWarning>=1.49);if(r.shortestCompleteRecovery!==null)assert.ok(r.shortestCompleteRecovery>=2.49);
  assert.equal(r.budget,10);assert.ok(r.equivalentRunLevel>=6&&r.equivalentRunLevel<=10);
 }
});
