// Cosmetic-only attack state: no projectile, hitbox, damage, cooldown or input writes.
import { WEAPONS } from '../data/weapons.js';
import { TECHS, WEAPON_TAGS } from '../data/techs.js';
import { markPlayerShot, shotFrame } from './player-motion.js';

export const ATTACK_FAMILIES = Object.freeze(['fire', 'dual', 'throw', 'cannon', 'blade', 'channel']);
export const WEAPON_POSES = Object.freeze({
    shotgun: 'fire', rifle: 'fire', scatter_rail: 'fire', toxic_scatter: 'fire', doom_barrage: 'fire',
    pistols: 'dual', burst_rail: 'dual', guillotine: 'dual',
    molotov: 'throw', gas: 'throw', plague_fire: 'throw', plague_end: 'throw',
    cannon: 'cannon', lotus_bloom: 'cannon', ember_lance: 'cannon', absolute_bloom: 'cannon',
    saw: 'blade', venom_saw: 'blade', orbit_saw: 'blade', carnage_saw: 'blade',
    thorns: 'channel', lotus_gun: 'fire',
});
export const TECH_IDLE_POSES = Object.freeze({ gunline: 'fire', executioner: 'dual', plague: 'throw', bloom: 'cannon', butcher: 'blade' });
export const ATTACK_HOLD = 0.110;
export function attackMinimumHold(tier) { return tier === 'absolute' ? .180 : tier === 'fusion' ? .150 : tier === 'evolved' ? .125 : ATTACK_HOLD; }
export const ATTACK_RECOVERY = 0.400;
const FAMILY_PHASES = Object.freeze({
    fire: Object.freeze([.032,.068,.110,.160,.210,.260,.300]),
    dual: Object.freeze([.024,.052,.090,.140,.190,.245,.300]),
    throw: Object.freeze([.040,.080,.120,.170,.215,.260,.300]),
    cannon: Object.freeze([.045,.090,.145,.200,.250,.300,.360]),
    blade: Object.freeze([.045,.080,.125,.170,.220,.260,.300]),
    channel: Object.freeze([.050,.095,.140,.190,.235,.275,.320]),
});
export function attackFrame(elapsed, family = 'fire', tier = 'normal') {
    if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
    const phases = FAMILY_PHASES[family] || FAMILY_PHASES.fire;
    // Upgraded releases brace through the peak longer and recover visibly.
    // This changes only drawn frame traversal; the projectile is still t=0.
    const hold = tier === 'absolute' ? .040 : tier === 'fusion' ? .025 : tier === 'evolved' ? .012 : 0;
    for (let i = 0; i < phases.length; i++) if (elapsed < phases[i] + (i >= 2 ? hold : 0)) return i + 1;
    return 0;
}
const TIER_RANK = Object.freeze({ normal: 0, evolved: 1, fusion: 2, absolute: 3, legendary: 2 });

export function weaponPose(w, { follow = false, family } = {}) {
    // Explicit families only describe a real sub-attack (e.g. ember_lance's bottle).
    if (ATTACK_FAMILIES.includes(family)) return family;
    if (w?.id === 'gas' && follow) return 'channel';
    return WEAPON_POSES[w?.id] || 'fire';
}
export function attackTier(w) {
    if (w?.id === 'lotus_gun') return 'legendary';
    const def = WEAPONS[w?.sourceId || w?.id];
    return def?.tier === 'absolute' ? 'absolute' : def?.fusionOnly ? 'fusion' : w?.evolved ? 'evolved' : 'normal';
}
export function attackPriority(w, techId, family = weaponPose(w)) {
    const tech = TECHS[techId], tags = WEAPON_TAGS[w?.id] || [];
    const affinity = !!tech && tags.some(tag => tech.tags.includes(tag));
    // Real family wins first; tech only resolves simultaneous contenders. A
    // passive or a field's damage tick never calls this API.
    return TIER_RANK[attackTier(w)] * 4 + (affinity ? 3 : 0) + (w?.sourceId ? 0 : 2)
        + (family === 'channel' ? 0 : 1);
}
export function idleAttackFamily(techId) { return TECH_IDLE_POSES[techId] || 'fire'; }

