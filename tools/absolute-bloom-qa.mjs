// Read-only paired Absolute balance probe. Current boss definitions are retained
// for historical combat so stage-9 identity/HP changes cannot confound the result.
// node tools/absolute-bloom-qa.mjs --variant=current|prebalance|76d8593
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const variant=process.argv.find(a=>a.startsWith('--variant='))?.split('=')[1]||'current';
const hashes=()=>Object.fromEntries(['src/game/','src/data/'].flatMap(dir=>readdirSync(root+dir).filter(f=>f.endsWith('.js')).sort().map(f=>[dir+f,createHash('sha256').update(readFileSync(root+dir+f)).digest('hex')])));
const before=hashes();
const snapshots=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`import {estimateWaveXP,simulatePlan} from './tools/run-progression-audit.mjs';const p=simulatePlan({rows:estimateWaveXP({residency:16,seed:7}),mode:'absolute',seed:1,collection:.85});console.log(JSON.stringify(p.stages.slice(7).map((s,i)=>({...s.beforeBoss,stage:i+8}))));`],{cwd:root,encoding:'utf8'}));
const baseline=!['current','prebalance'].includes(variant)?execFileSync('git',['rev-parse',variant],{cwd:root,encoding:'utf8'}).trim():null;
const loaded={};
registerHooks({load(url,context,nextLoad){if(!url.startsWith('file:'))return nextLoad(url,context);const file=fileURLToPath(url).slice(root.length);if(!file.startsWith('src/')||!file.endsWith('.js'))return nextLoad(url,context);
 let source=readFileSync(root+file,'utf8');
 if(baseline&&(file.startsWith('src/data/')&&file!=='src/data/bosses.js'||['weapons','enemies','hazards','tech','player','player-motion','butcher-sword','plague-targeting','targeting'].some(name=>file===`src/game/${name}.js`))){
  try{source=execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{} }
 if(variant==='prebalance'&&file==='src/game/weapons.js'){const old="const restrainedBloom = w.sourceId === 'absolute_bloom';";assert.ok(source.includes(old));source=source.replace(old,'const restrainedBloom = false;');}
 loaded[file]=createHash('sha256').update(source).digest('hex');return{format:'module',source,shortCircuit:true};
}});
const {FUSED_WEAPONS}=await import('../src/data/fusions.js');
if(variant==='prebalance')Object.assign(FUSED_WEAPONS.absolute_bloom.base,{dmg:150,cd:2.4});
const {G}=await import('../src/game/state.js');
const {createPlayer,recomputeStats}=await import('../src/game/player.js');
const {createWeapon}=await import('../src/game/weapons.js');
const {BOSSES,BOSS_HP_MULTIPLIER,BOSS_EVOLUTION_HP}=await import('../src/data/bosses.js');
const {measureBossEncounter}=await import('./boss-damage-bench.mjs');
if(process.argv.includes('--tiers')){const {simulateWeapon,TIER_SCENES}=await import('../tests/helpers/tier-power.mjs');const values={};for(const [id,lv] of [['absolute_bloom',1],['absolute_bloom',8],['lotus_bloom',8],['ember_lance',8]])values[id+lv]=Object.fromEntries(TIER_SCENES.map(scene=>[scene,simulateWeapon(id,lv,false,scene)]));console.log(JSON.stringify({variant,values}));process.exit(0);}
const rows=[];
for(const snap of snapshots){assert.equal(snap.absolutes,1);assert.equal(snap.finals,1);G.tech='bloom';G.passives={...snap.passives};createPlayer();G.weapons=snap.weapons.map((w,i)=>Object.assign(createWeapon(w.id,i),w));recomputeStats(true);const scenario={...snap,stats:{...G.player.stats},name:'legal planner Absolute + scatter, Bloom tech',weapons:snap.weapons.map(w=>[w.id,w.level,w.evolved])};
 for(const focus of [false,true])for(const seed of [1,7,13]){const r=measureBossEncounter(scenario,{hp:BOSSES[snap.stage].hp*BOSS_HP_MULTIPLIER*(BOSS_EVOLUTION_HP[snap.stage]||1),distance:200,seed,maxSeconds:900,focus});rows.push({...r,seed,build:snap,damageBy:{...G.damageBy}});}}
assert.deepEqual(hashes(),before,'source changed during Absolute probe');
const summary=[8,9,10].flatMap(stage=>[false,true].map(focus=>{const r=rows.filter(r=>r.stage===stage&&r.focus===focus);return{stage,focus,hp:r[0].hp,allKilled:r.every(r=>r.death!==null),meanSeconds:r.reduce((n,r)=>n+(r.death??900),0)/r.length,minSeconds:Math.min(...r.map(r=>r.death??900)),maxSeconds:Math.max(...r.map(r=>r.death??900)),minPatterns:Math.min(...r.map(r=>r.starts.length)),minPhases:Math.min(...r.map(r=>r.phases.length))};}));
console.log(JSON.stringify({variant,baseline,sourceHashes:before,loadedHashes:loaded,sourceHashGuardPassed:true,method:'Same actual legal progression snapshots and current boss definitions in every variant, three paired seeds, stage8/9/10, Bloom tech, auto and explicit focus. Actual moving boss AI/phases/adds/hits/hitstop. Standing high-HP player isolates TTK; not survival or human clear-rate evidence. Historical combat loads 76d weapon/tech/player/enemy/hazard/targeting modules and data; boss definitions/runtime and noncombat service modules remain current. No purchases, pets, wave director or mid-fight upgrades.',summary,rows},null,2));
