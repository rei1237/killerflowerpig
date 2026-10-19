import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G} from '../src/game/state.js';
import {WEAPONS} from '../src/data/weapons.js';
import {createPlayer} from '../src/game/player.js';
import {createWeapon} from '../src/game/weapons.js';
import {rollChoices,resetBuild,beginChoiceSession,finishChoiceSession,snapshotBuild,restoreBuild} from '../src/game/progression.js';
beforeEach(()=>{resetBuild();createPlayer();G.level=2;G.stage=1;G.gold=0;G.weapons=[createWeapon('shotgun',0),createWeapon('lotus_bloom',1)];});
const weights=()=>Object.fromEntries(rollChoices(99).map(c=>[c.id,c]));
function seeded(){let seed=123456789;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('unowned and recipe partner weights increase once while fused upgrades are quarter-weight',()=>{
 let w=weights();assert.equal(w.shotgun.weight,3);assert.equal(w.lotus_bloom.weight,.75);assert.equal(w.pistols.weight,2.4);assert.equal(w.rifle.weight,3.24);assert.equal(w.gas.weight,3.24);
 G.weapons[0].evolved=true;assert.equal(weights().rifle.weight,3.24);
 G.choiceAbsence={pistols:5};assert.equal(weights().pistols.weight,3.36);G.choiceAbsence.pistols=99;assert.equal(weights().pistols.weight,3.36);
});
test('absence advances only once per completed session, offers across rerolls reset it and reload preserves history',()=>{
 const a=beginChoiceSession();rollChoices(1);const eligible=[...G.choiceSession.eligibleIds],first=[...G.choiceSession.offeredIds];
 assert.deepEqual(G.choiceAbsence,{});for(let i=0;i<5;i++)rollChoices(1);assert.deepEqual(G.choiceAbsence,{});
 const offered=[...G.choiceSession.offeredIds],snap=snapshotBuild();resetBuild();restoreBuild(snap);assert.deepEqual(G.choiceSession.offeredIds,offered);assert.notEqual(G.choiceSession.offeredIds,snap.choiceSession.offeredIds);
 assert.equal(finishChoiceSession(a.id),true);for(const id of eligible)assert.equal(G.choiceAbsence[id],offered.includes(id)?0:1);const history={...G.choiceAbsence};assert.equal(finishChoiceSession(a.id),false);assert.deepEqual(G.choiceAbsence,history);
 const saved=snapshotBuild();resetBuild();restoreBuild(saved);assert.deepEqual(G.choiceAbsence,history);assert.ok(first.length);
});
test('seeded first-card shares favor exploration and reduce fused repeats without removing normal upgrades',()=>{
 const pool=rollChoices(99).sort((a,b)=>a.id.localeCompare(b.id));const baseline=pool.map(c=>({...c,weight:c.id==='lotus_bloom'?3:c.isNew?c.weight/1.2/(['rifle','gas'].includes(c.id)?1.35:1):c.weight}));
 function measure(items){const random=seeded(),total=items.reduce((s,c)=>s+c.weight,0),out={new:0,fused:0,ordinary:0};for(let n=0;n<30000;n++){let r=random()*total;const c=items.find(c=>(r-=c.weight)<0)||items.at(-1);out[c.isNew?'new':WEAPONS[c.id]?.fusionOnly?'fused':'ordinary']++;}return out;}
 const before=measure(baseline),after=measure(pool);assert.ok(after.new>before.new);assert.ok(after.fused<before.fused*.4);assert.ok(after.ordinary>900);
 console.log('Seeded 30k first-card shares',JSON.stringify({before,after}));
 const original=Math.random;Math.random=seeded();try{let fused=0;for(let n=0;n<10000;n++)if(rollChoices(1)[0].id==='lotus_bloom')fused++;assert.ok(Math.abs(fused/10000-after.fused/30000)<.01);}finally{Math.random=original;}
});
test('three-card screens always retain eligible ordinary growth alongside discovery guarantees',()=>{
 for(let i=0;i<1000;i++){
  const cards=rollChoices(3);assert.ok(cards.some(c=>!c.isNew&&(c.kind==='passive'||c.kind==='weapon'&&!WEAPONS[c.id].fusionOnly)));assert.equal(new Set(cards.map(c=>c.id)).size,3);
 }
 // 연꽃 가시 보장은 아직 만개 연꽃포 재료로 소모되지 않았을 때만 적용된다.
 G.weapons=[createWeapon('shotgun',0)];G.level=4;G.passives={heart:1,nose:1,hide:1,focus:1,sap:1};let cards=rollChoices(3);assert.ok(cards.some(c=>c.id==='thorns'));assert.ok(cards.some(c=>!c.isNew));
 G.weapons=[createWeapon('lotus_bloom',0)];G.passives={};G.level=2;const original=Math.random;Math.random=()=>.99;try{cards=rollChoices(3);assert.ok(cards.every(c=>c.isNew));}finally{Math.random=original;}
});

test('fusion materials are never offered again; unacquired items take their place',()=>{
 G.weapons=[createWeapon('lotus_bloom',0)];G.passives={};
 for(let i=0;i<500;i++){const cards=rollChoices(3);assert.ok(!cards.some(c=>c.id==='thorns'||c.id==='cannon'),'cannon/thorns were consumed by lotus bloom');}
 G.consumedItems=new Set(['shotgun','rifle']);G.weapons=[createWeapon('scatter_rail',0),createWeapon('lotus_bloom',1)];
 const pool=rollChoices(99);for(const id of ['shotgun','rifle','thorns','cannon'])assert.ok(!pool.some(c=>c.id===id),id);
 const pistols=pool.find(c=>c.id==='pistols');G.consumedItems=new Set();const before=rollChoices(99).find(c=>c.id==='pistols');
 assert.ok(pistols.weight>before.weight*1.9,'unacquired items are boosted after a fusion');
 G.consumedItems=new Set(['gas']);const snap=snapshotBuild();resetBuild();assert.equal(G.consumedItems.size,0);restoreBuild(snap);assert.ok(G.consumedItems.has('gas'));
});
