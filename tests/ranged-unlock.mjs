import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES} from '../src/data/stages.js';
import {ENEMIES} from '../src/data/enemies.js';
import {currentWeights} from '../src/game/spawner.js';
test('acid ranged trash begins only at stage3 90 seconds',()=>{
 for(const stage of [1,2])for(let t=0;t<=STAGES[stage].duration;t++)assert.equal(currentWeights(STAGES[stage],t).spitter,undefined);
 assert.equal(currentWeights(STAGES[3],0).spitter,undefined);
 assert.equal(currentWeights(STAGES[3],89.999).spitter,undefined);
 assert.equal(currentWeights(STAGES[3],90).spitter,2);
 assert.equal(currentWeights(STAGES[3],150).spitter,2);
 assert.equal(currentWeights(STAGES[4],0).spitter,1);
 assert.deepEqual(ENEMIES.spitter.ranged,{range:230,cooldown:2.6,speed:170,dmg:8});
});
