import { PET_UPGRADES, normalizePetUpgrades } from '../data/pet-upgrades.js';
export function purchasePetUpgrade(state,{trackId,expectedLevel,expectedRevision,requestId}){
 const track=PET_UPGRADES.find(t=>t.id===trackId);
 if(!track||!Number.isSafeInteger(expectedLevel)||expectedLevel<0||expectedLevel>=track.max||requestId!==`pet-training:${trackId}:${expectedLevel}`)return {ok:false,code:'INVALID_REQUEST'};
 if(!state.inventory.includes('pet_yeongnyang'))return {ok:false,code:'PET_NOT_OWNED'};
 const levels=normalizePetUpgrades(state),level=levels[trackId];
 // Canonical per-track/level IDs and monotonic levels survive receipt eviction.
 if(level>expectedLevel)return {ok:true,duplicate:true,state};
 if(expectedRevision!==state.revision)return {ok:false,code:'REVISION_CONFLICT'};
 if(level!==expectedLevel)return {ok:false,code:'STALE_LEVEL'};
 if(state.gold<track.cost[level])return {ok:false,code:'INSUFFICIENT_FUNDS'};
 return {ok:true,state:{...state,gold:state.gold-track.cost[level],revision:state.revision+1,petUpgrades:{...levels,[trackId]:level+1},receipts:[...state.receipts,requestId].slice(-128)}};
}
