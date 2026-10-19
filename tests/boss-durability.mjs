import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, BOSS_HP_MULTIPLIER } from '../src/data/bosses.js';
import { Boss } from '../src/game/boss.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { DAMAGE_SCENARIOS, measureBossDps, measureEarlyBossEncounter, measureBossEncounter } from '../tools/boss-damage-bench.mjs';

const oldHp=[0,520,1600,3400,5600,8500,12000,16000,21000,28000,42000];
const newHp=[0,1400,2240,4930,8120,12750,18000,24800,32550,44800,67200];

test('boss HP stays increasing by stage, without hidden resistance or a damage spike',()=>{
 clearWorld();G.view={w:1000,h:600};G.events={};G.damageBy={};G.caps={particles:0,texts:0};
 G.player={x:0,y:0,hp:100,maxHp:100,stats:{crit:0,armor:0}};
 for(const [id,data] of Object.entries(SPRITES))atlases[id]={walkH:data.walkH,frameCount:()=>8};
 let previousRatio=0;
 for(let stage=1;stage<=10;stage++){
  G.stage=stage;const b=new Boss(stage),def=BOSSES[stage],ratio=def.hp/oldHp[stage];
  assert.equal(def.hp,newHp[stage]);assert.equal(b.maxHp,newHp[stage]*BOSS_HP_MULTIPLIER);assert.equal(b.hp,b.maxHp);
  if(stage>1){assert.ok(ratio>=1.4&&ratio<=1.6);assert.ok(ratio>=previousRatio);previousRatio=ratio;}
  assert.ok(newHp[stage]>newHp[stage-1]);
  assert.equal(b.hurt(100,{silent:true}),100);assert.equal(b.hp,b.maxHp-100,'no hidden damage reduction');
  assert.equal(b.dmg,def.dmg*(1+(stage-1)*.05));assert.equal(b.radius,SPRITES[def.sheet].walkH*def.scale*.32);
 }
});

test('HP-only adjustment preserves the beginner warning and all ten identity layouts',()=>{
 assert.deepEqual(BOSSES[1].pacing,{opening:3,phaseRest:2.2,recovery:1.5,chargeWarning:1.15,chargeSpeed:480,summons:.6});
 assert.deepEqual(Object.values(BOSSES).map(b=>b.signature),['charge','barrage','hunt','lockshot','artillery','toxicTide','crosscut','echo','faultline','contract']);
 assert.equal(new Set(Object.values(BOSSES).map(b=>b.signatureHint)).size,10);
 for(let stage=2;stage<=10;stage++)assert.equal(BOSSES[stage].pacing,undefined,'no hidden pressure or warning-speed modifier');
});

test('actual-weapon stationary samples remain bounded while boss HP gives stronger builds more encounter time',()=>{
 for(const scenario of DAMAGE_SCENARIOS){
  const result=measureBossDps(scenario),oldSeconds=oldHp[scenario.stage]/result.dps,newSeconds=newHp[scenario.stage]/result.dps;
  assert.ok(Number.isFinite(result.dps)&&result.dps>0);assert.ok(newSeconds>oldSeconds);
  assert.ok(newSeconds<35,'sample is not a stationary bullet sponge');assert.ok(newSeconds>3);
  assert.ok(Object.keys(result.byWeapon).length>=scenario.weapons.length,'every selected weapon reaches actual Boss.hurt');
  assert.ok(Math.abs(newSeconds/oldSeconds-newHp[scenario.stage]/oldHp[scenario.stage])<1e-9);
 }
});

test('late equipment damage growth is measurable through the real weapon pipeline',()=>{
 const late=DAMAGE_SCENARIOS[2],without=measureBossDps({...late,stats:{...late.stats,might:1.5}}),withEquipment=measureBossDps({...late,stats:{...late.stats,might:2.15}});
 const growth=withEquipment.dps/without.dps;
 assert.ok(growth>1.3&&growth<1.5,'+65 percentage-point might increase remains meaningful, with fusion caps');
 // This is an equipment comparison at equal weapon levels, not an assumption
 // that every player has bought a crown or a prediction of human clear time.
});

test('reachable mid and two/three-final late fixtures begin real attacks and finish bounded encounters',()=>{
 // 중반 고정 빌드는 집중 정책 기준이며, 경험치 곡선에 따라 첫 융합이 5스테이지 전후로 들어올 수 있다.
 assert.ok(DAMAGE_SCENARIOS[1].finals<=1);
 assert.equal(DAMAGE_SCENARIOS[2].finals,2);assert.equal(DAMAGE_SCENARIOS[3].finals,3);
 assert.equal(DAMAGE_SCENARIOS[4].finals,1);assert.equal(DAMAGE_SCENARIOS[4].absolutes,1);
 for(const scenario of DAMAGE_SCENARIOS.slice(1)){
  assert.ok(Object.keys(scenario.passives).length<=6);assert.ok(scenario.weapons.length<=6);
  for(const distance of [100,300,500])for(let seed=1;seed<=12;seed++){
   const r=measureBossEncounter(scenario,{distance,seed});
   assert.ok(r.death!==null&&r.death<40,`${scenario.name}: bounded live encounter`);
   assert.ok(r.starts.length>0&&r.starts[0][0]<r.death,`${scenario.name}: begins a real attack pattern`);
  }
 }
});


test('explicit summon counts follow the 60% mob-count pass after the beginner multiplier',()=>{
 for(const [stage,counts] of [[1,[2,4,5]],[6,[4,5,7]]]){
  for(const [index,input] of [6,9,12].entries()){
   clearWorld();G.stage=stage;G.time=0;G.caps={enemies:420,particles:0,texts:0};
   G.player={x:0,y:0,stats:{crit:0,armor:0}};
   const b=new Boss(stage);b.patternSummon(input);assert.equal(G.enemies.count,counts[index]);
  }
 }
});


test('live early boss survives long enough to release its signature across 36 seeded encounters',()=>{
 for(const distance of [100,300]) {
  const rejected=measureEarlyBossEncounter({hp:700,distance});
  assert.equal(rejected.first,null,'the rejected 700 HP value can die during interrupted windups');assert.ok(rejected.death!==null);
 }
 for(const distance of [100,300,500])for(let seed=1;seed<=12;seed++){
  const result=measureEarlyBossEncounter({distance,seed});
  assert.equal(result.hp,1400);assert.ok(result.first!==null,`no charge at distance ${distance}, seed ${seed}`);
  assert.ok(result.death!==null&&result.first<result.death);assert.ok(result.first>=3);
  assert.ok(result.death<25,'fixed early build still wins within a bounded encounter');
 }
});

test('effective ×10 boss HP stays winnable: reference builds finish every live encounter within five minutes',()=>{
 for(const scenario of DAMAGE_SCENARIOS)for(const seed of [1,2]){
  const r=measureBossEncounter(scenario,{hp:BOSSES[scenario.stage].hp*BOSS_HP_MULTIPLIER,distance:200,seed,maxSeconds:300});
  assert.ok(r.death!==null&&r.death<300,`${scenario.name}: ${r.death}`);
  assert.ok(r.death>30,`${scenario.name}: the ×10 boss is a long fight, not a burst kill (${r.death})`);
  assert.ok(r.starts.length>=5,'the boss cycles through several real patterns');
 }
});
