import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sheets=['player-fire.png','player-lotus-fire.png','player-cape-fire.png','player-cape-lotus-fire.png','player-jade-fire.png','player-jade-lotus-fire.png'];
test('all six shipped complete body atlases contain eight fixed-size RGBA poses',()=>{
 for(const file of sheets){
  const png=fs.readFileSync(new URL(`../asset/sprites/${file}`,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG',file);
  assert.equal(png.readUInt32BE(16),3072,file);
  assert.equal(png.readUInt32BE(20),256,file);
  assert.equal(png[25],6,`${file}: real RGBA transparency`);
 }
});
test('every tech family ships eight complete poses for base, cape and jade',()=>{
 for(const outfit of ['base','cape','jade'])for(const family of ['dual','throw','cannon','blade','channel','sword']){
  const file=`player-${outfit}-${family}.png`;
  const png=fs.readFileSync(new URL(`../asset/sprites/${file}`,import.meta.url));
  assert.equal(png.readUInt32BE(16),3072,file);assert.equal(png.readUInt32BE(20),256,file);assert.equal(png[25],6,file);
 }
});

test('all fifteen tech idle/walk atlases contain eight transparent fixed-anchor cells',()=>{
 for(const outfit of ['base','cape','jade'])for(const family of ['fire','dual','throw','cannon','sword']){
  const file=`player-${outfit}-${family}-move.png`,png=fs.readFileSync(new URL(`../asset/sprites/${file}`,import.meta.url));
  assert.equal(png.readUInt32BE(16),3072,file);assert.equal(png.readUInt32BE(20),256,file);assert.equal(png[25],6,file);
 }
});
