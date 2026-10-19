// 웨이브 디렉터: 시간에 따라 목표 밀도를 유지하며 적을 시야 밖에서 투입, 시간 이벤트 처리
import { G, rand, pickWeighted, emit } from './state.js';
import { STAGES, EVENTS } from '../data/stages.js';
import { spawnEnemy, edgePosition } from './enemies.js';
import { audio } from '../core/audio.js';
import { floatText } from './effects.js';

let spawnAcc = 0;

export function resetSpawner() {
    spawnAcc = 0;
    G.eventIdx = 0;
}

export function currentWeights(st, t) {
    let w = st.weights[0][1];
    for (const [time, table] of st.weights) if (t >= time) w = table;
    return w;
}

function aliveCount() {
    let n = 0;
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) if (pool.items[i].alive) n++;
    return n;
}

export function updateSpawner(dt) {
    const st = STAGES[G.stage];
    const t = G.time;
    const prog = Math.min(1, t / st.duration);
    let target = st.density[0] + (st.density[1] - st.density[0]) * prog;
    if (G.boss) target *= 0.35;
    if (G.lowQ) target *= 0.85;
    target = Math.min(target, G.caps.enemies - 20);

    const alive = aliveCount();
    if (alive < target) {
        // 부족분에 비례한 투입 속도 (한 번에 몰아서 생성하지 않도록 누적기 사용)
        spawnAcc += dt * (4 + (target - alive) * 1.5);
        const table = currentWeights(st, t);
        while (spawnAcc >= 1) {
            spawnAcc -= 1;
            const pos = edgePosition(0.6);
            spawnEnemy(pickWeighted(table), pos.x + rand(-20, 20), pos.y + rand(-20, 20));
        }
    } else spawnAcc = 0;

    // 시간 이벤트
    if (!G.boss) {
        while (G.eventIdx < EVENTS.length && EVENTS[G.eventIdx].t <= t) {
            const ev = EVENTS[G.eventIdx++];
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
        spawnEnemy(pick, pos.x, pos.y, { elite: true, force: true });
        floatText(p.x, p.y - 90, '⚠ 엘리트 변이체', '#ff2244', 1.6);
        audio.sfx('warn');
    } else if (type === 'ring') {
        // 포위 링: 플레이어를 원형으로 둘러싸며 조여옴
        const n = 18 + G.stage * 3;
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
        const n = 26 + G.stage * 3;
        for (let i = 0; i < n; i++) {
            const off = (i % 7 - 3) * 22, back = Math.floor(i / 7) * 34;
            spawnEnemy('runner', sx - dy * off - dx * back, sy + dx * off - dy * back, { force: true, lineX: dx, lineY: dy, speedMul: 1.5 });
        }
        floatText(p.x, p.y - 90, '군체 러시!', '#ff2244', 1.4);
        audio.sfx('warn');
    }
    emit('event', type);
}
