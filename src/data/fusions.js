// Final recipes consume two evolved Lv8 weapons; absolute recipes consume three.
// 절대 무기는 테크마다 하나: 연꽃 정원=절대 만개, 탄막 사수=종말의 탄막, 역병 화염=역병 종언,
// 처형자=심판의 단두대, 도살자=학살 톱니바퀴. 재료는 각 테크 계열 무기 3종의 진화형.
export const FUSION_RECIPES = Object.freeze([
    { id: 'lotus_bloom', inputs: [{ id: 'cannon', level: 8 }, { id: 'thorns', level: 8 }], output: 'lotus_bloom' },
    { id: 'scatter_rail', inputs: [{ id: 'shotgun', level: 8 }, { id: 'rifle', level: 8 }], output: 'scatter_rail' },
    { id: 'plague_fire', inputs: [{ id: 'molotov', level: 8 }, { id: 'gas', level: 8 }], output: 'plague_fire' },
    { id: 'burst_rail', inputs: [{ id: 'pistols', level: 8 }, { id: 'rifle', level: 8 }], output: 'burst_rail' },
    { id: 'venom_saw', inputs: [{ id: 'saw', level: 8 }, { id: 'gas', level: 8 }], output: 'venom_saw' },
    { id: 'ember_lance', inputs: [{ id: 'cannon', level: 8 }, { id: 'molotov', level: 8 }], output: 'ember_lance' },
    { id: 'orbit_saw', inputs: [{ id: 'thorns', level: 8 }, { id: 'saw', level: 8 }], output: 'orbit_saw' },
    { id: 'toxic_scatter', inputs: [{ id: 'shotgun', level: 8 }, { id: 'gas', level: 8 }], output: 'toxic_scatter' },
    { id: 'absolute_bloom', tier: 'absolute', inputs: [{ id: 'cannon', level: 8 }, { id: 'thorns', level: 8 }, { id: 'molotov', level: 8 }], output: 'absolute_bloom' },
    { id: 'doom_barrage', tier: 'absolute', inputs: [{ id: 'shotgun', level: 8 }, { id: 'rifle', level: 8 }, { id: 'pistols', level: 8 }], output: 'doom_barrage' },
    { id: 'plague_end', tier: 'absolute', inputs: [{ id: 'molotov', level: 8 }, { id: 'gas', level: 8 }, { id: 'cannon', level: 8 }], output: 'plague_end' },
    { id: 'guillotine', tier: 'absolute', inputs: [{ id: 'pistols', level: 8 }, { id: 'rifle', level: 8 }, { id: 'saw', level: 8 }], output: 'guillotine' },
    { id: 'carnage_saw', tier: 'absolute', inputs: [{ id: 'saw', level: 8 }, { id: 'shotgun', level: 8 }, { id: 'thorns', level: 8 }], output: 'carnage_saw' },
]);
export const FUSED_WEAPONS = {
    absolute_bloom: {
        name: '절대 만개', icon: '💮', color: '#fff0b8', fusionOnly: true, tier: 'absolute', amountCap: 12,
        desc: '세 진화 무기의 공격을 계승하고 여덟 방향의 거대한 연꽃 광선으로 전장을 뒤덮는다.',
        base: { dmg: 150, cd: 2.4, amount: 8, speed: 1, duration: 0.6, area: 1, length: 760, width: 68 },
        levels: [{dmg:15,t:'절대 광선 피해 +15 · 계승 공격 강화'},{area:0.12,t:'절대 광선 범위 +12%'},{cd:-0.08,t:'재사용 -8%'},{dmg:20,t:'절대 광선 피해 +20 · 계승 공격 강화'},{area:0.12,t:'절대 광선 범위 +12%'},{cd:-0.08,t:'재사용 -8%'},{dmg:25,t:'절대 광선 피해 +25 · 세 진화 공격 최종 강화'}],
    },
    lotus_bloom: {
        name: '만개 연꽃포', icon: '💮', color: '#ff8bcc', fusionOnly: true,
        desc: '꽃잎 관통 광선과 몸을 지키는 회전 연꽃 가시를 함께 발사한다.',
        base: { dmg: 50, cd: 3.8, amount: 1, speed: 3.4, duration: 0.35, area: 1, length: 560, width: 44, radius: 90, hitCd: 0.45 },
        levels: [{dmg:8,t:'광선 피해 +8 · 가시 피해 함께 성장'},{area:0.12,t:'광선·가시 범위 +12%'},{cd:-0.1,t:'재사용 -10%'},{dmg:10,t:'광선 피해 +10 · 가시 피해 함께 성장'},{area:0.12,t:'광선·가시 범위 +12%'},{cd:-0.1,t:'재사용 -10%'},{dmg:12,t:'광선 피해 +12 · 회전 꽃잎 최대 5개'}],
    },
    scatter_rail: {
        name: '관통 산탄포', icon: '💥', color: '#a6deff', fusionOnly: true,
        desc: '산탄총의 부채꼴 7발에 소총의 4회 관통과 긴 사거리를 결합한다.',
        base: { dmg: 15, cd: 1.35, amount: 7, speed: 800, duration: 0.8, pierce: 4, area: 1, spread: 0.55 },
        levels: [{dmg:3,t:'탄당 피해 +3'},{pierce:1,t:'관통 +1'},{cd:-0.1,t:'재사용 -10%'},{amount:1,t:'산탄 +1'},{dmg:4,t:'탄당 피해 +4'},{pierce:1,t:'관통 +1'},{amount:1,t:'산탄 +1'}],
    },
    doom_barrage: {
        name: '종말의 탄막', icon: '🎆', color: '#9fd3ff', fusionOnly: true, tier: 'absolute', amountCap: 12,
        desc: '세 총기의 공격을 계승하고, 360도 전방위로 관통 탄환 12발을 흩뿌린 뒤 조준 레일탄 3발을 꽂는다.',
        base: { dmg: 34, cd: 1.5, amount: 12, speed: 760, duration: 0.85, pierce: 6, area: 1 },
        levels: [{dmg:4,t:'탄당 피해 +4 · 계승 공격 강화'},{pierce:2,t:'관통 +2'},{cd:-0.08,t:'재사용 -8%'},{speed:0.15,t:'탄속 +15%'},{dmg:5,t:'탄당 피해 +5 · 계승 공격 강화'},{area:0.1,t:'탄 크기 +10%'},{dmg:6,cd:-0.08,t:'피해 +6, 재사용 -8% · 세 총기 최종 강화'}],
    },
    plague_end: {
        name: '역병 종언', icon: '☣️', color: '#b8f05b', fusionOnly: true, tier: 'absolute', amountCap: 8,
        desc: '세 진화 무기를 계승하고, 화면 곳곳에 거대한 역병 화염 장판을 동시에 터뜨려 55% 둔화시킨다.',
        base: { dmg: 22, cd: 2.6, amount: 5, speed: 1, duration: 4, area: 1, radius: 125, tick: 0.3, slow: 0.55 },
        levels: [{dmg:3,t:'틱 피해 +3 · 계승 공격 강화'},{area:0.08,t:'범위 +8%'},{slow:0.05,t:'둔화 +5%'},{duration:0.1,t:'지속 +10%'},{dmg:3,t:'틱 피해 +3 · 계승 공격 강화'},{cd:-0.06,t:'재사용 -6%'},{dmg:4,t:'피해 +4 · 최종 강화'}],
    },
    guillotine: {
        name: '심판의 단두대', icon: '⚔️', color: '#ff3b5c', fusionOnly: true, tier: 'absolute', amountCap: 10,
        desc: '세 진화 무기를 계승하고, 치명타 확률 40%·치명타 피해 3.5배의 관통 처형탄을 연사한다. 체력 20% 이하 일반 적은 즉시 처형.',
        base: { dmg: 42, cd: 1.1, amount: 6, speed: 920, duration: 0.9, pierce: 4, area: 1, crit: 0.4, critBonus: 1.5, execute: 0.2 },
        levels: [{dmg:5,t:'피해 +5 · 계승 공격 강화'},{crit:0.05,t:'치명타 +5%'},{amount:1,t:'처형탄 +1'},{critBonus:0.3,t:'치명타 피해 +30%'},{dmg:6,t:'피해 +6 · 계승 공격 강화'},{cd:-0.1,t:'재사용 -10%'},{amount:1,crit:0.05,t:'처형탄 +1, 치명타 +5% · 최종 강화'}],
    },
    carnage_saw: {
        name: '학살 톱니바퀴', icon: '🩸', color: '#ff8f8f', fusionOnly: true, tier: 'absolute', amountCap: 8,
        desc: '세 진화 무기를 계승하고, 거대한 피의 톱날을 사방으로 튕겨 반복해서 베며 강한 출혈을 남긴다.',
        base: { dmg: 30, cd: 2.6, amount: 5, speed: 420, duration: 3.4, area: 1.3, hitCd: 0.3, bleed: 6 },
        levels: [{dmg:4,t:'피해 +4 · 계승 공격 강화'},{area:0.1,t:'크기 +10%'},{amount:1,t:'톱날 +1'},{duration:0.15,t:'지속 +15%'},{dmg:5,t:'피해 +5 · 계승 공격 강화'},{cd:-0.1,t:'재사용 -10%'},{amount:1,dmg:5,t:'톱날 +1, 피해 +5 · 최종 강화'}],
    },
    plague_fire: {
        name: '역병 화염병', icon: '🔥', color: '#b8f05b', fusionOnly: true,
        desc: '화염의 지속 피해와 독가스의 45% 둔화를 하나의 넓은 장판으로 결합한다.',
        base: { dmg: 9, cd: 3.4, amount: 2, speed: 1, duration: 3.6, area: 1, radius: 100, tick: 0.3, slow: 0.45 },
        levels: [{dmg:2,t:'틱 피해 +2'},{area:0.12,t:'범위 +12%'},{duration:0.15,t:'지속 +15%'},{slow:0.05,t:'둔화 +5%'},{dmg:2,t:'틱 피해 +2'},{cd:-0.1,t:'재사용 -10%'},{amount:1,t:'화염병 +1'}],
    },
    burst_rail: {"name": "연쇄 관통권총", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 8, "desc": "쌍권총의 빠른 3연발에 소총의 3회 관통과 긴 사거리를 결합한다.", "base": {"dmg": 15, "cd": 1.2, "amount": 3, "speed": 900, "duration": 0.8, "pierce": 3, "area": 1}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    venom_saw: {"name": "맹독 회전톱", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 4, "desc": "튕기는 톱날 2개가 적을 반복해서 베고 45% 둔화시킨다.", "base": {"dmg": 14, "cd": 3.5, "amount": 2, "speed": 340, "duration": 3.2, "area": 1, "hitCd": 0.4, "slow": 0.45}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    ember_lance: {"name": "화염 꽃잎창", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 2, "desc": "꽃잎 광선을 쏘면서 별도로 던진 병이 화염 장판을 남긴다.", "base": {"dmg": 48, "cd": 4, "amount": 1, "speed": 1, "duration": 0.35, "area": 1, "length": 540, "width": 40, "radius": 54, "tick": 0.3}, "levels": [{"dmg": 8, "t": "피해 +8"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 8, "t": "피해 +8"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    orbit_saw: {"name": "연꽃 톱니진", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 4, "desc": "몸 주위의 회전 꽃잎 3개와 튕기는 톱날 2개로 가까운 적과 먼 적을 함께 공격한다.", "base": {"dmg": 18, "cd": 3.8, "amount": 2, "speed": 350, "duration": 2.8, "area": 1, "radius": 78, "hitCd": 0.4}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
    toxic_scatter: {"name": "맹독 산탄총", "icon": "✿", "color": "#c8a6ff", "fusionOnly": true, "amountCap": 10, "desc": "부채꼴 독산탄 6발이 적 무리를 관통하며 맞은 적을 40% 둔화시킨다.", "base": {"dmg": 14, "cd": 1.3, "amount": 6, "speed": 560, "duration": 0.6, "pierce": 3, "area": 1, "spread": 0.65, "slow": 0.4}, "levels": [{"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}, {"amount": 1, "t": "발사 수 +1 (상한 적용)"}, {"dmg": 3, "t": "피해 +3"}, {"area": 0.1, "t": "범위 +10%"}, {"cd": -0.1, "t": "재사용 -10%"}]},
};
