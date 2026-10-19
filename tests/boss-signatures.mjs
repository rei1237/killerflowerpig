import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOSSES } from '../src/data/bosses.js';
import { Boss } from '../src/game/boss.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, fx } from '../src/core/assets.js';
import { spawnHazard, updateHazards, drawHazards } from '../src/game/hazards.js';
import { bossSpriteFrame, BOSS_FRAMES } from '../src/game/boss-appearance.js';

const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/later-stage-balance.json', import.meta.url)));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function reset(stage, phase=0) {
 clearWorld(); G.stage=stage;G.time=0;G.clock=0;G.events={};G.mode='boss';G.godMode=false;G.hallucinate=0;
 G.view={w:1000,h:700};G.camera={x:150,y:0};G.lowQ=false;
 G.caps={enemies:420,particles:0,texts:0,gems:500,decalScale:1};
 fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};
 G.player={x:300,y:0,vx:0,vy:0,radius:12,hp:10000,maxHp:10000,iframes:100,stats:{crit:0,armor:0}};
 for (const k of ['boss1','boss2','bossKing','rabbit1','rabbit2','rabbit3']) atlases[k]={walkH:112,frameCount:()=>8,draw(){}};
 const b=new Boss(stage);b.x=0;b.y=0;b.phase=phase;b.attackT=100;G.boss=b;return b;
}
function begin(b,name=b.def.signature) { b.task=b[`task_${name}`]();b.task.t=0;return b.task; }
function advance(b,time) { while(time>1e-8) {const dt=Math.min(.01,time);G.clock+=dt;updateHazards(dt);b.update(dt);time-=dt;} }
const hazards=()=>G.hazards.items.slice(0,G.hazards.count);
const shots=()=>G.enemyShots.items.slice(0,G.enemyShots.count);
const ellipseContains=(h,x,y)=>(x-h.x)**2+(y-h.y)**2/.49<h.radius**2;
const lineContains=(h,x,y)=>{const dx=x-h.x,dy=y-h.y,a=dx*Math.cos(h.angle)+dy*Math.sin(h.angle),n=-dx*Math.sin(h.angle)+dy*Math.cos(h.angle);return a>=0&&a<=h.len&&Math.abs(n)<=h.width/2;};

test('ten encounters advertise ten different executable signatures and concise Korean escape cues',()=>{
 assert.equal(new Set(Object.values(BOSSES).map(b=>b.signature)).size,10);
 for(let stage=1;stage<=10;stage++) {
  const b=reset(stage),def=BOSSES[stage];
  assert.equal(typeof b[`task_${def.signature}`],'function');assert.match(def.signatureHint,/[가-힣]/);assert.ok(def.signatureHint.length<65);
  for(const phase of def.phases) assert.ok(phase.includes(def.signature));
  close(b.radius,112*def.scale*.32);
  if(stage>1) for(const field of ['speed','dmg']) assert.equal(def[field],baseline.bosses[stage][field],`${stage}:${field}`);
  b.startPattern();assert.equal(b.lastPattern,def.signature,'opening cannot randomly skip identity');
 }
});

test('stage 1 keeps its generous charge warning, speed and long recovery in every phase',()=>{
 const old=Math.random;Math.random=()=>.5;
 try { for(let phase=0;phase<3;phase++) {
  const b=reset(1,phase);begin(b);const warning=1.15/Math.sqrt(b.phaseMul);
  assert.equal(hazards()[0].delay,warning);advance(b,warning-.005);close(b.x,0);
  advance(b,.01);assert.ok(b.x>0&&b.x<=4.8);
  while(b.task) advance(b,.01);
  assert.ok(b.attackT>=1.4/b.phaseMul*1.5-.011);
 } } finally { Math.random=old; }
});

test('all new signatures wait at least 1.05s and release real attack poses only at their gameplay event',()=>{
 for(let stage=2;stage<=10;stage++) for(const phase of [0,2]) {
  const b=reset(stage,phase);begin(b);const first=Math.min(...hazards().map(h=>h.delay));
  assert.ok(first>=1.05,`${stage}: phase cannot shorten the warning`);
  advance(b,first-.005);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.windup,`${stage}: premature attack`);assert.equal(G.enemyShots.count,0);
  advance(b,.01);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.attack,`${stage}: release pose`);
 }
});

