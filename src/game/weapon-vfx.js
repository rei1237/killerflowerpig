// Render-only weapon identities. No new projectiles, damage, timers or particles.
import { glow, fx } from '../core/assets.js';
import { settings } from '../core/settings.js';

export const WEAPON_VFX = Object.freeze({
 shotgun:{color:'#efb16e',light:'#fff0cf',trail:16,shape:'pellet'},
 pistols:{color:'#f6d679',light:'#fff7dc',trail:23,shape:'round'},
 rifle:{color:'#8ecde7',light:'#edfaff',trail:45,shape:'rail'},
 cannon:{color:'#ed75ad',light:'#ffe7f4',accent:'#bc91e8',shape:'petal'},
 thorns:{color:'#dc79ad',light:'#ffdae9',shape:'petal'},
 molotov:{color:'#f5a34f',light:'#ffe7b2',shape:'ember'},
 gas:{color:'#61c7ad',light:'#d3ffe5',shape:'gas'},
 saw:{color:'#dac9a9',light:'#fff2ce',shape:'blade'},
 absolute_bloom:{color:'#f7d58f',light:'#fff6df',accent:'#d7a5f5',shape:'absolute'},
 lotus_bloom:{color:'#d994e5',light:'#fff0fc',accent:'#ed86b5',shape:'lotus'},
 scatter_rail:{color:'#75c9ed',light:'#e0f6ff',trail:42,shape:'split'},
 plague_fire:{color:'#a9cf75',light:'#f5f5b1',accent:'#f0ae69',shape:'plague'},
 burst_rail:{color:'#b8a2ed',light:'#f5edff',trail:40,shape:'burst'},
 venom_saw:{color:'#65d3bd',light:'#ddfff3',accent:'#b296e3',shape:'venom'},
 ember_lance:{color:'#efa775',light:'#fff3d8',accent:'#ed778c',shape:'ember'},
 orbit_saw:{color:'#dea87f',light:'#ffe8d2',accent:'#e78db6',shape:'orbit'},
 toxic_scatter:{color:'#74ccb2',light:'#e6ffeb',trail:21,shape:'toxic'},
});
for(const value of Object.values(WEAPON_VFX))Object.freeze(value);
// 진화 후 외형이 크게 바뀌는 무기 (처형인의 쌍권총: 진홍 잔광 탄환)
export const EVOLVED_VFX = Object.freeze({ pistols: Object.freeze({color:'#ff3b5c',light:'#ffe6a8',trail:46,shape:'execution'}) });
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const TAU=Math.PI*2;
const FUSIONS=new Set(['absolute_bloom','lotus_bloom','scatter_rail','plague_fire','burst_rail','venom_saw','ember_lance','orbit_saw','toxic_scatter']);
// Actual hit events only. One weak entry per pooled object, guarded by spawn ID.
// This metadata never applies damage, extends slow, or creates world residues.
const fusionHits=new WeakMap();
let lastFusionHitAt=-Infinity;
export function recordFusionHit(target,weapon,now,slow=0) {
 if(!target||!FUSIONS.has(weapon))return;
 let hit=fusionHits.get(target);
 if(!hit||hit.id!==target.id)hit={id:target.id};
 hit.weapon=weapon;hit.at=now;
 if(slow>0){hit.slowWeapon=weapon;hit.slowUntil=now+.5;}
 fusionHits.set(target,hit);
 lastFusionHitAt=now;
}
export function createWeaponVfxFrame(lowQ,clock,visuals) {
 return {motion:settings.flash&&!motionPreference?.matches,clock,lowQ,glow:visuals?.projectileGlow!==false,beamReserve:lowQ?4:8,
  detailLeft:lowQ?24:72,petalLeft:lowQ?10:32,impactLeft:lowQ?3:8,scanLeft:lowQ?96:256,
  fieldLeft:lowQ?3:8,fieldScanLeft:lowQ?32:64,fieldsUsed:0,statusUsed:0,
  detailsUsed:0,petalsUsed:0,impactsUsed:0};
}
function detail(frame,beam=false) {if(frame.detailLeft<=0||(!beam&&frame.detailLeft<=frame.beamReserve))return false;if(beam)frame.beamReserve=Math.max(0,frame.beamReserve-1);frame.detailLeft--;frame.detailsUsed++;return true;}
function petal(ctx,x,y,size,angle,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,size,size*.38,angle,0,TAU);ctx.fill();}
function segment(ctx,x0,y0,x1,y1,color,width,alpha){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
export function weaponVfxProfile(id){return WEAPON_VFX[id]||WEAPON_VFX.pistols;}

export function drawWeaponProjectile(ctx,sh,frame) {
 const style=(sh.evolved&&EVOLVED_VFX[sh.weapon])||weaponVfxProfile(sh.weapon),decor=detail(frame);
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
 if(sh.kind==='lob'){
  if(decor&&frame.motion){
   const k=Math.max(0,Math.min(1,(sh.t-.065)/sh.dur));
   const x=sh.sx+(sh.tx-sh.sx)*k,y=sh.sy+(sh.ty-sh.sy)*k-Math.sin(k*Math.PI)*70;
   segment(ctx,x,y,sh.x,sh.y,style.color,3,.28);
  }
  ctx.translate(sh.x,sh.y);ctx.rotate(frame.motion?(sh.spin||0):-.25);
  // Cut-glass flask / canister silhouettes instead of an emoji bomb.
  ctx.globalAlpha=.86;ctx.fillStyle='#172b38';ctx.strokeStyle=style.light;ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(-5.5,-7,11,15,3);ctx.fill();ctx.stroke();
  ctx.globalAlpha=.72;ctx.fillStyle=style.color;ctx.fillRect(-3.5,-1,7,7);
  ctx.globalAlpha=.9;ctx.fillStyle=style.light;ctx.fillRect(-2.5,-11,5,4);
  if(decor){
   ctx.globalAlpha=.7;
   if(style.shape==='gas') {ctx.beginPath();ctx.arc(0,1,2,0,TAU);ctx.stroke();}
   else{petal(ctx,0,-13,4.5,-1.15,style.accent||style.color);petal(ctx,0,-13,2,-1.15,style.light);}
   if(style.shape==='plague'){ctx.strokeStyle=style.color;ctx.beginPath();ctx.arc(-1,1,2,0,TAU);ctx.stroke();}
   if(sh.weapon==='ember_lance'){petal(ctx,-4,0,3.5,-.7,style.accent);petal(ctx,4,0,3.5,.7,style.accent);}
  }
 }else if(sh.kind==='saw'){
  const size=sh.radius*2.4;
  ctx.translate(sh.x,sh.y);ctx.rotate(frame.motion?(sh.spin||0):0);
  ctx.globalAlpha=.94;if(sh.img)ctx.drawImage(sh.img,-size/2,-size/2,size,size);
  ctx.strokeStyle=style.color;ctx.lineWidth=1.3;ctx.globalAlpha=.7;
  ctx.beginPath();ctx.arc(0,0,sh.radius*.64,0,TAU);ctx.stroke();
  if(decor){
   ctx.globalAlpha=.45;ctx.strokeStyle=style.accent||style.light;ctx.lineWidth=2;
   for(let n=0;n<2;n++){ctx.beginPath();ctx.arc(0,0,sh.radius*1.03,n*Math.PI,n*Math.PI+1.1);ctx.stroke();}
   if(style.shape==='venom'){
    ctx.fillStyle=style.color;ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();
   }else if(style.shape==='orbit'){
    ctx.globalAlpha=.8;for(let n=0;n<3;n++)petal(ctx,0,0,sh.radius*.55,n*TAU/3,style.accent);
   }
  }
 }else{
  const img=sh.img,w=(img?.width||18)*(sh.radius/5),h=(img?.height||10)*(sh.radius/5);
  ctx.translate(sh.x,sh.y);ctx.rotate(sh.angle||0);
  if(decor){
   const length=(style.trail||20)*Math.min(1.4,sh.radius/5);
   ctx.globalAlpha=.25;ctx.fillStyle=style.color;
   ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(-w*.15,-Math.min(3,h*.24));ctx.lineTo(w*.35,0);ctx.lineTo(-w*.15,Math.min(3,h*.24));ctx.closePath();ctx.fill();
   if(style.shape==='split'){
    segment(ctx,-length*.7,-2,-2,-2,style.color,1,.5);segment(ctx,-length*.7,2,-2,2,style.color,1,.5);
    segment(ctx,-length*.5,-3,-length*.35,0,style.light,1,.7);segment(ctx,-length*.5,3,-length*.35,0,style.light,1,.7);
   }else if(style.shape==='burst'){
    for(let n=1;n<=3;n++)segment(ctx,-n*length*.25-3,0,-n*length*.25+2,0,style.light,2,.65);
   }else if(style.shape==='toxic'){ctx.globalAlpha=.7;petal(ctx,-length*.6,0,3.5,0,style.color);}
   else if(style.shape==='execution'){
    // 진홍 잔광 + 금빛 탄심 + 십자 섬광
    segment(ctx,-length,0,-2,0,style.color,4,.55);segment(ctx,-length*.6,0,0,0,style.light,1.5,.85);
    ctx.globalAlpha=.9;ctx.fillStyle=style.color;ctx.beginPath();ctx.moveTo(w*.55,0);ctx.lineTo(0,-4);ctx.lineTo(-3,0);ctx.lineTo(0,4);ctx.closePath();ctx.fill();
    segment(ctx,w*.2,-5,w*.2,5,style.light,1,.8);
   }
  }
  ctx.globalAlpha=.95;if(img)ctx.drawImage(img,-w/2,-h/2,w,h);
  // A small colored inlay preserves fusion identity even after the VFX budget.
  segment(ctx,-w*.22,0,w*.28,0,style.color,Math.min(3,sh.radius*.55),.85);
  segment(ctx,0,0,w*.3,0,style.light,1,.9);
 }
 ctx.restore();
}

export function drawWeaponOrbit(ctx,w,s,p,frame) {
 const style=weaponVfxProfile(w.id),n=s.amount,R=s.radius*s.area,size=26*s.area;
 const img=w.id==='orbit_saw'?fx.saw:(w.evolved?fx.petalBlood:fx.petal);
 for(let i=0;i<n;i++){
  const a=w.angle+(i/n)*Math.PI*2,ox=p.x+Math.cos(a)*R,oy=p.y-20+Math.sin(a)*R*.8;
  ctx.save();ctx.globalCompositeOperation='source-over';
  if(detail(frame)){
   ctx.globalAlpha=.25;ctx.strokeStyle=style.accent||style.color;ctx.lineWidth=2;
   ctx.beginPath();ctx.ellipse(p.x,p.y-20,R,R*.8,0,a-.42,a);ctx.stroke();
   if(w.id==='orbit_saw'){
    ctx.globalAlpha=.7;for(let n=0;n<3;n++)petal(ctx,ox,oy,size*.3,n*TAU/3+a,style.accent);
   }
  }
  ctx.translate(ox,oy);ctx.rotate(frame.motion?a*2:a);ctx.globalAlpha=.95;
  if(img)ctx.drawImage(img,-size/2,-size/2,size,size);
  ctx.globalAlpha=.7;petal(ctx,0,0,size*.12,.5,style.light);ctx.restore();
 }
}

export function drawWeaponBeam(ctx,b,frame) {
 const style=weaponVfxProfile(b.weapon),k=Math.max(0,Math.min(1,b.life/b.max));
 if(!k)return;
 const width=b.width*(.6+.4*k),decor=detail(frame,true),time=frame.motion?frame.clock:0;
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
 // Translucent tapered layers stay inside the real beam width and length.
 ctx.globalAlpha=k*.18;ctx.fillStyle=style.color;
 ctx.beginPath();ctx.moveTo(0,-width*.48);ctx.lineTo(b.len*.93,-width*.22);ctx.lineTo(b.len,0);ctx.lineTo(b.len*.93,width*.22);ctx.lineTo(0,width*.48);ctx.closePath();ctx.fill();
 ctx.globalAlpha=k*.23;ctx.fillStyle=style.accent||style.color;
 ctx.beginPath();ctx.moveTo(0,-width*.25);ctx.lineTo(b.len,0);ctx.lineTo(0,width*.25);ctx.closePath();ctx.fill();
 segment(ctx,0,0,b.len,0,style.light,Math.max(1,width*.055),k*.8);
 if(decor){
  segment(ctx,0,-width*.24,b.len*.95,-width*.09,style.color,1,k*.55);
  segment(ctx,0,width*.24,b.len*.95,width*.09,style.color,1,k*.55);
  if(frame.glow){
   const g=glow(style.color,32),r=Math.min(34,width*.72);
   ctx.globalAlpha=k*.48;ctx.drawImage(g,-r,-r,r*2,r*2);
  }
  // No fake impacts at the beam end. Petals decorate the light path only.
  const count=Math.min(frame.petalLeft,frame.lowQ?3:8);frame.petalLeft-=count;frame.petalsUsed+=count;
  const bloom=Math.min(count,style.shape==='absolute'?6:style.shape==='lotus'?4:style.shape==='petal'?3:0);
  for(let i=0;i<count;i++){
   ctx.globalAlpha=k*(.42+(i%2)*.17);
   if(i<bloom){
    const a=i/Math.max(1,bloom)*TAU+time*.2,r=width*.17;
    petal(ctx,Math.cos(a)*r,Math.sin(a)*r,Math.min(6,width*.16),a,i%2?style.light:style.color);
   }else{
    const phase=((i-bloom+.4)/Math.max(1,count-bloom)+(time*.32)%1)%1;
    const x=Math.min(b.len-5,Math.max(5,phase*b.len)),y=Math.sin(i*2.4+time*1.3)*width*.25;
    petal(ctx,x,y,style.shape==='ember'?4.5:3.5,i*.7+time*.35,i%2?style.light:style.color);
   }
  }
 }
 ctx.restore();
}

// Bounded read-only hit accents: only currently flashing, damaged targets
// geometrically inside a live beam qualify. No inferred endpoint explosion.
export function drawBeamHitAccents(ctx,beams,enemies,boss,frame) {
 if(!beams.count||!frame.impactLeft)return;
 const total=enemies.count+(boss?1:0),beamCount=Math.min(beams.count,8);
 for(let i=0;i<total&&frame.scanLeft>0&&frame.impactLeft>0;i++){
  frame.scanLeft--;const e=i===enemies.count?boss:enemies.items[i];
  if(!e||!(e.flash>0))continue;
  for(let j=0;j<beamCount;j++){
   const b=beams.items[j];if(!(b.life>0)||FUSIONS.has(b.weapon))continue;
   const dx=e.x-b.x,dy=e.y-e.radius-b.y,cx=Math.cos(b.angle),cy=Math.sin(b.angle),along=dx*cx+dy*cy;
   if(along<0||along>b.len||Math.abs(dx*cy-dy*cx)>=b.width/2+e.radius)continue;
   const style=weaponVfxProfile(b.weapon),r=Math.min(13,Math.max(5,e.radius*.65));
   ctx.save();ctx.translate(e.x,e.y-e.radius);ctx.globalCompositeOperation='source-over';
   ctx.globalAlpha=.65;ctx.strokeStyle=style.light;ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(-r*.35,0);ctx.moveTo(r*.35,0);ctx.lineTo(r,0);ctx.moveTo(0,-r);ctx.lineTo(0,-r*.35);ctx.moveTo(0,r*.35);ctx.lineTo(0,r);ctx.stroke();ctx.restore();
   frame.impactLeft--;frame.impactsUsed++;break;
  }
 }
}

// Ground accents attach only to existing live fields, with their exact ellipse.
// Ember's flask lands independently of its beam; never draw a false beam trail.
export function drawFusionResidues(ctx,hazards,frame,bounds) {
 for(let i=0;i<hazards.count&&frame.fieldScanLeft>0&&frame.fieldLeft>0;i++){
  frame.fieldScanLeft--;const h=hazards.items[i];
  if(!h.alive||h.kind!=='fire'||!['plague_fire','ember_lance'].includes(h.weapon)||h.t<0||h.t>=h.duration)continue;
  if(bounds&&(h.x+h.radius<bounds.x0||h.x-h.radius>bounds.x1||h.y+h.radius*.7<bounds.y0||h.y-h.radius*.7>bounds.y1))continue;
  if(!detail(frame))break;
  const style=weaponVfxProfile(h.weapon),alpha=Math.min(1,(h.duration-h.t)/.45),plague=h.weapon==='plague_fire';
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha*.7;ctx.strokeStyle=style.color;ctx.lineWidth=1.7;
  ctx.beginPath();ctx.ellipse(h.x,h.y,h.radius,h.radius*.7,0,0,TAU);ctx.stroke();
  const count=frame.lowQ?3:5,time=frame.motion?frame.clock:0;
  for(let n=0;n<count;n++){
   const a=n*TAU/count,x=h.x+Math.cos(a)*h.radius*.68,y=h.y+Math.sin(a)*h.radius*.46;
   ctx.globalAlpha=alpha*.65;petal(ctx,x,y,5,-1.2+Math.sin(time+n)*.08,style.accent||style.light);
   if(plague){ctx.strokeStyle=style.color;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x-3,y+3,2.5,0,TAU);ctx.stroke();}
  }
  ctx.restore();frame.fieldLeft--;frame.fieldsUsed++;
 }
}

