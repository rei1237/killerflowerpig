import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTech,TECH_ROUTES,TECH_SCENES} from './helpers/tech-power.mjs';
// 각 테크의 루트 빌드(진화 2종 / 최종 조합)가 다른 테크 대비 지나치게 약하거나 강하지 않은지 검증
function powers(stage){
 const raw={};
 for(const t in TECH_ROUTES){const [ws,fin]=TECH_ROUTES[t];const build=stage==='evo'?ws.map(id=>[id,8,true]):[[fin,8,false]];raw[t]=Object.fromEntries(TECH_SCENES.map(s=>[s,simulateTech(t,build,s)]));}
 const best=Object.fromEntries(TECH_SCENES.map(s=>[s,Math.max(...Object.values(raw).map(r=>r[s]))]));
 return Object.fromEntries(Object.entries(raw).map(([t,r])=>[t,TECH_SCENES.reduce((a,s)=>a+r[s]/best[s],0)/TECH_SCENES.length]));
}
for(const stage of ['evo','fin'])test(`tech route builds stay within a 1.35x power band (${stage})`,()=>{
 const p=powers(stage),vals=Object.values(p),hi=Math.max(...vals),lo=Math.min(...vals);
 assert.ok(hi/lo<1.35,`${stage}: ${JSON.stringify(Object.fromEntries(Object.entries(p).map(([k,v])=>[k,+v.toFixed(2)])))}`);
});
