// Filename retained for existing test runners; Alpha was superseded by Brutus King.
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateWaveXP,simulatePlan } from '../tools/run-progression-audit.mjs';
import { measureBossEncounter } from '../tools/boss-damage-bench.mjs';
import { bossMaxHp } from '../src/data/bosses.js';
import { save } from '../src/core/save.js';
import { resetWeaponRuntime } from '../src/game/weapons.js';

test('restored King preserves legal two-final growth and full frenzy challenge with current legendary/focus',t=>{
 const rows=estimateWaveXP({residency:16,seed:7});
 const snapshot=simulatePlan({rows,mode:'twoFinal',seed:101,collection:.85}).stages[8].beforeBoss;
 assert.ok(snapshot.level>=40&&snapshot.level<=60);assert.equal(snapshot.finals,2);assert.equal(snapshot.absolutes,0);
 assert.ok(snapshot.weapons.length<=6&&Object.keys(snapshot.passives).length<=6);
 assert.equal(bossMaxHp(9),537600);
 const scenario={...snapshot,stage:9,name:'pre-stage-9 two-final build',weapons:snapshot.weapons.map(w=>[w.id,w.level,w.evolved])};
 const previous=save.upgrades.lotus_gun;
 try{for(const seed of [1,7,13]){
  const times=[];
  for(const owned of [false,true])for(const focus of [false,true]){
   save.upgrades.lotus_gun=owned?1:0;resetWeaponRuntime();
   const r=measureBossEncounter(scenario,{hp:bossMaxHp(9),distance:200,seed,maxSeconds:120,focus});
   assert.ok(r.death>=28&&r.death<=100,`${seed}/${owned}/${focus}: ${r.death}`);
   assert.equal(r.phases.length,2);assert.ok(r.starts.length>=5);
   for(const phase of [0,1,2])assert.equal(r.starts.find(s=>s[2]===phase)?.[1],'faultline');
   const frenzy=r.starts.find(s=>s[2]===2);
   assert.ok(r.death-frenzy[0]>=6.2,'optimized build still sees both fully warned frenzy verdicts');
   times.push(r.death);
   t.diagnostic(JSON.stringify({seed,legendary:owned,focus,seconds:+r.death.toFixed(2),phasePatterns:[0,1,2].map(p=>r.starts.filter(s=>s[2]===p).length),frenzySeconds:+(r.death-frenzy[0]).toFixed(2)}));
  }
  assert.ok(times[1]<times[0]&&times[3]<times[2],'focused fire keeps its advantage');
  assert.ok(times[2]<times[0]&&times[3]<times[1],'legendary ownership remains meaningfully stronger');
 }}finally{if(previous===undefined)delete save.upgrades.lotus_gun;else save.upgrades.lotus_gun=previous;resetWeaponRuntime();}
});
