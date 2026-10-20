// 단일 무기 30초 전투 시뮬레이션 (보스 근접 / 흩어진 무리 / 일렬 통로)
import {G,clearWorld} from '../../src/game/state.js';
import {createPlayer,recomputeStats} from '../../src/game/player.js';
import {createWeapon,updateWeapons,updateShots} from '../../src/game/weapons.js';
import {updateHazards} from '../../src/game/hazards.js';
import {resetBuild} from '../../src/game/progression.js';
import {WEAPONS} from '../../src/data/weapons.js';
export function simulateWeapon(id, level, evolved, scene){
 resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:1,clock:0,gold:0,events:{},damageBy:{},boss:null,caps:{particles:0,texts:0},lowQ:true});G.grid.reset();G.player.hp=50;
 G.passives={};recomputeStats();
 G.weapons=[Object.assign(createWeapon(id,0),{level,evolved,cd:0})];
 let seed=1234567;const original=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const targets=[];const hp=1e8;
 if(scene==='boss'){G.boss={alive:true,x:80,y:0,radius:26,hp,hits:{},hurt(d){this.hp-=d}};targets.push(G.boss);}
 else for(let i=0;i<18;i++){const angle=i*Math.PI*2/18,r=85+(i%3)*80;const e=G.enemies.spawn();Object.assign(e,{id:i+1,x:scene==='corridor'?65+i*18:Math.cos(angle)*r,y:scene==='corridor'?(i%3-1)*16:Math.sin(angle)*r,radius:12,alive:true,hp,maxHp:hp,mass:1,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(16).fill(-99)});targets.push(e);G.grid.insert(e);}
 try{for(let f=0;f<1800;f++){G.clock+=1/60;updateWeapons(1/60);updateShots(1/60);updateHazards(1/60);for(const e of targets)if(e.bleedT>0){e.bleedT-=1/60;e.hp-=e.bleed/15;} }}finally{Math.random=original;}
 return targets.reduce((n,e)=>n+hp-e.hp,0);
}
export const TIER_SCENES=['boss','scatter','corridor'];
