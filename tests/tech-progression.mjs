import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer} from '../src/game/player.js';
import {createWeapon,weaponStats,hellfireTrailStats,updateWeapons} from '../src/game/weapons.js';
import {updateHazards} from '../src/game/hazards.js';
import {resetBuild,applyChoice,snapshotBuild,restoreBuild,xpForLevel} from '../src/game/progression.js';
import {FUSION_RECIPES} from '../src/data/fusions.js';
import {tierPower} from '../src/data/weapons.js';
beforeEach(()=>{resetBuild();clearWorld();createPlayer();G.mode='play';G.stage=1;G.gold=0;G.clock=1;G.events={};G.boss=null;G.caps={particles:0,texts:0};G.grid.reset();});
const w=(id,level,evolved=false)=>Object.assign(createWeapon(id,0),{level,evolved});
const damageRate=item=>{const s=weaponStats(item);return s.dmg*s.amount/s.cd};
test('cost curve slows discovery while concentrated mid and final tech increase deterministic damage per cooldown',()=>{
 const ref=lv=>12+(lv-1)*12+Math.max(0,lv-4)*10+Math.max(0,lv-9)*18+Math.max(0,lv-12)*40+Math.max(0,lv-17)*90+Math.max(0,lv-26)*140; // 5·10·13·18·27레벨부터 단계적 가속
 assert.equal(xpForLevel(1),12);assert.equal(xpForLevel(10),ref(10));assert.equal(xpForLevel(20),ref(20));assert.equal(xpForLevel(40),ref(40));assert.ok(xpForLevel(40)>xpForLevel(20)*4);
 const scattered=damageRate(w('shotgun',1))+damageRate(w('rifle',1));const focused=damageRate(w('shotgun',5))+damageRate(w('rifle',5));
 const final=damageRate(w('scatter_rail',8));assert.ok(focused>scattered*2);assert.ok(final>focused*1.4,`final ${final} vs focused ${focused}`);// 최종 무기 하향으로 1.5배 -> 1.4배 (관통 산탄포 Lv8 ≈ 1.46배)
 for(const recipe of FUSION_RECIPES){const early=damageRate(w(recipe.output,1)),mid=damageRate(w(recipe.output,5)),late=damageRate(w(recipe.output,8));assert.ok(mid>early*1.3,recipe.id);assert.ok(late>mid*1.15,recipe.id);}
 const plain=weaponStats(w('molotov',8)),evolved=weaponStats(w('molotov',8,true));assert.ok(evolved.dmg>=plain.dmg*1.85); // 무기 밸런스: 화염병 기본 피해를 올린 만큼 진화 보정을 낮췄다 (지옥 불꽃길 장판·범위는 그대로)assert.ok(evolved.duration>plain.duration*2);
});
test('hellfire trail has large real footprint and six-second lifetime, with bounded passive scaling and restore',()=>{
 const item=w('molotov',8,true);item.cd=999;G.weapons=[item];G.player.vx=1;updateWeapons(.01);assert.equal(G.hazards.count,1);
 const h=G.hazards.items[0];assert.ok(Math.abs(h.radius-138.24)<1e-8);assert.equal(h.duration,6);
 const enemy=(id,dx)=>({id,x:h.x+dx,y:h.y,radius:1,alive:true,hp:10000,maxHp:10000,mass:1,kx:0,ky:0,slow:0,slowT:0,hits:{}});
 const inside=enemy(1,h.radius-.1),outside=enemy(2,h.radius+.1);G.grid.insert(inside);G.grid.insert(outside);updateHazards(.1);assert.ok(inside.hp<10000);assert.equal(outside.hp,10000);
 updateHazards(2.1);assert.equal(G.hazards.count,1);updateHazards(3.9);assert.equal(G.hazards.count,0);
 for(let level=1;level<=5;level++){applyChoice({kind:'passive',id:'spread',level});applyChoice({kind:'passive',id:'sap',level});}
 const stats=hellfireTrailStats(weaponStats(item));assert.ok(Math.abs(stats.radius-228.096)<1e-8); // 확산 Lv5 = 범위 +65% (레벨당 13%)assert.equal(stats.duration,6,'sap now boosts XP, not duration');const snap=snapshotBuild();resetBuild();restoreBuild(snap);assert.deepEqual(hellfireTrailStats(weaponStats(G.weapons[0])),stats);
 assert.equal(hellfireTrailStats({...weaponStats(G.weapons[0]),durationScale:99}).duration,10);
});
test('final fused damage remains capped under extreme passive bonuses',()=>{
 G.player.stats.might=100;for(const recipe of FUSION_RECIPES){const f=w(recipe.output,8);assert.ok(Math.abs(weaponStats(f).dmg-(recipe.tier==='absolute'?420:220)*tierPower(f))<1e-9);}
});