test('machine gun locks one corridor, remains stationary and always exposes a reload opening',()=>{
 for(const phase of [0,2]) {
  const b=reset(2,phase);begin(b);const angles=hazards().map(h=>h.angle);
  G.player.y=220;advance(b,1.151);assert.equal(G.enemyShots.count,3);
  assert.ok(shots().every(s=>Math.abs(Math.atan2(s.vy,s.vx)-angles[0])<1e-9));
  while(b.task) advance(b,.01);
  close(b.x,0);close(b.y,0);assert.equal(G.enemyShots.count,3*(3+phase));assert.ok(b.attackT>=1.8);
 }
});

test('hunter makes one marked short leap then a perpendicular retreat, without an unmarked ring',()=>{
 const b=reset(3);const task=begin(b);advance(b,1.049);close(b.x,0);close(b.y,0);
 while(task.phase<2) advance(b,.01);
 close(b.x,300);close(b.y,0);assert.equal(b.motionState,'recover');
 while(b.task) advance(b,.01);
 close(b.x,300);close(Math.abs(b.y),105);assert.equal(G.enemyShots.count,0);assert.ok(b.attackT>=1.35);
});

test('sniper acquires two independent locks and freezes each line for at least .55s',()=>{
 const b=reset(4);const task=begin(b),first=task.locks[0].h;
 advance(b,.4);G.player.y=130;advance(b,.15);const angle=first.angle;assert.ok(angle>0);
 advance(b,.1);G.player.y=-160;advance(b,.4);close(first.angle,angle);assert.equal(G.enemyShots.count,0);
 advance(b,.12);assert.equal(G.enemyShots.count,1);close(Math.atan2(shots()[0].vy,shots()[0].vx),angle);
 advance(b,.2);assert.equal(task.locks.length,2);assert.ok(task.locks[1].h.angle<0);
 const second=task.locks[1].h;advance(b,.65);const locked=second.angle;G.player.y=200;advance(b,.55);
 assert.equal(G.enemyShots.count,2);close(Math.atan2(shots()[1].vy,shots()[1].vx),locked);
});

test('tank battery walks through forward impact circles and leaves both flanks safe',()=>{
 const b=reset(5);begin(b);const marks=hazards();assert.equal(marks.length,3);
 assert.deepEqual(marks.map(h=>h.x),[110,225,340]);assert.ok(marks.every(h=>h.y===0));
 assert.ok(marks[0].delay<marks[1].delay&&marks[1].delay<marks[2].delay);
 G.player.iframes=0;G.player.x=225;G.player.y=100;const hp=G.player.hp;updateHazards(1.8);assert.equal(G.player.hp,hp);
 const second=reset(5);begin(second);G.player.x=110;G.player.iframes=0;updateHazards(1.099);assert.equal(G.player.hp,10000);updateHazards(.002);assert.ok(G.player.hp<10000);
});

test('toxic horseshoe snapshots position with a broad clear exit and exactly five acid pockets',()=>{
 const b=reset(6);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,5);
 for(let distance=0;distance<=240;distance+=4) assert.ok(marks.every(h=>!ellipseContains(h,300+distance,0)),'east exit remains clear');
 G.player.x=600;advance(b,1.205);const acid=hazards().filter(h=>h.kind==='acid');assert.equal(acid.length,5);
 for(const h of acid) {assert.equal(h.duration,2.8);assert.ok(marks.some(m=>m.x===h.x&&m.y===h.y&&m.radius===h.radius));}
});

test('assassin crossing cuts lock both paths, strike in order and cannot hit beyond the drawn line',()=>{
 const b=reset(7);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,2);close(Math.abs(marks[1].angle-marks[0].angle),Math.PI/2);
 G.player.iframes=0;G.player.x=300;G.player.y=150;assert.ok(marks.every(h=>!lineContains(h,G.player.x,G.player.y)));
 updateHazards(1.051);assert.equal(G.player.hp,10000);close(b.x,marks[0].x);close(b.y,marks[0].y);
 G.player.x=300;G.player.y=0;updateHazards(.8);assert.ok(G.player.hp<10000);close(b.x,marks[1].x);
 const hp=G.player.hp;G.player.iframes=0;const h=marks[0];G.player.x=h.x-Math.cos(h.angle);G.player.y=h.y-Math.sin(h.angle);b.lineHit(h);assert.equal(G.player.hp,hp);
});

