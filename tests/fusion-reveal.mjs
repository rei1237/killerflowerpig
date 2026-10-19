import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.disabled=false;this.inert=false;this.isConnected=true;this.textContent='';this.className='';this.classList={toggle:(c,on)=>{const set=new Set(this.className.split(' '));on?set.add(c):set.delete(c);this.className=[...set].join(' ');}};}
 replaceChildren(...nodes){this.children=[...nodes];}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,cb){this.listeners[k]=cb;}
 focus(){document.activeElement=this;}
 click(){if(!this.disabled)this.listeners.click?.();}
 querySelectorAll(selector){const match=n=>selector==='button'?n.tag==='button':selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):selector.startsWith('#')?n.id===selector.slice(1):selector.startsWith('[data-action=')?n.dataset.action===selector.match(/"([^\"]+)"/)[1]:false;return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const body=new Element('body'),launcher=new Element('button'),prior=new Element('div');prior.inert=true;body.append(launcher,prior);
const events={},timers=new Map();let reduced=false,seq=0;
globalThis.document={body,activeElement:launcher,hidden:false,createElement:t=>new Element(t),addEventListener:(t,f)=>events[t]=f};
globalThis.window={addEventListener:(t,f)=>events[t]=f,matchMedia:()=>({matches:reduced})};
globalThis.setTimeout=f=>{timers.set(++seq,f);return seq};globalThis.clearTimeout=id=>timers.delete(id);
const {initFusionReveal,openFusionReveal,closeFusionReveal}=await import('../src/ui/fusion-reveal.js');
let opens=0,closes=0,done=0;initFusionReveal({onOpen:()=>opens++,onClose:()=>closes++});
const root=body.querySelector('#fusion-reveal'),q=s=>root.querySelector(s);
const data={ingredients:[{id:'cannon',name:'꽃잎포',level:5},{id:'thorns',name:'연꽃 가시',level:5}],output:{id:'lotus_bloom',name:'만개 연꽃포',desc:'광선과 회전 꽃잎'},statText:'피해 42 · 범위 180',onDone:()=>done++};
test('valid success payload opens once and displays actual ingredients, result, effect and slots',()=>{
 assert.equal(openFusionReveal(),false);assert.equal(openFusionReveal(data),true);assert.equal(openFusionReveal(data),false);assert.equal(opens,1);assert.equal(timers.size,1);assert.equal(launcher.inert,true);
 assert.equal(q('.fusion-reveal-result').hidden,true);assert.equal(q('.fusion-reveal-ingredients').children.length,2);
 q('.fusion-reveal-skip').click();assert.equal(timers.size,0);assert.equal(root.dataset.phase,'result');assert.equal(q('.fusion-reveal-result').children[1].textContent,'만개 연꽃포 · Lv.1');assert.match(q('.fusion-reveal-slots').textContent,/2개.*1개/);assert.equal(q('.fusion-reveal-stats').textContent,data.statText);
 assert.equal(done,0);q('.fusion-reveal-confirm').click();assert.equal(done,1);assert.equal(closes,1);assert.equal(closeFusionReveal(),false);assert.equal(launcher.inert,false);assert.equal(prior.inert,true);assert.equal(document.activeElement,launcher);
});
test('Escape cancels timers and callbacks run once; background reveals without advancing',()=>{
 openFusionReveal(data);let prevented=false;events.keydown({code:'Escape',preventDefault(){prevented=true},stopImmediatePropagation(){}});assert.equal(prevented,true);assert.equal(timers.size,0);assert.equal(done,2);
 openFusionReveal(data);document.hidden=true;events.visibilitychange();assert.equal(timers.size,0);assert.equal(root.hidden,false);assert.equal(root.dataset.phase,'result');assert.equal(done,2);closeFusionReveal();document.hidden=false;
});
test('reduced motion uses static immediate result, and focus trap blocks game keys',()=>{
 reduced=true;openFusionReveal(data);assert.equal(timers.size,0);assert.equal(root.dataset.phase,'result');let stopped=false,prevented=false;
 events.keydown({code:'Tab',stopImmediatePropagation(){stopped=true},preventDefault(){prevented=true}});assert.equal(stopped,true);assert.equal(prevented,true);assert.equal(document.activeElement,q('.fusion-reveal-confirm'));closeFusionReveal();
});
test('natural bloom completion still requires explicit confirmation',()=>{
 reduced=false;openFusionReveal(data);const before=done;[...timers.values()][0]();assert.equal(root.dataset.phase,'result');assert.equal(done,before);assert.equal(root.hidden,false);closeFusionReveal();assert.equal(done,before+1);
});
test('absolute three-ingredient awakening frees two slots and reduced motion shows static result',()=>{
 const absolute={ingredients:[{id:'cannon',level:8},{id:'thorns',level:8},{id:'molotov',level:8}],output:{id:'absolute_bloom',name:'절대 만개',tier:'absolute',desc:'세 진화 무기의 힘'},statText:'진화 코어 3개'};
 reduced=false;assert.equal(openFusionReveal(absolute),true);assert.equal(root.dataset.tier,'absolute');assert.equal(q('.fusion-reveal-ingredients').children.length,3);
 assert.match(q('#fusion-reveal-heading').textContent,/절대/);assert.match(q('.fusion-reveal-slots').textContent,/3개.*2칸/);assert.equal(q('.fusion-reveal-halo').children.length,12);
 assert.equal(timers.size,1);q('.fusion-reveal-skip').click();assert.equal(root.dataset.phase,'result');closeFusionReveal();
 reduced=true;assert.equal(openFusionReveal(absolute),true);assert.equal(root.dataset.phase,'result');assert.equal(timers.size,0);closeFusionReveal();
 assert.equal(openFusionReveal({...absolute,ingredients:[absolute.ingredients[0]]}),false);
});
