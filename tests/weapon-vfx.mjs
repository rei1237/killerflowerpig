import { treasureRandom } from '../src/game/coin-drops.js'; treasureRandom.next = () => .99; // 보물 상자 굴림 고정: 처치가 섞인 테스트가 난수 때문에 흔들리지 않게
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const media={matches:false};globalThis.window={matchMedia:()=>media};
let canvases=0;
function context(){
 const ops=[],stack=[],ctx={globalAlpha:.71,globalCompositeOperation:'source-over',fillStyle:'#123',strokeStyle:'#456',lineWidth:3,lineCap:'butt',ops,
 save(){stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineCap:this.lineCap});},restore(){Object.assign(this,stack.pop());},createRadialGradient(){return {addColorStop(){}};}};
 for(const name of ['translate','rotate','beginPath','closePath','moveTo','lineTo','fill','stroke','fillRect','roundRect','ellipse','arc','drawImage'])ctx[name]=function(...args){ops.push({name,args:args.map(a=>a&&typeof a==='object'?{width:a.width,height:a.height}:a),alpha:this.globalAlpha,color:name==='stroke'?this.strokeStyle:this.fillStyle,composite:this.globalCompositeOperation});};
 return ctx;
}
globalThis.document={createElement(){canvases++;return {width:1,height:1,getContext:()=>context()};}};
const {G,clearWorld}=await import('../src/game/state.js');
const {settings}=await import('../src/core/settings.js');
const {fx}=await import('../src/core/assets.js');
const {WEAPONS}=await import('../src/data/weapons.js');
const {FUSION_RECIPES}=await import('../src/data/fusions.js');
const {drawShots,orbitStats}=await import('../src/game/weapons.js');
const {WEAPON_VFX,createWeaponVfxFrame,drawWeaponProjectile,drawWeaponBeam,drawWeaponOrbit,drawBeamHitAccents}=await import('../src/game/weapon-vfx.js');
function reset(){clearWorld();G.clock=2;G.lowQ=false;G.camera={x:0,y:0};G.view={w:1000,h:600};G.player={x:0,y:0};G.weapons=[];settings.flash=true;media.matches=false;for(const n of ['petal','petalBlood','saw','bullet','rail','bomb'])fx[n]={width:26,height:26};}
function shot(id='shotgun'){return {kind:'bullet',weapon:id,x:20,y:30,vx:200,vy:0,radius:5,angle:.3,life:.5,dmg:20,pierce:2,img:fx.bullet,lastHit:[1]};}
function beam(id='cannon'){return {weapon:id,x:0,y:0,angle:0,len:420,width:38,life:.3,max:.35,evolved:false};}

test('all eight ordinary, eight final and one absolute weapons have explicit distinct visual identities',()=>{
 assert.equal(Object.keys(WEAPON_VFX).length,21);for(const id of Object.keys(WEAPONS))assert.ok(WEAPON_VFX[id],id);
 const fused=FUSION_RECIPES.map(r=>WEAPON_VFX[r.id]);assert.equal(new Set(fused.map(p=>p.color+':'+p.shape)).size,13);
 assert.equal(WEAPON_VFX.cannon.shape,'petal');assert.equal(WEAPON_VFX.lotus_bloom.shape,'lotus');assert.equal(WEAPON_VFX.ember_lance.shape,'ember');
});

test('rendering all projectile and beam shapes leaves damage, collision and lifetime state untouched',()=>{
 reset();for(const id of Object.keys(WEAPON_VFX)){
  const sh=shot(id);if(['saw','venom_saw','orbit_saw'].includes(id)){sh.kind='saw';sh.radius=14;sh.spin=3;}
  if(['gas','molotov','plague_fire'].includes(id))Object.assign(sh,{kind:'lob',sx:0,sy:0,tx:120,ty:20,t:.2,dur:.55,spin:2});
  const b=beam(id),before=JSON.stringify({sh,b}),frame=createWeaponVfxFrame(false,2),ctx=context();drawWeaponProjectile(ctx,sh,frame);drawWeaponBeam(ctx,b,frame);
  assert.equal(JSON.stringify({sh,b}),before,id);assert.equal(ctx.globalAlpha,.71);assert.equal(ctx.globalCompositeOperation,'source-over');
  assert.ok(ctx.ops.every(op=>op.composite==='source-over'));assert.ok(ctx.ops.every(op=>op.alpha<=.95));
 }
});

test('main drawShots is pure, preserves source sprite dimensions, and culls distant shots',()=>{
 reset();const sh=Object.assign(G.shots.spawn(),shot());const b=Object.assign(G.beams.spawn(),beam());const before=JSON.stringify({sh,b,player:G.player,shots:G.shots.count,beams:G.beams.count});
 const ctx=context();drawShots(ctx);assert.equal(JSON.stringify({sh,b,player:G.player,shots:G.shots.count,beams:G.beams.count}),before);
 assert.ok(ctx.ops.some(op=>op.name==='drawImage'&&op.args[1]===-13&&op.args[2]===-13&&op.args[3]===26&&op.args[4]===26));
 G.beams.clear();sh.x=5000;const culled=context();drawShots(culled);assert.equal(culled.ops.length,0);
});

