import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLY_RULES,supplyState,rollSupplies,KILL_OPPORTUNITY,compensatedChance} from '../src/game/supply-drops.js';
const wounded={hpRatio:.8,healingOnField:0,magnetsOnField:0};
test('compensation preserves spawn-limited XP and coin opportunity budgets',()=>{
 assert.equal(.6*KILL_OPPORTUNITY,1);
 for(const rate of [.04,.1,.015,.0015]) assert.ok(Math.abs((1-compensatedChance(rate))**.6-(1-rate))<1e-12);
});
test('each HP band has an exact compensated probability boundary; full HP never creates heals',()=>{
 for(const hpRatio of [.99,.7,.41,.4,.2,.01]){
  const chance=compensatedChance(hpRatio<=.4?.1:.04);
  assert.ok(rollSupplies({}, {...wounded,hpRatio},()=>chance-1e-8).kinds.includes('meat'));
  assert.ok(!rollSupplies({}, {...wounded,hpRatio},()=>chance).kinds.includes('meat'));
 }
 for(const hpRatio of [1,1.2,0,NaN])assert.ok(!rollSupplies({heal:30,low:12},{...wounded,hpRatio},()=>0).kinds.includes('meat'));
 assert.equal(rollSupplies({}, {...wounded,hpRatio:1},()=>.99).state.heal,0);
});
test('compensated guarantees are18 wounded,8 low-HP and36 magnet real kills',()=>{
 for(const [hpRatio,kind,threshold] of [[.8,'meat',18],[.2,'meat',8],[1,'magnet',36]]){
  let state={};for(let n=1;n<=threshold;n++){const r=rollSupplies(state,{...wounded,hpRatio},()=>.99);state=r.state;assert.equal(r.kinds.includes(kind),n===threshold);}
 }
});
test('independent supplies, caps and old/fractional saved opportunity values are preserved',()=>{
 assert.deepEqual(rollSupplies({},wounded,()=>.01).kinds,['meat','magnet']);
 const r=rollSupplies({heal:30,low:12,magnet:60},{hpRatio:.2,healingOnField:3,magnetsOnField:2},()=>.99);
 assert.deepEqual(r.kinds,[]);assert.deepEqual(r.state,{heal:30,low:12,magnet:60});
 assert.deepEqual(rollSupplies(r.state,wounded,()=>.99).kinds,['meat','magnet']);
 assert.deepEqual(supplyState({heal:17,low:5/3,magnet:999}),{heal:17,low:5/3,magnet:60});
 assert.deepEqual(supplyState({heal:999,low:-1,magnet:NaN}),{heal:30,low:0,magnet:0});
 assert.equal(SUPPLY_RULES.supplyLifetime,90);
});
