import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
const files = [];
for (const outfit of ['base','cape','jade']) {
  for (const family of ['dual','throw','cannon','sword','blade','channel','fire-move','dual-move','throw-move','cannon-move','sword-move']) files.push(`player-${outfit}-${family}.png`);
  files.push(outfit==='base'?'player-fire.png':`player-${outfit}-fire.png`);
  files.push(outfit==='base'?'player-lotus-fire.png':`player-${outfit}-lotus-fire.png`);
}
test('all 39 role/outfit atlases retain eight distinct transparent fixed-size frames', async () => {
  assert.equal(new Set(files).size,39);
  let bytes=0;
  for (const file of files) {
    const data=fs.readFileSync(new URL(`../asset/sprites/${file}`,import.meta.url)); bytes+=data.length;
    const img=await loadImage(data);
    assert.equal(img.width,3072,file);assert.equal(img.height,256,file);
    const canvas=createCanvas(384,256),ctx=canvas.getContext('2d'),hashes=new Set();
    for(let f=0;f<8;f++) {
      ctx.clearRect(0,0,384,256);ctx.drawImage(img,f*384,0,384,256,0,0,384,256);
      const pixels=ctx.getImageData(0,0,384,256).data;
      hashes.add(createHash('sha256').update(pixels).digest('hex'));
      let visible=0;
      for(let y=0;y<256;y++)for(let x=0;x<384;x++) {
        const alpha=pixels[(y*384+x)*4+3];if(alpha>16)visible++;
        if(x===0||x===383||y===0||y===255)assert.ok(alpha<=16,`${file} frame ${f} clipped at ${x},${y}`);
      }
      assert.ok(visible>1000,`${file} frame ${f} empty`);
    }
    assert.equal(hashes.size,8,`${file} duplicated frame`);
  }
  assert.ok(bytes<32*1024*1024,`compressed sprite budget: ${bytes}`);
});
