import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.disabled=false;this.inert=false;this.isConnected=true;this.textContent='';this.className='';this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');}};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,cb){this.listeners[k]=cb;}
 focus(){document.activeElement=this;}
 click(){if(!this.disabled)this.listeners.click?.();}
 querySelectorAll(selector){const match=n=>selector==='button'?n.tag==='button':selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):selector.startsWith('#')?n.id===selector.slice(1):selector.startsWith('[data-action=')?n.dataset.action===selector.match(/"([^\"]+)"/)[1]:false;return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const body=new Element('body'), launcher=new Element('button'), oldInert=new Element('div');oldInert.inert=true;body.append(launcher,oldInert);
globalThis.document={body,activeElement:launcher,createElement:t=>new Element(t)};
const listeners=[];globalThis.window={addEventListener:(type,callback,capture)=>listeners.push({type,callback,capture})};
const storage=new Map([['kfp.save.v1','preserve-me']]);let fail=false;
globalThis.localStorage={getItem:k=>{if(fail)throw Error('blocked');return storage.get(k)||null;},setItem:(k,v)=>{if(fail)throw Error('quota');storage.set(k,v);}};
const guide=await import('../src/ui/tutorial.js');
let events=[];const hooks={onOpen:()=>events.push('open'),onClose:()=>events.push('close')};guide.initTutorial(hooks);
const modal=body.querySelector('#tutorial');
const q=s=>modal.querySelector(s);
function key(code,shiftKey=false){const e={code,shiftKey,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};listeners[0].callback(e);return e;}
test('first run and initialization/open are idempotent',()=>{
 assert.equal(guide.shouldOfferTutorial(),true);guide.initTutorial(hooks);assert.equal(listeners.length,1);assert.equal(listeners[0].capture,true);
 assert.equal(guide.openTutorial({onDone:()=>events.push('done')}),true);assert.equal(guide.openTutorial(),false);assert.deepEqual(events,['open']);
 assert.equal(q('[data-action="back"]').disabled,true);assert.equal(launcher.inert,true);assert.equal(document.activeElement,q('[data-action="next"]'));
});
test('navigation clamps, keyboard traps focus, and hidden game receives no shortcuts',()=>{
 key('ArrowLeft');assert.match(q('.tutorial-count').textContent,/^1/);
 key('ArrowRight');assert.match(q('.tutorial-count').textContent,/^2/);
 q('[data-action="back"]').click();assert.match(q('.tutorial-count').textContent,/^1/);
 q('[data-action="next"]').focus();assert.equal(key('Tab').prevented,true);assert.equal(document.activeElement,q('[data-action="skip"]'));
 key('Tab',true);assert.equal(document.activeElement,q('[data-action="next"]'));
 assert.equal(key('KeyP').stopped,true);
});
test('skip closes once, restores original inert and focus, persists only guide key',()=>{
 key('Escape');assert.equal(guide.isTutorialOpen(),false);assert.equal(modal.hidden,true);assert.deepEqual(events,['open','close','done']);
 assert.equal(launcher.inert,false);assert.equal(oldInert.inert,true);assert.equal(document.activeElement,launcher);
 assert.equal(guide.closeTutorial(),false);assert.equal(guide.shouldOfferTutorial(),false);
 assert.equal(storage.get(guide.TUTORIAL_KEY),'done');assert.equal(storage.get('kfp.save.v1'),'preserve-me');
});
test('manual reopen resets to first step and completion fires once',()=>{
 guide.openTutorial({onDone:()=>events.push('finished')});assert.match(q('.tutorial-count').textContent,/^1/);
 for(let i=0;i<guide.TUTORIAL_STEPS.length-1;i++)q('[data-action="next"]').click();assert.equal(q('[data-action="next"]').textContent,'준비 완료');
 key('ArrowRight');assert.ok(q('.tutorial-count').textContent.startsWith(String(guide.TUTORIAL_STEPS.length)));
 q('[data-action="next"]').click();guide.closeTutorial();assert.equal(events.filter(x=>x==='finished').length,1);
});
test('storage failures do not break first-run offer, skip, or session-level dismissal',async()=>{
 fail=true;const fresh=await import('../src/ui/tutorial.js?blocked-storage');fresh.initTutorial();
 assert.equal(fresh.shouldOfferTutorial(),true);assert.equal(fresh.openTutorial(),true);assert.equal(fresh.closeTutorial(),true);assert.equal(fresh.shouldOfferTutorial(),false);
 assert.equal(fresh.openTutorial(),true);fresh.closeTutorial();fail=false;
});
test('all six steps use real local illustrations and focus/reduced-motion styling exists',()=>{
 const root=path.resolve(import.meta.dirname,'..');assert.equal(guide.TUTORIAL_STEPS.length,6);
 for(const step of guide.TUTORIAL_STEPS)assert.ok(fs.existsSync(path.join(root,'asset/tutorial',step.image)),step.image);
 const css=fs.readFileSync(path.join(root,'src/ui/tutorial.css'),'utf8');assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/max-width: 580px/);
});
