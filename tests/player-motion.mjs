import test from 'node:test';
import assert from 'node:assert/strict';
import { shotFrame, markPlayerShot, firingDrawRect, firingMuzzle } from '../src/game/player-motion.js';
test('shot phases use fixed clock and recover to ready',()=>{
 for(const [time,frame] of [[0,1],[.049,1],[.05,2],[.114,2],[.115,3],[.199,3],[.2,0],[-1,0],[Infinity,0]]) assert.equal(shotFrame(time),frame);
 const p={x:1,y:2,radius:13,flip:false};markPlayerShot(p,10,-1);
 assert.equal(p.shotAt,10);assert.equal(p.shotFlip,true);assert.equal(p.radius,13);assert.equal(p.x,1);
 assert.equal(shotFrame(10.06-p.shotAt),2);assert.equal(shotFrame(10.06-p.shotAt),2);
 p.dead=true;markPlayerShot(p,11,1);assert.equal(p.shotAt,10);
});
test('all sprite frames share a foot anchor and muzzle mirrors without moving collision',()=>{
 const first=firingDrawRect(0).slice(4);for(let i=1;i<4;i++) assert.deepEqual(firingDrawRect(i).slice(4),first);
 const p={x:100,y:100,vx:0,vy:0,flip:false};
 assert.deepEqual(firingMuzzle(p,0,1),{x:128.8,y:77.92});
 assert.deepEqual(firingMuzzle(p,0,-1),{x:71.2,y:77.92});
 assert.equal(p.x,100);assert.equal(p.y,100);
});
