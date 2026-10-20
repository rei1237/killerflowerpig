import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultTitleProgress,normalizeTitleProgress,recordSettlement} from '../src/core/titles.js';
import {TITLES,TECH_IDS} from '../src/data/titles.js';
import {validateProgress,defaultProgress} from '../src/core/progression-store.js';
const fresh=()=>({...defaultTitleProgress(),kills:0});
test('first sortie and per-tech mastery unlock from settlements; first title auto-equips',()=>{
 let {state,earned}=recordSettlement(fresh(),{runId:'r1',tech:'bloom',stage:1,outcome:'death',kills:20});
 assert.deepEqual(earned.sort(),['bloom_first','first_sortie']);assert.ok(state.equippedTitle);
 for(const stage of [1,2,3])({state,earned}=recordSettlement(state,{runId:'r2',tech:'bloom',stage,outcome:'clear',kills:10}));
 assert.ok(state.titles.includes('bloom_stage3'));assert.ok(!state.titles.includes('bloom_stage6'));
 assert.equal(state.techStats.bloom.runs,2,'one run counted once per runId');assert.equal(state.techStats.bloom.best,3);assert.equal(state.techStats.bloom.clears,3);
});
test('cross-tech titles require every tech; feats count evolution, fusion, absolute',()=>{
 let state=fresh();
 for(const tech of TECH_IDS.slice(0,-1))({state}=recordSettlement(state,{runId:tech,tech,stage:3,outcome:'clear'}));
 assert.ok(!state.titles.includes('all_rounder'));
 ({state}=recordSettlement(state,{runId:'x',tech:TECH_IDS.at(-1),stage:3,outcome:'clear',evolved:true,fused:true,absolute:true}));
 for(const id of ['all_rounder','first_evolve','first_fusion','absolute'])assert.ok(state.titles.includes(id),id);
});
test('save validation keeps known titles/stats only and survives old saves',()=>{
 const s=validateProgress({...defaultProgress(),titles:['first_sortie','hack'],equippedTitle:'hack',techStats:{gunline:{runs:2,best:99,clears:-1},evil:{runs:5}},feats:{deaths:3,bad:9}});
 assert.deepEqual(s.titles,['first_sortie']);assert.equal(s.equippedTitle,null);
 assert.equal(s.techStats.gunline.best,10);assert.equal(s.techStats.gunline.clears,0);assert.equal(s.techStats.evil,undefined);assert.deepEqual(s.feats,{deaths:3});
 const old=validateProgress({version:3,gold:5});assert.deepEqual(old.titles,[]);assert.deepEqual(old.techStats,{});
 assert.equal(new Set(TITLES.map(t=>t.id)).size,TITLES.length,'title ids are unique');
 assert.deepEqual(normalizeTitleProgress(undefined),defaultTitleProgress());
});
