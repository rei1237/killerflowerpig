import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shopAccess,highestClearedStage} from '../src/core/shop-access.js';
import {SHOP} from '../src/data/shop.js';
import {RELICS,RELIC_CHEST} from '../src/data/relics.js';
import {defaultProgress,purchase,purchaseRelic,openRelicChest} from '../src/core/progression-store.js';
import {PET_REDEMPTION,createPetRedemptionAdapter} from '../src/core/pet-redemption.js';
test('catalog expands at cleared milestones, independent of replay/current stage',()=>{
 const count=stage=>SHOP.filter(item=>shopAccess({maxClearedStage:stage,stage:10,maxStage:10},item).unlocked).length;
 assert.equal(count(0),3);assert.equal(count(1),5);assert.equal(count(2),7);
 assert.equal(highestClearedStage({stage:10,maxStage:10}),0);
 assert.equal(shopAccess({maxClearedStage:4,stage:1},RELICS[2]).unlocked,true);
 assert.equal(shopAccess({maxClearedStage:3},RELIC_CHEST).unlocked,false);
});
test('locked purchases and chests cannot debit or roll even with sufficient funds',()=>{
 const s={...defaultProgress(),gold:5000,maxClearedStage:0};
 assert.equal(purchase(s,{itemId:'pet_yeongnyang',expectedLevel:0,requestId:'pet'}).code,'STAGE_LOCKED');
 assert.equal(purchaseRelic(s,{itemId:'star_wings',requestId:'epic'}).code,'STAGE_LOCKED');
 const r=openRelicChest(s,{expectedCount:0,requestId:'chest'},()=>{throw Error('locked RNG ran');});assert.equal(r.code,'STAGE_LOCKED');assert.equal(s.gold,5000);
});
test('unlocked and previously owned progression remains usable on stage replay',()=>{
 const s={...defaultProgress(),gold:5000,maxClearedStage:2,stage:1};
 const r=purchase(s,{itemId:'pet_yeongnyang',expectedLevel:0,requestId:'pet'});assert.equal(r.ok,true);
 assert.equal(purchase(r.state,{itemId:'pet_yeongnyang',expectedLevel:0,requestId:'pet'}).duplicate,true);
});
test('exclusive pet is absent from random chest and stage drop definitions',()=>{
 assert.equal(SHOP.filter(i=>i.id==='pet_yeongnyang').length,1);assert.equal(RELICS.some(i=>i.id==='pet_yeongnyang'),false);
 for(const file of ['src/game/enemies.js','src/game/boss.js','src/game/progression.js'])assert.equal(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').includes('pet_yeongnyang'),false,file);
});
test('unconfigured redemption is disabled and makes no request or local grant',async()=>{
 assert.equal(PET_REDEMPTION.enabled,false);let called=false;
 const api=createPetRedemptionAdapter({fetchImpl:()=>{called=true;throw Error('must not send');}});
 assert.deepEqual(await api.redeem({answer:'placeholder',requestId:'one'}),{ok:false,code:'REDEMPTION_DISABLED'});assert.equal(called,false);
});
test('future server redemption handles rate limit and requires authoritative refresh',async()=>{
 const limited=createPetRedemptionAdapter({enabled:true,fetchImpl:async()=>({status:429})});assert.equal((await limited.redeem({answer:'public-event-code',requestId:'r'})).code,'RATE_LIMITED');
 const ready=createPetRedemptionAdapter({enabled:true,fetchImpl:async()=>({ok:true,json:async()=>({granted:true,rewardId:'pet_yeongnyang'})})});assert.deepEqual(await ready.redeem({answer:'public-event-code',requestId:'r'}),{ok:true,refreshProgress:true});
});
