// 전역 게임 상태 컨테이너. 각 시스템은 G 를 통해 데이터를 공유한다.
import { Pool } from '../core/pool.js';
import { SpatialGrid } from '../core/grid.js';
import { isLowQuality } from '../core/settings.js';

export const VIEW_H = 600; // 화면에 보이는 월드 높이(단위). 기기와 무관하게 난이도 일정.

// Draw-only budgets. Never use these for collision, attack timing, spawns or pools.
// In particular, adaptive rendering must not call configureCaps().
const VISUAL_TIERS = Object.freeze([
    Object.freeze({ tier: 0, maxDpr: 2, particleDraws: 650, decalDraws: 320, additiveParticles: true, projectileGlow: true, playerGlow: true, fieldGlowScreens: 1.2, fieldFillScreens: 3, vignette: true, scenery: true, ambient: true, sceneryLights: true }),
    Object.freeze({ tier: 1, maxDpr: 1, particleDraws: 160, decalDraws: 72, additiveParticles: false, projectileGlow: false, playerGlow: false, fieldGlowScreens: 0.6, fieldFillScreens: 1.6, vignette: true, scenery: true, ambient: true, sceneryLights: false }),
    Object.freeze({ tier: 2, maxDpr: 0.75, particleDraws: 90, decalDraws: 36, additiveParticles: false, projectileGlow: false, playerGlow: false, fieldGlowScreens: 0.3, fieldFillScreens: 1, vignette: false, scenery: false, ambient: false, sceneryLights: false }),
]);

export const G = {
    stage: 1,
    time: 0,          // 스테이지 경과(초)
    clock: 0,         // 게임 시간 (일시정지 제외)
    mode: 'idle',     // idle | play | boss | clearing | dead
    paused: false,
    kills: 0,
    gold: 0,
    hitstop: 0,
    flash: 0,
    flashColor: '#fff',
    shake: 0,
    hallucinate: 0,
    godMode: false,
    difficulty: 'easy', // 런 단위 난이도 (data/difficulty.js)
    lowQ: false,
    caps: null,
    visuals: VISUAL_TIERS[0],

    camera: { x: 0, y: 0, zoom: 1, ox: 0, oy: 0 },
    view: { w: 1000, h: VIEW_H },

    player: null,
    boss: null,
    encirclement: null,
    encirclementNextAt: 0,
    weapons: [],      // 런타임 무기 인스턴스
    passives: {},     // id -> level
    level: 1,
    xp: 0,
    xpNext: 5,
    pendingLevelUps: 0,
    rerolls: 0,
    choiceEventSerial: 0, choiceClosedThrough: 0, choiceSession: null, choiceAbsence: {},
    banished: new Set(),
    damageBy: {},     // 무기별 누적 피해 (결과 화면)

    enemies: new Pool(() => ({}), 256),
    shots: new Pool(() => ({}), 256),       // 플레이어 투사체
    enemyShots: new Pool(() => ({}), 128),
    gems: new Pool(() => ({}), 256),
    pickups: new Pool(() => ({}), 16),
    hazards: new Pool(() => ({}), 64),
    particles: new Pool(() => ({}), 512),
    texts: new Pool(() => ({}), 64),
    beams: new Pool(() => ({}), 8),
    decals: [],
    decalHead: 0,
    grid: new SpatialGrid(64),

    events: {},       // UI 콜백: levelUp, chest, bossSpawn, stageClear, death, toast
    eventIdx: 0,
    pendingSwarm: null, // 군체 러시 협공 대기 물결
};

export function emit(name, ...args) {
    const fn = G.events[name];
    if (fn) fn(...args);
}

export function configureCaps() {
    G.lowQ = isLowQuality();
    G.caps = G.lowQ
        ? { enemies: 156, particles: 260, texts: 36, gems: 300, decalScale: 0.6 }
        : { enemies: 252, particles: 650, texts: 64, gems: 500, decalScale: 1 };
    setVisualTier(G.lowQ ? 1 : 0);
}

export function setVisualTier(tier) {
    G.visuals = VISUAL_TIERS[Math.max(0, Math.min(2, Math.trunc(tier) || 0))];
}

export function clearWorld() {
    G.worldRevision = (G.worldRevision || 0) + 1;
    G.enemies.clear();
    G.shots.clear();
    G.enemyShots.clear();
    G.gems.clear();
    G.pickups.clear();
    G.hazards.clear();
    G.particles.clear();
    G.texts.clear();
    G.beams.clear();
    G.decals.length = 0;
    G.decalHead = 0;
    G.grid.reset();
    G.boss = null;
    G.encirclement = null;
    G.encirclementNextAt = 0;
    G.hitstop = 0;
    G.flash = 0;
    G.shake = 0;
    G.hallucinate = 0;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export function pickWeighted(table) {
    let total = 0;
    for (const k in table) total += table[k];
    let r = Math.random() * total;
    for (const k in table) { r -= table[k]; if (r <= 0) return k; }
    return Object.keys(table)[0];
}
