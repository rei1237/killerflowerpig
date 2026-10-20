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
  if(stage>1&&stage!==9) for(const field of ['speed','dmg']) assert.equal(def[field],stage===3&&field==='speed'?118:baseline.bosses[stage][field],`${stage}:${field}`);
  b.startPattern();assert.equal(b.lastPattern,def.signature,'opening cannot randomly skip identity');
 }
});

test('signatures preserve their full warning and release attack poses only at their gameplay event',()=>{
 for(let stage=2;stage<=10;stage++) for(const phase of [0,2]) {
  const b=reset(stage,phase);begin(b);const first=Math.min(...hazards().map(h=>h.delay));
  assert.ok(first>=(stage===3?.65:1.05),`${stage}: phase cannot shorten the warning`);
  advance(b,first-.005);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.windup,`${stage}: premature attack`);assert.equal(G.enemyShots.count,0);
  advance(b,.01);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.attack,`${stage}: release pose`);
 }
});

test('machine gun locks its corridor, stays stationary, escalates per phase and always exposes a reload opening',()=>{
 for(const phase of [0,1,2]) {
  const b=reset(2,phase);begin(b);const angles=hazards().map(h=>h.angle),fan=phase?3:1;
  assert.equal(hazards().length,3+phase+(phase===2?6:0),'mutation adds a shot, frenzy adds two telegraphed flank corridors');
  G.player.y=220;advance(b,1.151);assert.equal(G.enemyShots.count,3*fan);
  assert.ok(shots().every(s=>Math.abs(Math.atan2(s.vy,s.vx)-angles[0])<=.14+1e-9),'fan stays inside the locked corridor cone');
  while(b.task) advance(b,.01);
  close(b.x,0);close(b.y,0);assert.equal(G.enemyShots.count,3*fan*(3+phase)+(phase===2?12:0));assert.ok(b.attackT>=1.8);
 }
});

test('hunter separately locks two capped dashes and holds a stationary recovery without unmarked shots',()=>{
 const b=reset(3),task=begin(b);advance(b,.649);close(b.x,0);close(b.y,0);
 G.player.y=200;while(task.strike===0)advance(b,.01);
 close(b.x,300);close(b.y,0);assert.equal(task.phase,'warning');assert.equal(hazards()[0].delay,.5);
 G.player.x=-400;G.player.y=-400;
 while(b.task===task)advance(b,.01);
 assert.equal(b.task.phase,'recover');const position=[b.x,b.y];advance(b,1.24);assert.deepEqual([b.x,b.y],position);
 while(b.task)advance(b,.01);
 assert.equal(G.enemyShots.count,0);assert.ok(b.attackT>=1.35);
});

// 강화: 저격 3/4/5회(1.05초 간격), 3갈래(광폭화 5갈래). 각 조준선은 여전히 .55초 이상 고정된다.
test('sniper acquires three independent locks and freezes each line for at least .55s',()=>{
 const b=reset(4);const task=begin(b),first=task.locks[0].h;
 advance(b,.4);G.player.y=130;advance(b,.15);const angle=first.angle;assert.ok(angle>0);
 advance(b,.1);G.player.y=-160;advance(b,.4);close(first.angle,angle);assert.equal(G.enemyShots.count,0);
 advance(b,.12);assert.equal(G.enemyShots.count,3);close(Math.atan2(shots()[1].vy,shots()[1].vx),angle);
 advance(b,.2);assert.equal(task.locks.length,2);assert.ok(task.locks[1].h.angle<0);
 const second=task.locks[1].h;advance(b,.65);const locked=second.angle;G.player.y=200;advance(b,.55);
 assert.equal(G.enemyShots.count,6);close(Math.atan2(shots()[4].vy,shots()[4].vx),locked);
 while(b.task)advance(b,.01);assert.equal(task.locks.length,3);assert.equal(G.enemyShots.count,9);
 for(const phase of [1,2]){const r=reset(4,phase),t=begin(r);while(r.task)advance(r,.01);assert.equal(t.locks.length,[3,4,5][phase]);assert.equal(G.enemyShots.count,[3,4,5][phase]*(phase===2?5:3));}
});

