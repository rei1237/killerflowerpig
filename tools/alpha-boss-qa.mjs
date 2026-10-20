// Stage-9 Alpha HP selection using an actual pre-stage-9 planner build.
// node tools/alpha-boss-qa.mjs --hp=14000,18000,20000 > /tmp/alpha-boss-qa.json
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { estimateWaveXP,simulatePlan } from './run-progression-audit.mjs';
import { measureBossEncounter } from './boss-damage-bench.mjs';
import { BOSSES,BOSS_HP_MULTIPLIER,BOSS_EVOLUTION_HP } from '../src/data/bosses.js';
const hashes=()=>Object.fromEntries(['src/game/','src/data/'].flatMap(dir=>
 readdirSync(new URL('../'+dir,import.meta.url)).filter(f=>f.endsWith('.js')).sort().map(f=>{
  const file=dir+f;return[file,createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')];
 })));
const before=hashes();
const xp=estimateWaveXP({residency:16,seed:7});
const snapshot=simulatePlan({rows:xp,mode:'twoFinal',seed:101,collection:.85}).stages[8].beforeBoss;
assert.equal(snapshot.finals,2);assert.equal(snapshot.absolutes,0);
const scenario={...snapshot,stage:9,name:'pre-stage-9 actual two-final planner build',weapons:snapshot.weapons.map(w=>[w.id,w.level,w.evolved])};
const hp=(process.argv.find(a=>a.startsWith('--hp='))?.split('=')[1]||String(BOSSES[9].hp)).split(',').map(Number);
assert.ok(hp.every(n=>Number.isFinite(n)&&n>0&&n<=44800));
const rows=hp.flatMap(baseHp=>[false,true].flatMap(focus=>[1,7,13].map(seed=>({baseHp,seed,...measureBossEncounter(scenario,{hp:baseHp*BOSS_HP_MULTIPLIER*BOSS_EVOLUTION_HP[9],distance:200,seed,maxSeconds:480,focus})}))));
const after=hashes();assert.deepEqual(after,before,'source changed during Alpha diagnostic');
console.log(JSON.stringify({method:'Actual pre-stage-9 planner snapshot, 16s ordinary / 48s elite synthetic residency, 85% XP collection, real level choices/chests. 3 paired seeds, auto-aim and one explicit focus tap at encounter start. Actual moving boss, patterns, summons, player attacks, collisions and phase changes. Standing high-HP player isolates TTK; this is not survival or human clear-rate evidence. No purchases or mid-fight upgrades. Global HP multipliers unchanged.',sourceHashes:before,sourceHashGuardPassed:true,scenario,summary:hp.flatMap(baseHp=>[false,true].map(focus=>{const r=rows.filter(x=>x.baseHp===baseHp&&x.focus===focus);return{baseHp,focus,effectiveHp:baseHp*BOSS_HP_MULTIPLIER*BOSS_EVOLUTION_HP[9],allKilled:r.every(x=>x.death!==null),meanSeconds:r.reduce((n,x)=>n+x.death,0)/r.length,minSeconds:Math.min(...r.map(x=>x.death)),maxSeconds:Math.max(...r.map(x=>x.death)),minPatterns:Math.min(...r.map(x=>x.starts.length))};})),rows},null,2));
