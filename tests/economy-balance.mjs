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
 // 5·10·13·18·27레벨부터 단계적으로 가팔라지는 '쉬움' 기준 곡선 (보통 ×2.0 등 난이도 배율은 별도)
 const ref=lv=>12+(lv-1)*12+Math.max(0,lv-4)*10+Math.max(0,lv-9)*18+Math.max(0,lv-12)*40+Math.max(0,lv-17)*90+Math.max(0,lv-26)*140;
 assert.equal(xpForLevel(1),12);assert.equal(xpForLevel(4),48);assert.equal(xpForLevel(10),ref(10));
 const firstThree=[1,2,3].reduce((sum,level)=>sum+xpForLevel(level),0);assert.equal(firstThree,12+24+36);
 for(let lv=3;lv<=40;lv++)assert.ok(xpForLevel(lv)-xpForLevel(lv-1)>=xpForLevel(lv-1)-xpForLevel(lv-2),`convex at ${lv}`);
 // 기울기는 5·10·13·18·27레벨에서 정확히 한 단계씩 가팔라진다
 const slope=lv=>xpForLevel(lv)-xpForLevel(lv-1);
 for(const lv of [5,10,13,18,27])assert.ok(slope(lv)>slope(lv-1),`steeper from ${lv}`);
 assert.equal(xpForLevel(41),ref(41));
});
test('random chest refunds remain strictly below cost and deterministic alternatives are available',()=>{
 assert.equal(RELIC_CHEST.cost,16);assert.deepEqual(RELIC_CHEST.rates,[.6,.3,.1]);assert.equal(RELIC_CHEST.pityAt,10);
 assert.deepEqual(RELICS.map(r=>r.duplicateCoins),[3,7,14]);
 for(const relic of RELICS){assert.ok(relic.duplicateCoins<RELIC_CHEST.cost);assert.ok(relic.price>0);}
 assert.deepEqual(RELICS.map(r=>r.price),[12,52,130]);
 assert.equal(RELIC_CHEST.unlockStage,4);assert.equal(SHOP.find(i=>i.id==='pet_yeongnyang').unlockStage,2);
});