test('psychic echoes use two origins, staggered release and a wide missing sector per wave',()=>{
 const b=reset(8,2);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,2);assert.notEqual(marks[0].x,marks[1].x);
 advance(b,1.205);assert.equal(G.enemyShots.count,20);assert.ok(shots().every(s=>s.x===marks[0].x&&s.y===marks[0].y));
 advance(b,1);assert.equal(G.enemyShots.count,40);
 for(const h of marks) {
  const angles=shots().filter(s=>s.x===h.x&&s.y===h.y).map(s=>(Math.atan2(s.vy,s.vx)+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b);
  const gaps=angles.map((a,i)=>(angles[(i+1)%angles.length]-a+Math.PI*2)%(Math.PI*2));
  close(Math.max(...gaps),Math.PI/2);
 }
});

test('hammer faults leave center safe first, then hit center only at its later warning',()=>{
 const b=reset(9);begin(b);const marks=hazards();assert.equal(marks.length,3);
 const outer=marks.filter(h=>h.delay<2),center=marks.find(h=>h.delay===2);
 assert.ok(outer.every(h=>!lineContains(h,300,0)));assert.ok(lineContains(center,300,0));
 G.player.iframes=0;updateHazards(1.051);assert.equal(G.player.hp,10000);updateHazards(.948);assert.equal(G.player.hp,10000);updateHazards(.002);assert.ok(G.player.hp<10000);
});

test('financier contract fixes the debt mark, fires coins first and settles after two seconds',()=>{
 const b=reset(10);begin(b);const mark=hazards().find(h=>h.kind==='tcircle');assert.equal(mark.symbol,'hourglass');assert.equal(mark.delay,2);assert.equal(mark.x,300);
 G.player.x=520;G.player.iframes=0;advance(b,1.055);assert.equal(G.enemyShots.count,5);assert.ok(shots().every(s=>s.kind==='coin'));
 G.player.x=300;updateHazards(.944);assert.equal(G.player.hp,10000);updateHazards(.002);assert.ok(G.player.hp<10000);assert.equal(G.enemyShots.count,12);
 const final=reset(10,2);begin(final);assert.deepEqual(hazards().filter(h=>h.kind==='tcircle').map(h=>h.delay),[2,2.65]);
});

test('death and phase changes cancel owned warning callbacks without removing unrelated hazards',()=>{
 for(const stage of [2,4,5,6,7,8,9,10]) for(const interruption of ['phase','death']) {
  const b=reset(stage);begin(b);const callbacks=hazards().map(h=>[h.onFire,{...h}]);
  const friendly=spawnHazard('gas',1000,1000,{radius:20,duration:5});
  if(interruption==='phase') b.enterPhase(1);else b.die();
  assert.ok(hazards().includes(friendly));assert.ok(hazards().every(h=>h.onFire?.bossOwner!==b));
  const before=[G.enemyShots.count,G.hazards.count,G.player.hp,b.motionState];
  for(const [callback,h] of callbacks) callback(h);
  assert.deepEqual([G.enemyShots.count,G.hazards.count,G.player.hp,b.motionState],before,`${stage}:${interruption}`);
 }
});

test('phase reinforcement is an explicit brute/brood identity, not the same add wave on every boss',()=>{
 for(let stage=1;stage<=10;stage++) {
  const b=reset(stage);b.enterPhase(1);
  assert.equal(G.enemies.count,stage===1?4:stage===6?5:0,`stage ${stage}`);
 }
});

test('each final-phase signature completes with bounded hazards/projectiles and a real recovery gap',()=>{
 for(let stage=2;stage<=10;stage++) {
  const b=reset(stage,2);begin(b);let maxHazards=0,maxShots=0;
  for(let t=0;b.task&&t<6;t+=.01) {advance(b,.01);maxHazards=Math.max(maxHazards,G.hazards.count);maxShots=Math.max(maxShots,G.enemyShots.count);}
  assert.equal(b.task,null,`stage ${stage}: stuck task`);assert.ok(b.attackT>=1.25);assert.ok(maxHazards<=7);assert.ok(maxShots<=40);
  assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
 }
});

test('hourglass marker is draw-only and pooled hazards reset it on reuse',()=>{
 const b=reset(10);begin(b);const mark=hazards().find(h=>h.symbol==='hourglass');const snapshot=JSON.stringify(mark);
 const paths=[];const ctx=new Proxy({globalAlpha:1,moveTo:(...args)=>paths.push(args)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 drawHazards(ctx);assert.equal(JSON.stringify(mark),snapshot);assert.ok(paths.some(([x,y])=>x===mark.x-11&&y===mark.y-11));
 G.hazards.clear();const plain=spawnHazard('tcircle',0,0,{delay:1});assert.equal(plain.symbol,null);
});
