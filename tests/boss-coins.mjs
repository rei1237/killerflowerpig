import test from 'node:test';import assert from 'node:assert/strict';
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};globalThis.window={matchMedia:()=>({matches:false})};
const {G}=await import('../src/game/state.js');const {newRun,startStage,onPlayerDeath,retryStage}=await import('../src/game/game.js');const {Boss}=await import('../src/game/boss.js');const {atlases}=await import('../src/core/assets.js');const {dropCoin,updatePickups}=await import('../src/game/pickups.js');const {save,queueCoins}=await import('../src/core/save.js');const {bossCoinValue,bossCoinReceipt}=await import('../src/game/coin-drops.js');
function start(stage){newRun();startStage(stage);G.caps.decalScale=0;G.caps.particles=0;G.caps.texts=0;G.events={};for(const name of ['boss1','boss2','bossKing'])atlases[name]={walkH:112,frameCount:()=>8};}
const coins=()=>G.pickups.items.slice(0,G.pickups.count).filter(p=>p.kind==='coin');
for(const stage of [1,5,10])test(`boss${stage} drops one guaranteed auto-pulling bounty and replay cannot duplicate wallet`,()=>{
 start(stage);const before=save.gold,b=new Boss(stage);b.hurt(b.hp+1,{silent:true});assert.equal(coins().length,1);const c=coins()[0];assert.equal(c.value,bossCoinValue(stage));assert.equal(c.pull,true);assert.equal(c.rewardId,bossCoinReceipt(G.runId,stage));b.die();assert.equal(coins().length,1);
 c.x=G.player.x;c.y=G.player.y-14;updatePickups(.01);assert.equal(save.gold,before+bossCoinValue(stage));onPlayerDeath();retryStage();G.caps.decalScale=0;const replay=new Boss(stage);replay.hurt(replay.hp+1,{silent:true});assert.equal(coins().length,0);assert.equal(save.gold,before+bossCoinValue(stage));
});
test('boss bundle never merges with ordinary coins and durable fallback consumes it without recredit',()=>{
 start(5);for(let i=0;i<180;i++)dropCoin(500,500,1);const id=bossCoinReceipt(G.runId,5),boss=dropCoin(500,500,45,id);assert.equal(boss.value,45);assert.equal(G.pickups.count,181);dropCoin(500,500,2);assert.equal(boss.value,45);assert.equal(dropCoin(500,500,45,id),boss);
 const before=save.gold;assert.equal(queueCoins(45,id),true);boss.x=0;boss.y=-14;updatePickups(.01);assert.equal(save.gold,before+45);assert.equal(coins().some(c=>c.rewardId===id),false);
});
test('failed boss coin write leaves bundle collectible for one durable retry',()=>{
 start(1);const before=save.gold,id=bossCoinReceipt(G.runId,1),coin=dropCoin(0,-14,25,id),write=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};try{updatePickups(.01);assert.equal(save.gold,before);assert.equal(coins().length,1);}finally{localStorage.setItem=write;}
 G.clock+=2;updatePickups(.01);assert.equal(save.gold,before+25);assert.equal(dropCoin(0,0,25,id),null);
});
test('free cosmetic receipt churn cannot evict boss bounty, chest coins or clear settlement',async()=>{
 const {earnCoins,setCosmetic,persist}=await import('../src/core/save.js');const {hasRunReward}=await import('../src/core/run-rewards.js');const {validateProgress}=await import('../src/core/progression-store.js');start(5);
 const ids=[bossCoinReceipt(G.runId,5),`boss:${G.runId}:5:coins`,`stage-clear:${G.runId}:5`];const before=save.gold;ids.forEach((id,i)=>assert.equal(earnCoins(i===0?45:i===1?18:0,id),true));
 save.cosmeticInventory=['dusk_lotus_cape'];persist();for(let i=0;i<140;i++)assert.equal(setCosmetic('outfit',i%2?null:'dusk_lotus_cape',save.revision,`cosmetic-toggle-test:${i}`).ok,true);assert.ok(ids.every(id=>!save.receipts.includes(id)));const loaded=validateProgress(JSON.parse(data.get('kfp.progress.v5.guest')));assert.ok(ids.every(id=>hasRunReward(loaded,id)));
 ids.forEach(id=>earnCoins(45,id));assert.equal(save.gold,before+63);onPlayerDeath();retryStage();assert.equal(dropCoin(0,0,45,ids[0]),null);
});
test('bounded run ledger pins active checkpoint and migrates old v5 reward receipts',async()=>{
 const {normalizeRunRewards,recordRunReward,hasRunReward}=await import('../src/core/run-rewards.js');const {validateProgress}=await import('../src/core/progression-store.js');
 let s={runRewards:[],pinnedRewardRunId:'active',receipts:[]};s.runRewards=recordRunReward(s,'boss-bounty:active:5');for(let i=0;i<40;i++)s.runRewards=recordRunReward(s,`boss-bounty:other${i}:1`);
 assert.equal(s.runRewards.length,32);assert.equal(hasRunReward(s,'boss-bounty:active:5'),true);assert.equal(normalizeRunRewards(s.runRewards,'active').length,32);
 const migrated=validateProgress({version:5,gold:50,receipts:['boss-bounty:old:5','boss:old:5:coins','stage-clear:old:5']});migrated.receipts=[];for(const id of ['boss-bounty:old:5','boss:old:5:coins','stage-clear:old:5'])assert.equal(hasRunReward(migrated,id),true);assert.equal(migrated.gold,50);
});
