// Deterministic stationary-target audit, not an estimate of human clear time.
// Uses real weapon firing, projectile/beam/orbit collision, hazards and Boss.hurt.
import { pathToFileURL } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { Boss } from '../src/game/boss.js';
import { atlases, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { updateHazards } from '../src/game/hazards.js';
import { BOSSES } from '../src/data/bosses.js';
import { STAGES } from '../src/data/stages.js';
import { updateEnemies, updateEnemyShots, flushExplosions } from '../src/game/enemies.js';

export const DAMAGE_SCENARIOS = [
 { name:'early three-weapon build',stage:1,distance:100,weapons:[['shotgun',5],['pistols',3],['thorns',2]],stats:{might:1.1,cooldown:.93,amount:1,area:1,duration:1,projSpeed:1,crit:0}},
 { name:'mid four-weapon build',stage:5,distance:130,weapons:[['scatter_rail',5],['lotus_bloom',3],['plague_fire',3],['pistols',6]],stats:{might:1.53,cooldown:.79,amount:2,area:1.3,duration:1.36,projSpeed:1.36,crit:0}},
 { name:'late six-fusion build',stage:10,distance:130,weapons:[['scatter_rail',8],['burst_rail',8],['lotus_bloom',8],['plague_fire',8],['venom_saw',8],['ember_lance',8]],stats:{might:2.15,cooldown:.65,amount:3,area:1.5,duration:1.6,projSpeed:1.6,crit:0}},
];
export function measureBossDps(scenario, seconds=30) {
 const random=Math.random;let seed=0x5eed1234;
 Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try {
  clearWorld();G.stage=scenario.stage;G.clock=0;G.time=0;G.events={};G.damageBy={};G.mode='boss';G.lowQ=false;
  G.view={w:1000,h:600};G.camera={x:0,y:0};G.caps={enemies:0,particles:0,texts:0,gems:0,decalScale:0};
  G.player={x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,radius:10,hp:100,maxHp:100,dead:false,flip:false,stats:{armor:0,...scenario.stats}};
  for(const [name,data] of Object.entries(SPRITES)) atlases[name]={walkH:data.walkH,frameCount:()=>8,draw(){}};
  const boss=new Boss(scenario.stage);boss.x=scenario.distance;boss.y=0;boss.hp=boss.maxHp=1e9;G.boss=boss;
  G.weapons=scenario.weapons.map(([id,level],slot)=>Object.assign(createWeapon(id,slot),{level}));
  for(let i=0;i<Math.round(seconds*60);i++){const dt=1/60;G.clock+=dt;updateWeapons(dt);updateShots(dt);updateHazards(dt);}
  const damage=Object.values(G.damageBy).reduce((a,b)=>a+b,0);
  return {name:scenario.name,stage:scenario.stage,seconds,damage,dps:damage/seconds,byWeapon:{...G.damageBy},radius:boss.radius};
 } finally {Math.random=random;}
}
// Live boss movement/phases/summons with a fixed early build. The standing
// player's HP is a test fixture so contact deaths cannot end the measurement.
// No ordinary-wave director, pickups or new level choices are added mid-test.
export function measureEarlyBossEncounter({hp=BOSSES[1].hp,distance=300,seed=0x5eed1234}={}){
 const random=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try{clearWorld();G.stage=1;G.time=STAGES[1].duration;G.clock=0;G.events={};G.damageBy={};G.mode='boss';G.lowQ=false;G.godMode=false;
 G.view={w:1000,h:600};G.camera={x:0,y:0};G.caps={enemies:420,particles:0,texts:0,gems:500,decalScale:0};
 G.player={x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,radius:10,hp:1e9,maxHp:1e9,dead:false,flip:false,iframes:0,stats:{armor:0,...DAMAGE_SCENARIOS[0].stats}};
 for(const [name,data] of Object.entries(SPRITES))atlases[name]={walkH:data.walkH,frameCount:()=>8,draw(){}};
 fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};
 const b=new Boss(1);b.x=distance;b.y=0;b.maxHp=b.hp=hp;G.boss=b;
 let first=null,phases=[],starts=[];
 const charge=b.task_charge.bind(b);b.task_charge=()=>{const task=charge(),step=task.step;task.step=(dt,s)=>{step(dt,s);if(s.phase===1&&first===null)first=G.clock;};return task;};
 const start=b.startPattern.bind(b);b.startPattern=()=>{start();starts.push([G.clock,b.lastPattern,b.phase]);};
 const enter=b.enterPhase.bind(b);b.enterPhase=n=>{phases.push([G.clock,n,b.hp]);enter(n);};
 G.weapons=DAMAGE_SCENARIOS[0].weapons.map(([id,level],slot)=>Object.assign(createWeapon(id,slot),{level}));
 for(let i=0;i<60*45&&b.alive;i++){
  const dt=1/60;if(G.hitstop>0){G.hitstop-=dt;continue;}G.clock+=dt;G.player.iframes=Math.max(0,G.player.iframes-dt);
  updateEnemies(dt);flushExplosions();updateWeapons(dt);updateShots(dt);updateEnemyShots(dt);updateHazards(dt);b.update(dt);
 }
 return {hp,distance,first,death:b.alive?null:G.clock,remainingHp:b.hp,starts,phases};
 }finally{Math.random=random;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const rows=DAMAGE_SCENARIOS.map(s=>{const r=measureBossDps(s);return {...r,hp:BOSSES[s.stage].hp,stationaryHpOverDps:BOSSES[s.stage].hp/r.dps};});
 console.log(JSON.stringify({method:'30-second seeded stationary target, actual combat code, no movement/phase downtime/pet/critical bonuses. Not human clear times.',rows},null,2));
}
