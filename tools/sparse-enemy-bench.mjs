// Paired current-weapon runs: only stage/enemy/director data switch to the fixed prior commit.
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
const before = process.argv.includes('--before');
if (before) {
 const replacements = new Map(['src/data/enemies.js','src/data/stages.js','src/game/spawner.js'].map(file =>
  [new URL('../'+file, import.meta.url).href, execFileSync('git',['show','f9c66526bfd0e95a4f2d376ea0e2bd6c38de0ee8:'+file],{encoding:'utf8'})]));
 registerHooks({load(url,context,next){return replacements.has(url)?{format:'module',source:replacements.get(url),shortCircuit:true}:next(url,context);}});
}
const {runFiniteWave,waveConfiguration}=await import('./nongun-wave-qa.mjs');
const {estimateWaveXP,simulatePlan,summarizePlans}=await import('./run-progression-audit.mjs');
const {TECHS}=await import('../src/data/techs.js');
const {STAGES}=await import('../src/data/stages.js');
const rows=[];
for(const legendary of [false,true])for(const id of ['gunline','executioner','bloom','plague','butcher'])for(const phase of ['base','mid','evolved']) {
 const runs=[1,7,13].map(seed=>runFiniteWave({id,phase,route:true,scene:'moving',count:12,seconds:30,seed,legendary}));
 rows.push({id,phase,legendary,investment:runs[0].config.investment,clearSeconds:runs.map(r=>r.clearTime),halfClearSeconds:runs.map(r=>r.t50),kills:runs.map(r=>r.kills),hpRange:runs[0].hpRange});
}
const introduction=[];
for(const id of ['gunline','executioner','bloom','plague','butcher']) {
 const config=waveConfiguration(id,'base',true);config.stage=1;
 // One actual starting weapon except Butcher's intentional sword+saw pair.
 const starts=TECHS[id].start;
 config.build=config.build.filter(w=> (starts.weapons||[starts.weapon]).includes(w.id));
 introduction.push({id,...runFiniteWave({id,phase:'base',route:true,scene:'moving',count:3,seconds:30,godMode:false,configOverride:config})});
}
const {G}=await import('../src/game/state.js');
const {resetSpawner,updateSpawner}=await import('../src/game/spawner.js');
const {updateEnemies}=await import('../src/game/enemies.js');
const {updatePlayer}=await import('../src/game/player.js');
const {updateWeapons,updateShots}=await import('../src/game/weapons.js');
const {updateHazards}=await import('../src/game/hazards.js');
const {input}=await import('../src/core/input.js');
const openingSurvival=[];
for(const id of ['gunline','executioner','bloom','plague','butcher']) {
 const config=waveConfiguration(id,'base',true);config.stage=1;
 config.build=config.build.filter(w=>(TECHS[id].start.weapons||[TECHS[id].start.weapon]).includes(w.id));
 runFiniteWave({id,phase:'base',route:true,scene:'moving',count:0,seconds:0,godMode:false,configOverride:config});
 G.difficulty='normal';G.time=G.clock=0;resetSpawner();let peak=0;
 const original=Math.random;let seed=7;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try { for(let f=0;f<70*60;f++) {
  const dt=1/60;G.time=G.clock=(f+1)*dt;
  const angle=G.clock*G.player.stats.speed/130;
  Object.assign(input.move,{x:-Math.sin(angle),y:Math.cos(angle)});
  updatePlayer(dt);updateSpawner(dt);updateEnemies(dt);updateWeapons(dt);updateShots(dt);updateHazards(dt);
  peak=Math.max(peak,G.enemies.count);if(G.player.hp<=0)break;
 } } finally {Math.random=original;Object.assign(input.move,{x:0,y:0});}
 openingSurvival.push({id,seconds:G.clock,hp:G.player.hp,maxHP:G.player.maxHp,kills:G.kills,peak,legendary:false,levelUps:0});
}
// Default easy is the established 2–3-final planning target; do not inherit opening normal.
G.difficulty='easy';
const scenarios=[8,16,24].map(residency=>{const xp=estimateWaveXP({residency});return{residency,rows:xp,plans:summarizePlans(Array.from({length:40},(_,i)=>simulatePlan({rows:xp,seed:i+1,collection:residency===24?.7:residency===8?.95:.85})))}});
console.log(JSON.stringify({before,method:'Current weapons (including strengthened legendary), equal 3/14/31 investment + two equal evolution rewards. Twelve finite moving enemies, three seeds, no invulnerability for separate three-enemy stage1 introduction. Planner difficulty is easy; director XP assumes residency, not survival; 40 actual choice/chest planning seeds.',caps:Object.values(STAGES).map(s=>s.enemyCap),rows,introduction,openingSurvival,scenarios},(key,value)=>key==='representative'?undefined:value,2));
