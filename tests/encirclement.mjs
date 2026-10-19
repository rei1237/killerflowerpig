import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, updatePlayer } from '../src/game/player.js';
import { input } from '../src/core/input.js';
import { startEncirclement, updateEncirclement, constrainEncirclementPlayer, clearEncirclement, drawEncirclement, updateEncirclementCamera } from '../src/game/encirclement.js';
beforeEach(() => { clearWorld(); G.passives={}; createPlayer(); G.mode='play'; G.paused=false; G.stage=5; G.runId='test'; G.clock=100; G.events={}; G.view={w:600,h:900}; input.move.x=input.move.y=0; });
test('stage gate, fixed center/radius, one ring, and 90 second cooldown',()=>{
 G.stage=4; assert.equal(startEncirclement(),false); G.stage=5; assert.equal(startEncirclement(),true);
 const ring=G.encirclement; assert.equal(ring.radius,230); G.player.x=10; assert.equal(startEncirclement(),false); assert.equal(ring.x,0);
 clearEncirclement(); G.clock=189.99; assert.equal(startEncirclement(),false); G.clock=190; assert.equal(startEncirclement(),true);
});
test('two second warning then seven second physical confinement with exact release',()=>{
 startEncirclement(); updateEncirclement(1.99); assert.equal(G.encirclement.phase,'warning'); updateEncirclement(.01); assert.equal(G.encirclement.phase,'active');
 G.player.iframes=99; const hp=G.player.hp; input.move.x=1; updatePlayer(30);
 assert.ok(G.player.x<=220); assert.equal(G.player.hp,hp); assert.equal(G.player.iframes,69);
 G.player.x=100000; G.player.y=-100000; G.player.vx=9000; G.player.vy=-9000;
 constrainEncirclementPlayer(); assert.ok(Math.hypot(G.player.x,G.player.y)<=220.0000001); assert.equal(G.player.iframes,69); assert.equal(G.player.hp,hp);
 updateEncirclement(6.99); assert.ok(G.encirclement); updateEncirclement(.01); assert.equal(G.encirclement,null);
 G.player.x=500; assert.equal(constrainEncirclementPlayer(),false); assert.equal(G.player.x,500);
});
test('warning escape cancels activation without dragging the player through the wall',()=>{
 startEncirclement(); G.player.x=400; updateEncirclement(2); assert.equal(G.encirclement,null); assert.equal(G.player.x,400);
});
test('pause stops warning and active clock, invalid delta cannot corrupt it',()=>{
 startEncirclement(); G.paused=true; updateEncirclement(100); assert.equal(G.encirclement.age,0); G.paused=false; updateEncirclement(2);
 G.paused=true; updateEncirclement(100); assert.equal(G.encirclement.age,2); G.paused=false;
 for(const dt of [NaN,Infinity,-1]) updateEncirclement(dt); assert.equal(G.encirclement.age,2);
});
test('all terminal modes, dead player, stage/run changes and world reset invalidate enclosure',()=>{
 for(const change of [()=>G.mode='boss',()=>G.mode='idle',()=>G.mode='clearing',()=>G.mode='dead',()=>G.player.dead=true,()=>G.stage++,()=>G.runId='other']) {
  clearWorld(); G.mode='play'; G.player.dead=false; G.stage=5; G.runId='test'; startEncirclement(); change(); updateEncirclement(0); assert.equal(G.encirclement,null);
 }
 G.mode='play'; G.stage=5; G.player.dead=false; clearWorld(); startEncirclement(); clearWorld(); assert.equal(G.encirclement,null); assert.equal(G.encirclementNextAt,0);
});
test('mobile radius adapts once and fog drawing is bounded with readable countdown',()=>{
 G.view={w:300,h:600}; startEncirclement(); assert.equal(G.encirclement.radius,117); G.view.w=900; updateEncirclement(2); assert.equal(G.encirclement.radius,117);
 const labels=[], calls=[]; const ctx=new Proxy({}, {get:(_,key)=> (...args)=>{calls.push(key);if(key==='fillText')labels.push(args[0]);},set:()=>true});
 drawEncirclement(ctx); assert.equal(calls.filter(x=>x==='ellipse').length,18); assert.match(labels[0],/7초/); updateEncirclement(100); assert.equal(G.encirclement,null);
});

test('warning camera smoothly reaches fixed center; mobile wall stays visible at player extremes',()=>{
 G.view={w:600,h:1298}; G.camera.x=-80; G.camera.y=-60;
 startEncirclement(); updateEncirclementCamera(.016); assert.equal(G.camera.x,-80);
 updateEncirclement(1); updateEncirclementCamera(.016); assert.equal(G.camera.x,-40); assert.equal(G.camera.y,-30);
 updateEncirclement(1); assert.equal(updateEncirclementCamera(.016),true);
 assert.equal(G.camera.x,0); assert.equal(G.camera.y,0);
 for(const [x,y] of [[220,0],[-220,0],[0,220],[0,-220]]) {
  G.player.x=x; G.player.y=y; updateEncirclementCamera(.016);
  assert.equal(G.camera.x,0); assert.equal(G.camera.y,0);
  const fogExtent=G.encirclement.radius+31;
  assert.ok(fogExtent<=G.view.w/2); assert.ok(fogExtent<=G.view.h/2);
 }
 clearEncirclement(); updateEncirclementCamera(.016);
 assert.ok(G.camera.y<0 && G.camera.y>-240,'release resumes smooth player-follow rather than snapping');
});
