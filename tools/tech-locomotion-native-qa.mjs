import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas'),root=path.resolve(import.meta.dirname,'..');
const node=()=>({style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},getAttribute(){},replaceChildren(){},appendChild(){},addEventListener(){}});
globalThis.document={hidden:false,createElement:tag=>tag==='canvas'?createCanvas(1,1):node(),getElementById:()=>node()};globalThis.window={innerWidth:1100,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}};
const fail=process.env.COSMETIC_FAIL || '';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.Image=class extends Image{set src(value){if(fail==='image' && /player-(?:cape|jade|halo)/.test(String(value))){queueMicrotask(()=>this.onerror?.(Error('simulated404')));return;}try{super.src=typeof value==='string'?fs.readFileSync(path.join(root,value)):value;}catch(e){queueMicrotask(()=>this.onerror?.(e));}}};
globalThis.fetch=async url=>{if((fail==='metadata'||fail==='all') && String(url).includes('pet-yeongnyang'))return {ok:false};try{const data=fs.readFileSync(path.join(root,url));return {ok:true,json:async()=>JSON.parse(data)}}catch{return {ok:false}}};
const assets=await import('../src/core/assets.js'),{drawAppearance,appearanceAssets}=await import('../src/game/player-appearance.js');
const {markPlayerAttack,attackFrame,playerAttackPose}=await import('../src/game/attack-animation.js');
await assets.loadAssets();
const families=['fire','dual','throw','cannon','sword'], outfits=[null,'dusk_lotus_cape','jade_lotus_guard'];
const contact=createCanvas(1920,3500),g=contact.getContext('2d');g.fillStyle='#101722';g.fillRect(0,0,1920,3500);g.fillStyle='#f8deaa';g.font='27px sans-serif';g.fillText('FLOWERPIG / TECH-APPROPRIATE IDLE + WALK / 120 AUTHORED POSES',25,40);
let checks=0;for(let f=0;f<families.length;f++)for(let o=0;o<3;o++){
 const family=families[f],outfit=outfits[o],key=assets.characterSheetKey(outfit,`${family}_move`);assert.ok(await assets.requestCharacterSheet(key));
 const y=280+(f*3+o)*210;g.fillStyle=(f*3+o)%2?'#172330':'#101722';g.fillRect(0,y-180,1920,210);g.fillStyle='#e8d7b4';g.font='15px sans-serif';g.fillText(`${family.toUpperCase()} / ${outfit||'BASE'} / IDLE 0–3 · WALK 4–7`,25,y-160);
 for(let frame=0;frame<8;frame++){assert.equal(appearanceAssets({outfit},false,`${family}_move`).key,key);const moving=frame>=4,p={shotAt:-Infinity,readyFamily:family,useLocomotion:true,vx:moving?100:0,vy:0,flip:o===2};drawAppearance(g,{x:120+frame*240,y,clock:(frame%4+.1)/(moving?9:3),player:p,appearance:{outfit},scale:2.3,tech:null});checks++;}
}
fs.writeFileSync('/workspace/shared/flowerpig-tech-idle-walk-120poses.png',contact.toBuffer('image/png'));
const folder='/workspace/shared/flowerpig-tech-idle-walk-video';fs.mkdirSync(folder,{recursive:true});const movie=createCanvas(1200,520),m=movie.getContext('2d');let sequence=0;
for(const family of families){for(const outfit of outfits)assert.ok(await assets.requestCharacterSheet(assets.characterSheetKey(outfit,`${family}_move`)));
 for(let frame=0;frame<100;frame++){const moving=frame>=50,clock=frame/50;m.fillStyle='#101722';m.fillRect(0,0,1200,520);m.fillStyle='#f8deaa';m.font='27px sans-serif';m.fillText(`FLOWERPIG / ${family.toUpperCase()} / ${moving?'WALK':'IDLE'}`,28,40);m.fillStyle='#aab7cf';m.font='15px sans-serif';m.fillText('Actual shared renderer · authored foot steps, breathing and cloth · real-time 50fps',28,68);
 for(let o=0;o<3;o++){const outfit=outfits[o],key=assets.characterSheetKey(outfit,`${family}_move`);assert.equal(appearanceAssets({outfit},false,`${family}_move`).key,key);const p={shotAt:-Infinity,readyFamily:family,useLocomotion:true,vx:moving?100:0,vy:0,flip:false};m.fillStyle='#e9d6b6';m.font='17px sans-serif';m.fillText(outfit||'BASE',45+o*400,115);drawAppearance(m,{x:200+o*400,y:430,clock,player:p,appearance:{outfit},scale:4,tech:null});}
 fs.writeFileSync(`${folder}/${String(sequence++).padStart(4,'0')}.png`,movie.toBuffer('image/png'));}}
console.log(JSON.stringify({status:'PASS',poseChecks:checks,videoFrames:sequence,captureFPS:50,seconds:sequence/50,cache:assets.characterCacheInfo()}));
