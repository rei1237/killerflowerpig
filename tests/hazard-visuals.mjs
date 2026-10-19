import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const media={matches:false};
globalThis.window={matchMedia:()=>media};
let canvasCreates=0;
function context() {
 const ops=[],stack=[];
 const ctx={globalAlpha:.73,globalCompositeOperation:'source-over',fillStyle:'#123',strokeStyle:'#456',lineWidth:4,dash:[],ops,
  save(){stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,dash:this.dash});},
  restore(){Object.assign(this,stack.pop());},
  setLineDash(v){this.dash=[...v];},createRadialGradient(){return {addColorStop(){}};},
 };
 for(const name of ['beginPath','closePath','ellipse','arc','fill','stroke','fillRect','strokeRect','moveTo','lineTo','clip','translate','rotate','drawImage'])ctx[name]=function(...args){ops.push({name,args:args.map(a=>typeof a==='object'?{width:a.width,height:a.height}:a),alpha:this.globalAlpha,fill:this.fillStyle,stroke:this.strokeStyle,width:this.lineWidth,dash:[...this.dash]});};
 return ctx;
}
globalThis.document={createElement(name){assert.equal(name,'canvas');canvasCreates++;return {width:0,height:0,getContext:()=>context()};}};
const {G,clearWorld}=await import('../src/game/state.js');
const {settings}=await import('../src/core/settings.js');
const {spawnHazard,drawHazards}=await import('../src/game/hazards.js');
function reset(kind='acid',extra={}) {
 clearWorld();G.clock=2;G.lowQ=false;G.camera={x:0,y:0};G.view={w:1000,h:600};settings.flash=true;media.matches=false;
 const h=spawnHazard(kind,15,25,{radius:80,duration:4,dmg:6,tick:.4,delay:1,len:400,width:20,...extra});h.t=.5;return h;
}
function draw(){const ctx=context();drawHazards(ctx);return ctx;}

test('poison edge exactly matches its damaging ellipse and stays legible at appearance and expiry',()=>{
 const h=reset();
 for(const time of [0,.15,3.99]) {
  h.t=time;const before=JSON.stringify(h),ctx=draw();
  assert.ok(ctx.ops.some(o=>o.name==='ellipse'&&o.args[0]===15&&o.args[1]===25&&o.args[2]===80&&o.args[3]===56));
  const edge=ctx.ops.find(o=>o.name==='stroke'&&o.stroke==='#c3e66d');assert.ok(edge);assert.ok(edge.alpha>=.4&&edge.alpha<=.9);assert.equal(edge.width,1.7);assert.deepEqual(edge.dash,[]);
  assert.ok(ctx.ops.some(o=>o.name==='stroke'&&o.stroke==='#07111b'&&o.width===5));
  assert.equal(JSON.stringify(h),before,'rendering cannot change damage, timing, or collision');
  for(const op of ctx.ops)assert.ok(op.alpha>=0&&op.alpha<=1,op.alpha);
 }
 const late=draw().ops.find(o=>o.name==='fill'&&o.fill==='#27381d');h.t=1;const active=draw().ops.find(o=>o.name==='fill'&&o.fill==='#27381d');assert.ok(late.alpha<active.alpha,'fog dissolves before the boundary disappears');
});

test('friendly fog and dangerous acid have different boundary color, dash and danger symbol',()=>{
 reset('gas');const gas=draw().ops;assert.ok(gas.some(o=>o.name==='stroke'&&o.stroke==='#64d7bc'&&o.dash.join(',')==='3,5'));assert.ok(!gas.some(o=>o.name==='fill'&&o.fill==='#172519'));
 reset('acid');const acid=draw().ops;assert.ok(acid.some(o=>o.name==='stroke'&&o.stroke==='#c3e66d'&&o.dash.length===0));assert.ok(acid.some(o=>o.name==='fill'&&o.fill==='#172519'));
});

