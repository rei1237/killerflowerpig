// 웨이브 디렉터: 시간에 따라 목표 밀도를 유지하며 적을 시야 밖에서 투입, 시간 이벤트 처리
import { G, rand, pickWeighted, emit } from './state.js';
import { ENEMIES, RANGED_UNLOCK_STAGE } from '../data/enemies.js';
import { STAGES, EVENTS, POPULATION_SCALE } from '../data/stages.js';
import { spawnEnemy, edgePosition } from './enemies.js';
import { audio } from '../core/audio.js';
import { floatText } from './effects.js';
import { startEncirclement } from './encirclement.js';
import { difficultyOf } from '../data/difficulty.js';

let spawnAcc = 0;
// 군체 러시 강화: 속도 배율, 반대편 협공 물결(지연·규모 비율·시작 스테이지)
export const SWARM_RUSH = Object.freeze({ speed: 1.35, pincerDelay: 1.4, pincerRatio: 0.5, pincerStage: 2 });

export function resetSpawner() {
    spawnAcc = 0;
    G.eventIdx = 0;
    G.treasureDrops = 0; // 스테이지당 보물 상자 드롭 수
    G.pendingSwarm = null;
}

// 한 방향에서 일직선으로 쏟아지는 무리 한 줄
function spawnSwarmLine(st, angle, n) {
    const p = G.player;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const r = Math.hypot(G.view.w, G.view.h) / 2 + 60;
    const sx = p.x - dx * r, sy = p.y - dy * r;
    const late = G.stage >= 5;
    for (let i = 0; i < n; i++) {
        const off = (i % 3 - 1) * (late ? 80 : 22), back = Math.floor(i / 3) * (late ? 115 : 34);
        spawnEnemy(late ? 'suicider' : 'runner', sx - dy * off - dx * back, sy + dx * off - dy * back,
            { force: true, lineX: dx, lineY: dy, speedMul: (st.eventTuning?.swarmSpeed ?? 1.5) * SWARM_RUSH.speed });
    }
}

export function currentWeights(st, t) {
    let w = st.weights[0][1];
    for (const [time, table] of st.weights) if (t >= time) w = table;
    return Object.fromEntries(Object.entries(w).filter(([id]) =>
        st.bossId >= (ENEMIES[id]?.unlockStage || 1) &&
        (st.bossId >= RANGED_UNLOCK_STAGE || !ENEMIES[id]?.ranged)));
}

function aliveCount() {
    let n = 0;
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) if (pool.items[i].alive) n++;
    return n;
}

export function spawnRate(st, target, alive) {
    return st.spawn
        ? Math.min(st.spawn.maxRate, st.spawn.baseRate + (target - alive) * st.spawn.gapRate)
        : 2.112 + (target - alive) * 1.5; // 대군 압박: 빠른 보충 (이전 희소 조정을 되돌림)
}

export function updateSpawner(dt) {
    const st = STAGES[G.stage];
    const t = G.time;
    const prog = Math.min(1, t / st.duration);
    let target = st.density[0] + (st.density[1] - st.density[0]) * prog;
    if (G.boss) target *= 0.35;
    if (G.lowQ) target *= 0.85;
    target = Math.min(target, Math.max(0, G.caps.enemies - 12), st.enemyCap ?? Infinity);

    const alive = aliveCount();
    if (alive < target) {
        // 부족분에 비례한 투입 속도 (한 번에 몰아서 생성하지 않도록 누적기 사용)
        spawnAcc += dt * spawnRate(st, target, alive);
        const table = currentWeights(st, t);
        let budget = Math.ceil(target) - alive;
        while (spawnAcc >= 1 && budget > 0) {
            spawnAcc -= 1;
            const pos = edgePosition(0.6);
            const enemy = spawnEnemy(pickWeighted(table), pos.x + rand(-20, 20), pos.y + rand(-20, 20));
            if (!enemy) { spawnAcc = 0; break; }
            budget--;
        }
        if (budget <= 0) spawnAcc = 0;
    } else spawnAcc = 0;

    // 군체 러시 협공: 첫 물결 뒤 반대편에서 두 번째 물결
    if (G.pendingSwarm && G.time >= G.pendingSwarm.at) {
        const ps = G.pendingSwarm; G.pendingSwarm = null;
        if (!G.boss) {
            spawnSwarmLine(st, ps.angle, ps.n);
            floatText(G.player.x, G.player.y - 90, '⚠ 반대편에서도 몰려온다!', '#ff2244', 1.2);
            audio.sfx('warn');
        }
    }

    // 시간 이벤트
    if (!G.boss) {
        const events = st.events || EVENTS;
        while (G.eventIdx < events.length && events[G.eventIdx].t <= t) {
            const ev = events[G.eventIdx++];
            if (ev.t < st.duration - 5) runEvent(ev.type, st, t);
        }
    }
}

