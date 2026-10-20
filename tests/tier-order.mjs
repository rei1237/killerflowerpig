import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateWeapon,TIER_SCENES} from './helpers/tier-power.mjs';
import {WEAPONS} from '../src/data/weapons.js';
// 전투력 = 장면별 피해 / 그 장면의 최고 일반 무기(Lv8) 피해 의 평균
const normalIds=Object.keys(WEAPONS).filter(id=>!WEAPONS[id].fusionOnly);
const fusedIds=Object.keys(WEAPONS).filter(id=>WEAPONS[id].fusionOnly&&WEAPONS[id].tier!=='absolute');
const absoluteIds=Object.keys(WEAPONS).filter(id=>WEAPONS[id].tier==='absolute');
const raw=(id,level,evolved)=>Object.fromEntries(TIER_SCENES.map(s=>[s,simulateWeapon(id,level,evolved,s)]));
const normal=normalIds.map(id=>[id,raw(id,8,false)]);
const best=Object.fromEntries(TIER_SCENES.map(s=>[s,Math.max(...normal.map(([,r])=>r[s]))]));
const power=r=>TIER_SCENES.reduce((a,s)=>a+r[s]/best[s],0)/TIER_SCENES.length;
// 진화·조합 단계는 10% 이상, 절대 등급은 보스 장기전 기준(boss-durability)과 함께 5% 이상 우위
const MARGIN=1.1, ABSOLUTE_MARGIN=1.05;
test('higher-tier weapons always outperform every weapon of the tier below (entry level vs max level)',()=>{
 const normalMax=Math.max(...normal.map(([,r])=>power(r)));
 const evolved=normalIds.map(id=>[id,power(raw(id,8,true))]);
 for(const [id,p] of evolved)assert.ok(p>normalMax*MARGIN,`evolved ${id} ${p.toFixed(2)} <= normal max ${normalMax.toFixed(2)}`);
 const evolvedMax=Math.max(...evolved.map(([,p])=>p));
 for(const id of fusedIds){const p=power(raw(id,1,false));assert.ok(p>evolvedMax*MARGIN,`fusion ${id} Lv1 ${p.toFixed(2)} <= evolved max ${evolvedMax.toFixed(2)}`);}
 const fusedMax=Math.max(...fusedIds.map(id=>power(raw(id,8,false))));
 for(const id of absoluteIds){const p=power(raw(id,1,false));assert.ok(p>fusedMax*ABSOLUTE_MARGIN,`absolute ${id} Lv1 ${p.toFixed(2)} <= fusion max ${fusedMax.toFixed(2)}`);}
});
