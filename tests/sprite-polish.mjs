import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
// 네이티브 캔버스 의존성 없이 PNG 를 직접 디코딩한다 (이전: @napi-rs/canvas 가 없으면 실패).
import { decodePng } from './helpers/png.mjs';
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
    const img=decodePng(data);
    assert.equal(img.width,3072,file);assert.equal(img.height,256,file);
    const hashes=new Set();
    for(let f=0;f<8;f++) {
      const pixels=Buffer.alloc(384*256*4);
      for(let y=0;y<256;y++) img.data.copy(pixels,y*384*4,(y*3072+f*384)*4,(y*3072+f*384+384)*4);
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
