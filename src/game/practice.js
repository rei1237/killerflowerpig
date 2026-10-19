// Disposable training model: no currency, progression, reward queue, or live G writes.
import { advancePlayerMovement } from './player-motion.js';
import { toggleTargetAt } from './targeting.js';
export const PRACTICE_WORLD = Object.freeze({ width: 600, height: 340 });
export function createPractice() {
    return {
        step: 0, clock: 0, moved: 0, complete: false, selectedUpgrade: null,
        player: { x: 130, y: 235, vx: 0, vy: 0, facingX: 1, facingY: 0, flip: false, anim: 0, animT: 0, stats: { speed: 135, might: 1, maxHp: 100 } },
        dummy: { x: 430, y: 150, radius: 30, alive: true, def: { name: '연습 표적' } },
        target: null,
        coin: { x: 440, y: 255, collected: false }, trainingCoins: 0,
    };
}
export function advancePractice(state, move, dt) {
    if (state.complete || state.step === 3) return;
    dt = Math.max(0, Math.min(0.05, dt));
    state.clock += dt;
    const p = state.player, before = { x: p.x, y: p.y };
    advancePlayerMovement(p, move, dt);
    p.x = Math.max(30, Math.min(PRACTICE_WORLD.width - 30, p.x));
    p.y = Math.max(65, Math.min(PRACTICE_WORLD.height - 20, p.y));
    if (state.step === 0) {
        state.moved += Math.hypot(p.x - before.x, p.y - before.y);
        if (state.moved >= 80) state.step = 1;
    }
    if (state.step === 2 && Math.hypot(p.x - state.coin.x, p.y - 16 - state.coin.y) < 35) {
        state.coin.collected = true; state.trainingCoins = 1; state.step = 3;
    }
}
export function focusPracticeAt(state, x, y) {
    if (state.complete || state.step < 1 || state.step > 2) return false;
    state.target = toggleTargetAt([state.dummy], x, y, state.target, 10);
    if (state.target) { if (state.step === 1) state.step = 2; }
    return !!state.target;
}
export function choosePracticeUpgrade(state, id) {
    if (state.step !== 3 || state.complete || !['whet', 'heart'].includes(id)) return false;
    state.selectedUpgrade = id;
    if (id === 'whet') state.player.stats.might += 0.1;
    else state.player.stats.maxHp += 20;
    state.complete = true; state.step = 4;
    return true;
}
