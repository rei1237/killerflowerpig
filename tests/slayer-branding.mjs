import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest')),sw=read('service-worker.js');
const title='꽃돼지 청토끼 슬레이어!';
test('canonical Slayer name is identical in document, install identity, loader and title screen',()=>{
 assert.equal(manifest.name,title);assert.equal(manifest.short_name,title);
 assert.ok(html.includes(`<title>${title}</title>`));assert.ok(html.includes(`name="apple-mobile-web-app-title" content="${title}"`));
 assert.ok(html.includes(`id="loading-title">${title}</h1>`));assert.ok(html.includes(`class="slayer-title">${title}</h1>`));
 assert.ok(read('src/ui/loading.js').includes(`title.textContent = '${title}'`));
 assert.doesNotMatch(html+JSON.stringify(manifest),/BLUE NIGHT SURVIVAL|푸른 밤의 수호자/);
});
test('real PNG icon dimensions match manifest and include separate maskable, Apple and favicon variants',()=>{
 const icons=[...manifest.icons,{src:'asset/branding/slayer-icon-180.png',sizes:'180x180'},{src:'asset/branding/slayer-icon-32.png',sizes:'32x32'}];
 for(const i of icons){const b=fs.readFileSync(new URL('../'+i.src,import.meta.url));assert.equal(b.toString('ascii',1,4),'PNG');assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`,i.sizes);assert.ok(sw.includes(i.src));}
 assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));assert.match(html,/rel="apple-touch-icon"/);assert.match(html,/rel="icon"/);
});
test('responsive launch art stays small and all newly used local assets are cached',()=>{
 assert.match(html,/srcset="asset\/branding\/slayer-launch-480.webp 480w, asset\/branding\/slayer-launch-900.webp 900w"/);
 for(const size of [480,900]){const p=`asset/branding/slayer-launch-${size}.webp`;assert.ok(sw.includes(p));assert.ok(fs.statSync(new URL('../'+p,import.meta.url)).size<(size===480?65000:150000));}
 assert.ok(sw.includes('v46-partner-growth'));assert.ok(sw.includes('./src/ui/mobile.css'));
 assert.doesNotMatch(html,/maximum-scale|user-scalable=no/);
});
