import test from 'node:test';
import assert from 'node:assert/strict';
import { createPetalCharge, chargePetal, spendPetal } from '../src/game/petal-charge.js';
import { characterProgress, petalStats, awardCharacterXP, CHARACTER_XP_CAP } from '../src/core/character-progression.js';
import { defaultProgress, createGuestAdapter } from '../src/core/progression-store.js';
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; };
test('charge only real distinct kills, caps at 100 and spends exactly once', () => {
 const s=createPetalCharge(); assert.equal(spendPetal(s), false);
 for(let n=1;n<=40;n++) chargePetal(s,{killCount:n});
 assert.equal(s.charge,100); assert.equal(spendPetal(s),true); assert.equal(spendPetal(s),false);
 chargePetal(s,{killCount:40}); assert.equal(s.charge,0);
 chargePetal(s,{killCount:41,cannonKill:true}); assert.equal(s.charge,0);
 chargePetal(s,{killCount:42,elite:true}); assert.equal(s.charge,10);
});
test('pause/death cannot charge or fire and fresh stage clears charge',()=>{
 const s=createPetalCharge(); for(let n=1;n<=20;n++) chargePetal(s,{killCount:n});
 assert.equal(spendPetal(s,{active:false}),false); assert.equal(s.charge,100);
 const fresh=createPetalCharge(); chargePetal(fresh,{killCount:1,active:false}); assert.equal(fresh.charge,0);
});
test('permanent XP thresholds and cannon growth have explicit caps',()=>{
 assert.equal(characterProgress(99).level,1); assert.equal(characterProgress(100).level,2);
 assert.equal(characterProgress(220).level,3); assert.equal(characterProgress(CHARACTER_XP_CAP).level,50);
 assert.deepEqual(petalStats(1),{level:1,damage:80,radius:170});
 assert.deepEqual(petalStats(1000),{level:50,damage:668,radius:340});
 assert.deepEqual(petalStats(NaN),petalStats(1));
});
test('v3 migration preserves wallet, pets, relics and backup while adding permanent XP',()=>{
 const store=memory();const legacy={...defaultProgress(),version:3,gold:345,inventory:['pet_yeongnyang'],equippedPet:'pet_yeongnyang',relics:['star_wings'],upgrades:{might:2},chestPity:5,maxStage:5};
 delete legacy.characterXP; delete legacy.maxClearedStage; store.setItem('kfp.progress.v3.guest',JSON.stringify(legacy));
 const a=createGuestAdapter(store);let s=a.load(); assert.equal(s.version,4);assert.equal(s.gold,345);assert.equal(s.characterXP,0);assert.equal(s.equippedPet,'pet_yeongnyang');assert.deepEqual(s.relics,['star_wings']);assert.equal(s.upgrades.might,2);assert.equal(s.chestPity,5);assert.equal(s.maxClearedStage,4);
 const r=awardCharacterXP(s,{amount:220,requestId:'run:1',expectedCount:0});assert.equal(r.ok,true);a.commit(r.state);
 s=createGuestAdapter(store).load();assert.equal(s.characterXP,220);assert.equal(characterProgress(s.characterXP).level,3);assert.deepEqual(JSON.parse(store.getItem('kfp.progress.v3.guest')),legacy);
 assert.equal(awardCharacterXP(s,{amount:220,requestId:'run:1',expectedCount:0}).duplicate,true);
});
test('sequence prevents ancient reward replay after receipt eviction; invalid reward is rejected',()=>{
 let s=defaultProgress();const first={amount:1,requestId:'run:0',expectedCount:0};s=awardCharacterXP(s,first).state;
 for(let n=1;n<140;n++)s=awardCharacterXP(s,{amount:1,requestId:`run:${n}`,expectedCount:n}).state;
 assert.equal(s.characterXP,140);assert.equal(awardCharacterXP(s,first).code,'STALE_CHARACTER_REWARD');
 assert.equal(awardCharacterXP(s,{amount:-1,requestId:'bad',expectedCount:140}).ok,false);
 assert.equal(awardCharacterXP(s,{amount:2,requestId:'run:139',expectedCount:139}).code,'REWARD_ID_CONFLICT');
});
test('failed storage does not grant XP; queued settlements retry once in sequence',async()=>{
 const storage=memory();globalThis.localStorage=storage;const api=await import('../src/core/save.js');const write=storage.setItem;
 storage.setItem=()=>{throw Error('full')};assert.equal(api.queueCharacterXP(100,'stage:1'),false);assert.equal(api.save.characterXP,0);
 assert.equal(api.queueCharacterXP(120,'stage:2'),false);assert.equal(api.pendingCharacterXP(),220);
 storage.setItem=write;assert.equal(api.retryPendingCharacterXP(),true);assert.equal(api.save.characterXP,220);assert.equal(api.pendingCharacterXP(),0);
 assert.equal(api.queueCharacterXP(120,'stage:2',1),true);assert.equal(api.save.characterXP,220);
});
test('runtime cannon gates paused/dead modes, hits once and excludes reentrant self-charge',async()=>{
 const {G}=await import('../src/game/state.js');
 const cannon=await import('../src/game/petal-cannon.js');
 G.player={x:0,y:0,hp:100,dead:false,stats:{crit:0}};G.mode='play';G.paused=false;G.kills=0;G.clock=0;G.caps={particles:100,texts:10};G.enemies.clear();cannon.resetPetalCannon();
 for(let n=1;n<=20;n++){G.kills=n;cannon.creditPetalKill({});}
 assert.equal(cannon.getPetalStatus().charge,100);
 G.paused=true;assert.equal(cannon.firePetalCannon(),false);assert.equal(cannon.getPetalStatus().charge,100);
 G.paused=false;G.mode='dead';assert.equal(cannon.firePetalCannon(),false);G.mode='play';
 let hits=0;G.boss={alive:true,x:50,y:0,radius:10,hurt(dmg){hits++;assert.ok(dmg>=80);assert.equal(cannon.firePetalCannon(),false);G.kills++;cannon.creditPetalKill({elite:true});}};
 assert.equal(cannon.firePetalCannon(),true);assert.equal(hits,1);assert.equal(cannon.getPetalStatus().charge,0);assert.equal(cannon.firePetalCannon(),false);
 G.boss=null;cannon.resetPetalCannon();assert.equal(cannon.getPetalStatus().charge,0);
});
