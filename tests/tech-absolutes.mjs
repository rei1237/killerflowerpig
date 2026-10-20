import test from 'node:test';
import assert from 'node:assert/strict';
import {TECHS} from '../src/data/techs.js';
import {FUSION_RECIPES} from '../src/data/fusions.js';
import {WEAPONS} from '../src/data/weapons.js';
import {simulateWeapon} from './helpers/tier-power.mjs';
const absolutes=FUSION_RECIPES.filter(r=>r.tier==='absolute');
test('every tech owns exactly one absolute weapon built from three of its own family weapons',()=>{
 assert.equal(absolutes.length,Object.keys(TECHS).length);
 const owners=new Map();
 for(const r of absolutes){
  assert.equal(r.inputs.length,3,r.id);assert.ok(r.inputs.every(i=>i.level===8),r.id);
  const fits=Object.entries(TECHS).filter(([,t])=>r.inputs.filter(i=>t.family.weapons.includes(i.id)).length>=2&&t.route.some(line=>line.includes(WEAPONS[r.output].name)));
  assert.equal(fits.length,1,`${r.id} is advertised by exactly one tech route`);owners.set(fits[0][0],r.id);
 }
 assert.equal(owners.size,Object.keys(TECHS).length,'one per tech');
 assert.equal(new Set(absolutes.map(r=>r.inputs.map(i=>i.id).sort().join('+'))).size,absolutes.length,'distinct ingredient sets');
});
test('each absolute weapon actually deals damage on its own',()=>{
 for(const r of absolutes)assert.ok(simulateWeapon(r.output,1,false,'scatter')>0,r.id);
});
