import test from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer,recomputeStats,updatePlayer,damagePlayer,POLLEN_BARRIER_CD} from '../src/game/player.js';
import {resetBuild} from '../src/game/progression.js';
function setup(level){resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:1,clock:0,caps:{particles:0,texts:0},godMode:false});G.passives={pollen:level};recomputeStats(true);}
test('pollen veil recharges by level, blocks exactly one hit and pushes nearby enemies',()=>{
 setup(1);const p=G.player;assert.equal(p.stats.barrierCd,12);assert.equal(p.stats.cooldown,1,'no longer a cooldown passive');
 for(let i=0;i<12*60+2;i++)updatePlayer(1/60);assert.equal(p.barrier,true);
 const e=G.enemies.spawn();Object.assign(e,{x:40,y:0,alive:true,mass:1,kx:0,ky:0});
 const hp=p.hp;assert.equal(damagePlayer(30,40,0),true);assert.equal(p.hp,hp,'first hit absorbed');assert.equal(p.barrier,false);assert.ok(e.kx>0,'enemy pushed away');
 p.iframes=0;damagePlayer(30,40,0);assert.ok(p.hp<hp,'second hit lands');
 setup(5);assert.equal(G.player.stats.barrierCd,POLLEN_BARRIER_CD[5]);assert.ok(POLLEN_BARRIER_CD[5]<POLLEN_BARRIER_CD[1]);
 setup(0);assert.equal(G.player.stats.barrierCd,0);for(let i=0;i<20*60;i++)updatePlayer(1/60);assert.ok(!G.player.barrier);
});
