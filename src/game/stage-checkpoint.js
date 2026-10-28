import { DIFFICULTIES } from '../data/difficulty.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS } from '../data/weapons.js';
import { STAGES } from '../data/stages.js';
import { TECHS } from '../data/techs.js';
const number=(v,max=1e9)=>Number.isFinite(v)&&v>=0&&v<=max;
// A checkpoint contains only run build data. Never restore the permanent wallet.
export function validateStageCheckpoint(raw){
 if(!raw||typeof raw!=='object'||(raw.checkpointVersion!=null&&raw.checkpointVersion!==2)||(raw.runId!=null&&(typeof raw.runId!=='string'||raw.runId.length>96))||raw.dead||!STAGES[raw.stage]||!Number.isInteger(raw.stage)||!Number.isSafeInteger(raw.level)||raw.level<1||raw.level>10000||!number(raw.xp)||!Array.isArray(raw.weapons)||!raw.weapons.length||raw.weapons.length>MAX_WEAPONS)return null;
 const ids=new Set();for(const w of raw.weapons){if(!w||!Object.hasOwn(WEAPONS,w.id)||ids.has(w.id)||!Number.isInteger(w.level)||w.level<1||w.level>8||(w.evolved!=null&&typeof w.evolved!=='boolean')||(w.evolved===true&&!WEAPONS[w.id].evolve))return null;ids.add(w.id);}
 if(!raw.passives||typeof raw.passives!=='object'||Array.isArray(raw.passives))return null;
 for(const [id,lv] of Object.entries(raw.passives))if(!Object.hasOwn(PASSIVES,id)||!Number.isInteger(lv)||lv<1||lv>5)return null;
 if(raw.tech!=null&&!Object.hasOwn(TECHS,raw.tech))return null;
 let s;try{s=JSON.parse(JSON.stringify(raw));}catch{return null;}
 for(const key of ['gold','kills','rerolls','pendingLevelUps'])s[key]=number(s[key])?s[key]:0;
 s.pendingLevelUps=Math.min(100,Math.floor(s.pendingLevelUps));s.rerolls=Math.min(100,Math.floor(s.rerolls));
 s.banished=(Array.isArray(s.banished)?s.banished:[]).filter(id=>Object.hasOwn(WEAPONS,id)||Object.hasOwn(PASSIVES,id));
 s.difficulty=Object.hasOwn(DIFFICULTIES,s.difficulty)?s.difficulty:'easy';
 s.consumedItems=(Array.isArray(s.consumedItems)?s.consumedItems:[]).filter(id=>Object.hasOwn(WEAPONS,id)&&!WEAPONS[id].fusionOnly);
 s.coop=raw.coop===true;
 s.checkpointVersion=2;s.retry=raw.retry===true;
 return s;
}
