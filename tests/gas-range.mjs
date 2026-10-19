import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {G,clearWorld} from '../src/game/state.js';
import {createPlayer} from '../src/game/player.js';
import {createWeapon,weaponStats,updateWeapons,updateShots} from '../src/game/weapons.js';
import {updateHazards} from '../src/game/hazards.js';
import {resetBuild,applyChoice,snapshotBuild,restoreBuild} from '../src/game/progression.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
beforeEach(()=>{clearWorld();resetBuild();createPlayer();G.mode='play';G.stage=1;G.clock=1;G.gold=0;G.boss=null;G.events={};G.caps={particles:0,texts:0};G.grid.reset();});
const radius=w=>{const s=weaponStats(w);return s.radius*s.area};
function fire(id,evolved=false,level=1){const w=Object.assign(createWeapon(id,0),{evolved,level,cd:0});G.weapons=[w];updateWeapons(.01);updateShots(.6);return w;}
test('gas range grows forty percent at base, level and evolved; spread propagates exactly once through restore',()=>{
 let w=createWeapon('gas',0);near(radius(w),98);w.level=8;near(radius(w),112.7);w.evolved=true;near(radius(w),157.78);
 G.weapons=[w];for(let level=1;level<=5;level++)applyChoice({kind:'passive',id:'spread',level});near(radius(w),236.67);
 const snap=snapshotBuild();resetBuild();restoreBuild(snap);near(radius(G.weapons[0]),236.67);
});
test('actual grenade fields use expanded radii and exact ellipse damage boundaries',()=>{
 for(const [id,r] of [['gas',98],['plague_fire',100]]){
  G.hazards.clear();G.shots.clear();G.grid.reset();fire(id);const h=G.hazards.items[0];near(h.radius,r);while(G.hazards.count>1)G.hazards.release(G.hazards.count-1);
  const enemy=(n,dx,dy)=>({id:n,x:h.x+dx,y:h.y+dy,radius:1,alive:true,hp:1000,maxHp:1000,mass:1,kx:0,ky:0,slow:0,slowT:0,hits:{}});
  const inside=enemy(1,r-.1,0),outside=enemy(2,r+.1,0),verticalIn=enemy(3,0,r*.7-.1),verticalOut=enemy(4,0,r*.7+.1);
  for(const e of [inside,outside,verticalIn,verticalOut])G.grid.insert(e);updateHazards(.01);
  assert.ok(inside.hp<1000);assert.ok(verticalIn.hp<1000);assert.equal(outside.hp,1000);assert.equal(verticalOut.hp,1000);assert.ok(inside.slow>0);
 }
});
test('evolved following cloud never shrinks back to old hardcoded radius on refresh',()=>{
 const w=fire('gas',true,8);const h=w.follow;near(h.radius,157.78);w.cd=0;updateWeapons(.01);assert.equal(w.follow,h);near(h.radius,157.78);
 applyChoice({kind:'passive',id:'spread',level:1});w.cd=0;updateWeapons(.01);near(h.radius,173.558);assert.equal(G.hazards.count,1);
});
test('plague fire shares increased area while gas-derived bullet and saw hitboxes stay unchanged',()=>{
 const w=createWeapon('plague_fire',0);near(radius(w),100);w.level=8;near(radius(w),112);G.player.stats.area=100;near(radius(w),200);G.player.stats.area=1;
 for(const [id,r] of [['toxic_scatter',4],['venom_saw',14]]){G.shots.clear();G.hazards.clear();const w=Object.assign(createWeapon(id,0),{cd:0});G.weapons=[w];updateWeapons(.01);assert.ok(G.shots.count>0);for(const sh of G.shots.items.slice(0,G.shots.count))near(sh.radius,r);}
});
