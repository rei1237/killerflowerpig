import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nodes=new Map();
let now=1000;
function node(){
 return {style:{},attributes:{},children:[],textContent:'',hidden:false,
 setAttribute(k,v){this.attributes[k]=v;},
 appendChild(n){this.children.push(n);},
 replaceChildren(...children){this.children=children;}};
}
globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
Object.defineProperty(globalThis,'performance',{value:{now:()=>now}});
const {G}=await import('../src/game/state.js');
const {drawHUD}=await import('../src/ui/hud.js');
const {WEAPONS,PASSIVES}=await import('../src/data/weapons.js');
const tick=()=>{now+=101;drawHUD();};
test('HTML IDs are unique and all DOM HUD nodes exist',()=>{
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 const hud=fs.readFileSync(path.join(root,'src/ui/hud.js'),'utf8');
 for(const [,id] of hud.matchAll(/'(hud-[a-z-]+)'/g))if(id !== 'hud-slot')assert.ok(ids.includes(id),id);
});
test('all HTML local image and module references exist',()=>{
 for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(/^(https?:|#)/.test(url))continue;
  assert.ok(fs.existsSync(path.join(root,url)),url);
 }
});
test('HUD reads player HP, XP, stage, counters without changing game state',()=>{
 Object.assign(G,{mode:'play',player:{hp:45,maxHp:100},stage:1,time:65,level:3,xp:2,xpNext:5,kills:23,gold:12,weapons:[{id:'shotgun',level:2,evolved:false}],passives:{},boss:null});
 tick();
 assert.equal(nodes.get('hud-hp').style.width,'45%');
 assert.equal(nodes.get('hud-xp').style.width,'40%');
 assert.equal(nodes.get('hud-level').textContent,'선택 3');
 assert.equal(nodes.get('hud-time').textContent,'1:05');
 assert.equal(nodes.get('hud-hp-track').attributes['aria-valuenow'],45);
 assert.equal(nodes.get('hud-build').children.length,1);
 assert.equal(G.player.hp,45);
 assert.equal(G.gold,12);
});
test('HUD updates evolved equipment and boss health without rebuilding unchanged slots',()=>{
 const first=nodes.get('hud-build').children[0];
 tick();assert.equal(nodes.get('hud-build').children[0],first);
 G.weapons[0].evolved=true;G.passives[Object.keys(PASSIVES)[0]]=2;
 G.boss={alive:true,hp:25,maxHp:100,phase:1,def:{name:'시험 보스'}};
 tick();
 assert.equal(nodes.get('hud-build').children.length,2);
 assert.match(nodes.get('hud-build').children[0].title,new RegExp(WEAPONS.shotgun.evolve.name));
 assert.equal(nodes.get('hud-boss-hp').style.width,'25%');
 assert.equal(nodes.get('hud-time').textContent,'BOSS');
 assert.equal(nodes.get('hud-boss').hidden,false);
 G.boss.alive=false;G.boss.deadT=2;tick();assert.equal(nodes.get('hud-boss').hidden,true);
});
test('HUD caps invalid low HP and avoids unnecessary DOM writes',()=>{
 G.player.hp=-5;tick();
 assert.equal(nodes.get('hud-hp').style.width,'0%');
 G.player.hp=90;drawHUD();
 assert.equal(nodes.get('hud-hp').style.width,'0%');
 tick();assert.equal(nodes.get('hud-hp').style.width,'90%');
});
