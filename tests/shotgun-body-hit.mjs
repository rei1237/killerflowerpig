import test from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer,recomputeStats} from '../src/game/player.js';
import {createWeapon,updateWeapons,updateShots,bodyDist2} from '../src/game/weapons.js';
import {resetBuild} from '../src/game/progression.js';
import {SPRITES} from '../src/data/sprites.js';
function volley(dist,withSprite=true){
 let seed=42;const original=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try{
 resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:1,clock:0,gold:0,events:{},damageBy:{},boss:null,caps:{particles:0,texts:0},lowQ:true});G.grid.reset();recomputeStats();
 const w=Object.assign(createWeapon('shotgun',0),{cd:0});G.weapons=[w];
 const hp=1e8,e=G.enemies.spawn();
 // 발밑이 플레이어보다 아래 → 산탄은 몸통 위쪽을 지나간다
 Object.assign(e,{id:1,x:dist,y:20,radius:14,scale:0.52,atlas:withSprite?{walkH:SPRITES.rabbit1.walkH}:null,alive:true,hp,maxHp:hp,mass:1e9,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(16).fill(-99),def:{}});G.grid.insert(e);
 for(let f=0;f<50;f++){G.clock+=1/60;if(f>0)w.cd=99;updateWeapons(1/60);updateShots(1/60);}
 return Math.round((hp-e.hp)/9);
 }finally{Math.random=original;}
}
test('shotgun pellets that hit the upper body each deal damage (pellet count scales damage)',()=>{
 for(const dist of [60,120,180]){
  const body=volley(dist),footOnly=volley(dist,false);
  assert.ok(body>footOnly,`${dist}px: body hitbox ${body} pellets vs foot circle ${footOnly}`);
 }
 assert.ok(volley(60)>=4,'point blank: nearly every pellet lands on the sprite body');
});
test('body capsule spans the drawn sprite height, not only the foot circle',()=>{
 const e={x:0,y:0,radius:14,scale:0.52,atlas:{walkH:112}};
 assert.ok(bodyDist2(e,0,-45)<14*14,'head height is inside the body');
 assert.equal(bodyDist2(e,0,-14),0,'foot circle center still inside');
 assert.ok(bodyDist2({x:0,y:0,radius:14},0,-45)>14*14,'objects without sprite data keep the old circle');
});
