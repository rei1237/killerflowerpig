import { treasureRandom } from '../src/game/coin-drops.js'; treasureRandom.next = () => .99; // 보물 상자 굴림 고정: 처치가 섞인 테스트가 난수 때문에 흔들리지 않게
import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {WEAPONS,PASSIVES} from '../src/data/weapons.js';
import {resetBuild,rollChoices,applyChoice,snapshotBuild,restoreBuild} from '../src/game/progression.js';
import {createPlayer,updatePlayer} from '../src/game/player.js';
import {step} from '../src/game/game.js';
const oldPassives=['magazine','focus','sap','scope','spread','pollen','whet','heart','regen','nose','madness','hide'];
const oldWeapons=['shotgun','pistols','rifle','thorns','molotov','cannon','gas','saw'];
beforeEach(()=>{clearWorld();resetBuild();createPlayer();G.level=2;G.stage=1;G.mode='play';G.paused=false;G.hitstop=0;G.gold=0;G.events={};});
test('all eight ordinary weapons and all twelve old passives remain available; fused outputs stay recipe-only',()=>{
 const choices=rollChoices(99);for(const id of [...oldWeapons,...oldPassives])assert.ok(choices.some(c=>c.id===id),id);
 assert.deepEqual(Object.keys(PASSIVES).sort(),oldPassives.sort());assert.equal(Object.values(WEAPONS).filter(w=>w.fusionOnly).length,14);assert.ok(choices.every(c=>!WEAPONS[c.id]?.fusionOnly));
});
test('eligible missing regeneration is offered at early and periodic protected choices including rerolls',()=>{
 for(const level of [5,10])for(let attempt=0;attempt<20;attempt++){G.level=level;const picks=rollChoices(3);assert.equal(picks.filter(c=>c.id==='regen').length,1);assert.equal(new Set(picks.map(c=>c.id)).size,3);}
 G.level=9;G.pendingLevelUps=4;assert.ok(rollChoices(3).some(c=>c.id==='regen'));
});
test('bounded regen offers coexist with thorns eligibility and ignores passive count, respects bans and max level',()=>{
 G.level=5;G.passives={heart:1,nose:1,hide:1,focus:1,sap:1};let picks=rollChoices(3);assert.ok(picks.some(c=>c.id==='regen'));G.level=4;assert.equal(rollChoices(1)[0].id,'thorns');
 G.passives.whet=1;G.passives.scope=1;assert.ok(rollChoices(99).some(c=>c.id==='regen'));delete G.passives.whet;G.banished.add('regen');assert.ok(!rollChoices(99).some(c=>c.id==='regen'));G.banished.clear();G.passives.regen=5;assert.ok(!rollChoices(99).some(c=>c.id==='regen'));
});
test('automatic regeneration really ticks at 0.3 HP/s per level, caps HP, pauses and survives restore',()=>{
 applyChoice({kind:'passive',id:'regen',level:1});G.player.hp=50;updatePlayer(10);assert.equal(G.player.hp,53);
 for(let level=2;level<=5;level++)applyChoice({kind:'passive',id:'regen',level});assert.equal(G.player.stats.regen,1.5);
 G.player.hp=50;G.paused=true;step(10);assert.equal(G.player.hp,50);G.paused=false;updatePlayer(10);assert.equal(G.player.hp,65);
 const snap=snapshotBuild();resetBuild();restoreBuild(snap);assert.equal(G.player.stats.regen,1.5);G.player.hp=G.player.maxHp-.1;updatePlayer(10);assert.equal(G.player.hp,G.player.maxHp);
 G.player.dead=true;G.player.hp=0;updatePlayer(10);assert.equal(G.player.hp,0);
});
