// 웨이브 디렉터: 시간에 따라 목표 밀도를 유지하며 적을 시야 밖에서 투입, 시간 이벤트 처리
import { G, rand, pickWeighted, emit } from './state.js';
import { ENEMIES, RANGED_UNLOCK_STAGE } from '../data/enemies.js';
import { STAGES, EVENTS } from '../data/stages.js';
import { spawnEnemy, edgePosition } from './enemies.js';
import { audio } from '../core/audio.js';
import { floatText } from './effects.js';
import { startEncirclement } from './encirclement.js';

let spawnAcc = 0;

export function resetSpawner() {
    spawnAcc = 0;
    G.eventIdx = 0;
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
        : 2.112 + (target - alive) * 1.5;
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
        // 가장 무거운 유형을 엘리트로
        const types = Object.keys(table);
        const pick = types[types.length - 1];
        const pos = edgePosition(0.5);
        spawnEnemy(pick, pos.x, pos.y, { elite: true, force: true, hpMul: st.eventTuning?.eliteHp ?? 1 });
        floatText(p.x, p.y - 90, '⚠ 엘리트 변이체', '#ff2244', 1.6);
        audio.sfx('warn');
    } else if (type === 'ring') {
        // Late rings have a timed, visible poison boundary; early rings stay escapable.
        if (G.stage >= 5) startEncirclement();
        const n = st.eventTuning?.ringCount ?? 18 + G.stage * 3;
        const R = Math.min(G.view.w, G.view.h) * 0.62;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            spawnEnemy('shambler', p.x + Math.cos(a) * R * 1.3, p.y + Math.sin(a) * R, { force: true, hpMul: 0.8 });
        }
        floatText(p.x, p.y - 90, '포위당했다!', '#ff5a3a', 1.4);
        audio.sfx('warn');
    } else if (type === 'swarm') {
        // 군체 러시: 한 방향에서 일직선으로 쏟아지는 무리
        const a = Math.random() * Math.PI * 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        const r = Math.hypot(G.view.w, G.view.h) / 2 + 60;
        const sx = p.x - dx * r, sy = p.y - dy * r;
        const n = st.eventTuning?.swarmCount ?? 26 + G.stage * 3;
        for (let i = 0; i < n; i++) {
            const off = (i % 3 - 1) * (G.stage >= 5 ? 80 : 22), back = Math.floor(i / 3) * (G.stage >= 5 ? 115 : 34);
            spawnEnemy(G.stage >= 5 ? 'suicider' : 'runner', sx - dy * off - dx * back, sy + dx * off - dy * back, { force: true, lineX: dx, lineY: dy, speedMul: st.eventTuning?.swarmSpeed ?? 1.5 });
        }
        floatText(p.x, p.y - 90, G.stage >= 5 ? '⚠ 자폭 돌격대 · 예고선 밖으로!' : '군체 러시!', '#ff2244', 1.4);
        audio.sfx('warn');
    }
    emit('event', type);
}
