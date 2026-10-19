// Each fusion consumes two owned weapon items, both at least level five.
export const FUSION_RECIPES = Object.freeze([
    { id: 'lotus_bloom', inputs: [{ id: 'cannon', level: 5 }, { id: 'thorns', level: 5 }], output: 'lotus_bloom' },
    { id: 'scatter_rail', inputs: [{ id: 'shotgun', level: 5 }, { id: 'rifle', level: 5 }], output: 'scatter_rail' },
    { id: 'plague_fire', inputs: [{ id: 'molotov', level: 5 }, { id: 'gas', level: 5 }], output: 'plague_fire' },
    { id: 'burst_rail', inputs: [{ id: 'pistols', level: 5 }, { id: 'rifle', level: 5 }], output: 'burst_rail' },
    { id: 'venom_saw', inputs: [{ id: 'saw', level: 5 }, { id: 'gas', level: 5 }], output: 'venom_saw' },
    { id: 'ember_lance', inputs: [{ id: 'cannon', level: 5 }, { id: 'molotov', level: 5 }], output: 'ember_lance' },
    { id: 'orbit_saw', inputs: [{ id: 'thorns', level: 5 }, { id: 'saw', level: 5 }], output: 'orbit_saw' },
    { id: 'toxic_scatter', inputs: [{ id: 'shotgun', level: 5 }, { id: 'gas', level: 5 }], output: 'toxic_scatter' },
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
    burst_rail: {"name": "연쇄 관통권총", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 8, "desc": "쌍권총의 빠른 3연발에 소총의 5회 관통과 긴 사거리를 결합한다.", "base": {"dmg": 17, "cd": 1.2, "amount": 3, "speed": 900, "duration": 0.8, "pierce": 5, "area": 1}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    venom_saw: {"name": "맹독 회전톱", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 4, "desc": "튕기는 톱날 2개가 적을 반복해서 베고 45% 둔화시킨다.", "base": {"dmg": 14, "cd": 3.5, "amount": 2, "speed": 340, "duration": 3.2, "area": 1, "hitCd": 0.4, "slow": 0.45}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    ember_lance: {"name": "화염 꽃잎창", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 2, "desc": "관통 꽃잎 광선과 3초간 타오르는 화염 장판을 함께 발사한다.", "base": {"dmg": 48, "cd": 4, "amount": 1, "speed": 1, "duration": 0.35, "area": 1, "length": 540, "width": 40, "radius": 54, "tick": 0.3}, "levels": [{"dmg": 8, "t": "피해 +8"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 8, "t": "피해 +8"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    orbit_saw: {"name": "연꽃 톱니진", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 4, "desc": "몸 주위의 회전 꽃잎 3개와 튕기는 톱날 2개로 가까운 적과 먼 적을 함께 공격한다.", "base": {"dmg": 18, "cd": 3.8, "amount": 2, "speed": 350, "duration": 2.8, "area": 1, "radius": 78, "hitCd": 0.4}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    toxic_scatter: {"name": "맹독 산탄총", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 10, "desc": "부채꼴 독산탄 6발이 적 무리를 관통하며 맞은 적을 40% 둔화시킨다.", "base": {"dmg": 14, "cd": 1.3, "amount": 6, "speed": 560, "duration": 0.6, "pierce": 3, "area": 1, "spread": 0.65, "slow": 0.4}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
};
