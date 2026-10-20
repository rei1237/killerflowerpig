// Actual finite-HP stage-1 boss, actual movement and weapon collisions.
// Equal early investment: 10 item levels, no evolution, purchases or mid-fight upgrades.
// node tools/beginner-boss-qa.mjs > /tmp/beginner-boss-qa.json
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { Boss } from '../src/game/boss.js';
import { atlases, images, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { TECHS, techStartingWeapons } from '../src/data/techs.js';
import { createPlayer, recomputeStats, updatePlayer } from '../src/game/player.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { updateHazards } from '../src/game/hazards.js';
import { clearFocus } from '../src/game/targeting.js';
import { resetBuild } from '../src/game/progression.js';
import { save } from '../src/core/save.js';
import { input } from '../src/core/input.js';
const ROUTES={gunline:['shotgun','rifle'],bloom:['thorns','cannon'],plague:['molotov','gas'],executioner:['pistols','rifle'],butcher:['sword','saw']};
const PASSIVES={gunline:['magazine','scope'],bloom:['regen','pollen'],plague:['spread','sap'],executioner:['focus','scope'],butcher:['whet','hide']};
const round=n=>+n.toFixed(3);
const hashes=()=>Object.fromEntries(['src/game/','src/data/'].flatMap(dir=>
 readdirSync(new URL('../'+dir,import.meta.url)).filter(f=>f.endsWith('.js')).sort().map(f=>{
  const file=dir+f;return[file,createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')];
 })));
export function measureBeginnerBoss({tech,seed=7,kiteRadius=100,maxSeconds=300,baseHp=null,weaponLevel=4}={}){
 const random=Math.random;let rng=seed;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 try{
  resetBuild();clearWorld();clearFocus();
  Object.assign(save,{upgrades:{},relics:[],accessoryInventory:[],equippedAccessory:null,cosmeticInventory:[],equippedCosmetics:{outfit:null,ornament:null},equippedPet:null});
  Object.assign(G,{stage:1,tech,difficulty:'easy',time:150,clock:0,mode:'boss',godMode:false,events:{},damageBy:{},lowQ:true,view:{w:1000,h:600},caps:{enemies:252,particles:0,texts:0,gems:500,pickups:50,decalScale:0}});
  G.camera.x=G.camera.y=0;input.move.x=input.move.y=0;
  for(const [id,data] of Object.entries(SPRITES))atlases[id]={walkH:data.walkH,frameCount:()=>8,draw(){}};
  fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};images.playerFire={width:3072,height:256};
  createPlayer();G.player.x=180;
  G.weapons=ROUTES[tech].map((id,slot)=>Object.assign(createWeapon(id,slot),{level:weaponLevel}));
  G.passives=Object.fromEntries(PASSIVES[tech].map(id=>[id,1]));recomputeStats(true);
  const budget=G.weapons.reduce((n,w)=>n+w.level,0)+Object.values(G.passives).reduce((a,b)=>a+b,0);assert.equal(budget,weaponLevel*2+2);
  const starterBudget=techStartingWeapons(TECHS[tech]).length+1,choiceCount=budget-starterBudget;
  const b=new Boss(1);if(baseHp!==null)b.hp=b.maxHp=baseHp*7;b.x=b.y=0;G.boss=b;let starts=0,dashes=0,recoveries=0,lastTask=null,firstStart=null,firstDash=null;
  const start=b.startPattern.bind(b);b.startPattern=()=>{starts++;firstStart??=G.clock;return start();};
  const min={warning:Infinity,recovery:Infinity};let state=null,stateAt=0,hpLoss=0,previousHp=G.player.hp;
  for(let frame=0;frame<maxSeconds*60&&b.alive&&!G.player.dead;frame++){
   const dx=G.player.x-b.x,dy=G.player.y-b.y,d=Math.hypot(dx,dy)||1,radial=Math.max(-1,Math.min(1,(kiteRadius-d)/60));
   let mx=-dy/d+dx/d*radial,my=dx/d+dy/d*radial;const norm=Math.hypot(mx,my);input.move.x=mx/norm;input.move.y=my/norm;
   const dt=1/60;G.clock+=dt;updatePlayer(dt);G.camera.x=G.player.x;G.camera.y=G.player.y;
   updateWeapons(dt);updateShots(dt);updateHazards(dt);b.update(dt);
   if(G.player.hp<previousHp)hpLoss+=previousHp-G.player.hp;previousHp=G.player.hp;
   const next=b.task?.phase??'walk';
   if(next!==state||b.task!==lastTask){
    // Only completed, uninterrupted windows count; phases may cancel tells.
    if(state==='warning'&&next==='dash')min.warning=Math.min(min.warning,G.clock-stateAt);
    if(state==='recover'&&next==='walk'&&b.alive)min.recovery=Math.min(min.recovery,G.clock-stateAt);
    if(next==='dash'){dashes++;firstDash??=G.clock;}if(next==='recover')recoveries++;
    state=next;stateAt=G.clock;lastTask=b.task;
   }
   assert.equal(G.enemies.count,0);assert.equal(G.enemyShots.count,0);
  }
  return {tech,seed,kiteRadius,budget,choiceCount,equivalentRunLevel:choiceCount+1,weapons:G.weapons.map(w=>({id:w.id,level:w.level})),passives:{...G.passives},bossMaxHp:b.maxHp,
   killed:!b.alive,playerAlive:!G.player.dead,seconds:round(G.clock),hp:round(G.player.hp),maxHp:G.player.maxHp,hpLoss:round(hpLoss),remainingBossHp:round(Math.max(0,b.hp)),starts,dashes,recoveries,firstStart:round(firstStart??0),firstDash:round(firstDash??0),
   shortestCompleteWarning:Number.isFinite(min.warning)?round(min.warning):null,shortestCompleteRecovery:Number.isFinite(min.recovery)?round(min.recovery):null,damageBy:Object.fromEntries(Object.entries(G.damageBy).map(([id,n])=>[id,round(n)]))};
 }finally{Math.random=random;input.move.x=input.move.y=0;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const weaponLevel=Number(process.argv.find(a=>a.startsWith('--level='))?.split('=')[1]||4);assert.ok([3,4].includes(weaponLevel));
 const before=hashes(),rows=Object.keys(TECHS).flatMap(tech=>[1,7,13].map(seed=>measureBeginnerBoss({tech,seed,weaponLevel}))),after=hashes();assert.deepEqual(after,before,'source changed during diagnostic');
 const summary=Object.keys(TECHS).map(tech=>{const r=rows.filter(x=>x.tech===tech);return {tech,kills:r.filter(x=>x.killed).length,survived:r.filter(x=>x.playerAlive).length,meanSeconds:round(r.reduce((a,x)=>a+x.seconds,0)/r.length),minSeconds:Math.min(...r.map(x=>x.seconds)),maxSeconds:Math.max(...r.map(x=>x.seconds)),meanHp:round(r.reduce((a,x)=>a+x.hp,0)/r.length),minDashes:Math.min(...r.map(x=>x.dashes))};});
 console.log(JSON.stringify({method:`Five actual techs, paired seeds 1/7/13; two route weapons Lv${weaponLevel} + two legal passives Lv1 = ${weaponLevel*2+2} item levels, 0 evolution rewards. Equivalent run level ${weaponLevel*2} for two-weapon starters, ${weaponLevel*2+1} for one-weapon starters. Actual finite HP 4200, no god mode, purchases, healing pickups, wave director or mid-fight choices. Same 100px circular movement policy with radial correction and real movement speed for all techs. This is a controlled dodge/TTK check, not a human clear-rate estimate. Simulation ignores rendering/hitstop wall-time.`,sourceHashes:before,sourceHashGuardPassed:true,summary,rows},null,2));
}
