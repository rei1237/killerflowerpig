import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window={matchMedia:()=>({matches:false})};
const {images,atlases}=await import('../src/core/assets.js');
const {drawAppearance,APPEARANCE_LAYOUT}=await import('../src/game/player-appearance.js');
const {FIRING_SPRITE,PLAYER_HIT_RADIUS,firingMuzzle}=await import('../src/game/player-motion.js');
function context(){const calls=[];const c={calls};for(const n of ['save','restore','translate','scale','drawImage','beginPath','ellipse','stroke','fill','moveTo','lineTo','quadraticCurveTo','closePath','rotate'])c[n]=(...a)=>calls.push([n,...a]);return c;}
test('shared renderer follows firing frame, locked facing, foot and movement bob without mutation',()=>{
 images.playerFire={id:'player'};images.playerFireFlash={id:'flash'};
 for(const id of Object.keys(APPEARANCE_LAYOUT))images[`cosmetic_${id}`]={id};
 const p={shotAt:2,shotFlip:true,flip:false,vx:100,vy:0,hp:33,radius:10,anim:2};const before=structuredClone(p);
 const appearance={outfit:'jade_lotus_guard',ornament:'dawn_petal_halo'},ctx=context();
 assert.equal(drawAppearance(ctx,{x:30,y:40,clock:2.075,player:p,appearance}),true);
 assert.ok(ctx.calls.some(c=>c[0]==='scale'&&c[1]===-1));
 const drawn=ctx.calls.filter(c=>c[0]==='drawImage');
 assert.deepEqual(drawn.map(c=>c[1].id),['dawn_petal_halo','player','jade_lotus_guard']);
 assert.equal(drawn[1][2],2*384);assert.deepEqual(p,before);assert.equal(PLAYER_HIT_RADIUS,10);
 assert.equal(FIRING_SPRITE.anchorX,192);assert.equal(FIRING_SPRITE.anchorY,240);
 assert.equal(firingMuzzle({...p,x:0,y:0},2.075,1).x,28.799999999999997);
});
test('live draw and preview share code; optional asset failures retain equipment silhouette',()=>{
 assert.match(fs.readFileSync(new URL('../src/game/player.js',import.meta.url),'utf8'),/drawAppearance\(ctx/);
 const id='dusk_lotus_cape';delete images[`cosmetic_${id}`];const ctx=context();
 drawAppearance(ctx,{appearance:{outfit:id},player:{}});
 assert.ok(ctx.calls.some(c=>c[0]==='fill'));assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,1);
});
test('unrecognized or wrongly slotted appearances cannot render; missing player returns safely',()=>{
 const ctx=context();drawAppearance(ctx,{appearance:{ornament:'jade_lotus_guard',outfit:'bogus'}});
 assert.equal(ctx.calls.filter(c=>c[0]==='drawImage').length,1);
 delete images.playerFire;delete atlases.player;assert.equal(drawAppearance(context()),false);
});
