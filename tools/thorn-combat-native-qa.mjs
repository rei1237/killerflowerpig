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
const {tapFocusAt}=await import('../src/game/targeting.js');
const {createWeapon,orbitStats}=await import('../src/game/weapons.js');
const {recomputeStats}=await import('../src/game/player.js');
const {ENEMIES}=await import('../src/data/enemies.js');
await assets.loadAssets();
const canvas=createCanvas(1100,800);canvas.style={};rendering.initRender(canvas);
const folder='/workspace/shared/flowerpig-thorn-proof-frames';fs.mkdirSync(folder,{recursive:true});
let rng=331;Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
let frameIndex=0;const report=[];
for(const evolved of [false,true]){
 const outfit='jade_lotus_guard';saving.save.upgrades={};saving.save.equippedPet=null;saving.save.equippedCosmetics={outfit};
 game.newRun(1,'bloom');G.mode='play';G.paused=false;G.pendingLevelUps=0;
 const w=Object.assign(createWeapon('thorns',0),{level:evolved?8:1,evolved,cd:0});G.weapons=[w];recomputeStats();G.player.hp=G.player.maxHp=10000;
 for(const family of ['cannon_move','channel'])await assets.requestCharacterSheet(assets.characterSheetKey(outfit,family));
 G.enemies.clear();

 const samples=[];
 for(let f=0;f<200;f++){
  input.move.x=input.move.y=0;
  if(f===40){const os=orbitStats(w,w.s);for(let j=0;j<2;j++){const a=w.angle+j/os.amount*Math.PI*2;const e=spawnEnemy('shambler',G.player.x+Math.cos(a)*os.radius*os.area,G.player.y-20+Math.sin(a)*os.radius*os.area*.8+16);if(e){e.hp=e.maxHp=10000;e.speed=0;}}}
  if(f===65)G.enemies.clear();
  game.step(1/50);rendering.render(1/50);
  const active=w.thornState?.slots.filter(s=>s.ready).length||0,total=w.thornState?.slots.length||0;if(f%25===0)samples.push({time:G.clock,active,total});
  const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='rgba(8,14,24,.9)';ctx.fillRect(0,0,1100,64);ctx.fillStyle='#f8deaa';ctx.font='20px sans-serif';ctx.fillText(`LOTUS THORNS ${evolved?'EVOLVED Lv8':'Lv1'} / READY ${active} OF ${total}`,22,29);ctx.fillStyle='#b6c1d6';ctx.font='13px sans-serif';ctx.fillText('Two controlled contacts at 0.8s; actors leave at 1.3s; real individual timers regrow consumed petals · native render',22,51);ctx.restore();
  fs.writeFileSync(`${folder}/${String(frameIndex++).padStart(4,'0')}.jpg`,canvas.toBuffer('image/jpeg',85));
 }
 report.push({evolved,damage:G.damageBy,samples});assert.ok(Object.values(G.damageBy||{}).some(v=>v>0));
}
console.log(JSON.stringify({frames:frameIndex,fps:50,report}));
