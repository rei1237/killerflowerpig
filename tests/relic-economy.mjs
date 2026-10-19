import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProgress, openRelicChest, purchaseRelic, validateProgress, createGuestAdapter, createServerAdapter } from '../src/core/progression-store.js';
import { RELICS, RELIC_CHEST, rollRelic, chestRates, relicStats, MAX_MOVE_SPEED } from '../src/data/relics.js';
const funded=()=>({...defaultProgress(),gold:5000,maxClearedStage:10});
const open=(state,roll=0,requestId=`chest:${state.chestCount}`)=>openRelicChest(state,{expectedCount:state.chestCount,requestId},()=>roll);
test('rates sum to one and every boundary has the published outcome',()=>{
 assert.ok(Math.abs(RELIC_CHEST.rates.reduce((a,b)=>a+b)-1)<1e-12);assert.ok(Math.abs(RELICS.reduce((a,b)=>a+b.rate,0)-1)<1e-12);
 for(const [n,id] of [[0,'wind_feather'],[.599999,'wind_feather'],[.6,'moon_wings'],[.899999,'moon_wings'],[.9,'star_wings'],[.999999,'star_wings']])assert.equal(rollRelic(n).id,id);
 for(const n of [-1,1,NaN,Infinity])assert.throws(()=>rollRelic(n));
});
test('insufficient funds and stale opening never roll or charge',()=>{
 let calls=0;const random=()=>{calls++;return 0;};
 assert.equal(openRelicChest({...defaultProgress(),maxClearedStage:10},{expectedCount:0,requestId:'a'},random).code,'INSUFFICIENT_FUNDS');
 assert.equal(openRelicChest(funded(),{expectedCount:1,requestId:'a'},random).code,'STALE_CHEST');assert.equal(calls,0);
});
test('debit, award, pity and duplicate compensation are one immutable operation',()=>{
 const s=funded();const first=open(s);assert.equal(s.gold,5000);assert.equal(first.state.gold,4920);assert.deepEqual(first.state.relics,['wind_feather']);
 const second=open(first.state);assert.equal(second.state.gold,4856);assert.equal(second.reward.compensation,16);assert.equal(second.state.relicDuplicates,1);assert.equal(second.state.chestPity,2);
 const retry=openRelicChest(second.state,{expectedCount:1,requestId:second.reward.requestId},()=>{throw Error('must not reroll');});assert.equal(retry.duplicate,true);assert.equal(retry.state.gold,4856);
 const third=open(second.state,.7);const stale=openRelicChest(third.state,{expectedCount:1,requestId:second.reward.requestId});assert.equal(stale.code,'USED_REQUEST');
});
test('tenth opening guarantees epic after nine misses and resets pity',()=>{
 let s=funded();for(let i=0;i<9;i++)s=open(s,0).state;assert.equal(s.chestPity,9);assert.deepEqual(chestRates(s),[0,0,1]);
 const r=open(s,0);assert.equal(r.reward.itemId,'star_wings');assert.equal(r.state.chestPity,0);assert.deepEqual(chestRates(r.state),[.6,.3,.1]);
});
test('direct purchase bypasses chance, cannot charge owned relic twice, preserves pity',()=>{
 const s={...funded(),chestPity:5};const r=purchaseRelic(s,{itemId:'star_wings',requestId:'direct'});assert.equal(r.state.gold,4350);assert.equal(r.state.chestPity,5);
 assert.equal(purchaseRelic(r.state,{itemId:'star_wings',requestId:'again'}).state.gold,4350);
});
test('only strongest relic affects stats and movement speed is globally bounded',()=>{
 const s={...funded(),relics:RELICS.map(r=>r.id)};const stats=relicStats({speed:220,might:1,maxHp:100},s);assert.equal(stats.speed,MAX_MOVE_SPEED);assert.equal(stats.might,1.15);assert.equal(stats.maxHp,120);
 assert.equal(relicStats({speed:135,might:1,maxHp:100},{relics:['wind_feather']}).speed,143.1);
});
test('v2 migration and current schema reload preserve all relic and pity information',()=>{
 const values=new Map([['kfp.progress.v2.guest',JSON.stringify({version:2,gold:500,upgrades:{speed:3},inventory:['pet_yeongnyang'],equippedPet:'pet_yeongnyang'})]]);
 const store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};const a=createGuestAdapter(store);const s=a.load();assert.equal(s.gold,500);assert.equal(s.upgrades.speed,3);assert.equal(s.equippedPet,'pet_yeongnyang');assert.deepEqual(s.relics,[]);
 s.maxClearedStage=4;const r=open(s,.7);a.commit(r.state);assert.deepEqual(a.load(),r.state);assert.ok(values.has('kfp.progress.v2.guest'));
 assert.equal(validateProgress({...r.state,chestPity:100}).chestPity,9);
});
test('online chest sends intent without client random, reward or balance',async()=>{
 let body;const a=createServerAdapter({baseUrl:'/api',fetchImpl:async(url,args)=>{body=JSON.parse(args.body);assert.equal(url,'/api/relic-chests');return {ok:true,json:async()=>({state:funded()})};}});
 await a.openChest({expectedRevision:0,requestId:'server-chest',roll:.9,gold:123,itemId:'star_wings'});
 assert.deepEqual(Object.keys(body).sort(),['catalogVersion','expectedRevision','requestId']);
});
test('facade never debits or grants on failed write, and committed retry survives reload',async()=>{
 const values=new Map();let blocked=false;globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('quota');values.set(k,v);}};
 const api=await import('../src/core/save.js');api.save.maxClearedStage=10;api.earnCoins(500,'chest-test-seed');blocked=true;
 assert.equal(api.openChest(0).ok,false);assert.equal(api.save.gold,500);assert.equal(api.save.chestCount,0);assert.deepEqual(api.save.relics,[]);
 blocked=false;const r=api.openChest(0);assert.equal(r.ok,true);assert.equal(api.save.gold,420);const repeated=api.openChest(0);assert.deepEqual(repeated.reward,r.reward);assert.equal(api.save.gold,420);
 const restored=createGuestAdapter(globalThis.localStorage).load();assert.equal(restored.chestCount,1);assert.deepEqual(restored.lastChest,r.reward);
});
test('every duplicate tier pays its published compensation without stacking ownership',()=>{
 for(const [index,roll] of [[0,0],[1,.7],[2,.95]]){
  const item=RELICS[index],s={...funded(),relics:[item.id]};const r=open(s,roll);
  assert.equal(r.reward.compensation,item.duplicateCoins);assert.equal(r.state.gold,5000-RELIC_CHEST.cost+item.duplicateCoins);assert.deepEqual(r.state.relics,[item.id]);
 }
});
test('actual player recomputation applies epic HP/damage and caps combined movement',async()=>{
 const {save}=await import('../src/core/save.js');const {G}=await import('../src/game/state.js');const {createPlayer,recomputeStats}=await import('../src/game/player.js');
 save.relics=['wind_feather','moon_wings','star_wings'];save.upgrades={speed:3};G.passives={madness:5};createPlayer();
 assert.equal(G.player.maxHp,120);assert.equal(G.player.stats.might,1.15);assert.ok(Math.abs(G.player.stats.speed-222.75)<1e-9);
 G.passives.madness=99;recomputeStats();assert.equal(G.player.stats.speed,243);
});
