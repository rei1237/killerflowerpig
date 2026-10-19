import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOP } from '../src/data/shop.js';
import { RELICS, RELIC_CHEST } from '../src/data/relics.js';
import { PICKUP_ASSIST } from '../src/game/pickups.js';
import { xpForLevel } from '../src/game/progression.js';
const price = id => SHOP.find(i=>i.id===id).cost[0];
test('rare ordinary coins retain prices and give deliberate long-term shop goals',()=>{
 const expectedCoins=100*.15*3;
 assert.equal(expectedCoins,45);assert.equal(price('magnet'),8);assert.equal(price('speed'),12);
 assert.equal(Math.ceil(price('magnet')/(.15*3)),18);
 assert.equal(Math.ceil(price('speed')/(.15*3)),27);
 assert.match(fs.readFileSync(new URL('../src/game/enemies.js',import.meta.url),'utf8'),/coinDropValue\(e.elite\)/);
});
test('coin and XP collection are friendlier without expanding chest/bomb activation radius',()=>{
 assert.equal(70*PICKUP_ASSIST.coinMultiplier,105);assert.equal(70*PICKUP_ASSIST.gemMultiplier,84);
});
test('tech progression requires more XP with steeper late growth',()=>{
 assert.equal(xpForLevel(1),10);assert.equal(xpForLevel(10),100);
 const firstThree=[1,2,3].reduce((sum,level)=>sum+xpForLevel(level),0);assert.equal(firstThree,60);
 assert.equal(xpForLevel(41),10+40*10+21*20+6*40);
});
test('random chest refunds remain strictly below cost and deterministic alternatives are available',()=>{
 assert.equal(RELIC_CHEST.cost,16);assert.deepEqual(RELIC_CHEST.rates,[.6,.3,.1]);assert.equal(RELIC_CHEST.pityAt,10);
 assert.deepEqual(RELICS.map(r=>r.duplicateCoins),[3,7,14]);
 for(const relic of RELICS){assert.ok(relic.duplicateCoins<RELIC_CHEST.cost);assert.ok(relic.price>0);}
 assert.deepEqual(RELICS.map(r=>r.price),[12,52,130]);
 assert.equal(RELIC_CHEST.unlockStage,4);assert.equal(SHOP.find(i=>i.id==='pet_yeongnyang').unlockStage,2);
});
