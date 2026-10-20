import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window={matchMedia:()=>({matches:false})};
const {images,atlases}=await import('../src/core/assets.js');
const {drawAppearance,appearanceAssets,COSTUME_IDS}=await import('../src/game/player-appearance.js');
const {FIRING_SPRITE,PLAYER_HIT_RADIUS,firingMuzzle}=await import('../src/game/player-motion.js');
function context(){const calls=[];const c={calls};for(const n of ['save','restore','translate','scale','drawImage','beginPath','ellipse','stroke','fill','moveTo','lineTo','quadraticCurveTo','closePath','rotate'])c[n]=(...a)=>calls.push([n,...a]);return c;}
test('shared renderer follows firing frame, locked facing, foot and movement bob without mutation',()=>{
 images.playerFire={id:'player'};images.playerFireFlash={id:'flash'};
 images.playerHaloLayer={id:'halo'};images.costume_jade_lotus_guard_normal={id:'jade'};
 const p={shotAt:2,shotFlip:true,flip:false,vx:100,vy:0,hp:33,radius:10,anim:2};const before=structuredClone(p);
 const appearance={outfit:'jade_lotus_guard',ornament:'dawn_petal_halo'},ctx=context();
 assert.equal(drawAppearance(ctx,{x:30,y:40,clock:2.075,player:p,appearance}),true);
 assert.ok(ctx.calls.some(c=>c[0]==='scale'&&c[1]===-1));
 const drawn=ctx.calls.filter(c=>c[0]==='drawImage');
 assert.deepEqual(drawn.map(c=>c[1].id),['halo','jade']);
 assert.equal(drawn[1][2],2*384);assert.deepEqual(p,before);assert.equal(PLAYER_HIT_RADIUS,10);
 assert.equal(FIRING_SPRITE.anchorX,192);assert.equal(FIRING_SPRITE.anchorY,240);
 assert.equal(firingMuzzle({...p,x:0,y:0},2.075,1).x,28.799999999999997);
});
test('live draw and preview share code; missing costume art falls back to base without pasted icons',()=>{
 assert.match(fs.readFileSync(new URL('../src/game/player.js',import.meta.url),'utf8'),/drawAppearance\(ctx/);
 delete images.costume_dusk_lotus_cape_normal;const ctx=context();
 drawAppearance(ctx,{appearance:{outfit:'dusk_lotus_cape'},player:{}});
 assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 assert.deepEqual(appearanceAssets({outfit:'dusk_lotus_cape'},false).missing,['dusk_lotus_cape']);
 assert.ok(!ctx.calls.some(c=>c[0]==='fill'));
});
test('unrecognized or wrongly slotted appearances cannot render; missing player returns safely',()=>{
 const ctx=context();drawAppearance(ctx,{appearance:{ornament:'jade_lotus_guard',outfit:'bogus'}});
 assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 delete images.playerFire;delete atlases.player;assert.equal(drawAppearance(context()),false);
});
test('legendary ownership selects one complete firing sheet and keeps cosmetics layered; asset failure falls back',()=>{
 images.playerFire={id:'ordinary'};images.playerLotusFire={id:'lotus'};images.playerLotusFireFlash={id:'lotusFlash'};
 images.costume_jade_lotus_guard_lotus={id:'jadeLotus'};
 let ctx=context();drawAppearance(ctx,{lotusGun:true,clock:1,player:{shotAt:.98},appearance:{outfit:'jade_lotus_guard'}});
 let calls=ctx.calls.filter(c=>c[0]==='drawImage');assert.deepEqual(calls.map(c=>c[1].id),['jadeLotus']);assert.equal(calls[0][2],384);
 ctx=context();drawAppearance(ctx,{lotusGun:false,appearance:{}});assert.equal(ctx.calls.find(c=>c[0]==='drawImage')[1].id,'ordinary');
 ctx=context();drawAppearance(ctx,{lotusGun:true,tint:'flash',appearance:{}});assert.equal(ctx.calls.find(c=>c[0]==='drawImage')[1].id,'lotusFlash');
 delete images.playerLotusFire;ctx=context();drawAppearance(ctx,{lotusGun:true,appearance:{}});assert.equal(ctx.calls.find(c=>c[0]==='drawImage')[1].id,'ordinary');
 delete images.playerFire;delete images.playerLotusFireFlash;
});
test('all costume gun variants draw one body and never duplicate weapon, preserving firing frames and tint',()=>{
 for(const outfit of COSTUME_IDS)for(const variant of ['normal','lotus']){
  const key=`costume_${outfit}_${variant}`;images[key]={id:key};images[`${key}Flash`]={id:key+'Flash'};
  for(const elapsed of [1,.025,.075,.15]){
   const ctx=context();drawAppearance(ctx,{appearance:{outfit,ornament:'dawn_petal_halo'},lotusGun:variant==='lotus',clock:10,player:{shotAt:10-elapsed,shotFlip:true},tint:'flash'});
   const calls=ctx.calls.filter(c=>c[0]==='drawImage');assert.equal(calls.length,2);assert.equal(calls[0][1].id,'halo');assert.equal(calls[1][1].id,key+'Flash');assert.equal(calls[0][2],calls[1][2]);
  }
 }
});
