import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProgress,validateProgress,createGuestAdapter,createServerAdapter } from '../src/core/progression-store.js';
import { purchasePetUpgrade } from '../src/core/pet-upgrades.js';
import { PET_UPGRADES,petTrainingStats } from '../src/data/pet-upgrades.js';
const owned=()=>({...defaultProgress(),inventory:['pet_yeongnyang'],equippedPet:'pet_yeongnyang',gold:2000});
const buy=(s,id='attack',level=s.petUpgrades[id])=>purchasePetUpgrade(s,{trackId:id,expectedLevel:level,expectedRevision:s.revision,requestId:`pet-training:${id}:${level}`});
test('all tracks escalate, cap and preserve legacy currency/inventory',()=>{
 let s=owned();for(const t of PET_UPGRADES){for(let i=0;i<t.max;i++){const before=s.gold,r=buy(s,t.id);assert.equal(r.ok,true);s=r.state;assert.equal(s.gold,before-t.cost[i]);}assert.equal(buy(s,t.id).ok,false);}
 assert.deepEqual(petTrainingStats(s),{damage:24,heal:6,coinRange:240});assert.equal(s.gold,1115);
 const legacy=validateProgress({gold:321,inventory:['pet_yeongnyang'],upgrades:{might:2}});assert.deepEqual(legacy.petUpgrades,{attack:0,heal:0,support:0});assert.equal(legacy.gold,321);assert.equal(legacy.upgrades.might,2);
 assert.deepEqual(validateProgress({...s,petUpgrades:{attack:999,heal:-2,support:'3'}}).petUpgrades,{attack:5,heal:0,support:0});assert.deepEqual(petTrainingStats({...s,inventory:[]}),{damage:14,heal:3,coinRange:180});
});
test('ownership, funds, revision and canonical retries cannot grant or debit twice',()=>{
 assert.equal(buy(defaultProgress(),'attack',0).code,'PET_NOT_OWNED');assert.equal(buy({...owned(),gold:29}).code,'INSUFFICIENT_FUNDS');
 const s=owned(),r=buy(s);assert.equal(s.gold,2000);assert.equal(r.state.gold,1970);
 assert.equal(buy({...r.state,receipts:[]},'attack',0).duplicate,true);
 assert.equal(purchasePetUpgrade(s,{trackId:'heal',expectedLevel:0,expectedRevision:9,requestId:'pet-training:heal:0'}).code,'REVISION_CONFLICT');
 assert.equal(purchasePetUpgrade(s,{trackId:'attack',expectedLevel:0,expectedRevision:0,requestId:'unrelated'}).code,'INVALID_REQUEST');
});
test('durable transaction survives reload, rejects stale tabs and failed writes',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const a=createGuestAdapter(storage),b=createGuestAdapter(storage);a.load();a.commit(owned());const sa=a.load(),sb=b.load();
 const r=buy(sa);assert.equal(a.commit(r.state).ok,true);assert.equal(b.commit(buy(sb,'heal').state).code,'REVISION_CONFLICT');assert.equal(a.load().gold,1970);assert.equal(a.load().petUpgrades.attack,1);
 const fresh=b.refresh();assert.equal(fresh.ok,true);assert.equal(b.commit(buy(fresh.state,'heal').state).ok,true);
 const before=storage.getItem(a.key);a.refresh();storage.setItem=()=>{throw Error('quota');};assert.equal(a.commit(buy(a.load(),'support').state).code,'STORAGE_UNAVAILABLE');assert.equal(data.get(a.key),before);
});
test('server training seam transmits only validated intent, never client power or balance',async()=>{
 let body;const api=createServerAdapter({baseUrl:'/api',fetchImpl:async(path,opts)=>{assert.equal(path,'/api/pet-training');body=JSON.parse(opts.body);return {ok:true,json:async()=>({state:owned()})};}});
 await api.buyPetUpgrade({trackId:'attack',expectedLevel:0,expectedRevision:0,requestId:'pet-training:attack:0',gold:99999});assert.equal(body.gold,undefined);assert.equal(body.trackId,'attack');
});
globalThis.window={matchMedia:()=>({matches:false})};const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
test('real pet applies trained damage/radius/heal without purchase healing or resetting cadence; restart preserves training',async()=>{
 const {G,configureCaps,clearWorld}=await import('../src/game/state.js');const {save,buyPetUpgrade,persist}=await import('../src/core/save.js');const {resetPets,updatePets}=await import('../src/game/pets.js');const {dropCoin}=await import('../src/game/pickups.js');
 configureCaps();clearWorld();resetPets();Object.assign(save,owned());persist();G.level=1;G.damageBy={};G.player={x:0,y:0,flip:false,dead:false,hp:50,maxHp:100,stats:{might:1,crit:0}};
 updatePets(3);assert.equal(G.player.hp,50);assert.equal(buyPetUpgrade('heal',0).ok,true);assert.equal(G.player.hp,50);updatePets(2.99);assert.equal(G.player.hp,50);updatePets(.01);assert.equal(G.player.hp,54);
 assert.equal(buyPetUpgrade('attack',0).ok,true);assert.equal(buyPetUpgrade('support',0).ok,true);const c=dropCoin(-225,8,3),enemy=G.enemies.spawn();Object.assign(enemy,{alive:true,x:0,y:0,hp:1000,maxHp:1000,radius:8,slow:0});updatePets(.6);assert.equal(c.pull,true);assert.ok(Math.abs(enemy.hp-983.2)<1e-8);
 resetPets();updatePets(.6);assert.equal(save.petUpgrades.attack,1);assert.equal(G.player.hp,54,'restart grants no healing');
 const previous=save.gold,write=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};assert.equal(buyPetUpgrade('attack',1).ok,false);assert.equal(save.gold,previous);assert.equal(save.petUpgrades.attack,1);localStorage.setItem=write;
});
test('pet facade refreshes a conflicting tab without charging or auto-replaying purchase',async()=>{
 const {save,buyPetUpgrade}=await import('../src/core/save.js');const other=createGuestAdapter(localStorage),fresh=other.load();fresh.gold+=10;fresh.revision++;assert.equal(other.commit(fresh).ok,true);
 const before=fresh.gold;const r=buyPetUpgrade('support',1,save.revision);assert.equal(r.code,'REVISION_CONFLICT');assert.equal(save.gold,before);assert.equal(save.petUpgrades.support,1);
 assert.equal(buyPetUpgrade('support',1,save.revision).ok,true);assert.equal(save.gold,before-50);assert.equal(buyPetUpgrade('support',1,save.revision).duplicate,true);assert.equal(save.gold,before-50);
});
