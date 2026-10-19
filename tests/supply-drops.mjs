import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLY_RULES,supplyState,rollSupplies} from '../src/game/supply-drops.js';
const healthy={hpRatio:1,healingOnField:0,magnetsOnField:0};
test('healing and magnet rolls are independent, including same-kill drops',()=>{
 assert.deepEqual(rollSupplies({},healthy,()=>.01).kinds,['meat','magnet']);
 assert.deepEqual(rollSupplies({},healthy,()=>.04).kinds,[]);
 assert.deepEqual(rollSupplies({},{...healthy,hpRatio:.4},()=>.09).kinds,['meat']);
 assert.deepEqual(rollSupplies({},{...healthy,hpRatio:.4},()=>.1).kinds,[]);
 assert.equal(SUPPLY_RULES.healChance,.04);assert.equal(SUPPLY_RULES.magnetChance,.015);
});
test('healthy healing at30 kills and magnet at60 are guaranteed despite failed RNG',()=>{
 let state={};let heals=0,magnets=0;
 for(let i=1;i<=60;i++){const result=rollSupplies(state,healthy,()=>.99);state=result.state;heals+=result.kinds.includes('meat');magnets+=result.kinds.includes('magnet');if(i<30)assert.equal(heals,0);if(i<60)assert.equal(magnets,0);}
 assert.equal(heals,2);assert.equal(magnets,1);
});
test('low HP guarantee is12 consecutive eligible kills and resets on recovery',()=>{
 let state={};for(let i=1;i<=12;i++){const r=rollSupplies(state,{...healthy,hpRatio:.2},()=>.99);state=r.state;assert.equal(r.kinds.includes('meat'),i===12);}
 assert.equal(rollSupplies({low:11},healthy,()=>.99).state.low,0);
});
test('field caps retain bounded pending drought and release after collection',()=>{
 const capped=rollSupplies({heal:30,low:12,magnet:60},{hpRatio:.2,healingOnField:3,magnetsOnField:2},()=>.99);
 assert.deepEqual(capped.kinds,[]);assert.deepEqual(capped.state,{heal:30,low:12,magnet:60});
 assert.deepEqual(rollSupplies(capped.state,healthy,()=>.99).kinds,['meat','magnet']);
 assert.deepEqual(supplyState({heal:999,low:-1,magnet:NaN}),{heal:30,low:0,magnet:0});
});
