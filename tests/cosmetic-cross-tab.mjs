import test from 'node:test';import assert from 'node:assert/strict';
import {createGuestAdapter,defaultProgress} from '../src/core/progression-store.js';
test('cross-tab costume conflict refreshes durable state without replaying or double spending',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const old=globalThis.localStorage;globalThis.localStorage=storage;
 try{
  const seed=createGuestAdapter(storage),state={...defaultProgress(),gold:10000,maxClearedStage:3};seed.load();assert.ok(seed.commit(state).ok);
  const a=await import(`../src/core/save.js?tabA=${Date.now()}`),b=await import(`../src/core/save.js?tabB=${Date.now()}`);
  let changes=0;b.onCosmeticsChanged(()=>changes++);
  assert.ok(a.buyCosmetic('dusk_lotus_cape').ok);const durable=storage.getItem(seed.key);
  assert.deepEqual(b.buyCosmetic('jade_lotus_guard'),{ok:false,code:'REVISION_CONFLICT'});
  assert.equal(storage.getItem(seed.key),durable,'rejected intent never overwrites or auto-spends');
  assert.equal(b.save.gold,9640);assert.deepEqual(b.save.cosmeticInventory,['dusk_lotus_cape']);assert.equal(b.save.equippedCosmetics.outfit,'dusk_lotus_cape');assert.equal(changes,1);
  assert.ok(b.buyCosmetic('jade_lotus_guard').ok,'next deliberate click uses refreshed revision');
  assert.equal(b.save.gold,8860);assert.equal(b.save.equippedCosmetics.outfit,'jade_lotus_guard');assert.equal(changes,2);
  assert.ok(b.buyCosmetic('jade_lotus_guard').duplicate);assert.equal(b.save.gold,8860);assert.equal(changes,2);
  assert.deepEqual(createGuestAdapter(storage).load(),b.save);
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
test('adapter conflict refresh refuses unreadable records without changing storage',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const a=createGuestAdapter(storage);a.load();assert.ok(a.commit(defaultProgress()).ok);
 storage.setItem(a.key,'not json');assert.equal(a.refresh().ok,false);assert.equal(storage.getItem(a.key),'not json');
});
