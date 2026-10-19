import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { petAnimation,petSpriteRect,petVisualLimits,validatePetSprite,installPetSprite } from '../src/game/pet-sprite.js';
import { SPRITES } from '../src/data/sprites.js';
const meta={frameWidth:100,frameHeight:100,columns:4,rows:2,anchor:{x:50,y:95},animations:{idle:[0,1],follow:[2,3],attack:[4,5],heal:[6,7]}};
const state={animClock:0,moving:false,attackElapsed:99,healElapsed:99};
test('idle, follow, attack and heal select actual two-frame sequences on simulation time',()=>{
 const frame=s=>petSpriteRect(meta,{...state,...s}).frame;
 assert.equal(frame({animClock:0}),0);assert.equal(frame({animClock:.31}),1);
 assert.equal(frame({moving:true,animClock:0}),2);assert.equal(frame({moving:true,animClock:.13}),3);
 assert.equal(frame({attackElapsed:0}),4);assert.equal(frame({attackElapsed:.1}),5);assert.equal(frame({attackElapsed:.18}),0);
 assert.equal(frame({healElapsed:0}),6);assert.equal(frame({healElapsed:.26}),7);assert.equal(frame({healElapsed:.5}),0);
 assert.equal(petAnimation({...state,attackElapsed:0,healElapsed:0}).name,'attack');
});
test('all complete frame bounds, including wings and hat, fit below65percent of player silhouette',()=>{
 // Player firing PNG alpha bounds measured across all four frames at runtime scale .24.
 const firingMinimum={width:65.76,height:55.2};
 const legacyMinimum={width:Math.min(...SPRITES.player.anims.walk.map(f=>f.sw))*.48,height:Math.min(...SPRITES.player.anims.walk.map(f=>f.sh))*.48};
 for(const [firing,player] of [[true,firingMinimum],[false,legacyMinimum]]){
  const limit=petVisualLimits(firing);assert.ok(limit.width<=player.width*.65);assert.ok(limit.height<=player.height*.65);
  for(const shape of [[100,100],[200,100],[100,200]]){
   const m={...meta,frameWidth:shape[0],frameHeight:shape[1],anchor:{x:shape[0]/2,y:shape[1]}};
   const rect=petSpriteRect(m,state,firing).args;assert.ok(rect[6]<=limit.width);assert.ok(rect[7]<=limit.height);
  }
 }
});
test('source cells and feet anchors stay fixed when animation changes',()=>{
 const idle=petSpriteRect(meta,state),heal=petSpriteRect(meta,{...state,healElapsed:.3});
 assert.deepEqual(idle.args.slice(4),heal.args.slice(4));assert.deepEqual(heal.args.slice(0,4),[300,100,100,100]);
 assert.throws(()=>validatePetSprite({...meta,anchor:{x:150,y:95}}));
 assert.throws(()=>validatePetSprite({...meta,animations:{...meta.animations,heal:[8,9]}}));
 assert.throws(()=>installPetSprite({naturalWidth:1,naturalHeight:1},meta));
});
test('runtime attack and heal frames follow real companion actions without changing power',async()=>{
 globalThis.window={matchMedia:()=>({matches:false})};
 const {G,clearWorld,configureCaps}=await import('../src/game/state.js');const {save}=await import('../src/core/save.js');
 const {updatePets,drawPets,resetPets,PET_POWER}=await import('../src/game/pets.js');const {images}=await import('../src/core/assets.js');
 const image={naturalWidth:400,naturalHeight:200,complete:true};installPetSprite(image,meta);images.playerFire={};
 configureCaps();clearWorld();resetPets();save.inventory=['pet_yeongnyang'];save.equippedPet='pet_yeongnyang';G.level=1;G.damageBy={};
 G.player={x:0,y:0,vx:0,vy:0,hp:50,maxHp:100,flip:false,dead:false,stats:{might:1,crit:0}};
 const calls=[];const ctx=new Proxy({drawImage(...args){calls.push(args);}}, {get:(o,k)=>k in o?o[k]:(()=>{})});
 const e=G.enemies.spawn();Object.assign(e,{alive:true,x:0,y:0,hp:1000,maxHp:1000,radius:8,slow:0});
 updatePets(.7);drawPets(ctx);assert.deepEqual(calls.at(-1).slice(1,3),[0,100]);const hp=e.hp;
 updatePets(.1);drawPets(ctx);assert.deepEqual(calls.at(-1).slice(1,3),[100,100]);assert.equal(e.hp,hp);
 G.enemies.clear();updatePets(5.3);drawPets(ctx);assert.deepEqual(calls.at(-1).slice(1,3),[200,100]);assert.equal(G.player.hp,53);
 const pausedDraw=calls.at(-1);drawPets(ctx);assert.deepEqual(calls.at(-1),pausedDraw);
 assert.equal(PET_POWER.cooldown,.9);assert.equal(PET_POWER.healInterval,6);assert.equal(PET_POWER.targets,3);
});

test('shipped winged atlas matches exact source rectangles and every measured silhouette fits',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../asset/sprites/pet-yeongnyang.json',import.meta.url),'utf8'));
 const webp=fs.readFileSync(new URL('../asset/sprites/pet-yeongnyang.webp',import.meta.url));
 validatePetSprite(m);assert.equal(webp.toString('ascii',8,12),'WEBP');assert.equal(webp.toString('ascii',12,16),'VP8X');
 assert.equal(webp.readUIntLE(24,3)+1,m.sheetWidth);assert.equal(webp.readUIntLE(27,3)+1,m.sheetHeight);assert.ok(webp[20]&16);
 assert.equal(m.frames.length,8);assert.equal(new Set(m.frames.map(f=>f.source.join(','))).size,8);
 for(const [name,frames] of Object.entries(m.animations))for(let i=0;i<frames.length;i++){
  const clock=name==='idle'?i*.31:name==='follow'?i*.13:0;
  const s={...state,animClock:clock,moving:name==='follow',attackElapsed:name==='attack'?i*.1:99,healElapsed:name==='heal'?i*.26:99};
  const rect=petSpriteRect(m,s).args,bbox=m.frames[frames[i]].alphaBBox,scale=rect[6]/rect[2];
  assert.ok((bbox[2]-bbox[0])*scale<=65.76*.65);assert.ok((bbox[3]-bbox[1])*scale<=55.2*.65);
  assert.deepEqual(rect.slice(0,4),m.frames[frames[i]].source);
 }
});