test('cloud wisps are clipped, cached and capped; low quality reduces draw count',()=>{
 reset();const before=canvasCreates;const high=draw().ops;const after=canvasCreates;draw();draw();assert.equal(canvasCreates,after,'same two-color texture cache is reused');assert.ok(after-before<=1);
 assert.equal(high.filter(o=>o.name==='drawImage').length,3);assert.ok(high.some(o=>o.name==='clip'));
 G.lowQ=true;const low=draw().ops;assert.equal(low.filter(o=>o.name==='drawImage').length,1);assert.ok(low.some(o=>o.name==='stroke'&&o.stroke==='#c3e66d'));
});

test('heavy overlapping clouds share a hard frame-wide mist budget without losing danger boundaries',()=>{
 reset();for(let i=0;i<50;i++){const h=spawnHazard('acid',i,0,{radius:40,duration:4});h.t=1;}
 const high=draw().ops;assert.equal(high.filter(o=>o.name==='drawImage').length,48);assert.equal(high.filter(o=>o.name==='stroke'&&o.stroke==='#c3e66d').length,51);
 G.lowQ=true;const low=draw().ops;assert.equal(low.filter(o=>o.name==='drawImage').length,16);assert.equal(low.filter(o=>o.name==='stroke'&&o.stroke==='#c3e66d').length,51);
});

test('OS reduced motion and flash reduction freeze optional drift; pause is deterministic',()=>{
 reset();G.clock=1;const normal=draw().ops;G.clock=20;assert.notDeepEqual(draw().ops,normal);
 for(const policy of ['os','settings']) {
  media.matches=policy==='os';settings.flash=policy!=='settings';G.clock=1;const before=draw().ops;G.clock=20;assert.deepEqual(draw().ops,before,policy);
 }
 settings.flash=true;media.matches=false;G.clock=3;assert.deepEqual(draw().ops,draw().ops);
});

test('telegraphs show their full outer footprint immediately and progress using the real delay',()=>{
 let h=reset('tcircle');h.t=0;const early=draw().ops;assert.ok(early.some(o=>o.name==='ellipse'&&o.args[2]===80&&o.args[3]===56));
 h.t=.5;const half=draw().ops;assert.ok(half.some(o=>o.name==='ellipse'&&Math.abs(o.args[2]-74.4)<1e-8&&Math.abs(o.args[6]-Math.PI/2)<1e-8));
 h=reset('tline');h.t=.5;const line=draw().ops;assert.ok(line.some(o=>o.name==='strokeRect'&&o.args.join(',')==='0,-10,400,20'));assert.ok(line.some(o=>o.name==='fillRect'&&o.fill==='#fff1d3'&&o.args[2]===200));
});

test('offscreen hazards skip VFX and canvas state is restored for sprites and HUD',()=>{
 const h=reset();h.x=5000;assert.equal(draw().ops.length,0);
 h.x=15;const ctx=draw();assert.equal(ctx.globalAlpha,.73);assert.equal(ctx.globalCompositeOperation,'source-over');assert.equal(ctx.fillStyle,'#123');assert.equal(ctx.strokeStyle,'#456');assert.equal(ctx.lineWidth,4);assert.deepEqual(ctx.dash,[]);
});

test('hazard mechanics source remains unchanged: visual work adds no delays, hazards or particles',()=>{
 const source=fs.readFileSync(new URL('../src/game/hazards.js',import.meta.url),'utf8'),drawSource=source.slice(source.indexOf('// Draw-only styling:'));
 assert.doesNotMatch(drawSource,/spawnHazard\(|spawnParticle\(|damagePlayer\(|hitEnemy\(|Math.random\(|createRadialGradient\(|shadowBlur/);
 assert.match(source,/if \(dx \* dx \+ \(dy \* dy\) \/ 0.49 < h.radius \* h.radius\) damagePlayer\(h.dmg, h.x, h.y\)/);
 assert.match(source,/h.onFire\?\.\(h\);/);
});