test('orbital centers and sizes use the existing orbitStats geometry, including saw fusion',()=>{
 reset();for(const id of ['thorns','lotus_bloom','orbit_saw']){
  const w={id,level:1,angle:.5,evolved:false},s=orbitStats(w,{amount:2,radius:78,area:1.3,duration:3,dmg:20,speed:3.4,hitCd:.4}),p={x:40,y:50};
  const before=JSON.stringify({w,s,p}),ctx=context();drawWeaponOrbit(ctx,w,s,p,createWeaponVfxFrame(false,2));assert.equal(JSON.stringify({w,s,p}),before);
  const positions=ctx.ops.filter(op=>op.name==='translate');assert.equal(positions.length,s.amount);
  for(let i=0;i<s.amount;i++){const a=w.angle+(i/s.amount)*Math.PI*2,R=s.radius*s.area;assert.deepEqual(positions[i].args,[p.x+Math.cos(a)*R,p.y-20+Math.sin(a)*R*.8]);}
  const sprite=ctx.ops.find(op=>op.name==='drawImage');assert.equal(sprite.args[3],26*s.area);assert.equal(sprite.args[4],26*s.area);
 }
});

test('heavy effects obey frame-wide detail and petal caps, reserving flower-beam detail',()=>{
 reset();for(const low of [false,true]){
  const f=createWeaponVfxFrame(low,3),ctx=context();for(let i=0;i<200;i++)drawWeaponProjectile(ctx,shot('toxic_scatter'),f);
  const before=f.detailsUsed;for(let i=0;i<50;i++)drawWeaponBeam(ctx,beam('lotus_bloom'),f);
  assert.ok(f.detailsUsed>before,'flower beam retains its reserved decoration after a bullet swarm');assert.ok(f.detailsUsed<=(low?24:72));assert.ok(f.petalsUsed<=(low?10:32));
  assert.ok(ctx.ops.filter(o=>o.name==='drawImage').length>=200,'primary bullet bodies never disappear with decorative budget');
 }
});

test('reduced motion freezes optional spin and drift, while optional glow can be disabled independently',()=>{
 reset();for(const mode of ['os','settings']){
  media.matches=mode==='os';settings.flash=mode!=='settings';const a=context(),b=context();drawWeaponBeam(a,beam(),createWeaponVfxFrame(false,1));drawWeaponBeam(b,beam(),createWeaponVfxFrame(false,20));assert.deepEqual(a.ops,b.ops);
  const sh={...shot('saw'),kind:'saw',spin:3};const c=context();drawWeaponProjectile(c,sh,createWeaponVfxFrame(false,2));assert.ok(c.ops.some(o=>o.name==='rotate'&&o.args[0]===0));
 }
 settings.flash=true;media.matches=false;const c=context();drawWeaponBeam(c,beam(),createWeaponVfxFrame(false,2,{projectileGlow:false}));assert.equal(c.ops.filter(o=>o.name==='drawImage').length,0);assert.ok(c.ops.some(o=>o.name==='stroke'));
});

test('hit accents require actual damage flash inside a live beam and are strictly bounded',()=>{
 reset();const beams={count:1,items:[beam()]},enemies={count:40,items:Array.from({length:40},(_,i)=>({x:20+i*5,y:10,radius:10,flash:0}))};
 let f=createWeaponVfxFrame(false,2);drawBeamHitAccents(context(),beams,enemies,null,f);assert.equal(f.impactsUsed,0);
 for(const e of enemies.items)e.flash=.05;
 for(const low of [false,true]){f=createWeaponVfxFrame(low,2);drawBeamHitAccents(context(),beams,enemies,null,f);assert.equal(f.impactsUsed,low?3:8);}
 for(const e of enemies.items)e.y=500;f=createWeaponVfxFrame(false,2);drawBeamHitAccents(context(),beams,enemies,null,f);assert.equal(f.impactsUsed,0);
});