// 강화: 전진 포격 4발 + 기본부터 한쪽 측면 귀환 포격 1발(변이 양 측면, 광폭화 +2). 반대쪽 측면은 안전하게 남는다.
test('tank battery walks through forward impact circles plus one flank return and leaves the other flank safe',()=>{
 const b=reset(5);begin(b);const marks=hazards();assert.equal(marks.length,5);
 const forward=marks.slice(0,4);assert.deepEqual(forward.map(h=>h.x),[110,215,320,425]);assert.ok(forward.every(h=>h.y===0));
 assert.deepEqual([marks[4].x,marks[4].y],[270,105]);assert.ok(marks.every(h=>h.radius===70));
 for(let i=1;i<marks.length;i++)assert.ok(marks[i-1].delay<marks[i].delay);
 for(const phase of [1,2])assert.equal((reset(5,phase),begin(G.boss),hazards().length),[5,6,8][phase]);
 reset(5);begin(G.boss);
 G.player.iframes=0;G.player.x=225;G.player.y=-100;const hp=G.player.hp;updateHazards(2.2);assert.equal(G.player.hp,hp);
 const second=reset(5);begin(second);G.player.x=110;G.player.iframes=0;updateHazards(1.099);assert.equal(G.player.hp,10000);updateHazards(.002);assert.ok(G.player.hp<10000);
});

// 강화: 기본부터 출구가 반대쪽인 두 번째 파도(.85초 뒤), 산성 지속 3.4/4.0/4.6초. 파도마다 넓은 출구가 남는다.
test('toxic horseshoe snapshots position with a broad clear exit per wave and five acid pockets per wave',()=>{
 const b=reset(6);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,10);
 const first=marks.filter(h=>h.delay===1.2),second=marks.filter(h=>h.delay>1.2);assert.equal(first.length,5);assert.equal(second.length,5);
 close(second[0].delay,2.05);
 for(let distance=0;distance<=240;distance+=4) assert.ok(first.every(h=>!ellipseContains(h,300+distance,0)),'east exit remains clear in the first wave');
 for(let distance=0;distance<=240;distance+=4) assert.ok(second.every(h=>!ellipseContains(h,300-distance,0)),'west exit remains clear in the second wave');
 G.player.x=600;advance(b,1.205);const acid=hazards().filter(h=>h.kind==='acid');assert.equal(acid.length,5);
 for(const h of acid) {assert.equal(h.duration,3.4);assert.ok(first.some(m=>m.x===h.x&&m.y===h.y&&m.radius===h.radius));}
 advance(b,.85);assert.equal(hazards().filter(h=>h.kind==='acid').length,10);
 const rage=reset(6,2);begin(rage);assert.equal(hazards().length,15,'frenzy adds a third wave');
});

test('assassin crossing cuts lock both paths, strike in order and cannot hit beyond the drawn line',()=>{
 const b=reset(7);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,2);close(Math.abs(marks[1].angle-marks[0].angle),Math.PI/2);
 G.player.iframes=0;G.player.x=300;G.player.y=150;assert.ok(marks.every(h=>!lineContains(h,G.player.x,G.player.y)));
 updateHazards(1.051);assert.equal(G.player.hp,10000);close(b.x,marks[0].x);close(b.y,marks[0].y);
 G.player.x=300;G.player.y=0;updateHazards(.8);assert.ok(G.player.hp<10000);close(b.x,marks[1].x);
 const hp=G.player.hp;G.player.iframes=0;const h=marks[0];G.player.x=h.x-Math.cos(h.angle);G.player.y=h.y-Math.sin(h.angle);b.lineHit(h);assert.equal(G.player.hp,hp);
});

