import test from 'node:test';
import assert from 'node:assert/strict';
import { COIN_DROPS, coinDropValue, createCoinRandom, coinRandom } from '../src/game/coin-drops.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { spawnEnemy, hitEnemy } from '../src/game/enemies.js';
import { supplyState } from '../src/game/supply-drops.js';
const field=kind=>G.pickups.items.slice(0,G.pickups.count).filter(p=>p.kind===kind);
function reset(){clearWorld();G.stage=1;G.time=0;G.clock=0;G.kills=0;G.damageBy={};G.events={};G.lowQ=false;G.supplyDrought=supplyState();G.view={w:1000,h:600};G.caps={enemies:420,particles:0,texts:0,gems:500,decalScale:0};G.player={x:0,y:0,hp:20,maxHp:100,dead:false,stats:{crit:0,armor:0,magnet:70,greed:1}};for(const name of ['rabbit1','rabbit2','rabbit3'])atlases[name]={walkH:112,frameCount:()=>8};}
function kill(elite=false){const e=spawnEnemy('shambler',500,0,{elite});assert.ok(e);hitEnemy(e,e.hp+1,{silent:true});assert.equal(hitEnemy(e,100,{silent:true}),0);G.enemies.release(G.enemies.count-1);}
// 금화는 네임드(엘리트)만 30% 확률로 6개. 일반 적은 굴리지도 않고 0.
test('ordinary enemies never drop coins; elite coin odds have exact30percent boundary',()=>{
 assert.deepEqual(COIN_DROPS,{ordinaryChance:0,ordinaryValue:0,eliteChance:.3,eliteValue:6});
 assert.equal(coinDropValue(false,()=>{throw Error('ordinary must not roll')}),0);
 for(const roll of [0,.299999])assert.equal(coinDropValue(true,()=>roll),6);
 for(const roll of [.3,.999,1,-1,NaN])assert.equal(coinDropValue(true,()=>roll),0);
});
test('dedicated seeded coin stream is reproducible and does not call shared random',()=>{
 const original=Math.random;Math.random=()=>{throw Error('shared random consumed')};
 try {const a=createCoinRandom(123),b=createCoinRandom(123);for(let i=0;i<100;i++)assert.equal(a(),b());}finally{Math.random=original;}
});
test('real ordinary kills never drop coins; elites drop6 only on a winning roll, without gear or duplicate death loot',()=>{
 const prior=coinRandom.next,random=Math.random;Math.random=()=>.99;
 try{reset();coinRandom.next=()=>0;kill();assert.equal(field('coin').length,0);kill(true);assert.deepEqual(field('coin').map(c=>c.value),[6]);coinRandom.next=()=>.3;kill(true);assert.equal(field('coin').length,1);assert.equal(field('chest').length,0);assert.equal(G.kills,3);assert.equal(G.gems.count,3);}finally{coinRandom.next=prior;Math.random=random;}
});
test('coin successes and failures leave actual XP, healing guarantee, magnet drought and shared RNG identical',()=>{
 const prior=coinRandom.next,random=Math.random;
 const run=coinRoll=>{reset();let calls=0;Math.random=()=>{calls++;return .99};coinRandom.next=()=>coinRoll;for(let i=0;i<8;i++)kill();return {calls,xp:G.gems.items.slice(0,G.gems.count).map(g=>g.value),heals:field('meat').length,magnets:field('magnet').length,drought:{...G.supplyDrought}};};
 try{const success=run(.01),failure=run(.99);assert.deepEqual(success,failure);assert.equal(success.heals,1);}finally{coinRandom.next=prior;Math.random=random;}
});

test('ten thousand real elite kills roll the coin stream once each, award6 coins30percent of the time and never gear/chests/supplies',()=>{
 const prior=coinRandom.next,random=Math.random;Math.random=()=>.01;let rolls=0;coinRandom.next=()=>(rolls++%10)/10;
 try{reset();for(let i=0;i<10000;i++)kill(true);assert.equal(G.kills,10000);assert.equal(rolls,10000);assert.equal(field('coin').reduce((n,c)=>n+c.value,0),3000*6);assert.ok(G.gems.count>0);assert.ok(G.pickups.items.slice(0,G.pickups.count).every(p=>p.kind==='coin'));assert.deepEqual(G.supplyDrought,supplyState());}finally{coinRandom.next=prior;Math.random=random;}
});

test('actual boss defeat guarantees one boss gear chest and repeated damage cannot duplicate it',async()=>{
 const {Boss}=await import('../src/game/boss.js');const random=Math.random;Math.random=()=>.99;
 try{reset();for(const name of ['boss1','boss2','bossKing'])atlases[name]={walkH:112,frameCount:()=>8};const boss=new Boss(1);boss.hurt(boss.hp+1,{silent:true});assert.equal(boss.alive,false);assert.equal(field('chest').length,1);assert.equal(field('chest')[0].boss,true);boss.hurt(999999,{silent:true});assert.equal(field('chest').length,1);}finally{Math.random=random;}
});
