import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { STAGES, EVENTS } from '../src/data/stages.js';
import { resetSpawner, updateSpawner, currentWeights } from '../src/game/spawner.js';
import { updateEncirclement } from '../src/game/encirclement.js';
function reset(stage) {
 clearWorld(); resetSpawner(); Object.assign(G,{stage,time:0,clock:0,mode:'play',paused:false,runId:'wave-test',events:{},lowQ:false});
 G.view={w:360,h:640}; G.caps={enemies:252,particles:0,texts:0,gems:500,decalScale:0};
 G.player={x:0,y:0,vx:0,vy:0,radius:10,hp:100,maxHp:100,stats:{crit:0,armor:0},dead:false};
 for(const name of ['rabbit1','rabbit2','rabbit3']) atlases[name]={walkH:112,frameCount:()=>8};
}
function event(stage,type,occurrence=0){
 const events=STAGES[stage].events||EVENTS;
 const index=events.map((e,i)=>({...e,i})).filter(e=>e.type===type)[occurrence].i;
 G.eventIdx=index;G.time=events[index].t;G.clock=G.time;updateSpawner(0);
}
test('late specialist spawn tables are gated while earlier stage roster stays unchanged',()=>{
 for(let stage=1;stage<=10;stage++)for(const time of [0,100,200]){
  const weights=currentWeights(STAGES[stage],time);
  assert.equal(Boolean(weights.suicider),stage>=5);
  assert.equal(Boolean(weights.gunner),stage>=6);
  if(stage<5) assert.equal(weights.spitter,undefined);
 }
});
test('late rush events contain six to ten spaced suiciders instead of dense runner crowds',()=>{
 for(let stage=1;stage<=10;stage++){
  reset(stage);event(stage,'swarm');const enemies=G.enemies.items.slice(0,G.enemies.count);
  assert.equal(enemies.length,STAGES[stage].eventTuning.swarmCount);
  assert.ok(enemies.every(e=>e.type===(stage>=5?'suicider':'runner')));
  if(stage>=5){assert.ok(enemies.length<=10);for(let i=0;i<enemies.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(enemies[i].x-enemies[j].x,enemies[i].y-enemies[j].y)>=79.9);}
  updateSpawner(0);assert.equal(G.enemies.count,enemies.length);
 }
});
test('actual late ring event confines only after warning and releases before a later ring',()=>{
 reset(4);event(4,'ring');assert.equal(G.encirclement,null);
 reset(5);event(5,'ring');assert.equal(G.encirclement.phase,'warning');
 const ring=G.encirclement;updateEncirclement(2);assert.equal(ring.phase,'active');
 G.player.x=10000;updateEncirclement(.1);assert.ok(G.player.x<=ring.radius-G.player.radius);
 updateEncirclement(7);assert.equal(G.encirclement,null);
 G.enemies.clear();event(5,'ring',1);assert.equal(G.encirclement.phase,'warning');
 assert.equal(G.clock,140);assert.equal(G.encirclement.x,G.player.x);
});
