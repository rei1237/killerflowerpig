// Timed, non-damaging poison-fog enclosure. All clocks advance with gameplay only.
import { G, emit } from './state.js';

export const ENCIRCLEMENT = Object.freeze({ minStage: 5, warning: 2, active: 7, cooldown: 90, radius: 230 });
export function clearEncirclement() { G.encirclement = null; }
const valid = () => G.mode === 'play' && G.player && !G.player.dead;
export function startEncirclement() {
    if (!valid() || G.paused || G.stage < ENCIRCLEMENT.minStage || G.encirclement || G.clock < G.encirclementNextAt) return false;
    const shortSide = Math.min(G.view.w || 600, G.view.h || 600);
    // Leave room for the wall itself and mobile HUD; never change radius mid-event.
    const radius = Math.max(70, Math.min(ENCIRCLEMENT.radius, shortSide * 0.39));
    G.encirclement = { x: G.player.x, y: G.player.y, radius, age: 0, phase: 'warning', cameraStartX: G.camera.x, cameraStartY: G.camera.y, stage: G.stage, runId: G.runId };
    G.encirclementNextAt = G.clock + ENCIRCLEMENT.cooldown;
    emit('toast', '독 안개 포위 예고 · 2초 뒤 봉쇄! 표시 밖으로 피하거나 안에서 7초 버티세요.');
    return true;
}
export function constrainEncirclementPlayer() {
    const ring = G.encirclement, p = G.player;
    if (!ring || ring.phase !== 'active' || !valid()) return false;
    const dx = p.x - ring.x, dy = p.y - ring.y, distance = Math.hypot(dx, dy);
    const limit = Math.max(0, ring.radius - (p.radius || 10));
    if (distance <= limit) return false;
    const nx = dx / distance, ny = dy / distance;
    p.x = ring.x + nx * limit; p.y = ring.y + ny * limit;
    // Keep tangential movement, discard outward velocity. Invulnerability never bypasses the wall.
    const outward = (p.vx || 0) * nx + (p.vy || 0) * ny;
    if (outward > 0) { p.vx -= outward * nx; p.vy -= outward * ny; }
    return true;
}
export function updateEncirclement(dt) {
    const ring = G.encirclement;
    if (!ring) return;
    if (!valid() || ring.stage !== G.stage || ring.runId !== G.runId) { clearEncirclement(); return; }
    if (G.paused || !Number.isFinite(dt) || dt <= 0) return;
    ring.age += dt;
    if (ring.age >= ENCIRCLEMENT.warning + ENCIRCLEMENT.active) { clearEncirclement(); return; }
    if (ring.phase === 'warning' && ring.age >= ENCIRCLEMENT.warning) {
        // Escaping during the telegraph is fair counterplay: never snap a player back in.
        const safeRadius = ring.radius - (G.player.radius || 10);
        if (Math.hypot(G.player.x - ring.x, G.player.y - ring.y) > safeRadius) { clearEncirclement(); return; }
        ring.phase = 'active';
        emit('toast', '독 안개 봉쇄 · 안에서 7초 버티세요!');
    }
    constrainEncirclementPlayer();
}
// Warning provides a full two-second camera transition; active wall never drifts offscreen.
export function updateEncirclementCamera(dt) {
    const ring = G.encirclement, cam = G.camera, p = G.player;
    if (ring && valid()) {
        const t = Math.min(1, ring.age / ENCIRCLEMENT.warning);
        const ease = t * t * (3 - 2 * t);
        cam.x = ring.cameraStartX + (ring.x - ring.cameraStartX) * ease;
        cam.y = ring.cameraStartY + (ring.y - ring.cameraStartY) * ease;
        return ring.phase === 'active';
    }
    if (p) {
        const k = Math.min(1, Math.max(0, dt) * 10);
        cam.x += (p.x - cam.x) * k;
        cam.y += (p.y - 20 - cam.y) * k;
    }
    return false;
}

export function drawEncirclement(ctx) {
    const ring = G.encirclement;
    if (!ring || !valid()) return;
    const active = ring.phase === 'active';
    const remaining = Math.max(0, Math.ceil((active ? 9 : 2) - ring.age));
    ctx.save();
    // Code-native fog: soft bands + wisps, no filled interior or per-frame particle allocations.
    for (let i = 3; i >= 0; i--) {
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius + i * 5, 0, Math.PI * 2);
        ctx.strokeStyle = active ? `rgba(119,221,111,${0.06 + (3-i)*0.035})` : 'rgba(190,239,130,0.12)';
        ctx.lineWidth = 8 + i * 7; ctx.stroke();
    }
    ctx.setLineDash(active ? [] : [10, 9]);
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = active ? '#bcf48e' : '#f6d985'; ctx.lineWidth = active ? 3 : 2; ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 18; i++) {
        const angle = i * Math.PI * 2 / 18 + Math.sin(ring.age * 0.7 + i) * 0.025;
        const x = ring.x + Math.cos(angle) * (ring.radius + 9), y = ring.y + Math.sin(angle) * (ring.radius + 9);
        ctx.beginPath(); ctx.ellipse(x, y, 13, 22, angle, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(120,196,104,0.28)' : 'rgba(193,206,117,0.16)'; ctx.fill();
    }
    // Player-relative label remains on screen even at the far edge of the enclosure.
    const x = G.player.x, y = G.player.y - 76;
    ctx.fillStyle = 'rgba(12,30,22,0.9)'; ctx.fillRect(x - 114, y - 14, 228, 28);
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = active ? '#d7ffc0' : '#ffe7a2';
    ctx.fillText(active ? `독 안개 봉쇄 · 해제까지 ${remaining}초` : `독 안개 예고 · ${remaining}초 후 봉쇄`, x, y);
    ctx.restore();
}
