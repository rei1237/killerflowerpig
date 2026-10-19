import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPractice,advancePractice,focusPracticeAt,choosePracticeUpgrade} from '../src/game/practice.js';
import {advancePlayerMovement} from '../src/game/player-motion.js';
import {G} from '../src/game/state.js';
import {isTargetTap,joystickVector} from '../src/core/input.js';
const moveUntil=(s,goal,max=200)=>{for(let i=0;i<max&&s.step<goal;i++)advancePractice(s,{x:1,y:0},.05);};
test('practice uses exact live movement helper without live state mutation',()=>{
 const before=JSON.stringify(G),s=createPractice(),copy=structuredClone(s.player);
 advancePlayerMovement(copy,{x:.6,y:.8},.04);advancePractice(s,{x:.6,y:.8},.04);
 assert.deepEqual(s.player,copy);assert.equal(JSON.stringify(G),before);assert.equal(s.step,0);
});
test('four goals require real events in order; arbitrary choices cannot skip ahead',()=>{
 const s=createPractice();assert.equal(focusPracticeAt(s,430,120),false);assert.equal(choosePracticeUpgrade(s,'whet'),false);
 advancePractice(s,{x:0,y:0},10);assert.equal(s.step,0);
 moveUntil(s,1);assert.equal(s.step,1);assert.ok(s.moved>=80);
 assert.equal(focusPracticeAt(s,0,0),false);assert.equal(s.step,1);
 assert.equal(focusPracticeAt(s,430,120),true);assert.equal(s.step,2);
 assert.equal(focusPracticeAt(s,430,120),false);assert.equal(s.target,null);
 focusPracticeAt(s,430,120);for(let i=0;i<200;i++)advancePractice(s,{x:0,y:0},.05);assert.equal(s.target,s.dummy);
 s.player.x=s.coin.x;s.player.y=s.coin.y+16;advancePractice(s,{x:0,y:0},.01);
 assert.equal(s.step,3);assert.equal(s.trainingCoins,1);assert.equal(s.coin.collected,true);
 assert.equal(choosePracticeUpgrade(s,'unknown'),false);assert.equal(choosePracticeUpgrade(s,'whet'),true);
 assert.equal(s.player.stats.might,1.1);assert.equal(s.complete,true);assert.equal(s.step,4);
 assert.equal(choosePracticeUpgrade(s,'whet'),false);assert.equal(s.player.stats.might,1.1);
});
test('practice replay is disposable and has no persistent-economy route',()=>{
 const s=createPractice();s.step=3;choosePracticeUpgrade(s,'heart');s.trainingCoins=999;
 const fresh=createPractice();assert.equal(fresh.trainingCoins,0);assert.equal(fresh.player.stats.maxHp,100);assert.equal(fresh.selectedUpgrade,null);
 for(const file of ['../src/game/practice.js','../src/ui/practice.js']){
  const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(source,/earnCoins|creditReward|rollChest|applyChoice|save\.|G\./);
 }
});
test('practice uses live gesture deadzone and short-tap semantics',()=>{
 assert.equal(isTargetTap({duration:200,distance:7}),true);assert.equal(isTargetTap({duration:251,distance:0}),false);assert.equal(isTargetTap({duration:100,distance:9}),false);assert.equal(isTargetTap({duration:100,distance:0,multitouch:true}),false);
 assert.deepEqual(joystickVector(0,0),{x:0,y:0});assert.deepEqual(joystickVector(56,0),{x:1,y:0});
});
