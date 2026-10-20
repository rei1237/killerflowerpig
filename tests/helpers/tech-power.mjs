// 테크 루트 빌드 30초 전투 시뮬레이션 (테크 활성 + 계열 패시브 Lv5 + 공명 최대)
const R='../../src/';
const {G,clearWorld}=await import(new URL(R+'game/state.js',import.meta.url));
const {createPlayer,recomputeStats}=await import(new URL(R+'game/player.js',import.meta.url));
const {createWeapon,updateWeapons,updateShots}=await import(new URL(R+'game/weapons.js',import.meta.url));
const {updateHazards}=await import(new URL(R+'game/hazards.js',import.meta.url));
const {resetBuild}=await import(new URL(R+'game/progression.js',import.meta.url));
const {TECHS}=await import(new URL(R+'data/techs.js',import.meta.url));
export const TECH_ROUTES={gunline:[['shotgun','rifle'],'scatter_rail'],bloom:[['thorns','cannon'],'lotus_bloom'],plague:[['molotov','gas'],'plague_fire'],executioner:[['pistols','rifle'],'burst_rail'],butcher:[['saw','thorns'],'orbit_saw']};
export function simulateTech(tech,weapons,scene){
 resetBuild();clearWorld();createPlayer();Object.assign(G,{mode:'play',stage:1,clock:0,gold:0,events:{},damageBy:{},boss:null,caps:{particles:0,texts:0},lowQ:true,tech});G.grid.reset();G.player.hp=50;
 G.passives=Object.fromEntries(TECHS[tech].family.passives.map(p=>[p,5]));
 G.weapons=weapons.map(([id,level,evolved],slot)=>Object.assign(createWeapon(id,slot),{level,evolved,cd:0}));
 recomputeStats();
 let seed=1234567;const original=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const targets=[];const hp=1e8;
 if(scene==='boss'){G.boss={alive:true,x:80,y:0,radius:26,hp,hits:{},hurt(d,o={}){let a=d;const cc=(o.crit||0)+G.player.stats.crit;if(cc&&Math.random()<cc)a*=(G.player.stats.critMul||2)+(o.critBonus||0);this.hp-=a}};targets.push(G.boss);}
 else for(let i=0;i<18;i++){const angle=i*Math.PI*2/18,r=scene==='swarm'?40+(i%3)*18:85+(i%3)*80;const e=G.enemies.spawn();Object.assign(e,{id:i+1,x:scene==='corridor'?65+i*18:Math.cos(angle)*r,y:scene==='corridor'?(i%3-1)*16:Math.sin(angle)*r,radius:12,alive:true,hp,maxHp:hp,mass:1,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(16).fill(-99)});targets.push(e);G.grid.insert(e);}
 try{for(let f=0;f<1800;f++){G.clock+=1/60;updateWeapons(1/60);updateShots(1/60);updateHazards(1/60);for(const e of targets)if(e.bleedT>0){e.bleedT-=1/60;e.hp-=e.bleed/15;} }}finally{Math.random=original;}
 return targets.reduce((n,e)=>n+hp-e.hp,0);
}
export const TECH_SCENES=['boss','scatter','corridor','swarm'];
