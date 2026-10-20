import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {G} from '../src/game/state.js';
import {stageScaling,SPARSE_ENEMY_HP,SPARSE_ENEMY_XP} from '../src/data/enemies.js';
import {STAGES} from '../src/data/stages.js';
const before=JSON.parse(fs.readFileSync(new URL('../docs/sparse-enemies-before.json',import.meta.url)));
const after=JSON.parse(fs.readFileSync(new URL('../docs/sparse-enemies-after.json',import.meta.url)));
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
test('fixed sparse HP and XP stage budgets cannot secretly scale to equipped player damage',()=>{
 for(let stage=1;stage<=10;stage++){
  G.player={stats:{damage:1}};const original=stageScaling(stage,75,STAGES[stage].duration);
  G.player.stats.damage=100000;assert.deepEqual(stageScaling(stage,75,STAGES[stage].duration),original);
  assert.ok(SPARSE_ENEMY_HP[stage]>=1.3&&SPARSE_ENEMY_HP[stage]<=3);
  assert.ok(SPARSE_ENEMY_XP[stage]>=2.1&&SPARSE_ENEMY_XP[stage]<=3);
 }
});
test('paired current five-tech bench uses equal budgets, tougher mid encounters and retained legendary power',()=>{
 for(const row of after.rows){
  assert.equal(row.investment,{base:3,mid:14,evolved:31}[row.phase]);
  assert.ok(row.kills.every(n=>n===12));
  const previous=before.rows.find(r=>r.id===row.id&&r.phase===row.phase&&r.legendary===row.legendary);
  assert.ok(row.hpRange[0]>previous.hpRange[0]);
  if(row.phase==='mid')assert.ok(mean(row.clearSeconds)>mean(previous.clearSeconds)*1.2);
  if(row.legendary){const ordinary=after.rows.find(r=>r.id===row.id&&r.phase===row.phase&&!r.legendary);assert.ok(mean(row.clearSeconds)<mean(ordinary.clearSeconds));}
 }
});
test('actual opening director remains survivable without leveling or permanent gear',()=>{
 assert.equal(after.openingSurvival.length,5);
 for(const row of after.openingSurvival){assert.equal(row.seconds,70);assert.ok(row.hp>0);assert.equal(row.levelUps,0);assert.equal(row.legendary,false);assert.ok(row.peak<=STAGES[1].enemyCap);}
});
test('synthetic residency XP compensation retains a deliberate two-to-three-final good-run band',()=>{
 const prior=before.scenarios.find(s=>s.residency===16),current=after.scenarios.find(s=>s.residency===16);
 const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
 assert.ok(sum(current.rows,'kills')<sum(prior.rows,'kills')*.35);
 const xpRatio=sum(current.rows,'waveXP')/sum(prior.rows,'waveXP');assert.ok(xpRatio>.9&&xpRatio<1.1);
 const finals=current.plans.beforeBoss10Finals;assert.equal((finals[2]||0)+(finals[3]||0),40);
 assert.ok(Object.keys(current.plans.firstFusionStage).every(stage=>Number(stage)>=3),'no opening final fusion');
});
