// Filename retained for existing test runners; Alpha was superseded by Brutus King.
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateWaveXP,simulatePlan } from '../tools/run-progression-audit.mjs';
import { measureBossEncounter } from '../tools/boss-damage-bench.mjs';
import { bossMaxHp } from '../src/data/bosses.js';
import { save } from '../src/core/save.js';
import { resetWeaponRuntime } from '../src/game/weapons.js';
import './helpers/fixed-variants.mjs'; // 변이·보물 난수 스트림 고정 (벤치마크 재현성)

test('restored King preserves legal two-final growth and full frenzy challenge with current legendary/focus',t=>{
 const rows=estimateWaveXP({residency:16,seed:7});
 const snapshot=simulatePlan({rows,mode:'twoFinal',seed:101,collection:.85}).stages[8].beforeBoss;
 // 경험치 레벨업 3배(×2.5) + 구역마다 보급품(1·2구역 2개, 이후 3개) 이후 9스테이지 직전: 최종 무기 1~2개
 assert.ok(snapshot.level>=5&&snapshot.level<=45);assert.ok(snapshot.finals>=1&&snapshot.finals<=2);assert.equal(snapshot.absolutes,0);
 assert.ok(snapshot.weapons.length<=6&&Object.keys(snapshot.passives).length<=6);
 assert.ok(Math.abs(bossMaxHp(9)-24000*7*3.3)<1e-6); // 554400: 보스 HP 진화 배율 BOSS_EVOLUTION_HP[9]=3.3 (보급품 3개 + 경험치 레벨업 3배로 장비가 일찍 모여 2.0→3.3, 광폭 단계 보장)
 const scenario={...snapshot,stage:9,name:'pre-stage-9 late build',weapons:snapshot.weapons.map(w=>[w.id,w.level,w.evolved])};
 const previous=save.upgrades.lotus_gun;
 const all=[];
 try{for(const seed of [1,7,13]){
  const times=[];all.push(times);
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
  assert.ok(times[2]<times[0]&&times[3]<times[1],'legendary ownership remains meaningfully stronger');
 }
 // 집중 사격 이점은 시드 평균으로 본다: 페이즈 전환 타이밍 때문에 한 시드 안의 차이는 ±1초 안팎으로 흔들린다.
 const mean=i=>all.reduce((sum,times)=>sum+times[i],0)/all.length;
 assert.ok(mean(1)<mean(0)&&mean(3)<mean(2),'focused fire keeps its advantage on average');
 }finally{if(previous===undefined)delete save.upgrades.lotus_gun;else save.upgrades.lotus_gun=previous;resetWeaponRuntime();}
});
