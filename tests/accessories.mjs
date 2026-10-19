import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSORIES, ACCESSORY_SLOT_LIMIT } from '../src/data/accessories.js';
import { normalizeAccessories, activeAccessory, purchaseAccessory, equipAccessory, accessoryStats, accessoryEquipHP, commitAccessoryResult } from '../src/core/accessories.js';
const state=()=>({gold:10000,revision:0,maxClearedStage:10,receipts:[],accessoryInventory:[],equippedAccessory:null});
const buy=(s,id='moon_guard',requestId=id)=>purchaseAccessory(s,{itemId:id,requestId,expectedRevision:s.revision});
test('six unique expensive stage-gated accessories do not touch starter economy',()=>{
 assert.equal(ACCESSORIES.length,6);assert.equal(new Set(ACCESSORIES.map(i=>i.id)).size,6);assert.equal(ACCESSORY_SLOT_LIMIT,1);
 assert.deepEqual(ACCESSORIES.map(i=>i.price),[90,130,180,240,300,440]);assert.deepEqual(ACCESSORIES.map(i=>i.unlockStage),[3,4,5,6,7,9]);
});
test('legacy normalization is empty and never accepts unowned equipped items',()=>{
 assert.deepEqual(normalizeAccessories({gold:77,inventory:['pet_yeongnyang']}),{accessoryInventory:[],equippedAccessory:null});
 assert.equal(activeAccessory({accessoryInventory:['moon_guard'],equippedAccessory:'royal_star_crown'}),null);
});
test('purchase is immutable, gated, affordable and replay-safe without retrocharges',()=>{
 const s=state(),r=buy(s);assert.equal(s.gold,10000);assert.equal(r.state.gold,9910);assert.equal(r.state.equippedAccessory,'moon_guard');
 assert.equal(buy(r.state).duplicate,true);assert.equal(buy(r.state).state.gold,9910);
 assert.equal(buy({...s,maxClearedStage:2}).code,'STAGE_LOCKED');assert.equal(buy({...s,gold:89}).code,'INSUFFICIENT_FUNDS');
 assert.equal(purchaseAccessory(s,{itemId:'moon_guard',requestId:'x',expectedRevision:9}).code,'REVISION_CONFLICT');
});
test('one equipped slot requires ownership and switching never stacks all owned bonuses',()=>{
 let s=state();for(const item of ACCESSORIES)s=buy(s,item.id).state;
 assert.equal(s.accessoryInventory.length,6);assert.equal(activeAccessory(s).id,'royal_star_crown');
 const base={maxHp:100,might:1,armor:0,speed:135,crit:0,cooldown:1,area:1,projSpeed:1,regen:0};
 const stats=accessoryStats(base,s);assert.equal(stats.maxHp,120);assert.equal(stats.might,1.25);assert.equal(stats.armor,0);assert.deepEqual(base,{maxHp:100,might:1,armor:0,speed:135,crit:0,cooldown:1,area:1,projSpeed:1,regen:0});
 assert.deepEqual(accessoryStats(base,s),stats);assert.equal(equipAccessory(state(),'moon_guard').code,'NOT_OWNED');
 assert.equal(activeAccessory(equipAccessory(s,null).state),null);
});
test('speed/cooldown/crit caps and separate collection boost remain bounded',()=>{
 const s=id=>({...state(),accessoryInventory:[id],equippedAccessory:id});
 assert.equal(accessoryStats({speed:240},s('comet_boots')).speed,243);assert.equal(accessoryStats({cooldown:.42},s('constellation_hourglass')).cooldown,.4);
 assert.equal(accessoryStats({crit:.98,projSpeed:1},s('astral_lens')).crit,1);
 const lantern=accessoryStats({area:1,magnet:70},s('pollen_lantern'));assert.equal(lantern.magnet,70);assert.equal(lantern.pickupMultiplier,1.25);
});
test('equip health cannot create healing and failed durable commit exposes no grant',()=>{
 assert.equal(accessoryEquipHP(80,140),80);assert.equal(accessoryEquipHP(130,100),100);assert.equal(accessoryEquipHP(100,140),100);
 const s=state();const r=commitAccessoryResult(buy(s),()=>false);assert.equal(r.ok,false);assert.equal(s.gold,10000);assert.deepEqual(s.accessoryInventory,[]);
});
