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
const {createWeapon}=await import('../src/game/weapons.js');
const {recomputeStats}=await import('../src/game/player.js');
const {ENEMIES}=await import('../src/data/enemies.js');
await assets.loadAssets();
const canvas=createCanvas(1100,800);canvas.style={};rendering.initRender(canvas);
const folder='/workspace/shared/flowerpig-cannon-proof-frames';fs.mkdirSync(folder,{recursive:true});
let rng=773;Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
let frameIndex=0;const report=[];
for(const setup of [{level:1},{level:4},{level:8},{level:8,focus:true},{level:8,focus:true,weapon:'absolute_bloom'}]){
 const {level,focus=false,weapon='cannon'}=setup;
 const outfit='jade_lotus_guard';saving.save.upgrades={};saving.save.equippedPet=null;saving.save.equippedCosmetics={outfit};
 game.newRun(1,'bloom');G.mode='play';G.paused=false;G.pendingLevelUps=0;
 G.weapons=[Object.assign(createWeapon(weapon,0),{level,cd:.15})];recomputeStats();
 for(const family of ['cannon','cannon_move'])await assets.requestCharacterSheet(assets.characterSheetKey(outfit,family));
 G.enemies.clear();let selected=null;
 for(let j=0;j<12;j++){
  const x=j===0?-95:180+(j%4)*58,y=j===0?0:-125+Math.floor(j/4)*65;
  const e=spawnEnemy('shambler',G.player.x+x,G.player.y+y,{speedMul:.4});
  if(e){e.hp=focus&&j===6?20000:70;e.maxHp=e.hp;if(j===6)selected=e;}
 }
 if(focus&&selected)tapFocusAt(selected.x,selected.y-selected.radius);
 for(let f=0;f<150;f++){
  input.move.x=f<75?-.12:.12;input.move.y=.1;game.step(1/50);assert.ok(G.beams.count<=3,'global cannon visual cap');rendering.render(1/50);
  const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='rgba(8,14,24,.9)';ctx.fillRect(0,0,1100,64);ctx.fillStyle='#f8deaa';ctx.font='20px sans-serif';ctx.fillText(`${weapon==='cannon'?'LOTUS CANNON':'ABSOLUTE BLOOM'} Lv${level} / ${focus?'TARGET-ONLY FOCUSED BEAMS':'MULTI-TARGET AUTO-AIM'}`,22,29);ctx.fillStyle='#b6c1d6';ctx.font='14px sans-serif';ctx.fillText(focus?'Durable selected target + 70 HP bystanders · actual focused beam damage · native game render':'Same 70 HP opening formation · real moving enemies, collision and cooldowns · native game render',22,51);ctx.restore();
  fs.writeFileSync(`${folder}/${String(frameIndex++).padStart(4,'0')}.jpg`,canvas.toBuffer('image/jpeg',85));
 }
 if(focus&&weapon==='cannon')assert.equal(G.kills,0,'focused cannon leaves bystanders untouched');
 report.push({level,focus,weapon,damage:G.damageBy,kills:G.kills,hp:G.player.hp});assert.ok(Object.values(G.damageBy||{}).some(v=>v>0));
}
console.log(JSON.stringify({frames:frameIndex,fps:50,report}));
