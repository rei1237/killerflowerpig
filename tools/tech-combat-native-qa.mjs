import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas'),root=path.resolve(import.meta.dirname,'..');
const node=()=>({style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},getAttribute(){},replaceChildren(){},appendChild(){},addEventListener(){}});
globalThis.document={hidden:false,createElement:tag=>tag==='canvas'?createCanvas(1,1):node(),getElementById:()=>node()};globalThis.window={innerWidth:1100,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}};
const fail=process.env.COSMETIC_FAIL || '';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.Image=class extends Image{set src(value){if(fail==='image' && /player-(?:cape|jade|halo)/.test(String(value))){queueMicrotask(()=>this.onerror?.(Error('simulated404')));return;}try{super.src=typeof value==='string'?fs.readFileSync(path.join(root,value)):value;}catch(e){queueMicrotask(()=>this.onerror?.(e));}}};
globalThis.fetch=async url=>{if((fail==='metadata'||fail==='all') && String(url).includes('pet-yeongnyang'))return {ok:false};try{const data=fs.readFileSync(path.join(root,url));return {ok:true,json:async()=>JSON.parse(data)}}catch{return {ok:false}}};
const assets=await import('../src/core/assets.js'),game=await import('../src/game/game.js'),saving=await import('../src/core/save.js'),rendering=await import('../src/game/render.js');
const {G}=await import('../src/game/state.js');const {drawAppearance}=await import('../src/game/player-appearance.js');const {COSMETICS}=await import('../src/data/cosmetics.js');
const {spawnEnemy}=await import('../src/game/enemies.js');
const {input}=await import('../src/core/input.js');
const {createWeapon}=await import('../src/game/weapons.js');
const {recomputeStats}=await import('../src/game/player.js');
const {ENEMIES}=await import('../src/data/enemies.js');
await assets.loadAssets();
const canvas=createCanvas(1100,800);canvas.style={};rendering.initRender(canvas);
const folder='/workspace/shared/flowerpig-combat-video';fs.mkdirSync(folder,{recursive:true});
let rng=773;Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
let frameIndex=0;const report=[];
for(const [tech,outfit] of [['butcher',null],['butcher','dusk_lotus_cape'],['butcher','jade_lotus_guard'],['plague','jade_lotus_guard']]){
 saving.save.upgrades={};saving.save.equippedPet=null;saving.save.equippedCosmetics={outfit};
 game.newRun(1,tech);G.mode='play';G.paused=false;
 const family=tech==='butcher'?'sword':'throw';
 for(const f of [family,`${family}_move`,tech==='butcher'?'blade':'channel'])await assets.requestCharacterSheet(assets.characterSheetKey(outfit,f));
 const enemyType=Object.keys(ENEMIES).find(id=>!ENEMIES[id].ranged&&(ENEMIES[id].unlockStage||1)<=1);
 G.enemies.clear();
 for(let j=0;j<8;j++){const a=j/8*Math.PI*2;spawnEnemy(enemyType,G.player.x+Math.cos(a)*(100+j*12),G.player.y+Math.sin(a)*(100+j*12),{hpMul:8,speedMul:.65});}
 const before=G.damageBy?Object.values(G.damageBy).reduce((a,b)=>a+b,0):0;
 for(let f=0;f<200;f++){
  input.move.x=f<100?.35:-.35;input.move.y=.15;
  game.step(1/50);rendering.render(1/50);
  const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='rgba(8,14,24,.85)';ctx.fillRect(0,0,1100,64);ctx.fillStyle='#f8deaa';ctx.font='24px sans-serif';ctx.fillText(`${tech.toUpperCase()} / ${outfit||'BASE'} / ACTUAL SIMULATION + RENDER`,22,29);ctx.fillStyle='#b6c1d6';ctx.font='14px sans-serif';ctx.fillText('Seeded controlled enemy setup · real targeting, collision, cooldowns and cloth poses · native capture',22,51);ctx.restore();
  fs.writeFileSync(`${folder}/${String(frameIndex++).padStart(4,'0')}.png`,canvas.toBuffer('image/png'));
 }
 report.push({tech,outfit,damage:G.damageBy,hp:G.player.hp,enemyCount:G.enemies.count});
 assert.ok(Object.values(G.damageBy||{}).some(v=>v>0),'real hits must occur');
}
console.log(JSON.stringify({frames:frameIndex,fps:50,report}));
