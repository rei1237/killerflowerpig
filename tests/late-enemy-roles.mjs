import { treasureRandom } from '../src/game/coin-drops.js'; treasureRandom.next = () => .99; // 보물 상자 굴림 고정: 처치가 섞인 테스트가 난수 때문에 흔들리지 않게
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, fx } from '../src/core/assets.js';
import { ENEMIES, ENEMY_TOUGHNESS_MULTIPLIER } from '../src/data/enemies.js';
import { spawnEnemy, updateEnemies, flushExplosions, hitEnemy, fireEnemyShot, drawEnemy, drawEnemyShots } from '../src/game/enemies.js';
function reset(stage=6) {
 fx.splats={red:[{}],green:[{}]}; clearWorld(); G.stage=stage; G.time=0; G.clock=0; G.events={}; G.godMode=false;
 G.view={w:1000,h:600}; G.caps={enemies:420,particles:0,texts:0,gems:500,decalScale:1};
 G.player={x:0,y:0,vx:0,vy:0,radius:12,hp:100,maxHp:100,iframes:0,stats:{crit:0,armor:0}};
 for(const name of ['rabbit1','rabbit2','rabbit3']) atlases[name]={walkH:112,frameCount:()=>8};
}
test('all spawn routes gate new roles and ranged mobs, original atlas identities and toughness survive',()=>{
 reset(4); for(const id of ['suicider','gunner','spitter']) assert.equal(spawnEnemy(id,100,0,{force:true,elite:true}),null);
 reset(5); assert.ok(spawnEnemy('suicider',100,0)); assert.equal(spawnEnemy('gunner',100,0),null); assert.ok(spawnEnemy('spitter',100,0));
 reset(6); assert.ok(spawnEnemy('gunner',100,0)); assert.equal(ENEMY_TOUGHNESS_MULTIPLIER,1.62);
 assert.equal(ENEMIES.shambler.sheet,'rabbit1'); assert.equal(ENEMIES.brute.sheet,'rabbit2'); assert.equal(ENEMIES.hulk.sheet,'rabbit3');
});
test('suicide charge warns, locks direction, gives final fuse and can be killed safely',()=>{
 reset(); const e=spawnEnemy('suicider',150,0,{lineX:-1,lineY:0});
 updateEnemies(.1); assert.equal(e.rolePhase,'warning'); assert.equal(e.x,150); const aim=e.aimY;
 G.player.y=100; updateEnemies(.2); assert.equal(e.aimY,aim); assert.equal(G.player.hp,100);
 // 강화: 예고 .8→.7초, 신관 .6→.45초
 updateEnemies(.41); assert.equal(e.rolePhase,'warning'); updateEnemies(.1); assert.equal(e.rolePhase,'dash'); updateEnemies(.56); updateEnemies(.01); assert.equal(e.rolePhase,'fuse'); assert.equal(G.player.hp,100);
 hitEnemy(e,1e6,{silent:true}); flushExplosions(); assert.equal(G.player.hp,100); assert.equal(G.hazards.count,0);
});
test('overlapping armed detonations respect normal iframes and absolute damage cap, with no toxic field',()=>{
 reset(10); const a=spawnEnemy('suicider',0,0), b=spawnEnemy('suicider',0,0);
 for(const e of [a,b]) {e.rolePhase='fuse'; e.roleT=.01;}
 updateEnemies(.02); assert.equal(G.player.hp,100); flushExplosions();
 // 피해 상한 30→40: 두 폭발이 겹쳐도 무적시간 덕에 한 번(40)만 들어간다
 assert.equal(ENEMIES.suicider.charge.damageCap,40); assert.equal(G.player.hp,100-ENEMIES.suicider.charge.damageCap); assert.equal(G.player.iframes,.5); assert.equal(G.hazards.count,0);
 assert.equal(a.alive,false); assert.equal(b.alive,false);
 // 폭발마다 파편 8발(피해 = 상한 적용 폭발 피해 × .35), 무적시간 중이라 즉시 추가 피해 없음
 const shards=G.enemyShots.items.slice(0,G.enemyShots.count); assert.equal(shards.length,2*ENEMIES.suicider.charge.shrapnel);
 assert.ok(shards.every(s=>s.kind==='bullet'&&Math.abs(s.dmg-40*.35)<1e-9&&Math.abs(Math.hypot(s.vx,s.vy)-ENEMIES.suicider.charge.shrapnelSpeed)<1e-9));
});
test('gunner telegraphs a 3-round red bullet fan and cannot retarget during warning',()=>{
 reset(); const e=spawnEnemy('gunner',200,0); e.shootT=0;
 updateEnemies(.01); assert.equal(G.enemyShots.count,0); assert.equal(e.shotWarning,.7); const aim=e.aimY;
 G.player.y=150; updateEnemies(.3); assert.equal(G.enemyShots.count,0); assert.equal(e.aimY,aim);
 updateEnemies(.41); assert.equal(G.enemyShots.count,3); const shots=G.enemyShots.items.slice(0,3); assert.ok(shots.every(s=>s.kind==='bullet'&&s.radius===5)); const center=shots[1]; assert.ok(Math.abs(center.vy-aim*255)<1e-9,'middle round follows the locked aim'); assert.ok(shots[0].vy!==shots[2].vy,'outer rounds fan out');
});
test('pooled ordinary shots do not inherit boss acceleration',()=>{
 reset(); const s=fireEnemyShot(0,0,1,0,100,5); s.accel=9; G.enemyShots.clear(); const next=fireEnemyShot(0,0,1,0,100,5,'bullet'); assert.equal(next.accel,0);
});

