import test from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer,recomputeStats} from '../src/game/player.js';
import {createWeapon,updateWeapons,weaponStats} from '../src/game/weapons.js';
import {resetBuild} from '../src/game/progression.js';
import {TECHS} from '../src/data/techs.js';
function setup(tech,id){resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:1,clock:1,tech,boss:null,caps:{particles:0,texts:0}});G.grid.reset();G.passives={[TECHS[tech].start.passive]:1};G.weapons=[Object.assign(createWeapon(id,0),{cd:0})];recomputeStats();const e=G.enemies.spawn();Object.assign(e,{id:1,x:200,y:0,radius:14,alive:true,hp:1e8,maxHp:1e8,mass:1,kx:0,ky:0,hits:new Float32Array(24).fill(-99),def:{}});G.grid.insert(e);return G.weapons[0];}
test('all five techs disclose a strength and an actual limitation',()=>{for(const t of Object.values(TECHS)){assert.ok(t.strength.length>8);assert.ok(t.weakness.length>8);}assert.match(TECHS.executioner.weakness,/보스·정예/);assert.match(TECHS.bloom.weakness,/중복/);});
test('plague alone shortens actual bottle flight to .35 seconds',()=>{for(const [tech,expected] of [['plague',.35],['gunline',.55]]){setup(tech,'molotov');updateWeapons(.001);assert.equal(G.shots.items[0].kind,'lob');assert.equal(G.shots.items[0].dur,expected);}});
test('butcher first saw aims at a real target while preserving bounce and six-saw cap',()=>{setup('butcher','saw');const original=Math.random;Math.random=()=>.5;try{updateWeapons(.001);}finally{Math.random=original;}const shot=G.shots.items[0];assert.equal(shot.kind,'saw');assert.ok(shot.vx>0);assert.equal(shot.bounce,true);assert.ok(G.shots.count<=6);assert.equal(G.player.attackPose.family,'blade');assert.equal(G.player.attackPose.flip,false);});
test('early resonance cadence benefits are applied once without free gear',()=>{for(const [tech,id,mult] of [['plague','molotov',.92],['butcher','saw',.85],['executioner','pistols',.92]]){const w=setup(tech,id),withTech=weaponStats(w).cd;G.tech=null;const without=weaponStats(w).cd;assert.ok(Math.abs(withTech/without-mult)<1e-10);assert.equal(G.weapons.length,1);assert.equal(Object.keys(G.passives).length,1);}});