export function markPlayerAttack(player, clock, w, dx, { tech = null, family, follow = false, activation = false } = {}) {
    if (!player || player.dead || !w?.id || !Number.isFinite(clock)) return false;
    const pose = weaponPose(w, { family, follow });
    const old = player.attackPose, elapsed = clock - (old?.at ?? -Infinity);
    const priority = attackPriority(w, tech, pose), tier = attackTier(w);
    const same = old && old.weapon === (w.sourceId || w.id) && old.core === w.id && old.family === pose;
    // Burst bullets may update the real-shot timestamp without freezing the
    // authored body forever on frame 1. Start a new body cycle after 110 ms.
    const withinHold = elapsed >= 0 && elapsed < attackMinimumHold(old?.tier);
    const sameTick = old && Math.abs(elapsed) < 1e-7;
    // A burst fusion schedules its main bullets one update after its inherited
    // rifle/saw cores. Its first real main bullet may replace that same-owner
    // core, rather than hiding the new dual-pistol weapon for a whole hold.
    const mainReplacesOwnCore = old && old.weapon === w.id && !w.sourceId && old.core !== old.weapon && priority > old.priority;
    if (withinHold && !mainReplacesOwnCore && (!sameTick || priority <= old.priority)) {
        if (same && !activation) markPlayerShot(player, clock, dx);
        return false;
    }
    // A lower-priority event can take over once the held release is readable.
    // No queue: stale attacks must never play after their projectile has left.
    const facing = Math.abs(dx) > 0.08 ? dx < 0 : !!player.flip;
    player.attackPose = { at: clock, flip: facing, family: pose, weapon: w.sourceId || w.id,
        core: w.id, tier, priority, legendary: w.id === 'lotus_gun', color: WEAPONS[w.sourceId || w.id]?.color || '#ffe8a1' };
    markPlayerShot(player, clock, dx);
    return true;
}

export function playerAttackPose(player = {}, clock = 0, tech = null) {
    const attack = player.attackPose;
    const ready = ATTACK_FAMILIES.includes(player.readyFamily) ? player.readyFamily : idleAttackFamily(tech);
    if (attack && Number.isFinite(attack.at)) {
        const elapsed = clock - attack.at;
        const frame = attackFrame(elapsed, attack.family, attack.tier);
        if (frame) return { ...attack, frame, active: true };
        // The active held weapon determines the brief rest stance until the
        // next event, but the legendary gun returns to the build's ready pose.
        return { family: tech || player.readyFamily || attack.legendary ? ready : attack.family, frame: 0, flip: !!player.flip, active: false, tier: 'normal', legendary: false };
    }
    // Old callers and saved preview tests can still use the original gun API.
    const frame = shotFrame(clock - (player.shotAt ?? -Infinity));
    return { family: ready, frame, flip: frame ? !!player.shotFlip : !!player.flip, active: !!frame, tier: 'normal', legendary: false, legacy: true };
}

// One small local stroke, with a hard 220 ms lifetime and no particle state.
// Reduced motion suppresses the accent, not the readable body silhouette.
export function drawAttackAccent(ctx, pose, clock, reducedMotion = false) {
    if (reducedMotion || !pose?.active || !Number.isFinite(pose.at) || pose.tier === 'normal') return;
    const age = clock - pose.at;
    if (age < 0 || age >= 0.22) return;
    const rank = TIER_RANK[pose.tier] || 0, reach = 10 + rank * 2;
    ctx.strokeStyle = pose.color || '#ffe8a1';
    ctx.globalAlpha = (ctx.globalAlpha ?? 1) * 0.65 * (1 - age / 0.22);
    ctx.lineWidth = rank === 3 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(-reach, -8); ctx.lineTo(-reach - 3, -12);
    ctx.moveTo(reach, -8); ctx.lineTo(reach + 3, -12);
    if (rank >= 2) { ctx.moveTo(-7, -5); ctx.lineTo(7, -5); }
    if (rank >= 3) { ctx.moveTo(-3, -2); ctx.lineTo(3, -2); }
    ctx.stroke();
}