test('role warning circle matches blast geometry and optional generated art preserves atlas fallback',()=>{
 reset(); const e=spawnEnemy('suicider',100,20); e.rolePhase='fuse'; e.roleT=.3;
 const arcs=[], calls=[];
 const ctx=new Proxy({}, {get:(target,key)=>target[key] || ((...args)=>{if(key==='arc')arcs.push(args);}),set:(target,key,value)=>(target[key]=value,true)});
 e.atlas.draw=()=>calls.push('original'); drawEnemy(ctx,e);
 assert.equal(arcs[0][2],ENEMIES.suicider.charge.radius); assert.deepEqual(calls,['original']);
 atlases.enemyRole_suicider={draw:()=>calls.push('generated')}; drawEnemy(ctx,e);
 assert.deepEqual(calls,['original','generated']); delete atlases.enemyRole_suicider;
 fireEnemyShot(10,20,1,0,255,9,'bullet',5); drawEnemyShots(ctx,{});
 assert.ok(arcs.some(a=>a[0]===10 && a[1]===20 && a[2]===5));
});

test('long frames preserve fresh warning/fuse, bound dash travel, and sweep player collision',()=>{
 reset(); const e=spawnEnemy('suicider',240,0);
 updateEnemies(4); assert.equal(e.rolePhase,'warning'); assert.equal(e.roleT,ENEMIES.suicider.charge.warning); assert.equal(e.x,240);
 updateEnemies(4); assert.equal(e.rolePhase,'dash'); assert.equal(e.roleT,ENEMIES.suicider.charge.duration); assert.equal(e.x,240);
 // 돌진 강화(400×1.4=560px): 플레이어를 더 멀리 옮겨 접촉 정지 없이 최대 돌진 거리만 검증
 G.player.y=600; updateEnemies(4); assert.equal(e.rolePhase,'dash'); assert.equal(e.roleT,0);
 const c=ENEMIES.suicider.charge, travelled=Math.hypot(e.x-240,e.y);
 assert.ok(Math.abs(travelled-c.speed*c.duration)<1e-6,'dash length is bounded by speed×duration despite a four-second frame');
 assert.ok(e.y>0,'the long dash steers toward the moved player');
 updateEnemies(4); assert.equal(e.rolePhase,'fuse'); assert.equal(e.roleT,ENEMIES.suicider.charge.fuse); assert.equal(e.alive,true);
 hitEnemy(e,1e6,{silent:true}); flushExplosions();
 reset(); const near=spawnEnemy('suicider',100,0);
 updateEnemies(4); updateEnemies(4); updateEnemies(4);
 assert.ok(Math.abs(near.x-38)<1e-8,'sweep stops at activation distance instead of tunneling');
 assert.equal(G.player.hp,100); updateEnemies(4); assert.equal(near.rolePhase,'fuse'); assert.equal(near.roleT,ENEMIES.suicider.charge.fuse);
});
