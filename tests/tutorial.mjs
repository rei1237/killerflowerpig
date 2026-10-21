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
const storage=new Map([['kfp.save.v1','preserve-me'],['kfp.tutorial.v1','done']]);let fail=false;
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
test('all seven steps use real local illustrations and focus/reduced-motion styling exists',()=>{
 const root=path.resolve(import.meta.dirname,'..');assert.equal(guide.TUTORIAL_STEPS.length,7);
 for(const step of guide.TUTORIAL_STEPS)assert.ok(fs.existsSync(path.join(root,'asset/tutorial',step.image)),step.image);
 const css=fs.readFileSync(path.join(root,'src/ui/tutorial.css'),'utf8');assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/max-width: 580px/);
});

test('versioned offer preserves old guide/save keys and explains actual field-box flow',()=>{
 assert.equal(guide.TUTORIAL_KEY,'kfp.tutorial.v2');
 assert.equal(storage.get('kfp.tutorial.v1'),'done');
 assert.equal(storage.get('kfp.save.v1'),'preserve-me');
 const box=guide.TUTORIAL_STEPS.find(s=>s.visual==='fieldbox');
 assert.ok(box);assert.match(box.image,/salvage-cache/);assert.match(box.text,/열기 → 보상 확인 → 받기/);
 assert.match(box.text,/진화/);assert.match(box.text,/코인/);assert.match(box.text,/강화 1회/);assert.match(box.text,/새 보조 아이템/);assert.match(box.text,/보물 상자/);assert.match(JSON.stringify(guide.TUTORIAL_STEPS),/코인/);
 assert.match(box.tip,/변이체/);assert.match(box.tip,/보스 상자/);assert.match(JSON.stringify(guide.TUTORIAL_STEPS),/상점 재화/); // 코인은 상점 재화, 필드 상자는 전투 보상
 assert.doesNotMatch(JSON.stringify(guide.TUTORIAL_STEPS),/조각|파편/);
 const all=JSON.stringify(guide.TUTORIAL_STEPS);assert.match(all,/나중에 얻은 무기와 조합 무기/);assert.match(all,/STAGE 3 클리어/);assert.match(all,/1개만 장착/);
});

test('guide discloses bloom dual Lv1 starters, two slots and unchanged evolution requirements',()=>{
 const combo=guide.TUTORIAL_STEPS.find(s=>s.label==='아이템 조합');
 assert.match(combo.text,/연꽃 정원.*연꽃 가시 Lv\.1 \+ 꽃잎포 Lv\.1.*재생하는 살점 Lv\.1/);
 assert.match(combo.tip,/6칸 중 2칸/);
 assert.match(combo.text,/Lv\.8.*짝 보조 아이템 Lv\.1 이상.*상자로 진화/);
 assert.match(combo.text,/진화 무기 2개/);
 assert.match(combo.text,/꽃잎포·연꽃 가시·화염병 3개를 모두 진화/);
});
