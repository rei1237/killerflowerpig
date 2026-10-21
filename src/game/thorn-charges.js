// One consumable charge per visible petal. No target hit cache survives pool reuse.
import { G } from './state.js';
import { hitEnemy } from './enemies.js';
import { healPlayer } from './player.js';
import { sparks } from './effects.js';
import { TIER_POWER, tierPower } from '../data/weapons.js';

// ── 연꽃 수호 · 꽃잎 파열 ──
// 준비된 꽃잎 하나하나가 방어와 공격을 겸한다. 레벨업(꽃잎 수·크기·재생)이 그대로 성능이 된다.
//  · 탄 막기: 준비된 꽃잎이 적 탄환과 겹치면 탄을 지우고 꽃잎이 소모된다.
//  · 만개 수호: 준비된 꽃잎 1개당 받는 피해 -perPetal (상한 cap). 진화하면 더 단단해진다.
//  · 꽃잎 파열: 꽃잎이 소모될 때(적중·탄 막기) 그 자리에서 터져 주변 적에게 피해. 레벨이 오를수록 비율이 커진다.
export const THORN_GUARD = Object.freeze({ perPetal: .04, cap: .2, evolvedPerPetal: .05, evolvedCap: .3,
    burstBase: .1, burstPerLevel: .01, evolvedBurst: 0, burstRadius: 40, evolvedBurstRadius: 1.25,
    burstTargets: 3 }); // 파열 1회 최대 대상: 3 (+1 Lv5, +1 진화) — 밀집 대군에서 화면 청소가 되지 않게
const liveStates = new Set();
const fresh = state => state.player === G.player && G.clock - state.seen <= .25;
export function thornBurstRatio(w) { return THORN_GUARD.burstBase + THORN_GUARD.burstPerLevel * (Math.min(8, Math.max(1, w.level || 1)) - 1) + (w.evolved ? THORN_GUARD.evolvedBurst : 0); }
export function thornBurstRadius(w, s) { return THORN_GUARD.burstRadius * (s.area || 1) * (w.evolved ? THORN_GUARD.evolvedBurstRadius : 1); }
function petalPoint(state, i) {
    const a = state.angle + i / state.slots.length * TAU;
    return { x: state.x + Math.cos(a) * state.orbitRadius, y: state.y - 20 + Math.sin(a) * state.orbitRadius * .8 };
}
function consume(state, slot, now) { slot.ready = false; slot.readyAt = now + state.stats.regrow; slot.bornAt = slot.readyAt; }
// 꽃잎 파열: (x,y) 는 몸통 높이 좌표. exclude = 직접 맞은 대상(이중 피해 방지).
function petalBurst(state, x, y, exclude = null) {
    const w = state.owner, s = state.stats, r = thornBurstRadius(w, s), weapon = w.sourceId || w.id;
    // 조합 무기에 계승된 가시 코어는 조합 보정(작음) 대신 진화 가시 기준으로 파열한다: 조합해도 파열이 약해지지 않는다.
    const base = w.sourceId ? s.dmg * TIER_POWER.evolved.thorns / (tierPower(w) || 1) : s.dmg, dmg = base * thornBurstRatio(w);
    sparks(x, y, 6, w.evolved ? '#ff3b6b' : '#ff9fd0', 150);
    // 가까운 순으로 최대 burstTargets 명
    const near = [];
    for (let i = 0; i < G.enemies.count; i++) {
        const e = G.enemies.items[i];
        if (!e.alive || e === exclude) continue;
        const dx = e.x - x, dy = e.y - e.radius - y, d2 = dx * dx + dy * dy;
        if (d2 <= (r + e.radius) ** 2) near.push([d2, e, dx, dy]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const limit = THORN_GUARD.burstTargets + ((w.level || 1) >= 5 ? 1 : 0) + (w.evolved ? 1 : 0);
    for (const [d2, e, dx, dy] of near.slice(0, limit)) {
        const d = Math.sqrt(d2) || 1;
        hitEnemy(e, dmg, { weapon, kx: dx / d, ky: dy / d, knock: 60, bleed: s.bleed, silent: true });
    }
    const boss = G.boss;
    if (boss?.alive && boss !== exclude && Math.hypot(boss.x - x, boss.y - boss.radius - y) <= r + boss.radius) boss.hurt(dmg, { weapon });
}
// 적 탄환이 준비된 꽃잎에 닿으면 막는다. true = 탄 소멸.
export function interceptEnemyShot(shot) {
    if (!liveStates.size) return false;
    const now = G.clock;
    for (const state of liveStates) {
        if (!fresh(state)) { liveStates.delete(state); continue; }
        for (let i = 0; i < state.slots.length; i++) {
            const slot = state.slots[i];
            if (!slot.ready) continue;
            const pt = petalPoint(state, i), reach = state.petalRadius + (shot.radius || 6);
            if ((pt.x - shot.x) ** 2 + (pt.y - shot.y) ** 2 > reach * reach) continue;
            consume(state, slot, now);
            petalBurst(state, shot.x, shot.y);
            return true;
        }
    }
    return false;
}
// 만개 수호: 준비된 꽃잎 수에 비례한 받는 피해 감소 (여러 가시 코어 중 가장 강한 것 하나).
export function thornGuardReduction() {
    let best = 0;
    for (const state of liveStates) {
        if (!fresh(state)) { liveStates.delete(state); continue; }
        const ready = state.slots.reduce((n, slot) => n + (slot.ready ? 1 : 0), 0), evolved = !!state.owner.evolved;
        best = Math.max(best, Math.min(evolved ? THORN_GUARD.evolvedCap : THORN_GUARD.cap, ready * (evolved ? THORN_GUARD.evolvedPerPetal : THORN_GUARD.perPetal)));
    }
    return best;
}
export function resetThornGuard() { liveStates.clear(); }

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
        const bx = victim.x, by = victim.y - victim.radius;
        if (victim === G.boss) {
            const damage = victim.hurt(s.dmg, { weapon, crit: s.crit, critBonus: s.critBonus });
            if (s.lifesteal && damage > 0) healPlayer(s.lifesteal);
        } else {
            const damage = hitEnemy(victim, s.dmg, { weapon, kx: Math.cos(angle + Math.PI / 2),
                ky: Math.sin(angle + Math.PI / 2), knock: 90, crit: s.crit, critBonus: s.critBonus, bleed: s.bleed });
            if (s.lifesteal && damage) healPlayer(s.lifesteal);
        }
        Object.assign(state, { owner: w, stats: s });
        petalBurst(state, bx, by, victim);
    }
    Object.assign(state, { time: now, x: p.x, y: p.y, angle: w.angle, count: s.amount, owner: w, stats: s, orbitRadius: radius, petalRadius, seen: now });
    liveStates.add(state);
    return state;
}
