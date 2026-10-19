import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {save} from '../src/core/save.js';
import {createPlayer} from '../src/game/player.js';
import {resetBuild,beginChoiceSession,consumeChoiceReroll,finishChoiceSession,snapshotBuild,restoreBuild} from '../src/game/progression.js';
beforeEach(()=>{resetBuild();createPlayer();G.stage=1;G.gold=0;save.upgrades.reroll=0;});
test('every new choice gets a reroll; active reopening and all closed replay tokens never refill',()=>{
 const a=beginChoiceSession('choice:1');assert.equal(a.remaining,1);assert.equal(consumeChoiceReroll(a.id,a.revision).ok,true);
 assert.equal(beginChoiceSession(a.id).remaining,0);assert.equal(beginChoiceSession('choice:2'),null);assert.equal(finishChoiceSession(a.id),true);
 const b=beginChoiceSession('choice:2');assert.equal(b.remaining,1);finishChoiceSession(b.id);
 assert.equal(beginChoiceSession(a.id).closed,true);assert.equal(beginChoiceSession(b.id).closed,true);assert.equal(beginChoiceSession('choice:3').remaining,1);
});
test('buyer upgrades increase each session budget while stale double-clicks cannot spend twice',()=>{
 save.upgrades.reroll=2;const a=beginChoiceSession();assert.equal(a.budget,3);assert.equal(consumeChoiceReroll(a.id,0).ok,true);assert.equal(consumeChoiceReroll(a.id,0).ok,false);assert.equal(G.rerolls,2);
 assert.equal(consumeChoiceReroll('choice:999',1).ok,false);assert.equal(finishChoiceSession('choice:999'),false);finishChoiceSession(a.id);assert.equal(beginChoiceSession().budget,3);
});
test('snapshot and restore preserve spent budget, revision and closed event watermark independently',()=>{
 const a=beginChoiceSession();consumeChoiceReroll(a.id,0);const snap=snapshotBuild();assert.notEqual(snap.choiceSession,G.choiceSession);resetBuild();restoreBuild(snap);
 assert.equal(beginChoiceSession(a.id).remaining,0);assert.equal(consumeChoiceReroll(a.id,0).ok,false);assert.equal(consumeChoiceReroll(a.id,1).ok,false);
 finishChoiceSession(a.id);const closed=snapshotBuild();resetBuild();restoreBuild(closed);assert.equal(beginChoiceSession(a.id).closed,true);assert.equal(beginChoiceSession().remaining,1);
});
test('legacy snapshots start clean and a new run resets all session metadata',()=>{
 const snap=snapshotBuild();delete snap.choiceSession;delete snap.choiceEventSerial;delete snap.choiceClosedThrough;snap.rerolls=99;
 restoreBuild(snap);assert.equal(G.rerolls,0);assert.equal(beginChoiceSession().remaining,1);resetBuild();assert.equal(G.choiceSession,null);assert.equal(G.choiceEventSerial,0);assert.equal(G.choiceClosedThrough,0);
});
test('offered choices survive reopen and snapshot without free reroll or shared mutable records',()=>{
 const a=beginChoiceSession();G.choiceSession.choices=[{kind:'weapon',id:'thorns',level:1,name:'연꽃 가시',isNew:true}];
 const reopened=beginChoiceSession(a.id);assert.equal(reopened.choices[0].id,'thorns');reopened.choices[0].id='cannon';assert.equal(G.choiceSession.choices[0].id,'thorns');
 const snap=snapshotBuild();assert.notEqual(snap.choiceSession.choices[0],G.choiceSession.choices[0]);resetBuild();restoreBuild(snap);assert.equal(beginChoiceSession(a.id).choices[0].id,'thorns');
 snap.choiceSession.choices=[{kind:'weapon',id:'unknown',level:1}];restoreBuild(snap);assert.deepEqual(G.choiceSession.choices,[]);
});
