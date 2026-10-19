import { G } from './state.js';

// Selection changes aim only. It never moves the player or extends an attack's range.
export const FOCUS_LEASH = 720;
let focus = null;

// Pure helpers shared by the live world and the disposable tutorial practice.
// Coordinates use an enemy's feet; the selectable body is centered one radius up.
export function pickTargetAt(candidates, x, y, tolerance = 0) {
    let best = null, bestDistance = Infinity;
    for (const e of candidates) {
        if (!e?.alive || e.hp <= 0) continue;
        const r = Math.max(8, e.radius || 16);
        const dx = x - e.x, dy = y - (e.y - r);
        if ((dx / (r * 1.25 + tolerance)) ** 2 + (dy / (r + tolerance)) ** 2 > 1) continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) { best = e; bestDistance = distance; }
    }
    return best;
}

export function toggleTargetAt(candidates, x, y, currentTarget = null, tolerance = 0) {
    const target = pickTargetAt(candidates, x, y, tolerance);
    return target ? (target === currentTarget ? null : target) : currentTarget;
}

export function clearFocus() { focus = null; }

export function focusedTarget() {
    if (!focus) return null;
    const { target, id, stage, player, boss } = focus;
    const validMode = G.mode === 'play' || G.mode === 'boss';
    let present = boss ? G.boss === target : false;
    if (!boss && target.id === id) {
        for (let i = 0; i < G.enemies.count; i++) if (G.enemies.items[i] === target) { present = true; break; }
    }
    if (!validMode || !player || player !== G.player || player.dead || player.hp <= 0 || stage !== G.stage || !target.alive || target.hp <= 0 || !present || (!boss && target.id !== id) || Math.hypot(target.x - player.x, target.y - player.y) > FOCUS_LEASH) {
        clearFocus(); return null;
    }
    return target;
}

export function preferredTarget(x, y, range) {
    const target = focusedTarget();
    return target && Math.hypot(target.x - x, target.y - y) < range ? target : null;
}

export function tapFocusAt(x, y, tolerance = 0) {
    if (G.paused || !G.player || G.player.dead || G.player.hp <= 0 || !['play', 'boss'].includes(G.mode)) return focusedTarget();
    const current = focusedTarget();
    const candidates = G.enemies.items.slice(0, G.enemies.count);
    if (G.boss?.alive) candidates.push(G.boss);
    const target = toggleTargetAt(candidates, x, y, current, tolerance);
    if (!target) clearFocus();
    else if (target !== current) focus = { target, id: target.id, stage: G.stage, player: G.player, boss: target === G.boss };
    return focusedTarget();
}
