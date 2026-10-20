import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const values=new Map();let fail=false;
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}};
globalThis.window={matchMedia:()=>({matches:false})};
const api=await import('../src/core/save.js');
const {createGuestAdapter,validateProgress,createServerAdapter,SAVE_VERSION}=await import('../src/core/progression-store.js');
const {G,configureCaps,clearWorld}=await import('../src/game/state.js');
const {createPlayer,recomputeStats}=await import('../src/game/player.js');
const {dropGem,dropCoin,dropPickup,updatePickups}=await import('../src/game/pickups.js');
const {ACCESSORIES}=await import('../src/data/accessories.js');
test('v4 migration preserves wallet, pet, relic and records while initializing empty accessories',()=>{
 const source={version:4,revision:4,gold:900,upgrades:{speed:2},maxStage:8,maxClearedStage:7,characterXP:345,inventory:['pet_yeongnyang'],equippedPet:'pet_yeongnyang',relics:['star_wings']};
 const store=new Map([['kfp.progress.v4.guest',JSON.stringify(source)]]);const adapter=createGuestAdapter({getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)});
 const s=adapter.load();assert.equal(s.version,SAVE_VERSION);assert.equal(s.gold,900);assert.equal(s.characterXP,345);assert.equal(s.equippedPet,'pet_yeongnyang');assert.deepEqual(s.relics,['star_wings']);assert.deepEqual(s.accessoryInventory,[]);assert.equal(s.equippedAccessory,null);
 adapter.commit(s);assert.equal(JSON.parse(store.get('kfp.progress.v4.guest')).gold,900);assert.equal(adapter.load().version,5);
});
test('durable buy/equip/reload rejects stale or failed writes without charges or unowned grants',()=>{
 api.save.maxClearedStage=10;api.earnCoins(10000,'accessory-seed');let revision=api.save.revision;
 fail=true;assert.equal(api.buyAccessory('moon_guard',revision).ok,false);assert.equal(api.save.gold,10000);assert.deepEqual(api.save.accessoryInventory,[]);
 fail=false;assert.equal(api.buyAccessory('moon_guard',revision).ok,true);assert.equal(api.save.gold,9460);assert.equal(api.save.equippedAccessory,'moon_guard');
 assert.equal(api.buyAccessory('moon_guard',revision).duplicate,true);assert.equal(api.save.gold,9460);
 assert.equal(api.buyAccessory('astral_lens',revision).code,'REVISION_CONFLICT');assert.equal(api.setAccessory('astral_lens').code,'NOT_OWNED');
 assert.equal(api.buyAccessory('astral_lens',api.save.revision).ok,true);assert.equal(api.save.gold,8680);
 fail=true;assert.equal(api.setAccessory('moon_guard').ok,false);assert.equal(api.save.equippedAccessory,'astral_lens');fail=false;
 assert.equal(api.setAccessory('moon_guard').ok,true);const loaded=createGuestAdapter(localStorage).load();assert.equal(loaded.equippedAccessory,'moon_guard');assert.deepEqual(loaded.accessoryInventory,['moon_guard','astral_lens']);assert.equal(loaded.gold,8680);
});
test('actual player recomputation does not stack bonuses or heal by repeatedly switching',()=>{
 G.passives={};api.save.relics=[];api.save.upgrades={};api.save.accessoryInventory=ACCESSORIES.map(i=>i.id);api.save.equippedAccessory='moon_guard';createPlayer();assert.equal(G.player.maxHp,140);G.player.hp=80;
 recomputeStats();recomputeStats();assert.equal(G.player.maxHp,140);assert.equal(G.player.hp,80);assert.equal(G.player.stats.armor,1);
 api.save.equippedAccessory='royal_star_crown';recomputeStats();assert.equal(G.player.maxHp,120);assert.equal(G.player.hp,80);assert.equal(G.player.stats.might,1.25);assert.equal(G.player.stats.armor,0);
 api.save.equippedAccessory=null;recomputeStats();api.save.equippedAccessory='moon_guard';recomputeStats();assert.equal(G.player.hp,80);
 recomputeStats(true);assert.equal(G.player.hp,140);
});
test('lantern attracts XP and coins farther while leaving chest/bomb ranges unchanged',()=>{
 configureCaps();clearWorld();G.passives={};api.save.equippedAccessory='pollen_lantern';createPlayer();G.xp=0;G.xpNext=999;
 const gem=dropGem(100,-14,1);G.gems.items[0].x=100;G.gems.items[0].y=-14;const coin=dropCoin(125,-14,3),chest=dropPickup('chest',50,-14),bomb=dropPickup('bomb',50,-14);
 updatePickups(.001);assert.equal(G.gems.items[0].pull,true);assert.equal(coin.pull,true);assert.equal(chest.pull,false);assert.equal(bomb.pull,false);assert.equal(G.player.stats.magnet,70);
});
test('six dedicated WebP illustrations exist and are not duplicate binary assets',()=>{
 const data=ACCESSORIES.map(item=>fs.readFileSync(new URL('../'+item.image,import.meta.url)));
 for(const bytes of data)assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(new Set(data.map(bytes=>bytes.toString('base64'))).size,6);
});
test('future server accessory endpoints transmit intent only',async()=>{
 const requests=[];const a=createServerAdapter({baseUrl:'/api/kfp',fetchImpl:async(url,opts)=>{requests.push([url,JSON.parse(opts.body)]);return{ok:true,json:async()=>({state:validateProgress(api.save)})};}});
 await a.buyAccessory({itemId:'moon_guard',expectedRevision:1,requestId:'buy',gold:99999});await a.equipAccessory({itemId:null,expectedRevision:2,requestId:'equip'});
 assert.equal(requests[0][0],'/api/kfp/accessory-purchases');assert.equal(requests[0][1].gold,undefined);assert.equal(requests[1][0],'/api/kfp/accessory-equipment');assert.equal(requests[1][1].itemId,null);
});
