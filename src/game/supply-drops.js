// Ordinary-kill battlefield supplies. Separate from shop rarity, coins and chests.
export const SUPPLY_RULES=Object.freeze({healChance:.04,lowHpChance:.10,lowHpRatio:.4,healGuarantee:30,lowHpGuarantee:12,magnetChance:.015,magnetGuarantee:60,maxHealOnField:3,maxMagnetsOnField:2,bombChance:.0015});
export function supplyState(value={}){
 const cap=(v,max)=>Number.isSafeInteger(v)?Math.max(0,Math.min(max,v)):0;
 return {heal:cap(value.heal,30),low:cap(value.low,12),magnet:cap(value.magnet,60)};
}
export function rollSupplies(previous,context,random=Math.random){
 const state=supplyState(previous),out=[];
 const low=Number.isFinite(context.hpRatio)&&context.hpRatio<=SUPPLY_RULES.lowHpRatio;
 state.heal=Math.min(30,state.heal+1);state.low=low?Math.min(12,state.low+1):0;state.magnet=Math.min(60,state.magnet+1);
 const healRoll=random(),magnetRoll=random(),bombRoll=random();
 if((context.healingOnField||0)<3&&(state.heal>=30||state.low>=12||healRoll<(low?.10:.04))){out.push('meat');state.heal=0;state.low=0;}
 if((context.magnetsOnField||0)<2&&(state.magnet>=60||magnetRoll<.015)){out.push('magnet');state.magnet=0;}
 if(bombRoll<.0015)out.push('bomb');
 return {state,kinds:out};
}
