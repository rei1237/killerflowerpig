import test from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer,recomputeStats} from '../src/game/player.js';
import {updateWeapons,LOTUS_GUN} from '../src/game/weapons.js';
import {resetBuild} from '../src/game/progression.js';
import {save} from '../src/core/save.js';
import {purchase,defaultProgress} from '../src/core/progression-store.js';
import {shotFrame} from '../src/game/player-motion.js';
import {SHOP} from '../src/data/shop.js';
function setup(){resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:4,clock:0,caps:{particles:0,texts:0}});G.grid.reset();G.weapons=[];recomputeStats(true);
 const e=G.enemies.spawn();Object.assign(e,{id:1,x:150,y:0,radius:14,alive:true,hp:1e6,maxHp:1e6,mass:1,kx:0,ky:0,hits:new Float32Array(24).fill(-99),def:{}});G.grid.insert(e);}
test('lotus gun fires 3 piercing rounds outside weapon slots only when owned',()=>{
 const before=save.upgrades.lotus_gun;
 try{
  delete save.upgrades.lotus_gun;setup();for(let i=0;i<60;i++)updateWeapons(1/60);assert.equal(G.shots.count,0);assert.equal(G.player.shotAt,-Infinity);
  save.upgrades.lotus_gun=1;setup();for(let i=0;i<40;i++){G.clock+=1/60;updateWeapons(1/60);}
  const shots=G.shots.items.slice(0,G.shots.count).filter(s=>s.weapon==='lotus_gun');
  assert.ok(shots.length>=LOTUS_GUN.shots);assert.ok(shots.every(s=>s.pierce===LOTUS_GUN.pierce));assert.equal(G.weapons.length,0,'no slot used');assert.ok(Number.isFinite(G.player.shotAt),'lotus alone triggers authored firing motion');
  G.clock+=.45;updateWeapons(.45);assert.equal(G.player.shotAt,G.clock,'pose starts at the actual volley timestamp');assert.equal(shotFrame(G.clock-G.player.shotAt),1,'flash is immediate');assert.equal(LOTUS_GUN.cd,.45);
 }finally{if(before===undefined)delete save.upgrades.lotus_gun;else save.upgrades.lotus_gun=before;}
});
test('lotus gun is an expensive stage-3 unlock bought once',()=>{
 const item=SHOP.find(i=>i.id==='lotus_gun');assert.equal(item.max,1);assert.ok(item.cost[0]>=500); // 경제 축소에 맞춰 600으로 인하, 여전히 상점 최고가
 assert.ok(SHOP.filter(i=>i.id!=='lotus_gun').every(i=>i.cost.every(c=>c<item.cost[0])));
 const rich={...defaultProgress(),gold:5000};
 assert.equal(purchase({...rich,maxClearedStage:2},{itemId:'lotus_gun',expectedLevel:0,requestId:'l1'}).code,'STAGE_LOCKED');
 const ok=purchase({...rich,maxClearedStage:3},{itemId:'lotus_gun',expectedLevel:0,requestId:'l2'});assert.equal(ok.ok,true);assert.equal(ok.state.upgrades.lotus_gun,1);assert.equal(ok.state.gold,5000-item.cost[0]);
});
