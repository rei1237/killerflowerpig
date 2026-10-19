// Single-frame full-body artwork, never interpreted as atlas frames.
// Normalized alpha bounds keep feet anchored despite different source dimensions.
export const BOSS_ART = Object.freeze([
 null,
 {anchorX:252.5,footY:512,height:512}, {anchorX:269,footY:506,height:506},
 {anchorX:252.5,footY:508,height:502}, {anchorX:256,footY:507,height:501},
 {anchorX:256,footY:498,height:491}, {anchorX:253,footY:512,height:512},
 {anchorX:259.5,footY:512,height:512}, {anchorX:250.5,footY:505,height:505},
 {anchorX:256,footY:512,height:512}, {anchorX:170.5,footY:512,height:512},
].map((meta,stage)=>meta && Object.freeze({...meta,src:`asset/bosses/boss-${String(stage).padStart(2,'0')}.webp`})));

export function bossArtPose(boss,clock) {
 const dead= Math.min(1,Math.max(0,(boss.deadT||0)/.65));
 const attacking=boss.alive && boss.state==='attack';
 const phase=attacking ? Math.min(1,Math.max(0,((boss.anim||0)*.09+(boss.animT||0))/.5)) : 0;
 const pulse=Math.sin(phase*Math.PI);
 // The animation clock freezes with the simulation. No renderer state or hitbox mutation.
 return {scaleX:1+pulse*.055,scaleY:boss.alive?1-pulse*.06+Math.sin(clock*4+boss.stage)*.012:1-dead*.72,
  tilt:boss.alive?Math.sin(clock*3+boss.stage)*.012+pulse*.035:dead*.12,
  rise:boss.alive&&boss.stage===8 ? 1+Math.sin(clock*3)*1.1 : 0};
}

export function drawBossArtwork(ctx,boss,clock,image) {
 const meta=BOSS_ART[boss.stage];
 if(!meta||!image||!(image.width>0)||!(image.height>0))return false;
 const pose=bossArtPose(boss,clock),scale=boss.radius*3.2/meta.height;
 ctx.save();
 ctx.translate(boss.x,boss.y-pose.rise);
 ctx.scale(boss.flip?-1:1,1);
 ctx.rotate(pose.tilt);
 ctx.scale(pose.scaleX,pose.scaleY);
 // Five-argument drawImage draws the complete image, including transparent margins.
 ctx.drawImage(image,-meta.anchorX*scale,-meta.footY*scale,image.width*scale,image.height*scale);
 ctx.restore();
 if(boss.alive){
  // Same center/radius used by weapon projectile tests; ornaments do not enlarge it.
  ctx.save();ctx.strokeStyle=boss.flash>0?'#fff3cf':'#d6b879';
  ctx.globalAlpha*=boss.flash>0?.85:.32;ctx.lineWidth=boss.flash>0?2:1;
  ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(boss.x,boss.y-boss.radius,boss.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 return true;
}
