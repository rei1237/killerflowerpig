// Per-boss animated costume signatures, independent of collisions and attack timing.
// Existing walk/attack/death atlases remain intact; static dossier art is UI-only.
export const BOSS_SIGNATURES = Object.freeze([
 null,
 {color:'#a68669',kind:'scar'}, {color:'#9caab4',kind:'armor'},
 {color:'#727f9f',kind:'hood'}, {color:'#789b83',kind:'rifle'},
 {color:'#bd945f',kind:'shield'}, {color:'#7cb98a',kind:'tanks'},
 {color:'#bf8bc3',kind:'blades'}, {color:'#b69fe0',kind:'orbit'},
 {color:'#bca56e',kind:'hammer'}, {color:'#c3a4df',kind:'hourglass'},
]);
export function drawBossSignature(ctx,boss,clock,front=false) {
 if(!boss.alive)return;
 const sig=BOSS_SIGNATURES[boss.stage];if(!sig)return;
 const h=boss.atlas.walkH*boss.scale;
 const bob=Math.sin(clock*5+boss.stage)*1.5;
 ctx.save();ctx.translate(boss.x,boss.y-h*.44+bob);
 ctx.scale(boss.flip?-1:1,1);ctx.strokeStyle=sig.color;ctx.fillStyle=sig.color;
 ctx.lineWidth=Math.max(2,h*.025);ctx.globalAlpha*=.85;
 const line=(x,y,a,b)=>{ctx.beginPath();ctx.moveTo(x*h,y*h);ctx.lineTo(a*h,b*h);ctx.stroke();};
 const rect=(x,y,w,z)=>ctx.fillRect(x*h,y*h,w*h,z*h);
 if(!front){
  if(['hood','hourglass','blades'].includes(sig.kind)){
   ctx.fillStyle=sig.kind==='hourglass'?'#493260':'#29313f';
   ctx.beginPath();ctx.moveTo(-h*.17,-h*.25);ctx.lineTo(h*.2,-h*.25);
   ctx.lineTo(h*.36,h*.4);ctx.lineTo(-h*.33,h*.35);ctx.closePath();ctx.fill();
  }
  if(sig.kind==='armor'){rect(-.34,-.17,.17,.2);rect(.18,-.17,.17,.2);}
  if(sig.kind==='tanks'){rect(-.3,-.25,.14,.47);rect(.18,-.25,.14,.47);}
  if(sig.kind==='orbit'){
   for(let i=0;i<5;i++){const a=clock*.7+i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*h*.4,Math.sin(a)*h*.25-h*.08,3,0,Math.PI*2);ctx.fill();}
  }
 } else {
  switch(sig.kind){
   case 'scar':line(-.08,-.27,.08,-.1);break;
   case 'armor':rect(-.16,.01,.3,.035);break;
   case 'hood':line(-.16,-.22,0,-.42);line(0,-.42,.16,-.22);break;
   case 'rifle':line(.03,.1,.52,-.04);rect(.37,-.08,.18,.05);break;
   case 'shield':ctx.fillStyle='#333a3e';ctx.fillRect(h*.13,-h*.13,h*.27,h*.46);ctx.strokeRect(h*.13,-h*.13,h*.27,h*.46);break;
   case 'tanks':line(-.2,.1,.17,.2);break;
   case 'blades':line(-.18,.2,-.4,-.12);line(.2,.2,.42,-.12);break;
   case 'orbit':ctx.beginPath();ctx.arc(0,-h*.12,h*.1,0,Math.PI*2);ctx.stroke();break;
   case 'hammer':line(.22,.3,.3,-.28);rect(.16,-.34,.3,.15);break;
   case 'hourglass':
    ctx.strokeRect(-h*.055,-h*.04,h*.11,h*.17);
    line(-.045,-.025,.045,.115);line(.045,-.025,-.045,.115);
    ctx.fillStyle='#e4a5c5';rect(-.03,.08,.06,.025);break;
  }
 }
 ctx.restore();
}
