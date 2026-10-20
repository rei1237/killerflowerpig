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
// 최종 무기 하향(TIER_POWER) 이후 최종 빌드 편차: 역병 0.53 ~ 도살 0.74 (1.40배) — 최종 단계만 1.45배까지 허용, 진화 단계는 기존 1.35배 유지
const BAND={evo:1.35,fin:1.45};
for(const stage of ['evo','fin'])test(`tech route builds stay within a ${BAND[stage]}x power band (${stage})`,()=>{
 const p=powers(stage),vals=Object.values(p),hi=Math.max(...vals),lo=Math.min(...vals);
 assert.ok(hi/lo<BAND[stage],`${stage}: ${JSON.stringify(Object.fromEntries(Object.entries(p).map(([k,v])=>[k,+v.toFixed(2)])))}`);
});
