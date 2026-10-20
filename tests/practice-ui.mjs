import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.disabled=false;this.inert=false;this.isConnected=true;this.textContent='';this.className='';}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,cb){this.listeners[k]=cb;}focus(){document.activeElement=this;}click(){if(!this.disabled)this.listeners.click?.();}
 querySelectorAll(selector){const match=n=>selector==='button'?n.tag==='button':selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):selector.startsWith('#')?n.id===selector.slice(1):selector.startsWith('[data-upgrade=')?n.dataset.upgrade===selector.match(/"([^\"]+)"/)[1]:false;return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}getContext(){return new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});}getBoundingClientRect(){return{left:0,top:0,width:600,height:340};}setPointerCapture(){}
}
const body=new Element('body'),launcher=new Element('button'),paused=new Element('div');paused.inert=true;body.append(launcher,paused);
globalThis.document={body,activeElement:launcher,createElement:t=>new Element(t)};
const listeners={};globalThis.window={addEventListener:(type,cb)=>(listeners[type]??=[]).push(cb)};
globalThis.Image=class{complete=false;naturalWidth=0;};let now=1000;Object.defineProperty(globalThis,'performance',{value:{now:()=>now}});
const frames=new Map();let id=0;globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
function tick(count=1){for(let i=0;i<count;i++){now+=50;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));}}
let fail=false;const storage=new Map([['kfp.save.v1','untouched']]);globalThis.localStorage={getItem:k=>{if(fail)throw Error();return storage.get(k)||null;},setItem:(k,v)=>{if(fail)throw Error();storage.set(k,v);}};
const p=await import('../src/ui/practice.js');let events=[];const hooks={onOpen:()=>events.push('open'),onClose:()=>events.push('close')};p.initPractice(hooks);
const root=body.querySelector('#practice'),q=s=>root.querySelector(s);
function key(type,code,shiftKey=false){const e={code,shiftKey,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};(listeners[type]||[]).forEach(fn=>fn(e));return e;}
test('forced cancellation restores state without saving completion or invoking continuation',()=>{
 assert.equal(p.shouldOfferPractice(),true);p.openPractice({onDone:()=>events.push('unexpected-start')});
 key('keydown','ArrowRight');tick(2);assert.equal(frames.size,1);
 assert.equal(p.cancelPractice(),true);assert.equal(p.cancelPractice(),false);
 assert.equal(p.isPracticeOpen(),false);assert.equal(root.hidden,true);assert.equal(frames.size,0);
 assert.equal(launcher.inert,false);assert.equal(paused.inert,true);assert.equal(document.activeElement,launcher);
 assert.deepEqual(events,['open','close']);assert.equal(storage.has(p.PRACTICE_KEY),false);assert.equal(p.shouldOfferPractice(),true);
 events=[];p.openPractice();tick(20);assert.equal(root.dataset.step,'0');p.cancelPractice();events=[];
});
test('practice initialization/open duplicates do not double pause or animation loops',()=>{
 p.initPractice(hooks);assert.equal(listeners.keydown.length,1);assert.equal(p.shouldOfferPractice(),true);
 assert.equal(p.openPractice({onDone:()=>events.push('done')}),true);assert.equal(p.openPractice(),false);assert.deepEqual(events,['open']);assert.equal(frames.size,1);assert.equal(launcher.inert,true);
 assert.equal(root.dataset.step,'0');assert.equal(q('.practice-choices').hidden,true);assert.equal(q('.practice-focus').hidden,true);
 key('keydown','Tab');assert.equal(document.activeElement,q('.practice-skip'));
});
test('keyboard move, real target click, pickup proximity and explicit upgrade drive four steps',()=>{
 key('keydown','ArrowRight');tick(14);key('keyup','ArrowRight');assert.equal(root.dataset.step,'1');
 const canvas=q('.practice-canvas'),base={pointerId:1,clientX:430,clientY:120,isPrimary:true,button:0,preventDefault(){}};
 canvas.listeners.pointerdown(base);now+=100;canvas.listeners.pointerup(base);assert.equal(root.dataset.step,'2');
 key('keydown','ArrowRight');tick(33);key('keyup','ArrowRight');key('keydown','ArrowDown');tick(7);key('keyup','ArrowDown');
 assert.equal(root.dataset.step,'3');assert.equal(q('.practice-choices').hidden,false);assert.equal(document.activeElement,q('[data-upgrade="whet"]'));
 q('[data-upgrade="whet"]').click();assert.equal(root.dataset.step,'4');assert.equal(q('.practice-finish').hidden,false);
 assert.equal(document.activeElement,q('.practice-finish'));q('.practice-finish').click();assert.deepEqual(events,['open','close','done']);
 assert.equal(frames.size,0);assert.equal(launcher.inert,false);assert.equal(paused.inert,true);assert.equal(document.activeElement,launcher);assert.equal(p.closePractice(),false);
 assert.equal(storage.get('kfp.save.v1'),'untouched');assert.equal(storage.get(p.PRACTICE_KEY),'done');
});
test('manual replay, Escape skip and unavailable storage are safe and idempotent',()=>{
 fail=true;p.openPractice({onDone:()=>events.push('skip')});assert.equal(root.dataset.step,'0');assert.equal(q('.practice-finish').hidden,true);
 assert.equal(key('keydown','KeyP').stopped,true);key('keydown','Escape');assert.equal(p.isPracticeOpen(),false);assert.equal(frames.size,0);
 assert.equal(events.filter(x=>x==='skip').length,1);assert.equal(p.shouldOfferPractice(),false);assert.equal(launcher.inert,false);assert.equal(paused.inert,true);fail=false;
});

test('practice cancels in BFCache and resumes one frame chain without held movement',()=>{
 p.openPractice();key('keydown','ArrowRight');tick(2);
 listeners.pagehide.forEach(fn=>fn());assert.equal(frames.size,0);
 now+=600000;listeners.pageshow.forEach(fn=>fn());listeners.pageshow.forEach(fn=>fn());assert.equal(frames.size,1);
 tick(20);assert.equal(root.dataset.step,'0');p.cancelPractice();assert.equal(frames.size,0);
});
