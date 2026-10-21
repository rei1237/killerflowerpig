import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, BOSS_HP_MULTIPLIER, BOSS_EVOLUTION_HP } from '../src/data/bosses.js';
import { Boss } from '../src/game/boss.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { DAMAGE_SCENARIOS, measureBossDps, measureEarlyBossEncounter, measureBossEncounter } from '../tools/boss-damage-bench.mjs';
import './helpers/fixed-variants.mjs'; // 변이·보물 난수 스트림 고정 (벤치마크 재현성)

const oldHp=[0,520,1600,3400,5600,8500,12000,16000,21000,28000,42000];
// 최종 보스(10)는 의도적으로 67200 → 168000 (×2.5) 강화.
const newHp=[0,600,2240,4930,8120,12750,18000,24800,32550,24000,168000];
// 실제 전투 체력: 기준치 × BOSS_HP_MULTIPLIER × 4스테이지 이후 진화 배율
const effectiveHp=stage=>newHp[stage]*BOSS_HP_MULTIPLIER*(BOSS_EVOLUTION_HP[stage]||1);

test('boss HP matches selected encounter pacing without hidden resistance or a damage spike',()=>{
 clearWorld();G.view={w:1000,h:600};G.events={};G.damageBy={};G.caps={particles:0,texts:0};
 G.player={x:0,y:0,hp:100,maxHp:100,stats:{crit:0,armor:0}};
 for(const [id,data] of Object.entries(SPRITES))atlases[id]={walkH:data.walkH,frameCount:()=>8};
 let previousRatio=0;
 for(let stage=1;stage<=10;stage++){
  G.stage=stage;const b=new Boss(stage),def=BOSSES[stage],ratio=def.hp/oldHp[stage];
  assert.equal(def.hp,newHp[stage]);assert.equal(b.maxHp,effectiveHp(stage));assert.equal(b.hp,b.maxHp);
  assert.equal(BOSS_EVOLUTION_HP[stage]||1,stage<4?1:BOSS_EVOLUTION_HP[stage],'stages 1-3 keep the original boss HP');
  // 2~9는 기존 1.4~1.6배 조정 유지, 10은 의도된 최종 보스 강화(×4)라 비율 검사에서 제외
  if(stage>1&&stage<9){assert.ok(ratio>=1.4&&ratio<=1.6);assert.ok(ratio>=previousRatio);previousRatio=ratio;}
  if(stage!==9){assert.ok(newHp[stage]>newHp[stage-1]);assert.ok(stage===1||effectiveHp(stage)>effectiveHp(stage-1),'unchanged encounters retain increasing effective HP');}
  // Restored King uses measured legal-build pacing rather than the historic HP ladder.
  assert.equal(b.hurt(100,{silent:true}),100);assert.equal(b.hp,b.maxHp-100,'no hidden damage reduction');
  assert.equal(b.dmg,def.dmg*(1+(stage-1)*.05));assert.equal(b.radius,SPRITES[def.sheet].walkH*def.scale*.32);
 }
});

test('restored King has a readable opening while the beginner keeps its separate signature',()=>{
 assert.deepEqual(BOSSES[9].pacing,{opening:2.6,phaseRest:2.0});
 assert.deepEqual(Object.values(BOSSES).map(b=>b.signature),['trainingCharge','barrage','hunt','lockshot','artillery','toxicTide','crosscut','echo','faultline','contract']);
 assert.equal(new Set(Object.values(BOSSES).map(b=>b.signatureHint)).size,10);
 for(let stage=2;stage<=10;stage++)if(stage!==9)assert.equal(BOSSES[stage].pacing,undefined,'other encounters keep their pacing');
});

test('actual-weapon stationary samples remain bounded while boss HP gives stronger builds more encounter time',()=>{
 for(const scenario of DAMAGE_SCENARIOS){
  const result=measureBossDps(scenario),oldSeconds=oldHp[scenario.stage]/result.dps,newSeconds=newHp[scenario.stage]/result.dps;
  assert.ok(Number.isFinite(result.dps)&&result.dps>0);assert.ok(newSeconds>oldSeconds);
  // 최종 보스 기준치 168000. 느려진 레벨업·하향된 최종 무기·재생성한 픽스처 이후 10스테이지 정지 표본: 융합1 19.6초 / 융합2 45.9초 / 절대+진화2 48.1초 / 도살 14.9초 → 10스테이지만 상한 100초
  assert.ok(newSeconds<(scenario.stage===10?100:35),'sample is not a stationary bullet sponge');assert.ok(newSeconds>0);
  // 연꽃 가시는 몸에 붙은 고정 반경(50)으로 돈다: 100 이상 떨어져 멈춘 보스에는 닿지 않는다(진화해도 마찬가지). 그 외 무기는 모두 실제 Boss.hurt에 도달.
  if(scenario.stage===1)assert.ok(effectiveHp(1)/result.dps>10,'actual beginner HP still permits a readable encounter');
  const missed=scenario.weapons.filter(([id])=>!(id in result.byWeapon));
  assert.ok(missed.every(([id])=>id==='thorns'&&scenario.distance>=100),`every selected weapon reaches actual Boss.hurt: ${missed}`);
  assert.ok(Math.abs(newSeconds/oldSeconds-newHp[scenario.stage]/oldHp[scenario.stage])<1e-9);
 }
});

