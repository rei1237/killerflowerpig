import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {bossRewardTier} from '../src/data/boss-rewards.js';
const data=new Map();let failWrites=false;
globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(failWrites)throw Error('quota');data.set(k,v);}};
const {G}=await import('../src/game/state.js');
const {createPlayer}=await import('../src/game/player.js');
const {createWeapon}=await import('../src/game/weapons.js');
const {resetBuild,rollBossChest,rollChest}=await import('../src/game/progression.js');
const {queueCoins,retryPendingCoins,pendingCoinTotal,save}=await import('../src/core/save.js');
const {WEAPONS,PASSIVES}=await import('../src/data/weapons.js');
beforeEach(()=>{resetBuild();createPlayer();G.stage=1;G.gold=0;G.weapons=[createWeapon('shotgun',0)];});
test('stage tiers provide exact guaranteed counts and published independent premium odds',()=>{
 for(const [stage,count,chance] of [[1,2,.2],[2,2,.2],[3,3,.35],[5,3,.35],[6,5,.5],[8,5,.5],[9,5,.65],[10,5,.65]]){
  const tier=bossRewardTier(stage);assert.equal(tier.guaranteedCount,count);assert.equal(tier.premiumChance,chance);
  resetBuild();G.stage=stage;G.gold=0;G.weapons=[];let r=rollBossChest(`miss:${stage}`,()=>chance);assert.equal(r.premiumWon,false);assert.equal(r.rewards.length,count);
  r=rollBossChest(`hit:${stage}`,()=>chance-.000001);assert.equal(r.premiumWon,true);assert.equal(r.rewards.length,count+1);
 }
});
test('premium doubles an owned weapon upgrade after guaranteed rewards and clamps at level8',()=>{
 let r=rollBossChest('early',()=>0);const premium=r.rewards.find(x=>x.premium);assert.equal(premium.fromLevel,3);assert.equal(premium.level,5);assert.equal(premium.levelsGained,2);assert.equal(premium.rewardName,'연꽃 정밀 강화재');assert.equal(premium.rewardIconId,'premium_upgrade');assert.equal(premium.desc,`${premium.name} Lv.3 → Lv.5 · +2 강화, 최대 8`);
 resetBuild();G.gold=0;G.weapons=[Object.assign(createWeapon('lotus_bloom',0),{level:5})];r=rollBossChest('nearcap',()=>0);const capped=r.rewards.find(x=>x.premium);assert.equal(capped.fromLevel,7);assert.equal(capped.level,8);assert.equal(capped.levelsGained,1);assert.equal(G.weapons[0].level,8);
});
test('same boss session never rerolls, upgrades or credits twice and cached result is isolated',()=>{
 const first=rollBossChest('same',()=>0),level=G.weapons[0].level,gold=G.gold;first.rewards[0].name='mutated';
 const again=rollBossChest('same',()=>{throw Error('must not reroll');});assert.equal(again.duplicate,true);assert.equal(G.weapons[0].level,level);assert.equal(G.gold,gold);assert.notEqual(again.rewards[0].name,'mutated');
});
test('no eligible upgrade falls back to bounded coins and excludes every permanent shop category',()=>{
 G.stage=10;G.weapons=[Object.assign(createWeapon('venom_saw',0),{level:8})];const r=rollBossChest('maxed',()=>0);
 // 금화 축소: 상자 대체금 3+stage, 만렙 회수금 8+2*stage
 assert.equal(G.gold,5*13+28);assert.equal(r.rewards.at(-1).amount,28);assert.equal(r.rewards.at(-1).rewardName,'만렙 회수금');assert.equal(r.rewards.at(-1).rewardIconId,'gold');
 for(const reward of r.rewards){assert.ok(reward.id==='gold'||WEAPONS[reward.id]||PASSIVES[reward.id]);assert.ok(!['pet','accessory','relic'].includes(reward.kind));}
});
test('ordinary chest remains one basic reward and invalid boss requests do not mutate',()=>{
 const before=JSON.stringify({weapons:G.weapons,gold:G.gold});assert.equal(rollBossChest('').ok,false);assert.equal(JSON.stringify({weapons:G.weapons,gold:G.gold}),before);
 assert.equal(rollChest(1,()=>0).length,1);assert.equal(G.weapons[0].level,2);
});
test('failed permanent coin write queues boss fallback once and retry never rerolls the rewards',()=>{
 G.weapons=[];const before=save.gold;const r=rollBossChest('storage-chest',()=>0),amount=G.gold;assert.equal(r.ok,true);
 failWrites=true;assert.equal(queueCoins(amount,'boss:storage-chest'),false);assert.equal(save.gold,before);assert.equal(pendingCoinTotal(),amount);
 assert.equal(rollBossChest('storage-chest',()=>{throw Error('retry rolled');}).duplicate,true);assert.equal(G.gold,amount);
 failWrites=false;assert.equal(retryPendingCoins(),true);assert.equal(save.gold,before+amount);assert.equal(queueCoins(amount,'boss:storage-chest'),true);assert.equal(save.gold,before+amount);assert.equal(pendingCoinTotal(),0);
});
