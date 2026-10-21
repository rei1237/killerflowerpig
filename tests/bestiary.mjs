import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {bestiaryEntries,findBestiaryEntry,searchBestiary} from '../src/data/bestiary.js';
import {ENEMIES,ELITE} from '../src/data/enemies.js';import {BOSSES,bossMaxHp} from '../src/data/bosses.js';
test('every ordinary and elite variant plus bosses1–9 is open initially',()=>{
 const all=bestiaryEntries();assert.equal(all.length,Object.keys(ENEMIES).length*2+9);assert.equal(new Set(all.map(e=>e.id)).size,all.length);
 for(const id of Object.keys(ENEMIES)){assert.ok(findBestiaryEntry('enemy-'+id));assert.ok(findBestiaryEntry('elite-'+id));}
 for(let stage=1;stage<=9;stage++)assert.equal(findBestiaryEntry('boss-'+stage).hp,bossMaxHp(stage),'bestiary shows the real battle HP');
});
test('final boss is absent from data, IDs, search and direct detail lookup',()=>{
 assert.equal(findBestiaryEntry('boss-10'),null);assert.equal(searchBestiary(BOSSES[10].name).length,0);assert.equal(searchBestiary('시간의 채권자').length,0);
 assert.deepEqual(searchBestiary('','boss').map(e=>e.stage),[1,2,3,4,5,6,7,8,9]);assert.ok(!JSON.stringify(bestiaryEntries()).includes(BOSSES[10].name));
});
test('official base stats, gates, new roles and actual art are derived correctly',()=>{
 for(const [id,def] of Object.entries(ENEMIES)){assert.equal(findBestiaryEntry('enemy-'+id).hp,def.hp);assert.equal(findBestiaryEntry('elite-'+id).hp,def.hp*ELITE.hp);}
 assert.equal(findBestiaryEntry('enemy-spitter').stage,5);assert.equal(findBestiaryEntry('enemy-suicider').stage,5);assert.equal(findBestiaryEntry('enemy-gunner').stage,6);assert.equal(findBestiaryEntry('enemy-suicider').damage,0);
 const hunter=findBestiaryEntry('boss-3');assert.equal(hunter.speed,118);assert.match(hunter.pattern,/650 \/ 702 \/ 754/);assert.match(hunter.tell,/0.65초/);assert.match(hunter.tell,/0.5초/);assert.match(hunter.pattern,/1.25초/);
 for(const e of bestiaryEntries()){assert.ok(e.tell&&e.pattern&&e.counter);assert.ok(fs.existsSync(new URL('../'+(e.image||e.sprite.image),import.meta.url)));}
});
test('main entry and mobile stylesheet are wired without touching final fight/story',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),screens=fs.readFileSync(new URL('../src/ui/screens.js',import.meta.url),'utf8');assert.match(html,/id="btn-bestiary"/);assert.match(screens,/click\('btn-bestiary', openBestiary\)/);assert.match(screens,/clearEncirclement\(\)/);
 assert.match(fs.readFileSync(new URL('../style.css',import.meta.url),'utf8'),/bestiary.css/);assert.match(fs.readFileSync(new URL('../src/ui/bestiary.css',import.meta.url),'utf8'),/@media\(max-width:600px\)/);assert.ok(BOSSES[10]);
});
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};this.dataset={};this.listeners={};this.hidden=false;this.disabled=false;this.inert=false;this.isConnected=true;this.value='';this.className='';this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.listeners[k]=fn;}focus(){document.activeElement=this;}click(){if(!this.disabled)this.listeners.click?.();}
 querySelectorAll(selector){const matches=n=>selector.split(',').some(raw=>{const s=raw.trim();return s.startsWith('.')?n.className.split(' ').includes(s.slice(1)):s.startsWith('#')?n.id===s.slice(1):n.tag===s;});return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const body=new Element('body'),launcher=new Element('button'),inert=new Element('aside');inert.inert=true;body.append(launcher,inert);const listeners=[];
globalThis.document={body,activeElement:launcher,createElement:tag=>new Element(tag)};globalThis.window={addEventListener:(kind,fn,capture)=>listeners.push({kind,fn,capture})};
const ui=await import('../src/ui/bestiary.js');let opened=0,closed=0;ui.initBestiary({onOpen:()=>opened++,onClose:()=>closed++});const root=body.querySelector('#bestiary');
const key=(name,shiftKey=false)=>{let prevented=false,stopped=false;listeners[0].fn({key:name,shiftKey,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});return {prevented,stopped};};
test('DOM open is idempotent, filters/search work and final boss cannot appear',()=>{
 ui.initBestiary({onOpen:()=>opened++,onClose:()=>closed++});assert.equal(body.querySelectorAll('#bestiary').length,1);assert.equal(listeners.length,1);assert.equal(ui.openBestiary(),true);assert.equal(ui.openBestiary(),false);assert.equal(opened,1);assert.equal(launcher.inert,true);
 const input=root.querySelector('input'),select=root.querySelector('select'),list=root.querySelector('.bestiary-list');assert.equal(document.activeElement,input);assert.equal(list.children.length,27);
 select.value='boss';select.listeners.change();assert.equal(list.children.length,9);assert.ok(list.children.every(b=>b.dataset.entry!=='boss-10'));
 input.value=BOSSES[10].name;input.listeners.input();assert.equal(list.children.length,0);assert.match(root.querySelector('.bestiary-detail').children[0].textContent,/검색 결과/);
 input.value='헌터';input.listeners.input();assert.equal(list.children.length,1);list.children[0].click();assert.equal(root.querySelector('.bestiary-name').textContent,BOSSES[3].name);
});
test('DOM Escape restores focus/inert; Tab traps and arrows never leave allowed records',()=>{
 const input=root.querySelector('input'),select=root.querySelector('select');input.value='';select.value='boss';input.listeners.input();const buttons=root.querySelectorAll('button, input, select').filter(n=>!n.disabled&&!n.hidden);
 buttons[0].focus();assert.equal(key('Tab',true).prevented,true);assert.equal(document.activeElement,buttons.at(-1));key('Tab');assert.equal(document.activeElement,buttons[0]);
 root.querySelector('.bestiary-name').focus();for(let i=0;i<20;i++)key('ArrowRight');assert.equal(root.querySelector('.bestiary-name').textContent,BOSSES[9].name);assert.equal(key('Escape').prevented,true);assert.equal(ui.isBestiaryOpen(),false);assert.equal(closed,1);assert.equal(document.activeElement,launcher);assert.equal(launcher.inert,false);assert.equal(inert.inert,true);assert.equal(ui.closeBestiary(),false);
});

test('adjacent legacy boss archive also excludes final dossier while keeping combat definition',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),screens=fs.readFileSync(new URL('../src/ui/screens.js',import.meta.url),'utf8');assert.doesNotMatch(html,/FINAL THREAT|class="boss-dossier"/);assert.match(screens,/Object.entries\(BOSSES\).filter\(\(\[stage\]\) => Number\(stage\) <= 9\)/);assert.ok(BOSSES[10].phases.length);
});
test('environment note derives its timings and distinguishes enclosure from damaging acid',async()=>{
 const {ENCLOSURE_GUIDE}=await import('../src/data/bestiary.js');const {ENCIRCLEMENT}=await import('../src/game/encirclement.js');assert.match(ENCLOSURE_GUIDE,new RegExp(`${ENCIRCLEMENT.warning}초 예고`));assert.match(ENCLOSURE_GUIDE,new RegExp(`${ENCIRCLEMENT.active}초 유지`));assert.match(ENCLOSURE_GUIDE,/직접 피해는 없/);
});

test('short mobile panels keep the footer reachable through outer scrolling',()=>{
 const css=fs.readFileSync(new URL('../src/ui/bestiary.css',import.meta.url),'utf8');
 assert.match(css,/\.bestiary-panel\{overflow-y:auto;overscroll-behavior:contain\}/);
 assert.match(css,/\.bestiary-body\{flex:0 0 auto;grid-template-rows:116px auto;overflow:visible\}/);
 assert.match(css,/\.bestiary-detail\{max-height:52dvh;overflow-y:auto\}/);
});
test('cached gameplay atlas applies actual elite tint and clear encounter labeling',async()=>{
 const {atlases}=await import('../src/core/assets.js');let tint;
 Element.prototype.getContext=()=>({});
 atlases.rabbit1={anims:{walk:[{sw:80,sh:112,ox:40}]},draw(...args){tint=args[7];}};
 ui.openBestiary();const select=root.querySelector('select');select.value='elite';select.listeners.change();
 assert.equal(tint,'elite');assert.ok(root.querySelector('canvas'));assert.match(root.querySelector('.bestiary-tag').textContent,/기본 개체 STAGE.*정예 출현은 이벤트 편성/);
 ui.closeBestiary();delete atlases.rabbit1;delete Element.prototype.getContext;
});
