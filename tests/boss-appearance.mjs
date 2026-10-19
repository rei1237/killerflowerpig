import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOSS_ART,bossArtPose,drawBossArtwork } from '../src/game/boss-appearance.js';
test('all ten full-body boss images use complete-image rendering and fixed body circles',()=>{
 assert.equal(new Set(BOSS_ART.slice(1).map(a=>a.src)).size,10);
 for(let stage=1;stage<=10;stage++){
  const calls=[],arcs=[];
  const ctx=new Proxy({globalAlpha:1,drawImage:(...a)=>calls.push(a),arc:(...a)=>arcs.push(a)},{get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const b={alive:true,stage,x:25,y:50,radius:30,flip:false,state:'walk',anim:0,animT:0};
  const before=JSON.stringify(b),img={width:stage===10?341:512,height:512};
  assert.ok(fs.existsSync(new URL('../'+BOSS_ART[stage].src,import.meta.url)));
  assert.equal(drawBossArtwork(ctx,b,3,img),true);
  assert.equal(calls.length,1);assert.equal(calls[0].length,5);assert.equal(calls[0][0],img);
  assert.deepEqual(arcs[0].slice(0,3),[25,20,30]);assert.equal(JSON.stringify(b),before);
  assert.equal(drawBossArtwork(ctx,b,3,null),false);
 }
});
test('boss motion stays bounded, deterministic when paused and supports collapse',()=>{
 for(let stage=1;stage<=10;stage++)for(let frame=0;frame<100;frame++){
  const b={stage,alive:true,state:'attack',anim:frame%6,animT:.03};
  const p=bossArtPose(b,frame/10);assert.deepEqual(p,bossArtPose(b,frame/10));
  assert.ok(p.scaleX>=1&&p.scaleX<=1.056);assert.ok(p.scaleY>.92&&p.scaleY<1.013);assert.ok(Math.abs(p.tilt)<.05);assert.ok(Math.abs(p.rise)<2.11);
 }
 assert.ok(bossArtPose({stage:1,alive:false,deadT:1},0).scaleY<.3);
});
test('boss renderer selects stage artwork with old atlas only as missing-image fallback',()=>{
 const code=fs.readFileSync(new URL('../src/game/boss.js',import.meta.url),'utf8');
 assert.match(code,/if \(!drawBossArtwork\(ctx, this, G.clock, images\[`bossArt\$\{this.stage\}`\]\)\)/);
 assert.doesNotMatch(code,/drawBossSignature/);
});
test('ordinary mob appearance remains original while kills drop coins',()=>{
 const code=fs.readFileSync(new URL('../src/game/enemies.js',import.meta.url),'utf8');
 assert.match(code,/e.tint = elite \? 'elite' : def.tint/);assert.doesNotMatch(code,/enemyAppearance|drawBossSignature/);assert.match(code,/dropCoin\(e.x, e.y, e.elite \? 40 : 5\)/);
});