function runEvent(type, st, t) {
    const p = G.player;
    const table = currentWeights(st, t);
    if (type === 'elite') {
        // 가장 무거운 유형 3종 중에서 엘리트를 뽑는다. 후반에는 여러 마리가 동시에 나타나고 각자 다른 능력을 가진다.
        const types = Object.keys(table).sort((a, b) => ENEMIES[b].hp - ENEMIES[a].hp).slice(0, 3);
        // 엘리트 수 축소: 1~6구역 1마리, 7구역부터 2마리 (+난이도 추가)
        const count = (G.stage >= 7 ? 2 : 1) + (difficultyOf(G.difficulty).elite?.count || 0);
        for (let i = 0; i < count; i++) {
            const pick = types[Math.floor(Math.random() * types.length)];
            const pos = edgePosition(0.5);
            spawnEnemy(pick, pos.x, pos.y, { elite: true, force: true, hpMul: st.eventTuning?.eliteHp ?? 1 });
        }
        floatText(p.x, p.y - 90, count > 1 ? `⚠ 엘리트 변이체 ×${count}` : '⚠ 엘리트 변이체', '#ff2244', 1.6);
        audio.sfx('warn');
    } else if (type === 'ring') {
        // Late rings have a timed, visible poison boundary; early rings stay escapable.
        if (G.stage >= 5) startEncirclement();
        const n = Math.max(1, Math.round((st.eventTuning?.ringCount ?? 18 + G.stage * 3) * POPULATION_SCALE));
        const R = Math.min(G.view.w, G.view.h) * 0.62;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            spawnEnemy('shambler', p.x + Math.cos(a) * R * 1.3, p.y + Math.sin(a) * R, { force: true, hpMul: 0.8 });
        }
        floatText(p.x, p.y - 90, '포위당했다!', '#ff5a3a', 1.4);
        audio.sfx('warn');
    } else if (type === 'horde') {
        // 대군: 한 방향에서 폭넓은 무리가 밀려온다. 평소 출현표를 그대로 쓰되 한꺼번에, 짧은 시간 안에.
        const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const r = Math.hypot(G.view.w, G.view.h) / 2 + 80;
        const base = st.eventTuning?.hordeCount ?? Math.round(16 + G.stage * 6);
        const n = Math.round(base * POPULATION_SCALE * (G.lowQ ? 0.7 : 1));
        const types = Object.keys(table);
        for (let i = 0; i < n; i++) {
            const across = (Math.random() - 0.5) * Math.min(G.view.w, G.view.h) * 1.1;
            const depth = Math.random() * 190;
            const type = pickWeighted(table);
            spawnEnemy(type, p.x - dx * (r + depth) - dy * across, p.y - dy * (r + depth) + dx * across, { force: true, speedMul: 1.08 });
        }
        floatText(p.x, p.y - 90, '☠ 대군이 몰려온다!', '#ff2244', 1.6);
        audio.sfx('warn');
    } else if (type === 'swarm') {
        // 군체 러시: 한 방향에서 일직선으로 쏟아지는 무리 (+ 스테이지 2부터 반대편 협공)
        const a = Math.random() * Math.PI * 2;
        const n = Math.max(1, Math.round((st.eventTuning?.swarmCount ?? 26 + G.stage * 3) * POPULATION_SCALE));
        spawnSwarmLine(st, a, n);
        if (G.stage >= SWARM_RUSH.pincerStage) {
            G.pendingSwarm = { at: G.time + SWARM_RUSH.pincerDelay, angle: a + Math.PI, n: Math.max(1, Math.round(n * SWARM_RUSH.pincerRatio)) };
        }
        floatText(p.x, p.y - 90, G.stage >= 5 ? '⚠ 자폭 돌격대 · 예고선 밖으로!' : '군체 러시!', '#ff2244', 1.4);
        audio.sfx('warn');
    }
    emit('event', type);
}
