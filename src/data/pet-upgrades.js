// Permanent, deterministic training; coins are gameplay-earned only.
export const PET_UPGRADES = Object.freeze([
 {id:'attack',name:'영냥이 별빛 공격 훈련',cost:[180,300,480,720,1080],step:2,base:14,unit:'기본 피해',max:5},
 {id:'heal',name:'영냥이 치유 훈련',cost:[320,640,1120],step:1,base:3,unit:'6초마다 회복 HP',max:3},
 {id:'support',name:'영냥이 코인 탐색 훈련',cost:[150,300,540],step:20,base:180,unit:'코인 탐색 반경',max:3},
]);
export function normalizePetUpgrades(raw){
 const owned=Array.isArray(raw?.inventory)&&raw.inventory.includes('pet_yeongnyang');
 return Object.fromEntries(PET_UPGRADES.map(t=>[t.id,owned&&Number.isSafeInteger(raw.petUpgrades?.[t.id])?Math.max(0,Math.min(t.max,raw.petUpgrades[t.id])):0]));
}
export function petTrainingStats(state){const lv=normalizePetUpgrades(state);return {damage:14+2*lv.attack,heal:3+lv.heal,coinRange:180+20*lv.support};}
