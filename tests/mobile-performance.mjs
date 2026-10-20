import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameLoop } from '../src/core/frame-loop.js';
import { loadImage } from '../src/core/assets.js';

function fixture(hidden=false) {
 const events={},jobs=new Map();let id=0,frames=0,resets=0,suspends=0,resumes=0;
 const host={addEventListener:(n,fn)=>events[n]=fn,requestAnimationFrame:fn=>{jobs.set(++id,fn);return id;},cancelAnimationFrame:id=>jobs.delete(id)};
 const page={hidden,addEventListener:(n,fn)=>events[n]=fn};
 const loop=createFrameLoop({host,page,frame:()=>frames++,reset:()=>resets++,onSuspend:()=>suspends++,onResume:()=>resumes++});
 return {loop,page,jobs,events,run(){const [id,fn]=jobs.entries().next().value;jobs.delete(id);fn(1000);},get stats(){return {frames,resets,suspends,resumes};}};
}
test('mobile hide cancels RAF, resets time and resumes exactly one loop without auto-unpausing gameplay',()=>{
 const f=fixture();f.loop.start();f.loop.start();assert.equal(f.jobs.size,1);f.run();assert.equal(f.stats.frames,1);assert.equal(f.jobs.size,1);
 f.page.hidden=true;f.events.visibilitychange();assert.equal(f.jobs.size,0);assert.equal(f.stats.suspends,1);
 f.events.pagehide();assert.equal(f.stats.suspends,1);assert.equal(f.jobs.size,0);
 f.page.hidden=false;f.events.visibilitychange();f.events.pageshow();assert.equal(f.jobs.size,1);assert.equal(f.stats.resumes,1);
 f.run();assert.equal(f.stats.frames,2);assert.equal(f.jobs.size,1);assert.ok(f.stats.resets>=4);
});
test('BFCache pagehide cancels even without visibilitychange; hidden boot waits until visible',()=>{
 const f=fixture();f.loop.start();f.events.pagehide();assert.equal(f.jobs.size,0);f.events.pageshow();assert.equal(f.jobs.size,1);
 const g=fixture(true);g.loop.start();g.events.pageshow();assert.equal(g.jobs.size,0);g.page.hidden=false;g.events.visibilitychange();assert.equal(g.jobs.size,1);
});
test('assets are not reported ready until decoding settles; abort wins over pending decode',async()=>{
 const old=globalThis.Image;let image,resolveDecode;
 globalThis.Image=class {constructor(){image=this;}decode(){return new Promise(r=>resolveDecode=r);}removeAttribute(){}};
 try {
  let settled=false;const ready=loadImage('atlas.webp').then(x=>{settled=true;return x;});image.onload();await Promise.resolve();assert.equal(settled,false);resolveDecode();assert.equal(await ready,image);
  const controller=new AbortController(),pending=loadImage('atlas.webp',{signal:controller.signal});image.onload();controller.abort();resolveDecode();await assert.rejects(pending,{name:'AbortError'});assert.equal(image.onload,null);
 } finally {globalThis.Image=old;}
});
test('decode failure and decode stall use existing failure/timeout recovery',async()=>{
 const old=globalThis.Image;let image;
 globalThis.Image=class {constructor(){image=this;}decode(){return Promise.reject(Error('decode'));}removeAttribute(){}};
 try {const pending=loadImage('bad.webp');image.onload();assert.equal(await pending,null);
  image=null;globalThis.Image=class {constructor(){image=this;}decode(){return new Promise(()=>{});}removeAttribute(){}};
  const stall=loadImage('stall.webp',{timeoutMs:5});image.onload();assert.equal(await stall,null);
 } finally {globalThis.Image=old;}
});
