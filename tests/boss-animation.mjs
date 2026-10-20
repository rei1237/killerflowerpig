import { treasureRandom } from '../src/game/coin-drops.js'; treasureRandom.next = () => .99; // 보물 상자 굴림 고정: 처치가 섞인 테스트가 난수 때문에 흔들리지 않게
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOSS_SHEETS, BOSS_FRAMES, bossSpriteFrame, drawBossSpriteSheet, setBossMotion, updateBossMotion } from '../src/game/boss-appearance.js';
import { BossSheetCache } from '../src/game/boss-sheets.js';
import { Boss } from '../src/game/boss.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, images, fx } from '../src/core/assets.js';
import { updateHazards } from '../src/game/hazards.js';
import { step } from '../src/game/game.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function reset(stage=1) {
 clearWorld();G.stage=stage;G.clock=0;G.events={};G.mode='boss';G.paused=false;
 fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};
 G.view={w:1000,h:600};G.caps={enemies:420,particles:0,texts:0,gems:500,decalScale:1};
 G.player={x:300,y:0,vx:0,vy:0,radius:12,hp:10000,maxHp:10000,iframes:100,stats:{crit:0,armor:0}};
 for(const name of ['boss1','boss2','bossKing','rabbit1','rabbit2','rabbit3'])atlases[name]={walkH:112,frameCount:()=>8,draw(){}};
 const boss=new Boss(stage);boss.x=0;boss.y=0;boss.attackT=100;G.boss=boss;return boss;
}
function begin(boss,name) {boss.task=boss[`task_${name}`]();boss.task.t=0;return boss.task;}
const assertFrame=(b,frame)=>assert.equal(bossSpriteFrame(b),BOSS_FRAMES[frame]);
function mockContext() {
 const draws=[],arcs=[],scales=[],translations=[];
 const ctx=new Proxy({globalAlpha:1,drawImage:(...a)=>draws.push(a),arc:(...a)=>arcs.push(a),scale:(...a)=>scales.push(a),translate:(...a)=>translations.push(a)},
 {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 return {ctx,draws,arcs,scales,translations};
}

test('all ten shipped WebP atlases match runtime dimensions, pose order, anchors and measured height',()=>{
 for(let stage=1;stage<=10;stage++){
  const meta=BOSS_SHEETS[stage],path=new URL('../'+meta.src,import.meta.url),bytes=fs.readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.toString('ascii',12,16),'VP8X');
  assert.equal(bytes.readUIntLE(24,3)+1,meta.width);assert.equal(bytes.readUIntLE(27,3)+1,meta.height);
  const art=JSON.parse(fs.readFileSync(new URL('../'+meta.src.replace('.webp','.json'),import.meta.url),'utf8'));
  assert.equal(art.bodyHeight,meta.bodyHeight);assert.deepEqual(art.anchor,{x:meta.anchorX,y:meta.footY});assert.equal(art.facing,'right');
  assert.deepEqual(art.frames.map(f=>f.name),Object.keys(BOSS_FRAMES));
  for(let i=0;i<8;i++){const f=art.frames[i];assert.deepEqual([f.index,f.x,f.y,f.width,f.height],[i,i%4*256,Math.floor(i/4)*256,256,256]);}
 }
});

test('all ten sheets select source cells with the same ground anchor and unchanged hit circle',()=>{
 assert.equal(new Set(BOSS_SHEETS.slice(1).map(x=>x.src)).size,10);
 for(let stage=1;stage<=10;stage++) {
  const boss=reset(stage),meta=BOSS_SHEETS[stage],image={width:1024,height:512};
  assert.deepEqual([meta.columns,meta.cellWidth,meta.cellHeight,meta.anchorX,meta.footY],[4,256,256,128,240]);
  const seen=new Set();
  for(const [state,frame] of [['walk',0],['windup',2],['attack',3],['recover',4]]) {
   setBossMotion(boss,state);boss.flip=true;
   const before=JSON.stringify(boss),{ctx,draws,arcs,scales,translations}=mockContext();
   assert.equal(drawBossSpriteSheet(ctx,boss,image),true);
   assert.equal(draws[0].length,9);
   assert.deepEqual(draws[0].slice(1,5),[frame%4*256,Math.floor(frame/4)*256,256,256]);
   const scale=boss.radius*3.2/meta.bodyHeight;
   assert.deepEqual(draws[0].slice(5),[-128*scale,-240*scale,256*scale,256*scale]);
   assert.deepEqual(arcs[0].slice(0,3),[boss.x,boss.y-boss.radius,boss.radius]);
   assert.deepEqual(scales,[[-1,1]]);assert.deepEqual(translations,[[boss.x,boss.y]]);
   assert.equal(JSON.stringify(boss),before,'drawing cannot change animation, movement, or collision');seen.add(draws[0][1]+','+draws[0][2]);
  }
  assert.equal(seen.size,4);
  assert.equal(drawBossSpriteSheet(mockContext().ctx,boss,null),false);
  assert.equal(drawBossSpriteSheet(mockContext().ctx,boss,{width:512,height:512}),false);
 }
});

test('walking alternates actual frames; pause, idle, and hitstop freeze the simulation-driven pose',()=>{
 const b=reset();assertFrame(b,'walkA');b.update(.18);assertFrame(b,'walkB');b.update(.17);assertFrame(b,'walkA');
 setBossMotion(b,'attack',.16);
 for(const gate of ['pause','idle','hitstop']) {
  G.paused=gate==='pause';G.mode=gate==='idle'?'idle':'boss';G.hitstop=gate==='hitstop'?.2:0;
  const snapshot=[b.motionState,b.motionT,b.walkT,b.hurtT,b.deadT,b.x,b.y,b.radius];
  step(.05);drawBossSpriteSheet(mockContext().ctx,b,{width:1024,height:512});
  assert.deepEqual([b.motionState,b.motionT,b.walkT,b.hurtT,b.deadT,b.x,b.y,b.radius],snapshot,gate);
 }
 G.paused=false;G.mode='boss';G.hitstop=0;b.update(.17);assertFrame(b,'recover');b.update(.13);assert.equal(b.motionState,'walk');
});

test('charge holds windup for the exact gameplay warning and attacks only during the real dash',()=>{
 for(const stage of [1,2,10])for(const phase of [0,1,2]) {
  const b=reset(stage);b.phase=phase;const task=begin(b,'charge');
  const warning=(b.def.pacing?.chargeWarning??.75)/Math.sqrt(b.phaseMul),speed=b.def.pacing?.chargeSpeed??620;
  assertFrame(b,'windup');close(G.hazards.items[0].delay,warning);
  b.update(warning-.001);assertFrame(b,'windup');close(b.x,0);
  b.update(.002);assertFrame(b,'attack');close(b.x,speed*.002);
  const restDistance=task.len-task.dash;b.update(restDistance/speed+.001);
  assert.equal(b.task,null);assert.ok(['attack','recover'].includes(b.motionState));
  b.update(.3);assert.equal(b.motionState,'walk');
 }
});

test('ring and aimed volleys release the attack frame on the actual projectile event, including the final shot',()=>{
 for(const [name,delay,gap,count] of [['ring',.3,.35,2],['aimed',.35,.28,3]]) {
  const b=reset();begin(b,name);b.update(delay-.001);assertFrame(b,'windup');assert.equal(G.enemyShots.count,0);
  b.update(.002);assertFrame(b,'attack');assert.ok(G.enemyShots.count>0);
  b.update(.17);assertFrame(b,'recover');
  for(let i=1;i<count;i++) {
   const t=delay+gap*i+.001,oldCount=G.enemyShots.count;b.update(t-b.task.t);
   assert.ok(G.enemyShots.count>oldCount);assertFrame(b,'attack');
  }
  assert.equal(b.task,null);b.update(.17);assertFrame(b,'recover');b.update(.13);assert.equal(b.motionState,'walk');
 }
});

test('spiral, snipe, summon and blink switch poses at their own gameplay events',()=>{
 let b=reset(8);begin(b,'spiral');assertFrame(b,'windup');b.update(.001);assertFrame(b,'attack');assert.equal(G.enemyShots.count,2);
 b=reset(4);begin(b,'snipe');b.update(1.099);assertFrame(b,'windup');assert.equal(G.enemyShots.count,0);b.update(.002);assertFrame(b,'attack');assert.equal(G.enemyShots.count,3);
 b=reset(1);begin(b,'summon');b.update(.599);assertFrame(b,'windup');assert.equal(G.enemies.count,0);b.update(.002);assertFrame(b,'attack');assert.equal(G.enemies.count,2);assert.equal(b.task,null);
 b=reset(7);const task=begin(b,'blink');b.update(.699);assertFrame(b,'windup');assert.equal(b.x,0);b.update(.002);assertFrame(b,'attack');close(b.x,task.tx);close(b.y,task.ty);assert.equal(G.enemyShots.count,8);
});

test('directional attacks face their real target without changing projectile or collision math',()=>{
 for(const name of ['aimed','snipe']){
  const b=reset(4);G.player.x=-300;begin(b,name);const bodyY=b.bodyY(),radius=b.radius;if(name==='snipe'){b.update(.7);b.update(.401);}else b.update(.351);
  assert.equal(b.flip,true);assert.equal(b.radius,radius);close(b.bodyY(),bodyY);assert.ok(G.enemyShots.items[0].vx<0);
 }
});

test('acid pools and slam use actual hazard onFire callbacks, never an unrelated animation clock',()=>{
 for(const name of ['pools','slam']) {
  const b=reset(6);begin(b,name);b.update(.999);assertFrame(b,'windup');
  updateHazards(.999);assertFrame(b,'windup');assert.equal(G.enemyShots.count,0);
  updateHazards(.002);assertFrame(b,'attack');
  if(name==='pools')assert.ok(G.hazards.items.slice(0,G.hazards.count).some(h=>h.kind==='acid'));
  else assert.equal(G.enemyShots.count,16);
 }
 const b=reset(6);b.phase=2;begin(b,'pools');b.update(1.41);assert.equal(b.task,null);
 updateHazards(1.57);assertFrame(b,'attack','late actual pool detonation can still animate after task recovery begins');
});

test('hurt and both death cells are visible without hiding telegraphs or reviving dead bosses',()=>{
 const b=reset();b.hurt(1,{silent:true});assertFrame(b,'hurt');
 b.update(.12);assert.equal(b.hurtT,0);
 begin(b,'charge');b.hurtCooldown=0;b.hurt(1,{silent:true});assertFrame(b,'windup');
 setBossMotion(b,'attack',.16);assertFrame(b,'attack');
 b.die();assertFrame(b,'deathA');assert.equal(b.task,null);b.update(.239);assertFrame(b,'deathA');b.update(.002);assertFrame(b,'deathB');
 const before=b.motionState;setBossMotion(b,'attack',.16);assert.equal(b.motionState,before);
 b.update(4);assertFrame(b,'deathB');
});

test('lazy atlas cache requests only current/next, evicts stale requests, and handles failures without frame-loop retries',async()=>{
 const requests=[];
 const cache=new BossSheetCache(src=>{
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const r={src,promise,resolve,reject,cancelled:false,cancel(){this.cancelled=true;resolve(null);}};requests.push(r);return r;
 });
 assert.equal(requests.length,0);
 const first=cache.prepare(1);assert.deepEqual(requests.map(x=>x.src),[BOSS_SHEETS[1].src,BOSS_SHEETS[2].src]);
 const second=cache.prepare(2);assert.equal(requests.length,3);assert.equal(requests[0].cancelled,true);assert.deepEqual([...cache.entries.keys()],[2,3]);
 const sheet={width:1024,height:512};requests[1].resolve(sheet);requests[2].resolve({width:512,height:512});await Promise.all([first,second]);
 assert.equal(cache.get(1),null);assert.equal(cache.get(2),sheet);assert.equal(cache.get(3),null);
 await cache.prepare(2);for(let i=0;i<20;i++)cache.get(3);assert.equal(requests.length,3);
 const last=cache.prepare(10);assert.equal(cache.entries.size,1);assert.equal(requests[1].cancelled,true);requests[3].reject(new Error('offline'));await last;assert.equal(cache.get(10),null);
});

test('fallback still draws unique full-body art and stage prefetch never blocks stage entry',()=>{
 const b=reset(5),{ctx,draws}=mockContext(),portrait={width:512,height:512};images.bossArt5=portrait;b.draw(ctx);
 assert.equal(draws[0][0],portrait);assert.equal(draws[0].length,5);
 const source=fs.readFileSync(new URL('../src/game/game.js',import.meta.url),'utf8');
 assert.match(source,/G.stage = stage;\s+prepareBossSheets\(stage\);/);
 assert.doesNotMatch(source,/await prepareBossSheets/);
 assert.doesNotMatch(fs.readFileSync(new URL('../src/core/assets.js',import.meta.url),'utf8'),/boss-animations/);
});
