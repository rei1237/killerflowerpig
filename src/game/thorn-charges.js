// One consumable charge per visible petal. No target hit cache survives pool reuse.
import { G } from './state.js';
import { hitEnemy } from './enemies.js';
import { healPlayer } from './player.js';

export const THORN_SWEEP_SEGMENTS = 64;
const TAU = Math.PI * 2;
function entryTime(ax, ay, bx, by, radius) {
    const c = ax * ax + ay * ay - radius * radius;
    if (c <= 0) return 0;
    const dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
    if (a < 1e-12) return null;
    const b = 2 * (ax * dx + ay * dy), discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
}
export function thornChargeState(w, s, player, now) {
    let state = w.thornState;
    // New run/restore/player identity or a rewound clock cannot inherit spent charges.
    if (!state || state.player !== player || now < state.time || state.stage !== G.stage || state.stageStartTime !== G.stageStartTime) {
        state = w.thornState = { player, time: now, x: player.x, y: player.y, angle: w.angle,
            count: s.amount, slots: [], stage: G.stage, stageStartTime: G.stageStartTime };
    }
    if (state.slots.length > s.amount) state.slots.length = s.amount;
    while (state.slots.length < s.amount) state.slots.push({ ready: true, readyAt: now, bornAt: now });
    for (const slot of state.slots) if (!slot.ready && now >= slot.readyAt) {
        slot.ready = true; slot.bornAt = slot.readyAt;
    }
    return state;
}
function firstContact(target, state, player, angle, offset, radius, petalRadius, start, elapsed) {
    const movementX = target.motionVX || 0, movementY = target.motionVY || 0;
    const delta = angle - state.angle;
    // Actual traveled arc and relative target motion, never an expanded hit radius.
    const steps = Math.min(THORN_SWEEP_SEGMENTS, Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 48)),
        Math.ceil(Math.hypot(player.x - state.x, player.y - state.y) / Math.max(6, petalRadius))));
    const point = fraction => {
        const a = state.angle + delta * fraction + offset;
        const px = state.x + (player.x - state.x) * fraction + Math.cos(a) * radius;
        const py = state.y + (player.y - state.y) * fraction - 20 + Math.sin(a) * radius * .8;
        const tx = target.x - movementX * elapsed * (1 - fraction);
        const ty = target.y - target.radius - movementY * elapsed * (1 - fraction);
        return [px - tx, py - ty];
    };
    let a = start, from = point(a);
    for (let segment = Math.floor(start * steps); segment < steps; segment++) {
        const b = (segment + 1) / steps, to = point(b);
        if (b < start) continue;
        const hit = entryTime(from[0], from[1], to[0], to[1], petalRadius + target.radius);
        if (hit !== null) return a + (b - a) * hit;
        a = b; from = to;
    }
    if (start >= 1) {
        const [x, y] = point(1);
        if (x * x + y * y <= (petalRadius + target.radius) ** 2) return 1;
    }
    return null;
}
export function updateThornCharges(w, s, dt) {
    const p = G.player, now = G.clock;
    const state = thornChargeState(w, s, p, now);
    const elapsed = Math.max(0, Math.min(Math.max(0, dt), now - state.time));
    const countChanged = state.count !== s.amount;
    const radius = s.radius * s.area, petalRadius = 12 * s.area;
    const targets = G.enemies.items.slice(0, G.enemies.count);
    if (G.boss?.alive) targets.push(G.boss);
    // Conservative relative-motion broad phase. A target whose endpoints are far
    // away is still retained when its traveled segment crosses the orbit.
    const candidates = targets.filter(target => {
        if (!target.alive) return false;
        const ax = target.x - (target.motionVX || 0) * elapsed - state.x;
        const ay = target.y - target.radius - (target.motionVY || 0) * elapsed - state.y + 20;
        const bx = target.x - p.x, by = target.y - target.radius - p.y + 20;
        const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
        return (ax + dx * t) ** 2 + (ay + dy * t) ** 2 <= (radius + petalRadius + target.radius) ** 2;
    });
    const hitThisUpdate = new Set();
    for (let i = 0; i < state.slots.length; i++) {
        const slot = state.slots[i];
        if (!slot.ready) continue;
        // Count growth rearranges slots without an imaginary sweep across the gap.
        const start = elapsed > 0 && !countChanged ? Math.max(0, Math.min(1, (slot.bornAt - state.time) / elapsed)) : 1;
        let victim = null, earliest = Infinity;
        for (const target of candidates) {
            if (!target.alive || hitThisUpdate.has(target)) continue;
            const time = firstContact(target, state, p, w.angle, i / s.amount * TAU, radius, petalRadius, start, elapsed);
            if (time !== null && (time < earliest || time === earliest && (target.id || 0) < (victim?.id || 0))) {
                victim = target; earliest = time;
            }
        }
        if (!victim) continue;
        // Consume before damage: lethal hits/callbacks cannot reuse this charge.
        slot.ready = false; slot.readyAt = now + s.regrow; slot.bornAt = slot.readyAt;
        hitThisUpdate.add(victim);
        const angle = w.angle + i / s.amount * TAU, weapon = w.sourceId || w.id;
        if (victim === G.boss) {
            const damage = victim.hurt(s.dmg, { weapon, crit: s.crit, critBonus: s.critBonus });
            if (s.lifesteal && damage > 0) healPlayer(s.lifesteal);
        } else {
            const damage = hitEnemy(victim, s.dmg, { weapon, kx: Math.cos(angle + Math.PI / 2),
                ky: Math.sin(angle + Math.PI / 2), knock: 90, crit: s.crit, critBonus: s.critBonus, bleed: s.bleed });
            if (s.lifesteal && damage) healPlayer(s.lifesteal);
        }
    }
    Object.assign(state, { time: now, x: p.x, y: p.y, angle: w.angle, count: s.amount });
    return state;
}
