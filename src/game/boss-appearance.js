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

// Genuine pose atlas: each cell contains a separately drawn body pose.
// Coordinates are source-pixel coordinates, with a consistent ground anchor.
const SHEET_BODY_HEIGHTS = [0,188,187,169,182,175,202,173,203,185,188];
export const BOSS_SHEETS = Object.freeze(Array.from({length:11},(_,stage)=>stage ? Object.freeze({
 src:`asset/boss-animations/boss-${String(stage).padStart(2,'0')}.webp`,
 width:1024,height:512,columns:4,cellWidth:256,cellHeight:256,anchorX:128,footY:240,bodyHeight:SHEET_BODY_HEIGHTS[stage],
}) : null));
export const BOSS_FRAMES = Object.freeze({walkA:0,walkB:1,windup:2,attack:3,recover:4,hurt:5,deathA:6,deathB:7});

export function initBossMotion(boss) {
 boss.motionState='walk';boss.motionT=0;boss.motionDuration=Infinity;
 boss.walkT=0;boss.hurtT=0;boss.hurtCooldown=0;
}

export function setBossMotion(boss,state,duration=Infinity) {
 if(!boss.alive && state!=='dead')return;
 boss.motionState=state;boss.motionT=0;boss.motionDuration=duration;
}

export function hitBossMotion(boss) {
 if(!boss.alive || boss.hurtCooldown>0)return;
 boss.hurtT=.11;boss.hurtCooldown=.32;
}

export function recoverBossMotion(boss) {
 // Keep the release frame visible when the last volley also ends its task.
 if(boss.motionState==='attack' && Number.isFinite(boss.motionDuration))return;
 setBossMotion(boss,'recover',.18);
}

export function updateBossMotion(boss,dt) {
 if(!(dt>0))return;
 boss.walkT+=dt;
 boss.hurtT=Math.max(0,boss.hurtT-dt);
 boss.hurtCooldown=Math.max(0,boss.hurtCooldown-dt);
 boss.motionT+=dt;
 // Timers advance only from Boss.update, which the simulation pauses during
 // pause menus and hitstop. Drawing is pure and never advances animation.
 while(Number.isFinite(boss.motionDuration) && boss.motionT>=boss.motionDuration) {
  const overflow=boss.motionT-boss.motionDuration;
  if(boss.motionState==='attack')setBossMotion(boss,'recover',.12);
  else if(boss.motionState==='recover')setBossMotion(boss,boss.task?'windup':'walk');
  else break;
  boss.motionT=overflow;
 }
}

export function bossSpriteFrame(boss) {
 if(!boss.alive)return boss.deadT<.24 ? BOSS_FRAMES.deathA : BOSS_FRAMES.deathB;
 // Damage never obscures a live telegraph or an attack's release frame.
 if(boss.motionState==='windup')return BOSS_FRAMES.windup;
 if(boss.motionState==='attack')return BOSS_FRAMES.attack;
 if(boss.hurtT>0)return BOSS_FRAMES.hurt;
 if(boss.motionState==='recover')return BOSS_FRAMES.recover;
 return Math.floor((boss.walkT||0)/.17)%2 ? BOSS_FRAMES.walkB : BOSS_FRAMES.walkA;
}

export function drawBossSpriteSheet(ctx,boss,image) {
 const meta=BOSS_SHEETS[boss.stage];
 if(!meta || !image || image.width!==meta.width || image.height!==meta.height)return false;
 const frame=bossSpriteFrame(boss),scale=boss.radius*3.2/meta.bodyHeight;
 const sx=frame%meta.columns*meta.cellWidth,sy=Math.floor(frame/meta.columns)*meta.cellHeight;
 ctx.save();ctx.translate(boss.x,boss.y);ctx.scale(boss.flip?-1:1,1);
 // Nine-argument drawImage selects the real frame; no static-image bob/squash.
 ctx.drawImage(image,sx,sy,meta.cellWidth,meta.cellHeight,-meta.anchorX*scale,-meta.footY*scale,meta.cellWidth*scale,meta.cellHeight*scale);
 ctx.restore();
 if(boss.alive){
  ctx.save();ctx.strokeStyle=boss.flash>0?'#fff3cf':'#d6b879';
  ctx.globalAlpha*=boss.flash>0?.85:.32;ctx.lineWidth=boss.flash>0?2:1;
  ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(boss.x,boss.y-boss.radius,boss.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 return true;
}
