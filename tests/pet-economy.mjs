import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = {matchMedia:()=>({matches:false}),devicePixelRatio:1};
const data = new Map();
const write = (k,v) => data.set(k,v);
globalThis.localStorage = {getItem:k=>data.get(k)??null,setItem:write};
const {G,configureCaps,clearWorld}=await import('../src/game/state.js');
const {dropCoin,updatePickups}=await import('../src/game/pickups.js');
const {updatePets,resetPets}=await import('../src/game/pets.js');
const {save,earnCoins,buyUpgrade,equipPet}=await import('../src/core/save.js');
function reset(){configureCaps();clearWorld();resetPets();G.gold=0;G.level=1;G.damageBy={};G.player={x:0,y:0,flip:false,dead:false,stats:{magnet:70,greed:1,might:1,crit:0}};}
test('coin collection persists once; a failed write leaves pickup for retry',()=>{
 reset();const before=save.gold;const c=dropCoin(0,-14,12);updatePickups(0.016);assert.equal(G.pickups.count,0);assert.equal(G.gold,12);assert.equal(save.gold,before+12);updatePickups(0.016);assert.equal(save.gold,before+12);
 dropCoin(0,-14,1);localStorage.setItem=()=>{throw Error('quota');};updatePickups(0.016);assert.equal(G.pickups.count,1);assert.equal(save.gold,before+12);
 localStorage.setItem=write;updatePickups(0.016);assert.equal(G.pickups.count,1);G.clock+=2;updatePickups(0.016);assert.equal(G.pickups.count,0);assert.equal(save.gold,before+13);
});
test('coin budget merges value rather than dropping coins',()=>{
 reset();for(let i=0;i<500;i++)dropCoin(100,100,1);assert.equal(G.pickups.count,180);assert.equal(G.pickups.items.slice(0,G.pickups.count).reduce((sum,c)=>sum+c.value,0),500);
});
test('owned equipped pet follows, attracts nearby coins and damages enemies on cooldown',()=>{
 reset();save.maxClearedStage=2;earnCoins(600,'pet-test');assert.equal(buyUpgrade('pet_yeongnyang',0),true);
 const c=dropCoin(-60,8);const e=G.enemies.spawn();Object.assign(e,{alive:true,x:-50,y:8,hp:100,maxHp:100,radius:8,slow:0});
 updatePets(0.7);assert.equal(c.pull,true);assert.ok(e.hp<100);const hp=e.hp;updatePets(0.1);assert.equal(e.hp,hp);
 equipPet(null);updatePets(2);assert.equal(e.hp,hp);assert.equal(equipPet('pet_yeongnyang'),true);
});
test('non-repeatable reward queue retries once and exposes unsaved amount',async()=>{
 const {queueCoins,retryPendingCoins,pendingCoinTotal}=await import('../src/core/save.js');const before=save.gold;
 localStorage.setItem=()=>{throw Error('quota');};assert.equal(queueCoins(40,'chest-pending'),false);assert.equal(queueCoins(40,'chest-pending'),false);assert.equal(pendingCoinTotal(),40);assert.equal(save.gold,before);
 localStorage.setItem=write;assert.equal(retryPendingCoins(),true);assert.equal(pendingCoinTotal(),0);assert.equal(save.gold,before+40);queueCoins(40,'chest-pending');assert.equal(save.gold,before+40);
});
test('strong companion hits at most three enemies per attack and heals on bounded timer',()=>{
 reset();save.inventory=['pet_yeongnyang'];save.equippedPet='pet_yeongnyang';G.player.hp=50;G.player.maxHp=100;
 for(let i=0;i<10;i++){const e=G.enemies.spawn();Object.assign(e,{alive:true,x:10+i*5,y:0,hp:1000,maxHp:1000,radius:8,slow:0});}
 updatePets(.7);assert.equal(G.enemies.items.slice(0,10).filter(e=>e.hp<1000).length,3);
 const damage=G.damageBy.pet_yeongnyang;updatePets(.1);assert.equal(G.damageBy.pet_yeongnyang,damage);
 updatePets(5.3);assert.equal(G.player.hp,53);
});
test('coin sweep attracts existing coin drops without crediting until collected',async()=>{
 const {magnetAll,dropGem,dropPickup}=await import('../src/game/pickups.js');reset();const before=save.gold;
 const coin=dropCoin(300,0,3);dropGem(300,0,1);const chest=dropPickup('chest',300,0);magnetAll();
 assert.equal(coin.pull,true);assert.equal(G.gems.items[0].pull,true);assert.equal(chest.pull,false);assert.equal(save.gold,before);
});
test('expanded pull starts for nearby coins and gems and cannot overshoot a long frame',async()=>{
 const {dropGem}=await import('../src/game/pickups.js');reset();G.xp=0;G.xpNext=9999;
 const coin=dropCoin(100,-14,3);dropGem(80,-14,1);const gem=G.gems.items[0];gem.x=80;gem.y=-14;
 updatePickups(.5);assert.equal(coin.pull,true);assert.equal(gem.pull,true);assert.equal(gem.x,0);
});