test('texture cache is reused and rendering never spawns particles, applies damage or uses randomness',()=>{
 reset();drawWeaponBeam(context(),beam(),createWeaponVfxFrame(false,2));const before=canvases;for(let i=0;i<10;i++)drawWeaponBeam(context(),beam(),createWeaponVfxFrame(false,2));assert.equal(canvases,before);
 const helper=fs.readFileSync(new URL('../src/game/weapon-vfx.js',import.meta.url),'utf8');assert.doesNotMatch(helper,/Math.random\(|spawnParticle\(|\.spawn\(|hitEnemy\(|\.hurt\(|shadowBlur|createRadialGradient/);
 const draw=fs.readFileSync(new URL('../src/game/weapons.js',import.meta.url),'utf8').split('export function drawShots(ctx) {')[1];assert.doesNotMatch(draw,/\.spawn\(|\.hurt\(|hitEnemy\(|updateShots\(|updateWeapons\(/);
});

const {recordFusionHit,drawFusionResidues,drawFusionHitAccents}=await import('../src/game/weapon-vfx.js');
const {hitEnemy}=await import('../src/game/enemies.js');
test('fusion slow cues require a real damaging hit, stop with slow, and reject pooled ID reuse',()=>{
 reset();G.clock=10;G.caps={particles:100,texts:20};G.player.stats={crit:0};G.damageBy={};const e={id:200,alive:true,x:20,y:20,radius:10,hp:1000,maxHp:1000,slow:0,slowT:0};const pool={count:1,items:[e]};
 let frame=createWeaponVfxFrame(false,10),ctx=context();drawFusionHitAccents(ctx,pool,null,frame);assert.equal(frame.impactsUsed,0);
 hitEnemy(e,10,{weapon:'toxic_scatter',slow:.4,silent:true});assert.equal(e.hp,990);assert.equal(e.slowT,.5);
 frame=createWeaponVfxFrame(false,10.1);drawFusionHitAccents(context(),pool,null,frame);assert.equal(frame.statusUsed,1);assert.equal(e.hp,990);
 e.slowT=0;frame=createWeaponVfxFrame(false,10.1);drawFusionHitAccents(context(),pool,null,frame);assert.equal(frame.impactsUsed,0);
 e.slowT=.5;e.id++;frame=createWeaponVfxFrame(false,10.1);drawFusionHitAccents(context(),pool,null,frame);assert.equal(frame.impactsUsed,0);
});
test('fusion impact marks follow recorded hits rather than unrelated damage under a beam',()=>{
 reset();const e={id:21,alive:true,x:60,y:10,radius:10,flash:.06};const pool={count:1,items:[e]},beams={count:1,items:[beam('lotus_bloom')]};
 let f=createWeaponVfxFrame(false,2);drawBeamHitAccents(context(),beams,pool,null,f);assert.equal(f.impactsUsed,0);
 recordFusionHit(e,'lotus_bloom',2);f=createWeaponVfxFrame(false,2.01);drawFusionHitAccents(context(),pool,null,f);assert.equal(f.impactsUsed,1);
 f=createWeaponVfxFrame(false,2.2);drawFusionHitAccents(context(),pool,null,f);assert.equal(f.impactsUsed,0);
});
test('only live actual fusion fire fields receive bounded exact-footprint residue cues',()=>{
 reset();const h={alive:true,kind:'fire',weapon:'plague_fire',x:20,y:30,radius:72,t:.6,duration:3.6,dmg:9,slow:.45},hazards={count:20,items:Array.from({length:20},(_,i)=>({...h,x:i*10}))};
 const before=JSON.stringify(hazards),ctx=context(),f=createWeaponVfxFrame(true,2);drawFusionResidues(ctx,hazards,f);assert.equal(f.fieldsUsed,3);assert.ok(f.detailsUsed<=24);
 const edge=ctx.ops.find(o=>o.name==='ellipse');assert.deepEqual(edge.args,[0,30,72,72*.7,0,0,Math.PI*2]);assert.equal(JSON.stringify(hazards),before);
 for(const override of [{weapon:'molotov'},{kind:'acid'},{alive:false},{t:4},{x:5000}]){const c=context(),frame=createWeaponVfxFrame(false,2);drawFusionResidues(c,{count:1,items:[{...h,...override}]},frame,{x0:-500,x1:500,y0:-500,y1:500});assert.equal(frame.fieldsUsed,0);}
});
test('fusion residue motion freezes with reduced motion and actual fields never imply extra DoT',()=>{
 reset();media.matches=true;const h={alive:true,kind:'fire',weapon:'ember_lance',x:20,y:30,radius:54,t:.6,duration:3,dmg:7.68},pool={count:1,items:[h]};const a=context(),b=context(),before=JSON.stringify(h);
 drawFusionResidues(a,pool,createWeaponVfxFrame(false,2));drawFusionResidues(b,pool,createWeaponVfxFrame(false,20));assert.deepEqual(a.ops,b.ops);assert.equal(JSON.stringify(h),before);media.matches=false;
});
test('fused hit and slow cues share the existing strict impact budget',()=>{
 reset();const pool={count:30,items:Array.from({length:30},(_,i)=>({id:i,alive:true,x:i*3,y:10,radius:10,flash:.08,slow:.4,slowT:.5}))};for(const e of pool.items)recordFusionHit(e,'venom_saw',2,.4);
 for(const low of [true,false]){const f=createWeaponVfxFrame(low,2);drawFusionHitAccents(context(),pool,null,f);assert.equal(f.impactsUsed,low?3:8);assert.equal(f.statusUsed,low?3:8);assert.ok(f.scanLeft>=0);}
});
