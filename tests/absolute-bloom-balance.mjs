import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tierPower} from '../src/data/weapons.js';
import {FUSED_WEAPONS} from '../src/data/fusions.js';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer,recomputeStats} from '../src/game/player.js';
import {resetBuild} from '../src/game/progression.js';
import {createWeapon,weaponStats} from '../src/game/weapons.js';
function reset(){resetBuild();clearWorld();G.tech=null;createPlayer();G.passives={};recomputeStats(true);}
const stats=(id,sourceId,fusionLevel=1)=>weaponStats(Object.assign(createWeapon(id,0),{level:8,evolved:true,sourceId,fusionLevel}));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('Absolute Bloom has deliberate 125 damage / 3.2s cadence; all other fusion data matches the post-nerf snapshot',()=>{
 assert.equal(FUSED_WEAPONS.absolute_bloom.base.dmg,125);assert.equal(FUSED_WEAPONS.absolute_bloom.base.cd,3.2);
 const before=JSON.parse(readFileSync(new URL('./fixtures/absolute-bloom-untouched-fusions.json',import.meta.url)));
 assert.deepEqual(Object.fromEntries(Object.entries(FUSED_WEAPONS).filter(([id])=>id!=='absolute_bloom')),before);
});
test('only Absolute Bloom inherited cores get reduced power, slower cadence and half thorn healing',()=>{
 reset();for(const id of ['cannon','molotov','thorns']){const base=stats(id),bloom=stats(id,'absolute_bloom'),max=stats(id,'absolute_bloom',8),other=stats(id,'plague_end');
 const powerRatio=tierPower({id,evolved:true,sourceId:'absolute_bloom'})/tierPower({id,evolved:true});
 near(bloom.dmg/base.dmg,(id==='cannon'?1.30:1.15)*powerRatio);near(max.dmg/base.dmg,((id==='cannon'?1.30:1.15)+.35)*powerRatio);
 near(bloom.cd/base.cd,1.15);near(bloom.lifesteal,base.lifesteal*.5);
 near(other.dmg/base.dmg,(id==='cannon'?1.50:1.35)*tierPower({id,evolved:true,sourceId:'plague_end'})/tierPower({id,evolved:true}));near(other.cd,base.cd);near(other.lifesteal,base.lifesteal);
 }const thorns=stats('thorns','absolute_bloom');near(thorns.lifesteal,.15);assert.ok(thorns.regrow>.35);
});
test('Absolute Bloom keeps inherited non-Cannon damage cap600 and does not cap-inflate equipment',()=>{
 reset();G.player.stats.might=100;for(const id of ['molotov','thorns']){const blo=stats(id,'absolute_bloom',8),other=stats(id,'plague_end',8);near(blo.dmg,600*tierPower({id,evolved:true,sourceId:'absolute_bloom'}));near(other.dmg,600*tierPower({id,evolved:true,sourceId:'plague_end'}));}
});
