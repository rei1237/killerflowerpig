// Each fusion consumes two owned weapon items, both at least level five.
export const FUSION_RECIPES = Object.freeze([
    { id: 'lotus_bloom', inputs: [{ id: 'cannon', level: 5 }, { id: 'thorns', level: 5 }], output: 'lotus_bloom' },
    { id: 'scatter_rail', inputs: [{ id: 'shotgun', level: 5 }, { id: 'rifle', level: 5 }], output: 'scatter_rail' },
    { id: 'plague_fire', inputs: [{ id: 'molotov', level: 5 }, { id: 'gas', level: 5 }], output: 'plague_fire' },
]);
export const FUSED_WEAPONS = {
    lotus_bloom: {
        name: '만개 연꽃포', icon: '💮', color: '#ff8bcc', fusionOnly: true,
        desc: '꽃잎 관통 광선과 몸을 지키는 회전 연꽃 가시를 함께 발사한다.',
        base: { dmg: 50, cd: 3.8, amount: 1, speed: 3.4, duration: 0.35, area: 1, length: 560, width: 44, radius: 90, hitCd: 0.45 },
        levels: [{dmg:8,t:'광선 피해 +8 · 가시 피해 함께 성장'},{area:0.12,t:'광선·가시 범위 +12%'},{cd:-0.1,t:'재사용 -10%'},{dmg:10,t:'광선 피해 +10 · 가시 피해 함께 성장'},{area:0.12,t:'광선·가시 범위 +12%'},{cd:-0.1,t:'재사용 -10%'},{dmg:12,t:'광선 피해 +12 · 회전 꽃잎 최대 5개'}],
    },
    scatter_rail: {
        name: '관통 산탄포', icon: '💥', color: '#a6deff', fusionOnly: true,
        desc: '산탄총의 부채꼴 7발에 소총의 6회 관통과 긴 사거리를 결합한다.',
        base: { dmg: 18, cd: 1.35, amount: 7, speed: 800, duration: 0.8, pierce: 6, area: 1, spread: 0.55 },
        levels: [{dmg:3,t:'탄당 피해 +3'},{pierce:1,t:'관통 +1'},{cd:-0.1,t:'재사용 -10%'},{amount:1,t:'산탄 +1'},{dmg:4,t:'탄당 피해 +4'},{pierce:1,t:'관통 +1'},{amount:1,t:'산탄 +1'}],
    },
    plague_fire: {
        name: '역병 화염병', icon: '🔥', color: '#b8f05b', fusionOnly: true,
        desc: '화염의 지속 피해와 독가스의 45% 둔화를 하나의 넓은 장판으로 결합한다.',
        base: { dmg: 9, cd: 3.4, amount: 2, speed: 1, duration: 3.6, area: 1, radius: 72, tick: 0.3, slow: 0.45 },
        levels: [{dmg:2,t:'틱 피해 +2'},{area:0.12,t:'범위 +12%'},{duration:0.15,t:'지속 +15%'},{slow:0.05,t:'둔화 +5%'},{dmg:2,t:'틱 피해 +2'},{cd:-0.1,t:'재사용 -10%'},{amount:1,t:'화염병 +1'}],
    },
};
