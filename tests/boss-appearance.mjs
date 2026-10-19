import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOSS_SIGNATURES,drawBossSignature } from '../src/game/boss-appearance.js';
test('ten bosses have distinct cosmetic signatures without mutating combat state',()=>{
 assert.equal(new Set(BOSS_SIGNATURES.slice(1).map(s=>s.kind)).size,10);
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 for(let stage=1;stage<=10;stage++){
  const b={alive:true,stage,atlas:{walkH:150},scale:.6,x:25,y:50,radius:30,flip:false};
  const before=JSON.stringify(b);drawBossSignature(ctx,b,3);drawBossSignature(ctx,b,3,true);assert.equal(JSON.stringify(b),before);
 }
});
test('ordinary mob appearance remains original while kills drop coins',()=>{
 const code=fs.readFileSync(new URL('../src/game/enemies.js',import.meta.url),'utf8');
 assert.match(code,/e.tint = elite \? 'elite' : def.tint/);assert.doesNotMatch(code,/enemyAppearance|drawBossSignature/);assert.match(code,/dropCoin\(e.x, e.y, e.elite \? 12 : 1\)/);
});
