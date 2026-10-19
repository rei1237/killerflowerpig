export const KILL_OPPORTUNITY = 5 / 3;
export const compensatedChance = probability => 1 - (1 - probability) ** KILL_OPPORTUNITY;
// Ordinary-kill battlefield supplies. Separate from shop rarity, coins and chests.
export const SUPPLY_RULES=Object.freeze({supplyLifetime:90,healChance:.04,lowHpChance:.10,lowHpRatio:.3,healOnlyBelowRatio:.3,healGuarantee:30,lowHpGuarantee:12,magnetChance:.015,magnetGuarantee:60,maxHealOnField:3,maxMagnetsOnField:2,bombChance:.0015});
export function supplyState(value={}){
 const cap=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
 return {heal:cap(value.heal,30),low:cap(value.low,12),magnet:cap(value.magnet,60)};
}
export function rollSupplies(previous,context,random=Math.random){
 const state=supplyState(previous),out=[];
 // 회복 아이템은 HP 30% 이하일 때만 등장한다. 그 위에서는 확률·보정 카운터도 쌓이지 않는다.
 const injured=Number.isFinite(context.hpRatio)&&context.hpRatio>0&&context.hpRatio<=SUPPLY_RULES.healOnlyBelowRatio;
 const low=injured&&context.hpRatio<=SUPPLY_RULES.lowHpRatio;
 state.heal=injured?Math.min(30,state.heal+KILL_OPPORTUNITY):state.heal;state.low=low?Math.min(12,state.low+KILL_OPPORTUNITY):0;state.magnet=Math.min(60,state.magnet+KILL_OPPORTUNITY);
 const healRoll=random(),magnetRoll=random(),bombRoll=random();
 if(injured&&(context.healingOnField||0)<3&&(state.heal>=30-1e-9||state.low>=12-1e-9||healRoll<compensatedChance(low?.10:.04))){out.push('meat');state.heal=0;state.low=0;}
 if((context.magnetsOnField||0)<2&&(state.magnet>=60-1e-9||magnetRoll<compensatedChance(.015))){out.push('magnet');state.magnet=0;}
 if(bombRoll<compensatedChance(.0015))out.push('bomb');
 return {state,kinds:out};
}
