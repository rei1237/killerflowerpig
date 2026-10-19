import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOP } from '../src/data/shop.js';
import { RELICS, RELIC_CHEST } from '../src/data/relics.js';
import { PICKUP_ASSIST } from '../src/game/pickups.js';
import { xpForLevel } from '../src/game/progression.js';
const price = id => SHOP.find(i=>i.id===id).cost[0];
test('short starter kill budget buys useful permanent upgrades without clearing a stage',()=>{
 const coinsForTwentyKills=20*3;
 assert.ok(price('magnet')<=coinsForTwentyKills);assert.ok(price('speed')<=coinsForTwentyKills);assert.ok(price('maxHp')<=coinsForTwentyKills);
 assert.equal(Math.ceil(price('magnet')/3),14);assert.equal(Math.ceil((price('magnet')+price('speed'))/3),34);
 assert.match(fs.readFileSync(new URL('../src/game/enemies.js',import.meta.url),'utf8'),/dropCoin\(e.x, e.y, e.elite \? 24 : 3\)/);
});
test('coin and XP collection are friendlier without expanding chest/bomb activation radius',()=>{
 assert.equal(70*PICKUP_ASSIST.coinMultiplier,105);assert.equal(70*PICKUP_ASSIST.gemMultiplier,84);
});
test('early run level choices cost 20 percent less XP with later growth retained',()=>{
 assert.equal(xpForLevel(1),4);assert.equal(xpForLevel(10),40);
 const firstThree=[1,2,3].reduce((sum,level)=>sum+xpForLevel(level),0);assert.equal(firstThree,24);
 assert.equal(xpForLevel(41),4+40*4+21*7+12);
});
test('random chest refunds remain strictly below cost and deterministic alternatives are available',()=>{
 assert.equal(RELIC_CHEST.cost,80);assert.deepEqual(RELIC_CHEST.rates,[.6,.3,.1]);assert.equal(RELIC_CHEST.pityAt,10);
 assert.deepEqual(RELICS.map(r=>r.duplicateCoins),[16,36,72]);
 for(const relic of RELICS){assert.ok(relic.duplicateCoins<RELIC_CHEST.cost);assert.ok(relic.price>0);}
 assert.deepEqual(RELICS.map(r=>r.price),[60,260,650]);
 assert.equal(RELIC_CHEST.unlockStage,4);assert.equal(SHOP.find(i=>i.id==='pet_yeongnyang').unlockStage,2);
});
