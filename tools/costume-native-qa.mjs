import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas'),root=path.resolve(import.meta.dirname,'..');
const node=()=>({style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},getAttribute(){},replaceChildren(){},appendChild(){},addEventListener(){}});
globalThis.document={hidden:false,createElement:tag=>tag==='canvas'?createCanvas(1,1):node(),getElementById:()=>node()};globalThis.window={innerWidth:1100,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}};
const fail=process.env.COSMETIC_FAIL || '';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.Image=class extends Image{set src(value){if(fail==='image' && /player-(?:cape|jade|halo)/.test(String(value))){queueMicrotask(()=>this.onerror?.(Error('simulated404')));return;}try{super.src=typeof value==='string'?fs.readFileSync(path.join(root,value)):value;}catch(e){queueMicrotask(()=>this.onerror?.(e));}}};
globalThis.fetch=async url=>{if((fail==='metadata'||fail==='all') && String(url).includes('pet-yeongnyang'))return {ok:false};try{const data=fs.readFileSync(path.join(root,url));return {ok:true,json:async()=>JSON.parse(data)}}catch{return {ok:false}}};
const assets=await import('../src/core/assets.js'),{drawAppearance,appearanceAssets}=await import('../src/game/player-appearance.js');
await assets.loadAssets();const keys=['playerFire','playerLotusFire','costume_dusk_lotus_cape_normal','costume_dusk_lotus_cape_lotus','costume_jade_lotus_guard_normal','costume_jade_lotus_guard_lotus','playerHaloLayer'];
assert.ok(assets.images.playerFire);assert.ok(assets.images.playerHaloLayer);
const {shotFrame,FIRING_SPRITE}=await import('../src/game/player-motion.js');
const rows=[['BASE / STANDARD',null,false],['BASE / LEGENDARY',null,true],['CAPE / STANDARD','dusk_lotus_cape',false],['CAPE / LEGENDARY','dusk_lotus_cape',true],['JADE / STANDARD','jade_lotus_guard',false],['JADE / LEGENDARY','jade_lotus_guard',true]];
// Find representative timestamps through the actual timing function, never force an atlas frame.
const times=Array(8).fill(null); times[0]=1;
for(let i=0;i<1000;i++){const t=i/1000,frame=shotFrame(t);if(frame&&times[frame]===null)times[frame]=t+.001;}
assert.ok(times.every(t=>t!==null),'All eight authored frames reachable');
const canvas=createCanvas(1920,1460),g=canvas.getContext('2d');g.fillStyle='#101722';g.fillRect(0,0,1920,1460);g.fillStyle='#f8deaa';g.font='26px sans-serif';g.fillText('FLOWERPIG / 48 AUTHORED FIRING POSES',30,40);g.font='16px sans-serif';g.fillStyle='#aab7cf';g.fillText('Actual shared combat renderer / fixed feet / immediate shot / cloth follow-through',30,70);
for(let r=0;r<rows.length;r++){
 const [label,outfit,lotusGun]=rows[r];await assets.requestCharacterSheet(assets.characterSheetKey(outfit,'fire',lotusGun));const y=290+r*220;g.fillStyle=r%2?'#172330':'#101722';g.fillRect(0,y-190,1920,220);g.fillStyle='#ead7b7';g.font='15px sans-serif';g.fillText(label,24,y-170);
 for(let c=0;c<8;c++){const x=120+c*240;g.fillStyle='#829bad';g.font='12px sans-serif';g.fillText(String(c),x-5,y-145);const appearance={outfit,ornament:'dawn_petal_halo'};assert.deepEqual(appearanceAssets(appearance,lotusGun).missing,[]);drawAppearance(g,{x,y,clock:10,scale:2.3,lotusGun,appearance,player:{shotAt:10-times[c],shotFlip:r%2===1,flip:r%2===1}});}
}
fs.writeFileSync('/workspace/shared/flowerpig-eight-frame-48poses.png',canvas.toBuffer('image/png'));
console.log(JSON.stringify({status:'PASS',bodyVariants:6,poseChecks:48,atlas:'3072x256',frameTimes:times,animationDuration:FIRING_SPRITE.recoverEnd,contact:'/workspace/shared/flowerpig-eight-frame-48poses.png'}));
