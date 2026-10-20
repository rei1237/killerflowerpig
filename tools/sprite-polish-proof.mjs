// Art-only comparison: draw authored pixels at native size and enlarged.
// Does not import or modify gameplay state. Uses the unchanged runtime phases.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { attackFrame } from '../src/game/attack-animation.js';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const [oldPath, newPath, output, family = 'cannon'] = process.argv.slice(2);
if (!oldPath || !newPath || !output) throw Error('Usage: old.png new.png output-folder [family]');
const oldArt = await loadImage(oldPath), newArt = await loadImage(newPath);
for (const art of [oldArt,newArt]) if (art.width !== 3072 || art.height !== 256) throw Error('Expected eight 384×256 cells');
fs.mkdirSync(output,{recursive:true});
const canvas = createCanvas(1000,640), ctx = canvas.getContext('2d');
const fps = 50, duration = 4;
function character(art,frame,x,y,scale) {
 ctx.drawImage(art,frame*384,0,384,256,x-192*scale,y-240*scale,384*scale,256*scale);
}
for(let i=0;i<fps*duration;i++) {
 const clock=i/fps, phase=clock%1, frame=phase<.55?0:attackFrame(phase-.55,family);
 ctx.fillStyle='#141c2a';ctx.fillRect(0,0,1000,640);
 ctx.textAlign='left';ctx.fillStyle='#f4d99e';ctx.font='bold 24px sans-serif';
 ctx.fillText(`${family.toUpperCase()} / AUTHORED EIGHT-POSE COMPARISON`,28,40);
 ctx.font='15px sans-serif';ctx.fillStyle='#b7c7db';
 ctx.fillText('Real attack-frame cadence • native 0.24 scale below • enlarged pixels above',28,68);
 for(const [art,x,label] of [[oldArt,250,'PREVIOUS'],[newArt,750,'REDRAWN']]) {
  ctx.strokeStyle='#34475c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-190,414);ctx.lineTo(x+190,414);ctx.stroke();
  character(art,frame,x,414,1.35);character(art,frame,x,560,.24);
  ctx.textAlign='center';ctx.fillStyle='#d8e4ee';ctx.font='bold 18px sans-serif';ctx.fillText(label,x,460);
  ctx.font='13px sans-serif';ctx.fillStyle='#8fa9be';ctx.fillText(`frame ${frame} / 7`,x,600);
 }
 fs.writeFileSync(path.join(output,`${String(i).padStart(4,'0')}.jpg`),canvas.toBuffer('image/jpeg',90));
}
const contact=createCanvas(1536,620), cc=contact.getContext('2d');
cc.fillStyle='#141c2a';cc.fillRect(0,0,1536,620);
for(let f=0;f<8;f++){
 const x=(f%4)*384,y=Math.floor(f/4)*310;
 cc.drawImage(newArt,f*384,0,384,256,x,y+30,384,256);
 cc.font='16px sans-serif';cc.fillStyle='#e9d5ad';cc.fillText(`POSE ${f}`,x+16,y+20);
}
fs.writeFileSync(path.join(output,'contact.png'),contact.toBuffer('image/png'));
console.log(JSON.stringify({frames:fps*duration,fps,duration,oldPath,newPath,family}));
