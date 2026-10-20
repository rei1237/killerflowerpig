// Expected values over actual seeded spawns/deaths, not a survival/DPS simulation.
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer} from '../src/game/player.js';
import {resetBuild} from '../src/game/progression.js';
import {resetSpawner,updateSpawner} from '../src/game/spawner.js';
import {updateEncirclement} from '../src/game/encirclement.js';
import {hitEnemy,flushExplosions} from '../src/game/enemies.js';
import {STAGES} from '../src/data/stages.js';
import {coinTier,bossCoinValue} from '../src/game/coin-drops.js';
import {seeded} from './run-progression-audit.mjs';
import {settings} from '../src/core/settings.js';
Math.random=seeded(7);settings.gore='off';const rows=[];
for(let stage=1;stage<=10;stage++){
 clearWorld();resetBuild();createPlayer();Object.assign(G,{stage,time:0,clock:0,kills:0,damageBy:{},mode:'play',view:{w:1000,h:600},caps:{enemies:252,particles:0,texts:0,gems:500,decalScale:0}});resetSpawner();
 let old=0,next=0,elite=0;const counts={};G.events={kill:e=>{counts[e.type]=(counts[e.type]||0)+1;if(e.elite){elite++;old+=.3*6;}const t=coinTier(e);next+=t.chance*t.value;}};const expires=new Map();
 for(let i=0;i<Math.ceil(STAGES[stage].duration/.1);i++){
  G.time=G.clock=i*.1;updateEncirclement(.1);updateSpawner(.1);
  for(let j=G.enemies.count-1;j>=0;j--){const e=G.enemies.items[j];if(!expires.has(e.id))expires.set(e.id,G.time+16*(e.elite?3:1));if(!e.alive){e.deadT+=.1;if(e.deadT>.15)G.enemies.release(j);}else if(G.time>=expires.get(e.id))hitEnemy(e,e.hp+1,{silent:true});}
  flushExplosions();G.gems.clear();G.pickups.clear();G.hazards.clear();
 }
 rows.push({stage,kills:G.kills,eliteKills:elite,counts,oldExpected:Math.round((old*.85+5*stage)*100)/100,newExpected:Math.round((next*.85+bossCoinValue(stage))*100)/100,bossCoins:bossCoinValue(stage)});
}
console.log(JSON.stringify({method:'Seed7 director,16s ordinary/48s elite synthetic residency,85% field coin collection,guaranteed boss bounty,greed1; no survival/DPS or boss-phase kills.',rows},null,2));
