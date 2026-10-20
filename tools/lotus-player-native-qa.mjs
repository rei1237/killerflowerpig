import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas'),root=path.resolve(import.meta.dirname,'..');
const node=()=>({style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},getAttribute(){},replaceChildren(){},appendChild(){},addEventListener(){}});
globalThis.document={hidden:false,createElement:tag=>tag==='canvas'?createCanvas(1,1):node(),getElementById:()=>node()};globalThis.window={innerWidth:1100,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}};
const fail=process.env.LOTUS_FAIL || '';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.Image=class extends Image{set src(value){if(fail==='image' && /player-(?:lotus|cape-lotus|jade-lotus)-fire\.png/.test(String(value))){queueMicrotask(()=>this.onerror?.(Error('simulated404')));return;}try{super.src=typeof value==='string'?fs.readFileSync(path.join(root,value)):value;}catch(e){queueMicrotask(()=>this.onerror?.(e));}}};
globalThis.fetch=async url=>{if((fail==='metadata'||fail==='all') && String(url).includes('pet-yeongnyang'))return {ok:false};try{const data=fs.readFileSync(path.join(root,url));return {ok:true,json:async()=>JSON.parse(data)}}catch{return {ok:false}}};
const assets=await import('../src/core/assets.js'),game=await import('../src/game/game.js'),saving=await import('../src/core/save.js'),rendering=await import('../src/game/render.js');
const {G}=await import('../src/game/state.js');const {drawAppearance}=await import('../src/game/player-appearance.js');const {drawPlayer}=await import('../src/game/player.js');
await assets.loadAssets();assert.equal(!!assets.images.playerLotusFire,!fail);
if(!fail){assert.equal(assets.images.playerLotusFire.width,1536);assert.equal(assets.images.playerLotusFire.height,256);}
const canvas=createCanvas(1100,800);canvas.style={};rendering.initRender(canvas);saving.save.gold=10000;saving.save.maxClearedStage=3;assert.ok(saving.persist());game.newRun(1);game.step(.016);G.player.hp=37;const oldStats=JSON.stringify(G.player.stats),radius=G.player.radius;
assert.ok(saving.buyUpgrade('lotus_gun',0));assert.equal(saving.save.gold,7600);assert.ok(saving.buyUpgrade('lotus_gun',0));assert.equal(saving.save.gold,7600);
for(const item of ['jade_lotus_guard','dawn_petal_halo'])assert.ok(saving.buyCosmetic(item,saving.save.revision).ok);
let calls=0;const ctx=canvas.getContext('2d'),draw=ctx.drawImage;ctx.drawImage=function(img,...args){if(img===assets.images.playerLotusFire||img===assets.images.costume_jade_lotus_guard_lotus)calls++;return draw.call(this,img,...args);};
const contact=createCanvas(1280,580),g=contact.getContext('2d');g.fillStyle='#111521';g.fillRect(0,0,1280,580);g.fillStyle='#f8deaa';g.font='22px sans-serif';g.fillText('LEGENDARY LOTUS • COMPLETE CHARACTER FIRING ART',24,35);g.font='14px sans-serif';g.fillStyle='#aab7cf';g.fillText('Native game renderer • the owned weapon selects a complete character atlas • original hitbox and muzzle retained',24,64);
const poses=[{label:'READY',elapsed:1},{label:'FIRE',elapsed:.025},{label:'RECOIL',elapsed:.075},{label:'RECOVER',elapsed:.15}];
for(let row=0;row<2;row++)for(let i=0;i<4;i++){const x=150+i*320,y=295+row*265;g.fillStyle='#efe3d1';g.fillText(poses[i].label+(row?' / ARMOR + HALO':''),x-110,y-200);drawAppearance(g,{x,y,clock:10,scale:3.3,player:{shotAt:10-poses[i].elapsed,shotFlip:row===1,flip:row===1},appearance:row?saving.save.equippedCosmetics:{}});}
fs.writeFileSync(`/workspace/shared/lotus-player-${fail||'native'}-comparison.png`,contact.toBuffer('image/png'));
for(const elapsed of [1,.025,.075,.15]){G.clock=10;G.player.shotAt=10-elapsed;drawPlayer(ctx);assert.equal(G.player.hp,37);assert.equal(JSON.stringify(G.player.stats),oldStats);assert.equal(G.player.radius,radius);}
assert.equal(calls,fail?0:4);game.continueRun(game.loadRun());game.step(.016);rendering.render(.016);assert.ok(saving.upgradeLevel('lotus_gun'));fs.writeFileSync(`/workspace/shared/lotus-player-${fail||'native'}-combat.png`,canvas.toBuffer('image/png'));
console.log(JSON.stringify({status:'PASS',failureMode:fail||'none',fullAtlasDraws:calls,hpUnchanged:37,statsUnchanged:true,hitRadius:radius,continue:true,comparison:`/workspace/shared/lotus-player-${fail||'native'}-comparison.png`}));
