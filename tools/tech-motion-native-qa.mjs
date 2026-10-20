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
const families=[['fire','shotgun','gunline'],['dual','pistols','executioner'],['throw','molotov','plague'],['cannon','cannon','bloom'],['blade','saw','butcher'],['channel','thorns','bloom'],['sword','sword','butcher']];
const outfits=[null,'dusk_lotus_cape','jade_lotus_guard'];
const contact=createCanvas(1920,5000),g=contact.getContext('2d');g.fillStyle='#101722';g.fillRect(0,0,1920,5000);g.fillStyle='#f8deaa';g.font='27px sans-serif';g.fillText('FLOWERPIG / SEVEN ATTACK FAMILIES / THREE COSTUMES / 168 POSES',25,40);
let checks=0,peakBytes=0;
for(let f=0;f<families.length;f++)for(let o=0;o<outfits.length;o++){
 const [family,id,tech]=families[f],outfit=outfits[o],key=assets.characterSheetKey(outfit,family,false);
 const img=await assets.requestCharacterSheet(key);assert.ok(img,`Missing ${key}`);assert.equal(img.width,3072);assert.equal(img.height,256);
 const times=Array(8).fill(null);times[0]=1;for(let j=0;j<1000;j++){const t=j/1000,k=attackFrame(t,family);if(k&&times[k]===null)times[k]=t+.001;}assert.ok(times.every(t=>t!==null));
 const y=290+(f*3+o)*220;g.fillStyle=(f*3+o)%2?'#172330':'#101722';g.fillRect(0,y-190,1920,220);g.fillStyle='#e8d7b4';g.font='15px sans-serif';g.fillText(`${family.toUpperCase()} / ${outfit||'BASE'}`,25,y-170);
 for(let frame=0;frame<8;frame++){assert.equal(appearanceAssets({outfit},false,family).key,key);const p={shotAt:-Infinity,attackPose:null,readyFamily:family,flip:o===2};markPlayerAttack(p,10,{id},o===2?-1:1,{tech});drawAppearance(g,{x:120+frame*240,y,clock:10+times[frame],player:p,appearance:{outfit,ornament:'dawn_petal_halo'},scale:2.3,tech:null});checks++;}
 const info=assets.characterCacheInfo();peakBytes=Math.max(peakBytes,info.decodedBytes);assert.ok(info.bodies.length<=4);assert.ok(info.flashes.length<=2);
}
fs.writeFileSync('/workspace/shared/flowerpig-tech-role-168poses.png',contact.toBuffer('image/png'));
const folder='/workspace/shared/flowerpig-tech-role-video';fs.mkdirSync(folder,{recursive:true});
const movie=createCanvas(1200,520),m=movie.getContext('2d');let sequence=0;
for(const [family,id,tech] of families){
 for(const outfit of outfits)assert.ok(await assets.requestCharacterSheet(assets.characterSheetKey(outfit,family,false)));
 for(let f=0;f<60;f++){
  const clock=10+f/50,attackAt=10+Math.floor((clock-10)/.6)*.6;
  m.fillStyle='#101722';m.fillRect(0,0,1200,520);m.fillStyle='#f8deaa';m.font='27px sans-serif';m.fillText(`FLOWERPIG / ${family.toUpperCase()} ATTACK`,28,40);m.fillStyle='#aab7cf';m.font='15px sans-serif';m.fillText('Real-time shared renderer · 50fps · immediate release, recoil and cloth follow-through',28,68);
  for(let o=0;o<3;o++){const outfit=outfits[o];assert.equal(appearanceAssets({outfit},false,family).key,assets.characterSheetKey(outfit,family));const p={attackPose:null,shotAt:-Infinity,readyFamily:family,flip:false};markPlayerAttack(p,attackAt,{id},1,{tech});m.fillStyle='#e9d6b6';m.font='17px sans-serif';m.fillText(outfit||'BASE',45+o*400,115);drawAppearance(m,{x:200+o*400,y:430,clock,player:p,appearance:{outfit,ornament:'dawn_petal_halo'},scale:4,tech:null});m.fillStyle='#8099ae';m.font='14px sans-serif';m.fillText(`pose ${playerAttackPose(p,clock,tech).frame}`,170+o*400,475);}
  fs.writeFileSync(`${folder}/${String(sequence++).padStart(4,'0')}.png`,movie.toBuffer('image/png'));
 }
}
console.log(JSON.stringify({status:'PASS',families:7,outfits:3,poseChecks:checks,peakDecodedBytes:peakBytes,bodyCacheCap:4,flashCacheCap:2,videoFrames:sequence,captureFPS:50,seconds:sequence/50}));
