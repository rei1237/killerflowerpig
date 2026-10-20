// Deterministic real updateWeapons/updateShots comparison; optional baseline root.
import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),load=p=>import(pathToFileURL(path.join(root,p)));
const {G,clearWorld}=await load('src/game/state.js');const {createPlayer,recomputeStats}=await load('src/game/player.js');
const {updateWeapons,updateShots,LOTUS_GUN,resetWeaponRuntime}=await load('src/game/weapons.js');
const {save}=await load('src/core/save.js');const {resetBuild}=await load('src/game/progression.js');const {tapFocusAt,clearFocus}=await load('src/game/targeting.js');
Math.random=()=>.99;
function probe(stage,scene,owned=true,dt=1/60){resetBuild();clearWorld();clearFocus();createPlayer();resetWeaponRuntime();Object.assign(G,{stage,clock:0,mode:'play',events:{},damageBy:{},caps:{particles:0,texts:0},weapons:[],passives:{}});G.grid.reset();recomputeStats();save.upgrades.lotus_gun=owned?1:0;
 const targets=[],hp=1e8;
 if(scene==='boss'||scene==='boss-far') {const b={alive:true,x:scene==='boss'?180:440,y:0,radius:30,hp,maxHp:hp,hits:{},hurt(d){this.hp-=d;this.flash=.06;return d}};G.boss=b;targets.push(b);}
 else for(let i=0;i<18;i++){const e=G.enemies.spawn();Object.assign(e,{id:i+1,alive:true,x:120+(i%6)*45,y:(Math.floor(i/6)-1)*65,radius:14,hp,maxHp:hp,elite:true,mass:1,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(24).fill(-99),def:{},motionVX:0,motionVY:0});targets.push(e);G.grid.insert(e);}
 if(scene==='focus')tapFocusAt(targets[17].x,targets[17].y-targets[17].radius);
 let peak=0;for(let f=0;f<Math.round(20/dt);f++){G.clock+=dt;G.grid.reset();for(let i=0;i<targets.length;i++){const e=targets[i];if(scene==='moving-pack'||scene==='focus'){const old=e.y;e.y=(Math.floor(i/6)-1)*65+Math.sin(G.clock*1.8+i*.15)*45;e.motionVY=(e.y-old)/dt;}if(e!==G.boss)G.grid.insert(e);}updateWeapons(dt);updateShots(dt);peak=Math.max(peak,G.shots.count);}
 return{damage:Math.round(targets.reduce((s,e)=>s+hp-e.hp,0)),targetsHit:targets.filter(e=>e.hp<hp).length,peakShots:peak};}
const results={stats:LOTUS_GUN,scenes:{}};for(const stage of [1,4,10])for(const scene of ['boss','boss-far','moving-pack','focus'])results.scenes[stage+':'+scene]=probe(stage,scene);
results.nonowner=probe(4,'moving-pack',false);results.lowFps=probe(4,'boss',true,1/15);console.log(JSON.stringify(results,null,2));
