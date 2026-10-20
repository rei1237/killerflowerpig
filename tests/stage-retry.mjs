import test from 'node:test';import assert from 'node:assert/strict';
const disk=new Map();globalThis.localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};globalThis.window={matchMedia:()=>({matches:false})};
const {G}=await import('../src/game/state.js');const {newRun,startStage,loadRun,continueRun,retryStage,onPlayerDeath,checkpointStageClear,clearRun}=await import('../src/game/game.js');
const {createWeapon}=await import('../src/game/weapons.js');const {save,earnCoins,buyUpgrade}=await import('../src/core/save.js');const {validateStageCheckpoint}=await import('../src/game/stage-checkpoint.js');
function enter(stage){newRun(1,'butcher','normal');G.level=17;G.xp=33;G.passives={whet:3,heart:2};G.weapons=[Object.assign(createWeapon('sword',0),{level:7}),Object.assign(createWeapon('saw',1),{level:6})];G.rerolls=2;G.pendingLevelUps=0;G.banished=new Set(['gas']);startStage(stage);}
for(const stage of [1,5,10])test(`stage${stage} death/boss retry restores entry build, full HP and clears all transient world`,()=>{
 enter(stage);const cp=loadRun();G.mode='boss';G.boss={alive:true};G.player.hp=1;G.weapons[0].level=8;G.passives.whet=5;G.level=33;G.xp=99;G.rerolls=0;G.pendingLevelUps=4;
 for(const pool of ['enemies','shots','enemyShots','gems','pickups','hazards','particles','texts','beams'])G[pool].spawn();G.encirclement={phase:'active'};G.hallucinate=5;G.hitstop=1;
 onPlayerDeath();assert.equal(loadRun().retry,true);assert.equal(retryStage(),true);assert.equal(G.stage,stage);assert.equal(G.mode,'play');assert.equal(G.time,0);assert.equal(G.level,17);assert.equal(G.xp,33);assert.equal(G.rerolls,2);assert.equal(G.tech,'butcher');assert.deepEqual(G.passives,cp.passives);assert.deepEqual(G.weapons.map(w=>w.level),[7,6]);assert.equal(G.banished.has('gas'),true);assert.equal(G.player.hp,G.player.maxHp);assert.equal(G.player.iframes,0);assert.equal(G.pendingLevelUps,0);
 for(const pool of ['enemies','shots','enemyShots','gems','pickups','hazards','particles','texts','beams'])assert.equal(G[pool].count,0);assert.equal(G.boss,null);assert.equal(G.encirclement,null);assert.equal(G.hallucinate,0);assert.equal(G.hitstop,0);
 assert.equal(retryStage(),false,'double click cannot reset live attempt');onPlayerDeath();assert.equal(retryStage(),true);assert.equal(G.weapons[0].level,7);
});
test('serialized reload and permanent purchases after entry never restore an old wallet',()=>{
 enter(5);save.maxClearedStage=5;earnCoins(300,'retry-funding');const cp=loadRun();assert.equal(buyUpgrade('maxHp',0),true);const gold=save.gold;onPlayerDeath();const serialized=JSON.parse(disk.get('kfp.run.v1'));clearRun();assert.equal(continueRun(serialized),true);assert.equal(save.gold,gold);assert.equal(save.upgrades.maxHp,1);assert.equal(G.player.hp,G.player.maxHp);assert.ok(G.player.maxHp>=130);assert.equal(G.stage,cp.stage);
});
test('completed stage advances persisted entry after reward choices; old entry cannot replay',()=>{
 enter(5);const stale=loadRun();G.weapons[0].level=8;G.pendingLevelUps=1;assert.equal(checkpointStageClear(),false);assert.equal(loadRun().stage,5);G.pendingLevelUps=0;G.choiceSession={closed:false};assert.equal(checkpointStageClear(),false);G.choiceSession=null;assert.equal(checkpointStageClear(),true);const next=loadRun();assert.equal(next.stage,6);assert.equal(next.weapons[0].level,8);assert.equal(continueRun(stale),false);assert.equal(continueRun(next),true);assert.equal(G.stage,6);onPlayerDeath();retryStage();assert.equal(G.weapons[0].level,8);
});
test('invalid checkpoints fail safely; legacy flat valid builds migrate and missing entry uses current stage',()=>{
 enter(10);const valid=loadRun();for(const broken of [{...valid,stage:99},{...valid,level:NaN},{...valid,weapons:[]},{...valid,weapons:[{id:'nope',level:1}]},{...valid,passives:{heart:99}}]){assert.equal(validateStageCheckpoint(broken),null);assert.equal(continueRun(broken),false);}
 const legacy={...valid};delete legacy.checkpointVersion;delete legacy.pendingLevelUps;assert.equal(continueRun(legacy),true);clearRun();onPlayerDeath();assert.equal(retryStage(),true);assert.equal(G.stage,10);disk.set('kfp.run.v1','broken');assert.equal(loadRun(),null);
});
test('a fresh module load retries the persisted death stage and preserves finalized entry choices',async()=>{
 const {finalizeEntryCheckpoint}=await import('../src/game/game.js');newRun(5,'butcher');assert.ok(G.pendingLevelUps>0);G.pendingLevelUps=0;G.weapons[0].level=4;assert.equal(finalizeEntryCheckpoint(),true);onPlayerDeath();
 const reloaded=await import('../src/game/game.js?retry-reload');assert.equal(reloaded.loadRun().stage,5);assert.equal(reloaded.retryStage(),true);assert.equal(G.weapons[0].level,4);assert.equal(G.pendingLevelUps,0);assert.equal(G.player.iframes,0);
});
test('corrupt inherited registry IDs, impossible evolution and cyclic callers are rejected',()=>{
 enter(5);const cp=loadRun();for(const id of ['constructor','toString','__proto__']){assert.equal(validateStageCheckpoint({...cp,weapons:[{id,level:1}]}),null);assert.equal(validateStageCheckpoint({...cp,tech:id}),null);assert.equal(validateStageCheckpoint({...cp,passives:{[id]:1}}),null);}
 assert.equal(validateStageCheckpoint({...cp,weapons:[{id:'lotus_bloom',level:1,evolved:true}]}),null);assert.equal(validateStageCheckpoint({...cp,weapons:[{id:'sword',level:1,evolved:'yes'}]}),null);const cycle={...cp};cycle.self=cycle;assert.equal(validateStageCheckpoint(cycle),null);
});
test('legacy missing or empty run IDs migrate to short durable reward-safe identity',async()=>{
 const {rollBossChest}=await import('../src/game/progression.js');for(const id of [undefined,'']){enter(1);const legacy={...loadRun(),runId:id};assert.equal(continueRun(legacy),true);assert.ok(G.runId.length<=96&&G.runId.length>0);assert.equal(loadRun().runId,G.runId);assert.equal(rollBossChest(`boss:${G.runId}:1`).ok,true);}
 assert.equal(validateStageCheckpoint({...loadRun(),runId:'x'.repeat(97)}),null);
});
test('failed advancement persistence keeps latest in-memory rewards for title/continue',()=>{
 enter(5);const stale=loadRun(),write=localStorage.setItem;G.weapons[0].level=8;localStorage.setItem=()=>{throw Error('quota');};
 try{assert.equal(checkpointStageClear(),false);assert.equal(loadRun().stage,6);assert.equal(loadRun().weapons[0].level,8);assert.equal(continueRun(stale),false);assert.equal(continueRun(loadRun()),true);assert.equal(G.stage,6);assert.equal(G.weapons[0].level,8);}finally{localStorage.setItem=write;}
 onPlayerDeath();retryStage();assert.equal(JSON.parse(disk.get('kfp.run.v1')).stage,6);
});
