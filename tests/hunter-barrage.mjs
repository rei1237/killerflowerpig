import test from 'node:test';
import assert from 'node:assert/strict';
import { Boss } from '../src/game/boss.js';
import { BOSSES } from '../src/data/bosses.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';

// 헌터 청토끼(3구역) 탄막 완화: 같은 페이즈의 공통 탄막을 완화 없는 경우와 비교한다.
function run(kind, phase, barrage) {
    clearWorld(); Object.assign(G, { stage: 3, mode: 'boss', clock: 0, time: 0, events: {}, damageBy: {}, godMode: false,
        view: { w: 600, h: 1200 }, camera: { x: 0, y: 0 }, lowQ: false, caps: { enemies: 252, particles: 0, texts: 0, gems: 500, decalScale: 0 } });
    fx.splats = { dark: [{ width: 64, height: 64 }], red: [{ width: 64, height: 64 }] };
    for (const [id, s] of Object.entries(SPRITES)) atlases[id] = { walkH: s.walkH, frameCount: () => 8, draw() {} };
    G.player = { x: 300, y: 0, vx: 0, vy: 0, radius: 10, hp: 1e9, maxHp: 1e9, iframes: 0, stats: { crit: 0, armor: 0 } };
    const b = new Boss(3); b.def = { ...b.def, barrage }; G.boss = b; b.x = 0; b.y = 0; b.phase = phase; b.attackT = 100;
    const task = b[`task_${kind}`](); task.t = 0; b.task = task;
    let maxSpeed = 0, fired = 0, seen = new Set(), t = 0;
    while (b.task === task && t < 10) {
        t += 1 / 60; task.t += 1 / 60; task.step(1 / 60, task);
        for (let i = 0; i < G.enemyShots.count; i++) { const s = G.enemyShots.items[i]; if (!seen.has(s)) { seen.add(s); fired++; maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vy)); } }
    }
    return { fired, maxSpeed, duration: t, rest: b.attackT };
}

test('stage-3 hunter fires fewer, slower ring and aimed bullets with longer gaps than the shared pattern', () => {
    const softened = BOSSES[3].barrage;
    assert.ok(softened, 'hunter has a barrage softening config');
    for (const [kind, phase] of [['aimed', 1], ['aimed', 2], ['ring', 2]]) {
        const soft = run(kind, phase, softened), hard = run(kind, phase, undefined);
        assert.ok(soft.fired <= hard.fired * 0.6, `${kind}/${phase}: ${soft.fired} vs ${hard.fired}`);
        assert.ok(soft.maxSpeed < hard.maxSpeed * 0.85, `${kind}/${phase} speed`);
        assert.ok(soft.rest > hard.rest, `${kind}/${phase} rest after pattern`);
    }
    // 다른 보스는 완화 설정이 없어 기존 탄막 그대로다.
    for (const stage of [2, 4, 5, 6, 7, 8]) assert.equal(BOSSES[stage].barrage, undefined);
});
