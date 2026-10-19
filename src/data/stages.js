// 스테이지 정의. duration 동안 생존하면 보스가 등장하고, 보스 처치 시 클리어.
// weights: 시간 구간별 적 출현 가중치 [t(초), {type: weight}]
export const STAGES = {
    1: {
        name: 'LAST DAWN', subtitle: '도시 외곽', duration: 150, bg: 'bg1',
        ground: { seed: 1, base: '#1b1d1a', stain: 'rgba(60,90,40,0.18)', crack: 'rgba(0,0,0,0.45)' },
        fog: 'rgba(60,140,60,0.06)', bossId: 1,
        weights: [[0, { shambler: 1 }], [55, { shambler: 3, runner: 1 }], [115, { shambler: 3, runner: 2, brute: 1 }]],
        density: [8, 36],
        enemyCap: 48,
        spawn: { baseRate: 2, gapRate: 0.45, maxRate: 5 },
        eventTuning: { ringCount: 10, swarmCount: 12, swarmSpeed: 1.15, eliteHp: 0.65 },
        events: [{ t: 70, type: 'ring' }, { t: 90, type: 'elite' }, { t: 115, type: 'swarm' }, { t: 140, type: 'ring' }],
    },
    2: {
        name: 'NEON GRAVEYARD', subtitle: '네온 시티 중심가', duration: 160, bg: 'bg1',
        ground: { seed: 2, base: '#16151d', stain: 'rgba(120,20,90,0.16)', crack: 'rgba(0,0,0,0.5)' },
        fog: 'rgba(160,40,140,0.06)', bossId: 2,
        weights: [[0, { shambler: 3, runner: 1 }], [50, { shambler: 2, runner: 2 }], [110, { shambler: 2, runner: 2, brute: 1 }]],
        density: [14, 56],
        enemyCap: 72,
        spawn: { baseRate: 3, gapRate: 0.65, maxRate: 8 },
        eventTuning: { ringCount: 16, swarmCount: 20, swarmSpeed: 1.3, eliteHp: 0.8 },
    },
    3: {
        name: 'POISON MIST', subtitle: '호텔 지구', duration: 170, bg: 'bg3',
        ground: { seed: 3, base: '#18201a', stain: 'rgba(90,160,40,0.2)', crack: 'rgba(0,0,0,0.45)' },
        fog: 'rgba(90,200,60,0.1)', bossId: 3,
        weights: [[0, { shambler: 2, runner: 2, bloater: 1 }], [60, { runner: 2, bloater: 1, brute: 1 }], [90, { runner: 2, spitter: 2, bloater: 1, brute: 1 }]],
        density: [26, 100],
    },
    4: {
        name: 'SHADOWS IN THE RUINS', subtitle: '구시가지 폐허', duration: 180, bg: 'bg3',
        ground: { seed: 4, base: '#15181f', stain: 'rgba(40,60,110,0.18)', crack: 'rgba(0,0,0,0.5)' },
        fog: 'rgba(40,60,140,0.07)', bossId: 4,
        weights: [[0, { brute: 2, runner: 3, spitter: 1 }], [70, { brute: 2, runner: 3, spitter: 2, bloater: 1 }]],
        density: [32, 125],
    },
    5: {
        name: 'THE FALLEN PARADISE', subtitle: '상업 지구', duration: 180, bg: 'bg5',
        ground: { seed: 5, base: '#1c1420', stain: 'rgba(110,20,30,0.24)', crack: 'rgba(0,0,0,0.5)' },
        fog: 'rgba(140,30,90,0.07)', bossId: 5,
        weights: [[0, { brute: 3, runner: 2, bloater: 1 }], [60, { brute: 3, runner: 3, spitter: 2, bloater: 1, splitter: 1 }]],
        density: [38, 150],
    },
    6: {
        name: 'RIVER OF DESPAIR', subtitle: '절망의 강', duration: 190, bg: 'bg5',
        ground: { seed: 6, base: '#1d1010', stain: 'rgba(30,10,10,0.4)', crack: 'rgba(80,0,0,0.4)' },
        fog: 'rgba(170,20,20,0.08)', bossId: 6,
        weights: [[0, { brute: 2, spitter: 2, bloater: 2, splitter: 1 }], [80, { brute: 2, spitter: 2, bloater: 2, splitter: 2, hulk: 1 }]],
        density: [45, 175],
    },
    7: {
        name: 'ABYSS ENTRANCE', subtitle: '중앙 방송국 로비', duration: 190, bg: 'bg7',
        ground: { seed: 7, base: '#1e1512', stain: 'rgba(120,20,10,0.3)', crack: 'rgba(255,60,20,0.15)' },
        fog: 'rgba(200,40,20,0.08)', bossId: 7,
        weights: [[0, { splitter: 2, runner: 3, brute: 2 }], [70, { splitter: 2, runner: 3, brute: 2, hulk: 1, spitter: 2 }]],
        density: [52, 200],
    },
    8: {
        name: 'HALLUCINATION', subtitle: '25층 생체 실험실', duration: 200, bg: 'bg7',
        ground: { seed: 8, base: '#1a1a1c', stain: 'rgba(180,180,200,0.08)', crack: 'rgba(0,0,0,0.5)' },
        fog: 'rgba(200,60,220,0.07)', bossId: 8,
        weights: [[0, { splitter: 3, hulk: 1, runner: 3, bloater: 2 }], [80, { splitter: 3, hulk: 2, runner: 3, bloater: 2, spitter: 2 }]],
        density: [60, 225],
    },
    9: {
        name: 'THRONE OF ROT', subtitle: '47층 스튜디오 홀', duration: 200, bg: 'bg9',
        ground: { seed: 9, base: '#170c0e', stain: 'rgba(130,0,20,0.32)', crack: 'rgba(60,0,10,0.5)' },
        fog: 'rgba(160,0,30,0.09)', bossId: 9,
        weights: [[0, { hulk: 2, splitter: 3, runner: 3, spitter: 2 }], [80, { hulk: 3, splitter: 3, runner: 3, spitter: 2, bloater: 2 }]],
        density: [68, 250],
    },
    10: {
        name: 'THE LAST CROWN', subtitle: '50층 청토끼의 심장부', duration: 210, bg: 'bg9',
        ground: { seed: 10, base: '#120708', stain: 'rgba(170,0,25,0.36)', crack: 'rgba(90,0,10,0.6)' },
        fog: 'rgba(200,0,30,0.1)', bossId: 10,
        weights: [[0, { hulk: 3, splitter: 3, runner: 4, spitter: 2, bloater: 2 }]],
        density: [76, 280],
    },
};

export const STAGE_COUNT = 10;

// 시간 이벤트 (모든 스테이지 공통, 초 단위): 엘리트 / 군체 러시 / 포위 링
export const EVENTS = [
    { t: 45, type: 'ring' },
    { t: 60, type: 'elite' },
    { t: 95, type: 'swarm' },
    { t: 120, type: 'elite' },
    { t: 140, type: 'ring' },
    { t: 175, type: 'swarm' },
    { t: 185, type: 'elite' },
];
