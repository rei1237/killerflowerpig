import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateWaveXP,simulatePlan } from '../tools/run-progression-audit.mjs';
import { measureBossEncounter } from '../tools/boss-damage-bench.mjs';
import { bossMaxHp } from '../src/data/bosses.js';

test('stage 9 actual two-final progression build gets a late 60–100s fight without changing global HP rules',()=>{
 const rows=estimateWaveXP({residency:16,seed:7});
 const snapshot=simulatePlan({rows,mode:'twoFinal',seed:101,collection:.85}).stages[8].beforeBoss;
 assert.equal(snapshot.level,47);assert.equal(snapshot.finals,2);assert.equal(snapshot.absolutes,0);
 assert.deepEqual(snapshot.weapons.map(w=>[w.id,w.level]),[['scatter_rail',5],['lotus_bloom',3]]);
 assert.equal(bossMaxHp(9),291200);
 const scenario={...snapshot,stage:9,name:'pre-stage-9 two-final build',weapons:snapshot.weapons.map(w=>[w.id,w.level,w.evolved])};
 const automatic=[],focused=[];
 for(const seed of [1,7,13]){
  const r=measureBossEncounter(scenario,{hp:bossMaxHp(9),distance:200,seed,maxSeconds:110});
  assert.ok(r.death>=60&&r.death<=100,`seed ${seed}: ${r.death}`);
  assert.ok(r.starts.length>=10);assert.equal(r.phases.length,2);
  assert.ok(r.starts.some(([,pattern])=>pattern==='charge'));automatic.push(r.death);
  const f=measureBossEncounter(scenario,{hp:bossMaxHp(9),distance:200,seed,maxSeconds:110,focus:true});
  assert.ok(f.death>=45&&f.death<=100,`focused seed ${seed}: ${f.death}`);
  assert.ok(f.starts.length>=10);assert.equal(f.phases.length,2);focused.push(f.death);
 }
 assert.ok(focused.reduce((a,b)=>a+b,0)<automatic.reduce((a,b)=>a+b,0),'focused fire rewards deliberate boss targeting');
});
