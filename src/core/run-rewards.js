// Independent of the evictable generic purchase/equipment receipt ring.
// The active checkpoint is the latest run; retain32 reward-bearing runs, each30 flags.
export function parseRunReward(id){
 if(typeof id!=='string')return null;
 let m=/^(boss-bounty|stage-clear):(.{1,96}):(10|[1-9])$/.exec(id);
 if(m)return {kind:m[1]==='boss-bounty'?'boss':'clear',runId:m[2],stage:Number(m[3])};
 m=/^boss:(.{1,96}):(10|[1-9]):coins$/.exec(id);
 return m?{kind:'chest',runId:m[1],stage:Number(m[2])}:null;
}
export function normalizeRunRewards(raw,pinnedRunId=null){
 const out=[];for(const entry of Array.isArray(raw)?raw:[]){
  if(!entry||typeof entry.runId!=='string'||!entry.runId.length||entry.runId.length>96)continue;
  const normalized={runId:entry.runId};for(const k of ['boss','chest','clear'])normalized[k]=[...new Set((Array.isArray(entry[k])?entry[k]:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=10))];
  const existing=out.find(e=>e.runId===entry.runId);if(existing){for(const k of ['boss','chest','clear'])existing[k]=[...new Set([...existing[k],...normalized[k]])];}else out.push(normalized);
 }const tail=out.slice(-32),pin=out.find(r=>r.runId===pinnedRunId);return pin&&!tail.includes(pin)?[pin,...tail.slice(-31)]:tail;
}
export function hasRunReward(state,id){const p=parseRunReward(id);return !!(p&&state.runRewards?.some(r=>r.runId===p.runId&&r[p.kind]?.includes(p.stage)))||!!state.receipts?.includes(id);}
export function recordRunReward(state,id){const p=parseRunReward(id),ledger=normalizeRunRewards(state.runRewards,state.pinnedRewardRunId);if(!p)return ledger;let entry=ledger.find(r=>r.runId===p.runId);if(!entry){entry={runId:p.runId,boss:[],chest:[],clear:[]};ledger.push(entry);}if(!entry[p.kind].includes(p.stage))entry[p.kind].push(p.stage);return normalizeRunRewards(ledger,state.pinnedRewardRunId);}
