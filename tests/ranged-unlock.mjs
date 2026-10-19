import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES} from '../src/data/stages.js';
import {ENEMIES,RANGED_UNLOCK_STAGE} from '../src/data/enemies.js';
import {currentWeights} from '../src/game/spawner.js';
import {G,clearWorld} from '../src/game/state.js';
import {spawnEnemy,updateEnemies} from '../src/game/enemies.js';
import {atlases} from '../src/core/assets.js';
function reset(stage){clearWorld();G.stage=stage;G.time=0;G.clock=0;G.caps={enemies:420};G.player={x:0,y:0,radius:10,hp:100,dead:false,stats:{armor:0}};G.view={w:1000,h:600};atlases.rabbit2={walkH:112,frameCount:()=>8};}
test('every ranged mob is excluded from all stage1–4 tables; stage5 unlocks at60s',()=>{
 assert.equal(RANGED_UNLOCK_STAGE,5);
 for(let stage=1;stage<5;stage++)for(let t=0;t<=STAGES[stage].duration;t++)for(const id of Object.keys(currentWeights(STAGES[stage],t)))assert.ok(!ENEMIES[id].ranged);
 assert.equal(currentWeights(STAGES[5],59.999).spitter,undefined);
 assert.ok(currentWeights(STAGES[5],60).spitter>0);
 assert.deepEqual(ENEMIES.spitter.ranged,{range:230,cooldown:2.6,speed:170,dmg:8});
});
test('central gate covers ordinary forced elite and summon-style spawns',()=>{
 for(let stage=1;stage<5;stage++)for(const opts of [{},{force:true},{elite:true},{force:true,elite:true}]){reset(stage);assert.equal(spawnEnemy('spitter',100,0,opts),null);assert.equal(G.enemies.count,0);}
 reset(5);assert.ok(spawnEnemy('spitter',100,0,{force:true,elite:true}));
});
test('defensive firing gate blocks retained ranged objects if early-stage state is restored',()=>{
 reset(5);const e=spawnEnemy('spitter',100,0);e.shootT=0;G.stage=2;updateEnemies(.01);assert.equal(G.enemyShots.count,0);
 G.stage=5;e.shootT=0;updateEnemies(.01);assert.equal(G.enemyShots.count,1);
});
