// Deterministic stationary-target audit, not an estimate of human clear time.
// Uses real weapon firing, projectile/beam/orbit collision, hazards and Boss.hurt.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { G, clearWorld } from '../src/game/state.js';
import { Boss } from '../src/game/boss.js';
import { atlases, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { updateHazards } from '../src/game/hazards.js';
import { BOSSES } from '../src/data/bosses.js';
import { STAGES } from '../src/data/stages.js';
import { updateEnemies, updateEnemyShots, flushExplosions } from '../src/game/enemies.js';

const planned = JSON.parse(readFileSync(new URL('../tests/fixtures/planned-boss-builds.json', import.meta.url), 'utf8'));
export const DAMAGE_SCENARIOS = [
 // Deliberately strong early signature stress test, retained from the HP audit.
 // Unlike the later fixtures this is not asserted as an XP-planner snapshot.
 { name:'early three-weapon stress build',stage:1,distance:100,weapons:[['shotgun',5],['pistols',3],['thorns',2]],stats:{might:1.1,cooldown:.93,amount:1,area:1,duration:1,projSpeed:1,crit:0}},
 ...planned.builds.map(b=>({...b,weapons:b.weapons.map(w=>[w.id,w.level,w.evolved])})),
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
  G.weapons=scenario.weapons.map(([id,level,evolved=false],slot)=>Object.assign(createWeapon(id,slot),{level,evolved}));
  for(let i=0;i<Math.round(seconds*60);i++){const dt=1/60;G.clock+=dt;updateWeapons(dt);updateShots(dt);updateHazards(dt);}
  const damage=Object.values(G.damageBy).reduce((a,b)=>a+b,0);
  return {name:scenario.name,stage:scenario.stage,seconds,damage,dps:damage/seconds,byWeapon:{...G.damageBy},radius:boss.radius};
 } finally {Math.random=random;}
}
// Live boss movement/phases/summons with a fixed reachable build. The standing
// player's HP is a test fixture so contact deaths cannot end the measurement.
// No ordinary-wave director, pickups or new level choices are added mid-test.
export function measureBossEncounter(scenario,{hp=BOSSES[scenario.stage].hp,distance=300,seed=0x5eed1234,maxSeconds=120}={}){
 const random=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try{clearWorld();G.stage=scenario.stage;G.time=STAGES[scenario.stage].duration;G.clock=0;G.events={};G.damageBy={};G.mode='boss';G.lowQ=false;G.godMode=false;
 G.view={w:1000,h:600};G.camera={x:0,y:0};G.caps={enemies:252,particles:0,texts:0,gems:500,decalScale:0};
 G.player={x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,radius:10,hp:1e9,maxHp:1e9,dead:false,flip:false,iframes:0,stats:{armor:0,...scenario.stats}};
 for(const [name,data] of Object.entries(SPRITES))atlases[name]={walkH:data.walkH,frameCount:()=>8,draw(){}};
 fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};
 const b=new Boss(scenario.stage);b.x=distance;b.y=0;b.maxHp=b.hp=hp;G.boss=b;
 let first=null,phases=[],starts=[];
 const charge=b.task_charge.bind(b);b.task_charge=()=>{const task=charge(),step=task.step;task.step=(dt,s)=>{step(dt,s);if(s.phase===1&&first===null)first=G.clock;};return task;};
 const start=b.startPattern.bind(b);b.startPattern=()=>{start();starts.push([G.clock,b.lastPattern,b.phase]);};
 const enter=b.enterPhase.bind(b);b.enterPhase=n=>{phases.push([G.clock,n,b.hp]);enter(n);};
 G.weapons=scenario.weapons.map(([id,level,evolved=false],slot)=>Object.assign(createWeapon(id,slot),{level,evolved}));
 for(let i=0;i<60*maxSeconds&&b.alive;i++){
  const dt=1/60;if(G.hitstop>0){G.hitstop-=dt;continue;}G.clock+=dt;G.player.iframes=Math.max(0,G.player.iframes-dt);
  updateEnemies(dt);flushExplosions();updateWeapons(dt);updateShots(dt);updateEnemyShots(dt);updateHazards(dt);b.update(dt);
 }
 return {name:scenario.name,stage:scenario.stage,hp,distance,first,death:b.alive?null:G.clock,remainingHp:b.hp,starts,phases};
 }finally{Math.random=random;}
}
export function measureEarlyBossEncounter(options={}) { return measureBossEncounter(DAMAGE_SCENARIOS[0],{maxSeconds:45,...options}); }
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const rows=DAMAGE_SCENARIOS.map(s=>{const r=measureBossDps(s);return {...r,hp:BOSSES[s.stage].hp,stationaryHpOverDps:BOSSES[s.stage].hp/r.dps};});
 const live=DAMAGE_SCENARIOS.slice(1).flatMap(s=>[100,300,500].flatMap(distance=>Array.from({length:12},(_,i)=>measureBossEncounter(s,{distance,seed:i+1}))));
 console.log(JSON.stringify({method:'Stationary target and live boss AI with a standing high-HP player, actual combat code. No survival, player dodging, pets, boss-wave director or mid-fight upgrades. Not human clear times.',rows,live},null,2));
}