// 강화: 메아리 3/4/4개, 탄 20+3×페이즈, 광폭화 간격 .6초. 90도 빈 쐐기는 그대로.
test('psychic echoes use separate origins, staggered release and a wide missing sector per wave',()=>{
 assert.equal((reset(8,0),begin(G.boss),hazards().length),3);
 const b=reset(8,2);begin(b);const marks=hazards().map(h=>({...h}));assert.equal(marks.length,4);assert.equal(new Set(marks.map(m=>`${m.x},${m.y}`)).size,4);
 advance(b,1.205);assert.equal(G.enemyShots.count,26);assert.ok(shots().every(s=>s.x===marks[0].x&&s.y===marks[0].y));
 advance(b,.6);assert.equal(G.enemyShots.count,52);advance(b,.6);assert.equal(G.enemyShots.count,78);advance(b,.6);assert.equal(G.enemyShots.count,104);
 for(const h of marks) {
  const angles=shots().filter(s=>s.x===h.x&&s.y===h.y).map(s=>(Math.atan2(s.vy,s.vx)+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b);
  const gaps=angles.map((a,i)=>(angles[(i+1)%angles.length]-a+Math.PI*2)%(Math.PI*2));
  close(Math.max(...gaps),Math.PI/2);
 }
});

test('King fixes sequential fault lines then reacquires one/two fully warned verdicts without adds',()=>{
 for(const phase of [0,1,2]) {
  const b=reset(9,phase);const task=begin(b);const initial=hazards().map(h=>({...h}));
  assert.equal(initial.length,phase?6:4);
  assert.equal(initial[0].delay,1.05);assert.equal(initial[1].delay,1.05);assert.equal(initial[2].delay,2);
  assert.equal(initial[0].width,58);
  G.player.x=600;G.player.y=200;
  let circles=0,seen=new Set();
  while(b.task){advance(b,.01);for(const h of hazards())if(h.kind==='tcircle'&&!seen.has(h.onFire)){seen.add(h.onFire);circles++;assert.equal(h.delay,1.05);assert.equal(h.x,600);assert.equal(h.y,200);}}
  assert.equal(circles,phase);assert.ok(b.attackT>=1.5);assert.equal(G.enemyShots.count,0);assert.equal(G.enemies.count,0);
 }
});

test('King telegraph footprints have a reachable central opening and outside edges stay safe',()=>{
 const b=reset(9);begin(b);G.player.iframes=0;
 const marks=hazards().map(h=>({...h}));
 assert.ok(!lineContains(marks[0],300,0)&&!lineContains(marks[1],300,0));
 updateHazards(1.051);assert.equal(G.player.hp,10000,'first flank strike leaves center open');
 G.player.y=45;updateHazards(.95);assert.equal(G.player.hp,10000,'45px sidestep clears center');
 const hp=G.player.hp;G.player.x=300;G.player.y=0;b.lineHit(marks[2],1);close(hp-G.player.hp,b.dmg);assert.ok(b.dmg<50);
});

// 강화: 금화 사격선 7/9/11줄, 모래시계 2/2/3개(.65초 간격), 결산 금화 11발.
test('financier contract fixes the debt mark, fires coins first and settles after two seconds',()=>{
 const b=reset(10);begin(b);const mark=hazards().find(h=>h.kind==='tcircle');assert.equal(mark.symbol,'hourglass');assert.equal(mark.delay,2);assert.equal(mark.x,300);
 assert.equal(hazards().filter(h=>h.kind==='tcircle').length,2);
 G.player.x=520;G.player.iframes=0;advance(b,1.055);assert.equal(G.enemyShots.count,7);assert.ok(shots().every(s=>s.kind==='coin'));
 G.player.x=300;updateHazards(.944);assert.equal(G.player.hp,10000);updateHazards(.002);assert.ok(G.player.hp<10000);assert.equal(G.enemyShots.count,18);
 const final=reset(10,2);begin(final);hazards().filter(h=>h.kind==='tcircle').map(h=>h.delay).forEach((d,i)=>close(d,[2,2.65,3.3][i]));assert.equal(hazards().filter(h=>h.kind==='tcircle').length,3);
 assert.equal(hazards().filter(h=>h.kind==='tline').length,11);
});

test('death and phase changes cancel owned warning callbacks without removing unrelated hazards',()=>{
 for(const stage of [2,3,4,5,6,7,8,9,10]) for(const interruption of ['phase','death']) {
  const b=reset(stage);begin(b);const callbacks=hazards().filter(h=>h.onFire).map(h=>[h.onFire,{...h}]);
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
  assert.equal(G.enemies.count,stage===6?5:0,`stage ${stage}`);
 }
});

// 강화된 4~10 보스 광폭화 기준 상한: 독성 3파도 15개·계약 14개 경고, 메아리 4×26=104발 (이전 12/72)
test('each final-phase signature completes with bounded hazards/projectiles and a real recovery gap',()=>{
 for(let stage=2;stage<=10;stage++) {
  const b=reset(stage,2);begin(b);let maxHazards=0,maxShots=0;
  for(let t=0;b.task&&t<8;t+=.01) {advance(b,.01);maxHazards=Math.max(maxHazards,G.hazards.count);maxShots=Math.max(maxShots,G.enemyShots.count);}
  assert.equal(b.task,null,`stage ${stage}: stuck task`);assert.ok(b.attackT>=1.25);assert.ok(maxHazards<=16,`stage ${stage}: ${maxHazards} hazards`);assert.ok(maxShots<=110,`stage ${stage}: ${maxShots} shots`);
  assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
 }
});

test('hourglass marker is draw-only and pooled hazards reset it on reuse',()=>{
 const b=reset(10);begin(b);const mark=hazards().find(h=>h.symbol==='hourglass');const snapshot=JSON.stringify(mark);
 const paths=[];const ctx=new Proxy({globalAlpha:1,moveTo:(...args)=>paths.push(args)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 drawHazards(ctx);assert.equal(JSON.stringify(mark),snapshot);assert.ok(paths.some(([x,y])=>x===mark.x-11&&y===mark.y-11));
 G.hazards.clear();const plain=spawnHazard('tcircle',0,0,{delay:1});assert.equal(plain.symbol,null);
});

test('advanced bosses retain bullet mixing and signature escalation; beginner does not',()=>{
 for(let stage=1;stage<=10;stage++) {
  const def=BOSSES[stage];
  if(stage===1){assert.deepEqual(def.phases,[['trainingCharge'],['trainingCharge'],['trainingCharge']]);continue;}
  assert.ok(!def.phases[0].some(k=>k==='ring'||k==='aimed')||stage===1,`${stage}: opening phase stays a pure signature read`);
  assert.ok(def.phases[2].some(k=>k==='ring'||k==='aimed'),`${stage}: frenzy mixes a bullet pattern`);
  // Hunter's 2 → 3 → off-beat 3 combo is verified with a moving player in hunter-speed.mjs.
  if(stage<2||stage===3) continue;
  const threat=phase=>{const b=reset(stage,phase);const task=begin(b);let warnings=hazards().length,shotsMax=0,locks=0;
   for(let t=0;b.task&&t<8;t+=.01){advance(b,.01);shotsMax=Math.max(shotsMax,G.enemyShots.count);warnings=Math.max(warnings,hazards().filter(h=>h.onFire).length);locks=Math.max(locks,task.strike??task.next??0);}
   return warnings+shotsMax/10+locks;};
  assert.ok(threat(2)>threat(0),`stage ${stage}: frenzy signature is harder than the opening`);
 }
});

test('assassin pursuit slashes re-aim at the moved player and every cut throws a shadow-dagger fan',()=>{
 const b=reset(7);begin(b);
 updateHazards(1.051);assert.equal(shots().length,3,'first cut throws 3 daggers');
 G.player.x=520;G.player.y=-140;
 updateHazards(.8);assert.equal(shots().length,6,'second cut throws 3 more');
 const pursuit=hazards().find(h=>h.kind==='tline'&&h.color==='#ff6fd0');assert.ok(pursuit,'pursuit slash appears after the locked cuts');
 assert.ok(lineContains(pursuit,520,-140),'pursuit line passes through the player position at that moment');
 G.player.iframes=0;updateHazards(.61);assert.ok(G.player.hp<10000,'standing still under the pursuit slash is punished');
 const rage=reset(7,2);begin(rage);assert.equal(hazards().length,4,'rage phase locks four cuts');
});