test('late equipment damage growth is measurable through the real weapon pipeline',()=>{
 const late=DAMAGE_SCENARIOS[2],without=measureBossDps({...late,stats:{...late.stats,might:1.5}}),withEquipment=measureBossDps({...late,stats:{...late.stats,might:2.15}});
 const growth=withEquipment.dps/without.dps;
 assert.ok(growth>1.2&&growth<1.5,'+65 percentage-point might increase remains meaningful, with fusion caps');
 // This is an equipment comparison at equal weapon levels, not an assumption
 // that every player has bought a crown or a prediction of human clear time.
});

test('reachable mid and two/three-final late fixtures begin real attacks and finish bounded encounters',()=>{
 // 중반 고정 빌드는 집중 정책 기준이며, 경험치 곡선에 따라 첫 융합이 5스테이지 전후로 들어올 수 있다.
 assert.ok(DAMAGE_SCENARIOS[1].finals<=1);
 // 느려진 레벨업으로 픽스처 이름('2융합'·'3융합'·'절대+최종1')보다 실제 도달 개수가 적다: 10스테이지 직전 2융합=1개, '3융합'=2개, 절대+1=절대 무기 1개(일반 최종 0개).
 // 원거리 적·엘리트 축소로 경험치 곡선이 바뀌어 재생성된 스냅샷: 2융합=1개, '3융합'=1개, 절대+1=절대 1개+최종 1개.
 assert.equal(DAMAGE_SCENARIOS[2].finals,1);assert.equal(DAMAGE_SCENARIOS[3].finals,1);
 assert.equal(DAMAGE_SCENARIOS[4].finals,1);assert.equal(DAMAGE_SCENARIOS[4].absolutes,1);
 for(const scenario of DAMAGE_SCENARIOS.slice(1)){
  assert.ok(Object.keys(scenario.passives).length<=6);assert.ok(scenario.weapons.length<=6);
  for(const distance of [100,300,500])for(let seed=1;seed<=12;seed++){
   const r=measureBossEncounter(scenario,{distance,seed});
   // 실제 전투 체력 실측(고정 변이 난수): 5스테이지 중반 ~136초 / 10스테이지 융합1 ~166초 / 융합2 ~367초 / 절대+1 ~390초 / 도살 ~126초 → 5~9스테이지 상한 220초, 10스테이지 상한 450초
   assert.ok(r.death!==null&&r.death<(scenario.stage>=10?450:scenario.stage>=4?220:40),`${scenario.name}: bounded live encounter`);
   assert.ok(r.starts.length>0&&r.starts[0][0]<r.death,`${scenario.name}: begins a real attack pattern`);
  }
 }
});


test('explicit summon counts follow the 60% mob-count pass after the beginner multiplier',()=>{
 for(const [stage,counts] of [[9,[4,5,7]],[6,[4,5,7]]]){
  for(const [index,input] of [6,9,12].entries()){
   clearWorld();G.stage=stage;G.time=0;G.caps={enemies:420,particles:0,texts:0};
   G.player={x:0,y:0,stats:{crit:0,armor:0}};
   const b=new Boss(stage);b.patternSummon(input);assert.equal(G.enemies.count,counts[index]);
  }
 }
});


test('strong early burst fixture stays bounded without artificial protection to force beginner attacks',()=>{
 for(const distance of [100,300,500])for(let seed=1;seed<=12;seed++){
  const result=measureEarlyBossEncounter({distance,seed});
  assert.equal(result.hp,600);
  // 1스테이지 보스: 첫 공격은 항상 예고된 돌진, 이후 완화된 원형/조준 탄막이 섞인다.
  assert.ok(result.starts.every(([at,pattern])=>at>=3&&at<result.death&&['trainingCharge','ring','aimed'].includes(pattern)), 'beginner attacks are its warned charge or softened barrage');
  if(result.starts.length)assert.equal(result.starts[0][1],'trainingCharge');
  // Strong pistol crits can cross a phase boundary during charge windup.
  // Do not add hidden boss invulnerability just to force that dash to connect.
  if(result.first!==null){assert.ok(result.first<result.death);assert.ok(result.first>=3);}
  assert.ok(result.death!==null);
  assert.ok(result.death<25,'fixed early build still wins within a bounded encounter');
 }
});

// 실제 전투 체력(×7 × BOSS_EVOLUTION_HP)으로 측정. 4스테이지 이후 보스는 의도적으로 훨씬 질기다:
// 실측(느려진 레벨업·하향된 최종 무기·재생성한 픽스처 이후): 중반 ~136초, 융합1 ~166초, 융합2 ~367초, 절대+1 ~390초 → 4스테이지 이후 상한 25분(느슨한 안전망)
test('effective boss HP stays winnable: reference builds finish every live encounter within five minutes (twenty-five from stage 4)',()=>{
 for(const scenario of DAMAGE_SCENARIOS)for(const seed of [1,2]){
  const cap=scenario.stage>=4?1500:300;
  const r=measureBossEncounter(scenario,{hp:effectiveHp(scenario.stage),distance:200,seed,maxSeconds:cap});
  assert.ok(r.death!==null&&r.death<cap,`${scenario.name}: ${r.death}`);
  assert.ok(r.death>(scenario.stage===1?10:30),`${scenario.name}: the ×10 boss is a long fight, not a burst kill (${r.death})`);
  assert.ok(r.starts.length>=(scenario.stage===1?1:5),'the boss cycles through real patterns; beginner windows are separately tested across all five techs');
 }
});
