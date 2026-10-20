// Real game renderer and real phase transitions, with authored enemy art.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), {createCanvas,Image}=require('@napi-rs/canvas');
const media={matches:false}; globalThis.Image=Image; globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.matchMedia=()=>media; globalThis.window={matchMedia:()=>media}; globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const {loadAssets}=await import('../src/core/assets.js'); await loadAssets();
const {G,clearWorld,configureCaps}=await import('../src/game/state.js');
const {createPlayer,drawPlayer}=await import('../src/game/player.js');
const {spawnEnemy,updateEnemies,drawEnemy,flushExplosions}=await import('../src/game/enemies.js');
const {settings}=await import('../src/core/settings.js'); settings.gore='off'; settings.shake=false;
const c=createCanvas(1440,850),ctx=c.getContext('2d');ctx.fillStyle='#0b1521';ctx.fillRect(0,0,c.width,c.height);
ctx.font='bold 28px sans-serif';ctx.fillStyle='#ffe9b9';ctx.fillText('Bomber: committed charge / visible fuse / bounded blast',28,44);
const phases=[['Windup: locked lane','warning',false],['Committed dash','dash',false],['Planted fuse: kill to disarm','fuse',false],['Detonation: no hidden shrapnel','blast',false],['Low quality: exact danger radius','fuse',false],['Reduced motion: stable silhouette','fuse',true]];
for(let i=0;i<phases.length;i++){
 const [label,target,reduced]=phases[i];media.matches=reduced; settings.quality=i===4?'low':'high';configureCaps();clearWorld(); G.stage=6;G.mode='play';G.time=0;G.clock=0;G.events={};G.weapons=[];G.passives={};G.view={w:1000,h:600};createPlayer();G.player.x=0;G.player.y=0;
 const e=spawnEnemy('suicider',240,0);updateEnemies(.01);
 if(target!=='warning'){for(let j=0;j<86;j++)updateEnemies(.01);}
 if(target==='dash')for(let j=0;j<20;j++)updateEnemies(.01);
 if(target==='fuse'||target==='blast'){for(let j=0;j<100 && e.rolePhase!=='fuse';j++)updateEnemies(.01);for(let j=0;j<55;j++)updateEnemies(.01);}
 if(target==='blast'){for(let j=0;j<40 && e.alive;j++)updateEnemies(.01);flushExplosions();updateEnemies(.065);}
 if(target==='warning')for(let j=0;j<55;j++)updateEnemies(.01);
 const x=24+(i%3)*472,y=80+Math.floor(i/3)*378;ctx.fillStyle='#1b2b39';ctx.fillRect(x,y,448,352);ctx.save();ctx.beginPath();ctx.rect(x,y,448,352);ctx.clip();ctx.translate(x+130,y+215);ctx.scale(.85,.85);drawEnemy(ctx,e);drawPlayer(ctx);ctx.restore();
 ctx.font='bold 17px sans-serif';ctx.fillStyle='#ffe9b9';ctx.fillText(label,x+14,y+28);ctx.font='14px sans-serif';ctx.fillStyle='#b9cbd8';ctx.fillText(`phase: ${e.detonated?'detonation':e.rolePhase} | fuse: ${Math.max(0,e.roleT).toFixed(2)}s`,x+14,y+324);
}
const out=process.argv[2]||'/workspace/shared/suicider-native-qa.png';fs.writeFileSync(out,c.toBuffer('image/png'));console.log(out);