export function drawFusionHitAccents(ctx,enemies,boss,frame,bounds) {
 if(frame.clock<lastFusionHitAt||frame.clock-lastFusionHitAt>.5)return;
 const total=enemies.count+(boss?1:0);
 for(let i=0;i<total&&frame.scanLeft>0&&frame.impactLeft>0;i++){
  frame.scanLeft--;const e=i===enemies.count?boss:enemies.items[i],hit=e&&fusionHits.get(e);
  if(!hit||hit.id!==e.id)continue;
  if(bounds&&(e.x<bounds.x0||e.x>bounds.x1||e.y<bounds.y0||e.y>bounds.y1))continue;
  const impact=e.flash>0&&frame.clock>=hit.at&&frame.clock-hit.at<.09;
  const slow=e.alive&&e.slow>0&&e.slowT>0&&frame.clock<hit.slowUntil;
  if(!impact&&!slow)continue;
  const style=weaponVfxProfile(slow?hit.slowWeapon:hit.weapon),r=Math.min(13,Math.max(6,e.radius*.6));
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.8;ctx.strokeStyle=style.light;ctx.lineWidth=1.4;
  if(impact){
   const y=e.y-e.radius;ctx.beginPath();
   for(let n=0;n<4;n++){const a=n*TAU/4+.35;ctx.moveTo(e.x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45);ctx.lineTo(e.x+Math.cos(a)*r,y+Math.sin(a)*r);}
   ctx.stroke();
  }
  if(slow){
   // Down chevrons at the feet communicate current slow, not poison damage.
   ctx.strokeStyle=style.color;ctx.lineWidth=1.8;ctx.beginPath();
   for(let n=0;n<2;n++){const y=e.y-5+n*5;ctx.moveTo(e.x-5,y-3);ctx.lineTo(e.x,y);ctx.lineTo(e.x+5,y-3);}ctx.stroke();frame.statusUsed++;
  }
  ctx.restore();frame.impactLeft--;frame.impactsUsed++;
 }
}
