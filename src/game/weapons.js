import { applyTechWeaponBonus, resonanceTier, isMismatchedWeapon } from './tech.js';
import { FUSION_RECIPES } from '../data/fusions.js';
import { MISMATCH_DAMAGE } from '../data/techs.js';
import { firingMuzzle } from './player-motion.js';
import { markPlayerAttack } from './attack-animation.js';
import { createWeaponVfxFrame, drawWeaponProjectile, drawWeaponOrbit, drawWeaponBeam, drawBeamHitAccents, drawStunMarks, drawFusionResidues, drawFusionHitAccents, recordLotusBloom, drawLotusBlooms, resetLotusBlooms } from './weapon-vfx.js';
// 무기 런타임: 쿨다운 → 발사 패턴, 플레이어 투사체/광선/궤도체 업데이트 및 충돌
import { G, rand } from './state.js';
import { fireSword, drawButcherSword } from './butcher-sword.js';
import { choosePlagueLanding } from './plague-targeting.js';
import { updateThornCharges, thornOrbitRadius, thornPetalRadius, thornStun } from './thorn-charges.js';
import { chooseCannonVolley, collectCannonTargets, cannonBeamHits, cannonFocusMultiplier, CANNON_RAY_LIMIT } from './cannon-targeting.js';
import { WEAPONS, tierPower, CANNON_IMPACT_MULTIPLIER, CANNON_MISMATCH_DAMAGE, CANNON_STRAIGHT_POWER, cannonLaneRatio, cannonLaneStack } from '../data/weapons.js';
import { fx, glow, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { hitEnemy } from './enemies.js';
import { spawnHazard, limitFriendlyFields } from './hazards.js';
import { sparks, petals, embers, shake, floatText } from './effects.js';
import { healPlayer } from './player.js';
import { preferredTarget, focusedTarget } from './targeting.js';
import { upgradeLevel } from '../core/save.js';

export function createWeapon(id, slot) {
    return { id, slot, level: 1, evolved: false, cd: 0.4, activeT: 0, angle: 0, burst: 0, burstT: 0, trailT: 0, follow: null };
}

// Final fusions retain both evolved attack cores. They are runtime children,
// never inventory slots or recursive fusions, and all effects belong to sourceId.
export function activeWeaponCores(create = true) {
    const out = [];
    for (const w of G.weapons) {
        out.push(w);
        const recipe = FUSION_RECIPES.find(r => r.output === w.id);
        if (!recipe) continue;
        if (!w.fusionCores && create) w.fusionCores = recipe.inputs.map((input, index) => Object.assign(createWeapon(input.id, w.slot), { level: 8, evolved: true, sourceId: w.id, coreIndex: index + 1, cd: w.cd }));
        for (const core of w.fusionCores || []) {
            if (create) { core.slot = w.slot; core.fusionLevel = w.level; }
            out.push(core);
        }
    }
    return out;
}
const ownerId = w => w.sourceId || w.id;
const isCannonBeam = id => ['cannon', 'lotus_bloom', 'ember_lance', 'absolute_bloom'].includes(id);
const cannonRequests = [];
const animateAttack = (w, dx, options) => markPlayerAttack(G.player, G.clock, w, dx, { tech: G.tech, ...options });
const hitChannel = w => w.coreIndex ? 6 + w.slot * 3 + w.coreIndex - 1 : w.slot;
function ensureHitChannels(e) {
    if (e.hits instanceof Float32Array && e.hits.length >= 24) return;
    const previous = e.hits;
    e.hits = new Float32Array(24).fill(-99);
    if (previous instanceof Float32Array) e.hits.set(previous.subarray(0, 24));
}

// 레벨·진화·패시브를 반영한 최종 수치
export function weaponStats(w) {
    const def = WEAPONS[w.id];
    const b = def.base;
    const ps = G.player.stats;
    const acc = { dmg: 0, cd: 0, amount: 0, area: 0, duration: 0, speed: 0, pierce: 0, slow: 0, crit: 0, critBonus: 0, length: 0, width: 0, regrow: 0 };
    for (let i = 0; i < Math.min(8, Math.max(1, w.level)) - 1; i++) {
        const l = def.levels[i];
        for (const k in acc) if (l[k]) acc[k] += l[k];
    }
    const ev = w.evolved && def.evolve ? def.evolve.mods : {};
    const result = {
        dmg: (b.dmg + acc.dmg) * (ev.dmg || 1) * (w.evolved ? 1.35 : 1) * ps.might,
        cd: b.cd * Math.max(0.25, 1 + acc.cd) * (ev.cd || 1) * ps.cooldown,
        amount: Math.max(1, Math.round((b.amount + acc.amount + (ps.amount || 0)) * (ev.amount || 1))),
        area: (1 + acc.area) * (ev.area || 1) * ps.area,
        duration: b.duration * (1 + acc.duration) * (ev.duration || 1) * ps.duration,
        speed: b.speed * (1 + acc.speed) * ps.projSpeed,
        pierce: (b.pierce || 0) + acc.pierce + (ev.pierce || 0) + (b.pierce ? ps.pierce || 0 : 0),
        slow: Math.min(0.85, (b.slow || 0) + acc.slow + (ev.slow || 0)),
        // 무기 고유 치명타: 확률(crit)과 치명타 피해 배율 가산(critBonus, 기본 3배에 더함)
        crit: (b.crit || 0) + acc.crit + (ev.crit || 0), critBonus: (b.critBonus || 0) + acc.critBonus + (ev.critBonus || 0),
        execute: Math.max(ev.execute || 0, b.execute || 0), bleed: Math.max(ev.bleed || 0, b.bleed || 0),
        lifesteal: ev.lifesteal || 0, permanent: !!ev.permanent, trail: !!ev.trail, follow: !!ev.follow,
        spread: b.spread || 0, radius: b.radius || 0, tick: b.tick || 0.3, hitCd: b.hitCd || 0.3,
        length: ((b.length || 0) + acc.length) * ps.projSpeed, width: (b.width || 0) + acc.width,
        bonusAmount: (ps.amount || 0) + Math.round(4 * (ps.amountMul || 0)), durationScale: ps.duration,
    };
    // 탄창 확장(비례): 투사체 수 × (1+보너스). 정수로 늘리지 못한 나머지는 피해 배율로 환산
    if (ps.amountMul) {
        const total = result.amount * (1 + ps.amountMul), n = Math.max(result.amount, Math.floor(total + 1e-9));
        if (!isCannonBeam(w.id)) result.dmg *= total / n;
        result.amount = n;
    }
    applyTechWeaponBonus(w, result);
    // The three-beam limit applies after every source of extra projectiles.
    // No removed or fractional ray is converted into hidden damage.
    if (isCannonBeam(w.id)) {
        result.amount = Math.min(CANNON_RAY_LIMIT, result.amount);
        result.cd = Math.max(0.3, result.cd);
    }
    if (w.sourceId) {
        // Cannon's focused Lv8 base is 4/3 of its former curve; scale only this core's
        // cap proportionally so ordinary might upgrades retain their headroom.
        const absolute = WEAPONS[w.sourceId]?.tier === 'absolute';
        // Absolute Bloom deliberately trades some inherited power/cadence and
        // lifesteal for its three-core composition; other owners are unchanged.
        const restrainedBloom = w.sourceId === 'absolute_bloom';
        // 계승 코어 배율 하향 (최종 무기 하향 조정): 일반 1.35→1.15, 절대 1.65→1.35, 대포 1.95→1.5, 절대 만개 1.6/1.4→1.3/1.15
        const sourcePower = restrainedBloom ? (w.id === 'cannon' ? 1.30 : 1.15) :
            absolute ? (w.id === 'cannon' ? 1.50 : 1.35) : 1.15;
        const sourceGrowth = restrainedBloom ? .05 : .08;
        result.dmg = Math.min(w.id === 'cannon' ? 800 : 600, result.dmg * (sourcePower + sourceGrowth * (Math.min(8, Math.max(1, w.fusionLevel || 1)) - 1)));
        if (restrainedBloom) { result.cd *= 1.15; result.lifesteal *= .5; }
        result.amount = Math.min(20, result.amount); result.area = Math.min(3, result.area);
        result.duration = Math.min(14, result.duration); result.cd = Math.max(0.2, result.cd);
    }
    if (def.fusionOnly) {
        result.dmg = Math.min(def.tier === 'absolute' ? 420 : 220, result.dmg * (1 + 0.08 * (Math.min(8, Math.max(1, w.level)) - 1))); result.cd = Math.max(0.5, result.cd);
        result.amount = Math.min(def.amountCap || (w.id === 'lotus_bloom' ? 3 : w.id === 'plague_fire' ? 5 : 12), result.amount);
        result.area = Math.min(2, result.area); result.duration = Math.min(['lotus_bloom', 'ember_lance', 'absolute_bloom'].includes(w.id) ? 0.7 : 6, result.duration);
        result.pierce = Math.min(12, result.pierce); result.slow = Math.min(0.65, result.slow);
    }
    // 등급 보정: 상위 등급 무기가 하위 등급보다 약해지지 않도록. 피해 상한(220/420/600)은 보정 전 값에 적용된다.
    result.dmg *= tierPower(w);
    // Beam-only: do not double a mixed weapon's orbit, fire field or lifesteal.
    // Derived once after all stat multipliers/caps; inherited cores use this
    // same path without multiplying their owner's already-derived value.
    if (isCannonBeam(w.id)) {
        result.beamDamage = result.dmg * CANNON_IMPACT_MULTIPLIER * CANNON_STRAIGHT_POWER * (isMismatchedWeapon(w.id) ? CANNON_MISMATCH_DAMAGE / MISMATCH_DAMAGE : 1);
        result.focusBeamDamage = result.beamDamage;
        // One straight lane: all rays overlap, so a target on it takes the stacked lane.
        result.beamAutoImpact = result.beamDamage * cannonLaneRatio(w.id, w.level) * cannonLaneStack(result.amount);
        result.beamFocusedImpact = result.focusBeamDamage * cannonFocusMultiplier(result.amount);
    }
    if (w.id === 'thorns') {
        // result.cd already includes player and tech cooldown exactly once.
        result.regrow = Math.max(.35, ((b.regrow || 1.8) + acc.regrow) * (ev.regrow || 1) * result.cd / b.cd);
        result.cd = result.regrow;
        result.permanent = true;
        result.duration = 0; // charges expire on contact, never as an all-petal activation
    }
    result.executeChance = 0;
    if (G.tech === 'executioner' && ['pistols', 'burst_rail', 'guillotine'].includes(w.id)) {
        result.critBonus += 0.75;
        result.executeChance = 0.03 + (w.level >= 5 ? 0.02 : 0) + (resonanceTier() >= 3 ? 0.03 : 0);
        result.precision = true;
    }
    return result;
}

// 가장 가까운 적 (그리드 반경 확장 탐색)
const near = [];
export function nearestEnemy(x, y, maxR = 480) {
    const focused = preferredTarget(x, y, maxR);
    if (focused) return focused;
    let best = null, bd = maxR * maxR;
    for (let r = 120; r <= maxR; r *= 2) {
        const list = G.grid.query(x, y, r, near);
        for (const e of list) {
            if (!e.alive) continue;
            const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = e; }
        }
        if (best) break;
    }
    // 보스는 사거리 안이면 우선 조준 (거리 가중치 0.5)
    if (G.boss && G.boss.alive) {
        const dx = G.boss.x - x, dy = G.boss.y - y;
        const d = dx * dx + dy * dy;
        if (d < maxR * maxR && d * 0.25 < bd) best = G.boss;
    }
    return best;
}

function aimAt(w, target, useMuzzle = true) {
    const p = G.player;
    if (!target) return [p.facingX, p.facingY];
    const origin = useMuzzle && images.playerFire ? firingMuzzle(p, G.clock, target.x-p.x) : null;
    const dx = target.x - (origin?.x ?? p.x), dy = (target.y - (target.radius || 20)) - (origin?.y ?? p.y-22);
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, origin];
}

// 탄환 피격 판정: 발밑 원 하나가 아니라 스프라이트 높이만큼의 세로 캡슐.
// 머리·몸통에 맞은 산탄 펠릿도 한 발 한 발 피해가 들어간다.
export function bodyDist2(t, x, y) {
    const spriteH = (t.atlas?.walkH || 0) * (t.scale || 0);
    const bottom = t.y - t.radius;
    const top = t.y - Math.max(t.radius, spriteH * 0.85 - t.radius);
    const cy = Math.max(top, Math.min(bottom, y));
    const dx = t.x - x, dy = cy - y;
    return dx * dx + dy * dy;
}

// Exact swept distance to the same vertical body capsule, not a larger hitbox.
function pointSegmentDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, d = dx * dx + dy * dy;
    const t = d ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d)) : 0;
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}
export function sweptBodyDist2(target, x0, y0, x1, y1) {
    const spriteH = (target.atlas?.walkH || 0) * (target.scale || 0);
    const top = target.y - Math.max(target.radius, spriteH * .85 - target.radius);
    const bottom = target.y - target.radius;
    if (x1 !== x0) {
        const t = (target.x - x0) / (x1 - x0), y = y0 + t * (y1 - y0);
        if (t >= 0 && t <= 1 && y >= top && y <= bottom) return 0;
    }
    return Math.min(bodyDist2(target, x0, y0), bodyDist2(target, x1, y1),
        pointSegmentDist2(target.x, top, x0, y0, x1, y1), pointSegmentDist2(target.x, bottom, x0, y0, x1, y1));
}
export function sawAimDirection(player, target, speed, origin = null) {
    const x = target.x - (origin?.x ?? player.x), y = target.y - (target.radius || 20) - (origin?.y ?? player.y - 22);
    const vx = target.motionVX ?? target.vx ?? 0, vy = target.motionVY ?? target.vy ?? 0;
    const a = vx * vx + vy * vy - speed * speed, b = 2 * (x * vx + y * vy), c = x * x + y * y;
    let time = 0;
    if (Math.abs(a) < 1e-8) { if (b < -1e-8) time = -c / b; }
    else {
        const d = b * b - 4 * a * c;
        if (d >= 0) { const r = Math.sqrt(d), t1 = (-b - r) / (2 * a), t2 = (-b + r) / (2 * a);
            time = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity); }
    }
    time = Number.isFinite(time) ? Math.max(0, Math.min(1, time)) : 0;
    const dx = x + vx * time, dy = y + vy * time, length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
}

// 처형인의 쌍권총 적중 연출: 치명타는 진홍 파편, 처형은 큰 문구와 화면 흔들림
function executionerHitFx(e) {
    const y = e.y - e.radius;
    if (e.lastExecute) {
        sparks(e.x, y, 14, '#ff2a4a', 260);
        sparks(e.x, y, 8, '#ffd36b', 200);
        floatText(e.x, y - e.radius * 2, '☠ 처형!', '#ff4d6d', 0.9);
        shake(3);
    } else if (e.lastCrit) {
        sparks(e.x, y, 7, '#ff3b5c', 220);
    }
}

export function precisionCrit(sh, target) {
    return (sh.crit || 0) + (sh.precision && sh.precisionTarget === target && sh.precisionTargetId === target.id && focusedTarget() === target ? 0.12 : 0);
}

function shoot(w, s, dirX, dirY, opts) {
    const p = G.player;
    const sh = G.shots.spawn();
    sh.kind = 'bullet';
    sh.weapon = ownerId(w); sh.coreId = w.sourceId ? w.id : null; sh.coreIndex = w.coreIndex || 0;
    sh.slot = w.slot;
    const muzzle = opts.origin || (images.playerFire ? firingMuzzle(p, G.clock, dirX) : { x: p.x + dirX * 16, y: p.y - 22 + dirY * 10 });
    sh.x = muzzle.x; sh.y = muzzle.y;
    sh.vx = dirX * s.speed; sh.vy = dirY * s.speed;
    sh.angle = Math.atan2(dirY, dirX);
    sh.dmg = s.dmg; sh.pierce = s.pierce; sh.life = s.duration;
    sh.radius = (opts.radius || 5) * s.area;
    sh.img = opts.img;
    sh.crit = s.crit; sh.critBonus = s.critBonus || 0; sh.execute = 0; sh.executeChance = s.executeChance || 0; sh.precision = !!s.precision;
    sh.precisionTarget = s.precision ? preferredTarget(G.player.x, G.player.y, 520) : null;
    sh.precisionTargetId = sh.precisionTarget?.id; sh.bleed = s.bleed; sh.slow = s.slow || 0;
    sh.knock = opts.knock ?? 60;
    sh.bounce = false;
    sh.spin = 0;
    sh.lastHit = sh.lastHit || [];
    sh.lastHit.length = 0;
    sh.evolved = w.evolved;
    return sh;
}

function lob(w, s, tx, ty, hazardKind) {
    const p = G.player;
    const sh = G.shots.spawn();
    sh.kind = 'lob';
    sh.weapon = ownerId(w); sh.coreId = w.sourceId ? w.id : null; sh.coreIndex = w.coreIndex || 0; sh.slot = w.slot;
    animateAttack(w, tx - p.x, { family: 'throw' });
    sh.sx = p.x; sh.sy = p.y - 30; sh.tx = tx; sh.ty = ty;
    sh.x = sh.sx; sh.y = sh.sy;
    sh.t = 0; sh.dur = G.tech === 'plague' ? 0.35 : 0.55; sh.life = 1;
    sh.hazard = hazardKind;
    sh.s = s;
    sh.img = (hazardKind === 'fire' || hazardKind === 'firegas') ? fx.bomb : null;
    sh.lastHit = sh.lastHit || [];
}

function randomEnemyNear(maxR, preferBoss = false) {
    const p = G.player;
    const b = G.boss;
    if (b && b.alive && (preferBoss || Math.random() < 0.5) && Math.hypot(b.x - p.x, b.y - p.y) < maxR * 1.3) return b;
    const list = G.grid.query(p.x, p.y, maxR, near);
    let n = 0, pick = null;
    for (const e of list) {
        if (!e.alive) continue;
        n++;
        if (Math.random() * n < 1) pick = e; // 저수지 샘플링
    }
    return pick;
}

export const BURST_INTERVAL = 0.045;
export const SAW_VISUAL_CAP = 6;
export const ORBIT_VISUAL_CAP = 8;
export function orbitStats(w, s) {
    if (w.id === 'orbit_saw') return { ...s, dmg: s.dmg * 0.6, amount: Math.min(5, 3 + Math.floor((w.level - 1) / 3) + (s.bonusAmount || 0)), radius: 78, duration: Math.min(4.5, 2.8 * (s.durationScale || 1)), permanent: false };
    return w.id === 'lotus_bloom' ? { ...s, dmg: s.dmg * 0.45, amount: Math.min(5, 3 + Math.floor((w.level - 1) / 3) + (s.bonusAmount || 0)), radius: 90, duration: Math.min(4.5, 2.8 * (s.durationScale || 1)), permanent: false }
        : s.amount > ORBIT_VISUAL_CAP ? { ...s, amount: ORBIT_VISUAL_CAP, dmg: s.dmg * s.amount / ORBIT_VISUAL_CAP } : s;
}
// 같은 무기의 장판은 한 번 투척 수 + 2 (최소 3)까지만 동시에 유지한다.
// 융합 무기는 자체 상한이 있으므로 제외.
const fieldCap = (s, id) => WEAPONS[id]?.fusionOnly ? Infinity : Math.max(3, Math.round(s.amount) + 2);
export function hellfireTrailStats(s) { return { radius: 64 * s.area, duration: Math.min(10, 6 * (s.durationScale || 1)), dmg: s.dmg * 0.6, tick: 0.3, slow: s.slow || 0 }; }
export function emberFieldStats(s) { return { ...s, dmg: s.dmg * 0.16, amount: Math.min(2, s.amount), duration: Math.min(6, 3 * (s.durationScale || 1)), radius: 54, tick: 0.3 }; }
const FIRE = {
    sword(w, s) { fireSword(w, s); },
    sword_wheel(w, s) { fireSword(w, s); },
    absolute_bloom(w, s) { FIRE.cannon(w, s); },
    // 절대 무기: 탄막 사수 — 360도 관통 탄환 + 조준 레일탄 3발
    doom_barrage(w, s) {
        const p = G.player, n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + G.clock * 0.7;
            shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: 5, knock: 60 });
        }
        const t = nearestEnemy(p.x, p.y, 700);
        const [dx, dy, origin] = aimAt(w, t);
        animateAttack(w, origin ? origin.x-G.player.x : dx);
        const base = Math.atan2(dy, dx);
        for (const off of [-0.08, 0, 0.08]) shoot(w, { ...s, dmg: s.dmg * 2 }, Math.cos(base + off), Math.sin(base + off), { img: fx.rail, radius: 7, knock: 120, origin });
        shake(2); audio.sfx('zap');
    },
    // 절대 무기: 역병 화염 — 거대한 역병 화염 장판 다발
    plague_end(w, s) {
        for (let i = 0; i < s.amount; i++) {
            const p = G.player, landing = G.tech === 'plague' ? choosePlagueLanding(p, 420, .35, i, { radius: s.radius * s.area, kind: 'fire', weapon: ownerId(w) }) : null;
            const e = landing || randomEnemyNear(420, i === 0);
            lob(w, s, e ? e.x : p.x + rand(-220, 220), e ? e.y : p.y + rand(-170, 170), 'firegas');
        }
    },
    // 절대 무기: 처형자 — 치명타·처형 특화 관통 연사
    guillotine(w, s) { FIRE.pistols(w, s); },
    // 절대 무기: 도살자 — 출혈을 남기는 거대 피의 톱날
    carnage_saw(w, s) { FIRE.saw(w, s); },
    burst_rail(w, s) { FIRE.pistols(w, s); },
    venom_saw(w, s) { FIRE.saw(w, s); },
    toxic_scatter(w, s) { FIRE.shotgun(w, s); },
    ember_lance(w, s) { FIRE.cannon(w, s); FIRE.molotov(w, emberFieldStats(s)); },
    orbit_saw(w, s) { FIRE.saw(w, s); w.activeT = orbitStats(w, s).duration; },
    lotus_bloom(w, s) { FIRE.cannon(w, s); w.activeT = orbitStats(w, s).duration; },
    scatter_rail(w, s) { FIRE.shotgun(w, s); },
    plague_fire(w, s) {
        for (let i = 0; i < s.amount; i++) {
            const p = G.player, landing = G.tech === 'plague' ? choosePlagueLanding(p, 340, .35, i, { radius: s.radius * s.area, kind: 'fire', weapon: ownerId(w) }) : null;
            const e = landing || randomEnemyNear(340, !!WEAPONS[w.id].fusionOnly);
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'firegas');
        }
    },
    shotgun(w, s) {
        const t = nearestEnemy(G.player.x, G.player.y, 420);
        const [dx, dy, origin] = aimAt(w, t);
        animateAttack(w, origin ? origin.x-G.player.x : dx);
        const base = Math.atan2(dy, dx);
        const n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = base + (n > 1 ? (i / (n - 1) - 0.5) * s.spread : 0) + rand(-0.05, 0.05);
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved ? fx.bossShot : fx.pellet, radius: 4, knock: 90, origin });
            sh.vx *= rand(0.85, 1.1); sh.vy *= rand(0.85, 1.1);
        }
        if (!images.playerFire) sparks(G.player.x + dx * 22, G.player.y - 22 + dy * 10, 5, '#ffcf6b', 140);
        shake(1.5);
        audio.sfx('shot');
    },
    pistols(w, s) {
        w.burst = s.amount;
        w.burstT = 0;
    },
    rifle(w, s) {
        const t = nearestEnemy(G.player.x, G.player.y, 700);
        const [dx, dy, origin] = aimAt(w, t);
        animateAttack(w, origin ? origin.x-G.player.x : dx);
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < s.amount; i++) {
            const a = base + (i === 0 ? 0 : rand(-0.35, 0.35));
            shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.rail, radius: w.evolved ? 9 : 6, knock: 120, origin });
        }
        audio.sfx(w.evolved ? 'zap' : 'shot');
    },
    thorns(w, s) {
        animateAttack(w, G.player.facingX, { activation: true });
        w.activeT = s.duration;
    },
    molotov(w, s) {
        const p = G.player;
        for (let i = 0; i < s.amount; i++) {
            const landing = G.tech === 'plague' ? choosePlagueLanding(p, 320, .35, i, { radius: s.radius * s.area, kind: 'fire', weapon: ownerId(w) }) : null;
            const e = landing || randomEnemyNear(320, !!w.sourceId);
            const tx = e ? e.x : p.x + rand(-200, 200);
            const ty = e ? e.y : p.y + rand(-150, 150);
            lob(w, s, tx, ty, 'fire');
        }
    },
    cannon(w, s) {
        // Main and retained cores due in this frame share one authored volley.
        // Their real scheduled damage is retained; removed rays add no damage.
        cannonRequests.push({ w, s });
    },
    gas(w, s) {
        const p = G.player;
        if (s.follow) {
            if (!w.follow || !w.follow.alive) {
                animateAttack(w, p.facingX, { follow: true, activation: true });
                w.follow = spawnHazard('gas', p.x, p.y, { radius: s.radius * s.area, duration: 9999, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: ownerId(w), follow: true });
            } else {
                w.follow.radius = s.radius * s.area; w.follow.dmg = s.dmg; w.follow.slow = s.slow;
            }
            return;
        }
        for (let i = 0; i < s.amount; i++) {
            const landing = G.tech === 'plague' ? choosePlagueLanding(p, 300, .35, i, { radius: s.radius * s.area, kind: 'gas', weapon: ownerId(w) }) : null;
            const e = landing || randomEnemyNear(300);
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'gas');
        }
    },
    saw(w, s) {
        const p = G.player;
        const aimed = G.tech === 'butcher' ? preferredTarget(p.x, p.y, 520) || nearestEnemy(p.x, p.y, 520) : null;
        const origin = aimed && images.playerFire ? firingMuzzle(p, G.clock, aimed.x-p.x) : null;
        const firstAim = aimed ? sawAimDirection(p, aimed, s.speed, origin) : null;
        animateAttack(w, origin ? origin.x-p.x : firstAim ? firstAim[0] : p.facingX, { family: 'blade' });
        // 화면 정리: 이전 톱날 묶음은 짧게 사라지고, 한 번에 최대 SAW_VISUAL_CAP개만 날린다.
        // 상한을 넘는 톱날 수는 피해로 환산해 총 화력은 유지한다.
        const owner = ownerId(w);
        for (let i = 0; i < G.shots.count; i++) {
            const old = G.shots.items[i];
            if (old.kind === 'saw' && old.weapon === owner && old.slot === w.slot && old.coreIndex === (w.coreIndex || 0)) old.life = Math.min(old.life, .15);
        }
        const n = Math.min(SAW_VISUAL_CAP, s.amount);
        if (s.amount > n) s = { ...s, dmg: s.dmg * s.amount / n };
        for (let i = 0; i < n; i++) {
            const randomAngle = Math.random() * Math.PI * 2;
            const a = i === 0 && firstAim ? Math.atan2(firstAim[1], firstAim[0]) : randomAngle;
            const big = w.id === 'carnage_saw';
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved || big ? fx.sawBone : fx.saw, radius: big ? 18 : 14, knock: big ? 70 : 40, origin: i === 0 ? origin : null });
            sh.kind = 'saw';
            sh.pierce = 9999;
            sh.bounce = true;
            sh.hitCd = s.hitCd;
        }
        audio.sfx('saw');
    },
};

function flushCannonVolleys() {
    // Every same-frame Cannon release shares the same visible three-ray geometry,
    // even when two different final weapons are equipped. Nothing fires invisibly.
    if (cannonRequests.length) {
        const components = cannonRequests;
        // Prioritize the strongest actual release for pose/visual attribution.
        const primary = components.reduce((best, c) => c.s.dmg > best.s.dmg ? c : best);
        const { w } = primary, p = G.player, focus = focusedTarget();
        const count = Math.min(CANNON_RAY_LIMIT, Math.max(...components.map(c => c.s.amount)));
        const length = Math.max(...components.map(c => c.s.length * Math.sqrt(c.s.area)));
        const width = Math.max(...components.map(c => c.s.width * c.s.area));
        const rayProfiles = Array.from({length:count},(_,i) => {
            const segments = components.filter(c=>c.s.amount>i).map(c=>({length:c.s.length*Math.sqrt(c.s.area),width:c.s.width*c.s.area}));
            return segments.filter((s,index)=>!segments.some((other,j)=>j!==index && other.length>=s.length && other.width>=s.width &&
                (other.length>s.length || other.width>s.width || j<index)));
        });
        const { targets } = collectCannonTargets({ player: p, grid: G.grid, enemies: G.enemies,
            boss: G.boss, focus, view: G.view, camera: G.camera, length });
        const right = images.playerFire ? firingMuzzle(p, G.clock, 1) : { x: p.x, y: p.y - 22 };
        const left = images.playerFire ? firingMuzzle(p, G.clock, -1) : right;
        const center = images.playerFire ? firingMuzzle(p, G.clock, 0) : right;
        const volley = chooseCannonVolley({ targets, focus, count, length, width, rayProfiles,
            fallbackAngle: Math.atan2(p.facingY, p.facingX),
            muzzleAt: dx => Math.abs(dx) <= .08 ? center : dx < 0 ? left : right });
        // 집중 사격 경로: 총구에서 집중 대상까지. 그 사이에 선 적들도 일반 광선 피해를 받는다.
        const focusPathLength = volley.focused ? Math.hypot(volley.focusEndX - volley.rays[0].x, volley.focusEndY - volley.rays[0].y) : 0;
        const damageTo = (target, path = false) => {
            const contributions = new Map();
            const focusedHit = volley.focused && !path;
            for (const { w: core, s } of components) {
                const len = path ? Math.min(s.length * Math.sqrt(s.area), focusPathLength) : s.length * Math.sqrt(s.area), wid = s.width * s.area;
                const rays = volley.focused ? 1 : Math.min(s.amount, volley.rays.length);
                let hits = 0;
                for (let i = 0; i < rays; i++) if (cannonBeamHits(target, { ...volley.rays[i], length: len, width: wid, segments: null })) hits++;
                if (!hits) continue;
                // The focus multiplier already counts every ray; a straight lane stacks its overlapping rays.
                const ratio = focusedHit ? cannonFocusMultiplier(s.amount) : cannonLaneRatio(core.id, core.level) * cannonLaneStack(hits, target === G.boss);
                const owner = ownerId(core), old = contributions.get(owner);
                const impact = (focusedHit ? s.focusBeamDamage : s.beamDamage) * ratio;
                if (old) { old.damage += impact; old.crit = Math.max(old.crit, s.crit); }
                else contributions.set(owner, { damage: impact, crit: s.crit });
            }
            return contributions;
        };
        let focusHit = false;
        const hit = (target, path = false) => {
            const before = target.hp, ray = volley.rays[0];
            for (const [weapon, { damage, crit }] of damageTo(target, path)) {
                if (!target.alive || target.hp <= 0) break;
                if (target === G.boss) target.hurt(damage, { weapon });
                else hitEnemy(target, damage, { weapon, kx: ray.dx, ky: ray.dy, knock: 160, crit });
            }
            if (volley.focused && !path) focusHit = target.hp < before;
        };
        if (volley.focused) {
            const target = volley.focusTarget;
            if (target.alive && target.hp > 0 && target.id === volley.focusTargetId) {
                hit(target);
                // 경로 위의 다른 적(보스 포함)도 관통해 맞힌다. 집중 배율은 집중 대상에게만 적용된다.
                for (let i = 0; i < G.enemies.count; i++) {
                    const e = G.enemies.items[i];
                    if (e !== target && e.alive && e.hp > 0) hit(e, true);
                }
                if (G.boss?.alive && G.boss !== target) hit(G.boss, true);
            }
        } else {
            for (let i = 0; i < G.enemies.count; i++) if (G.enemies.items[i].alive) hit(G.enemies.items[i]);
            if (G.boss?.alive) hit(G.boss);
        }
        // Hits are immediate. Replacing the previous visual also bounds overlaps
        // from independent owner cooldowns: never more than three active beams.
        G.beams.clear();
        const duration = Math.max(...components.map(c => c.s.duration));
        animateAttack(w, volley.rays[0].dx, { family: 'cannon' });
        for (let i = 0; i < volley.rays.length; i++) {
            const ray = volley.rays[i], b = G.beams.spawn();
            b.weapon = ownerId(w); b.coreId = w.sourceId ? w.id : null; b.slot = w.slot;
            b.x = ray.x; b.y = ray.y; b.angle = ray.angle; b.len = ray.length; b.width = ray.width;
            b.life = duration; b.max = duration; b.evolved = w.evolved;
            b.segments = ray.segments.map(segment => ({...segment}));
            b.focused = volley.focused === true; b.focusPrimary = b.focused && i === 0;
            b.focusCount = b.focused ? volley.rays.length : 0; b.focusHit = b.focusPrimary && focusHit;
            b.focusEndX = b.focused ? volley.focusEndX : null; b.focusEndY = b.focused ? volley.focusEndY : null;
            b.focusTargetId = b.focused ? volley.focusTargetId ?? null : null;
            // Straight lane: the lead ray draws the full beam, stacked rays braid into it.
            b.stack = b.focused ? 0 : volley.rays.length; b.stackIndex = b.focused ? 0 : i;
            if (b.focused) {
                const end = Math.hypot(b.focusEndX - b.x, b.focusEndY - b.y);
                b.len = Math.min(b.len,end); for (const segment of b.segments) segment.length=Math.min(segment.length,end);
            }
            else for (let j = 0; j < Math.min(8, Math.floor(24 / volley.rays.length)); j++) {
                const t = Math.random() * b.len; petals(b.x + ray.dx * t, b.y + ray.dy * t, 1);
            }
        }
        shake(ownerId(w) === 'absolute_bloom' ? 2 : 4); audio.sfx('zap');
    }
    cannonRequests.length = 0;
}

// 상점 전설 장비 「연꽃 총」: 슬롯 밖에서 자동 발사 (보유 시)
export const LOTUS_GUN = Object.freeze({ cd: 0.36, shots: 3, spread: 0.07, baseDmg: 40, dmgPerStage: 14, pierce: 7, speed: 960, crit: 0.1, bloomRadius: 90, bloomDamage: 1, bloomBossDamage: 0.75, bloomTargets: 8 });
const lotusGun = { id: 'lotus_gun', slot: 99, level: 1, evolved: false, coreIndex: 0, cd: 0.5 };
export function resetWeaponRuntime() { lotusGun.cd = 0.5; lotusGun.coreIndex = 0; cannonRequests.length = 0; resetLotusBlooms(); }
export function lotusGunStats() {
    const ps = G.player.stats;
    return { dmg: (LOTUS_GUN.baseDmg + LOTUS_GUN.dmgPerStage * (G.stage || 1)) * (ps.might || 1), speed: LOTUS_GUN.speed * (ps.projSpeed || 1),
        duration: 0.9, pierce: LOTUS_GUN.pierce, area: 1, crit: LOTUS_GUN.crit, critBonus: 0, execute: 0, bleed: 0, slow: 0 };
}
function updateLotusGun(dt) {
    if (upgradeLevel('lotus_gun') <= 0) return;
    lotusGun.cd -= dt;
    if (lotusGun.cd > 0) return;
    const p = G.player, t = nearestEnemy(p.x, p.y, 520);
    if (!t) { lotusGun.cd = 0.15; return; }
    lotusGun.cd = LOTUS_GUN.cd * (p.stats.cooldown || 1);
    const s = lotusGunStats(), [, , origin] = aimAt(lotusGun, t);
    const [dx, dy] = sawAimDirection(p, t, s.speed, origin), base = Math.atan2(dy, dx);
    const volley = { bloomed: false }; // One bloom per volley, never per pierced target.
    animateAttack(lotusGun, origin ? origin.x-G.player.x : dx); // Pose/flash starts on the actual lotus volley, never before it.
    for (let i = 0; i < LOTUS_GUN.shots; i++) {
        const a = base + (i - (LOTUS_GUN.shots - 1) / 2) * LOTUS_GUN.spread;
        const shot = shoot(lotusGun, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: 8, knock: 70, origin });
        shot.lotusVolley = volley;
    }
}

// A finite, non-recursive impact bloom. Direct rounds still use normal collision,
// crit and boss phase invulnerability. The bloom never creates more projectiles.
const lotusTargets = [];
function bloomLotus(shot, target, directDamage) {
    if (!(directDamage > 0) || shot.weapon !== 'lotus_gun' || !shot.lotusVolley || shot.lotusVolley.bloomed) return;
    shot.lotusVolley.bloomed = true;
    const x = target.x, y = target.y - target.radius, radius = LOTUS_GUN.bloomRadius;
    const nearby = G.grid.query(x, y + 45, radius + 95, lotusTargets)
        .filter(e => e.alive && bodyDist2(e, x, y) <= (radius + e.radius) ** 2)
        .sort((a, b) => bodyDist2(a, x, y) - bodyDist2(b, x, y)).slice(0, LOTUS_GUN.bloomTargets);
    let landed = false;
    for (const e of nearby) {
        if (hitEnemy(e, shot.dmg * LOTUS_GUN.bloomDamage, { weapon: 'lotus_gun', knock: 0 }) > 0) landed = true;
    }
    const boss = G.boss;
    if (boss?.alive && bodyDist2(boss, x, y) <= (radius + boss.radius) ** 2) {
        if (boss.hurt(shot.dmg * LOTUS_GUN.bloomBossDamage, { weapon: 'lotus_gun' }) > 0) landed = true;
    }
    // An impact bloom remains honest even if the direct hit killed its seed.
    if (landed || directDamage > 0) recordLotusBloom(x, y, radius, G.clock);
}

export function updateWeapons(dt) {
    cannonRequests.length = 0;
    const p = G.player;
    if (p.dead) return;
    updateLotusGun(dt);
    for (const w of activeWeaponCores()) {
        const s = weaponStats(w);
        w.s = s;
        if (w.id === 'thorns') {
            if (!w.poseActivated) { animateAttack(w, p.facingX, { activation: true }); w.poseActivated = true; }
            // A stalled frame cannot spin through multiple unseen revolutions.
            w.angle += WEAPONS.thorns.base.speed * Math.max(0, Math.min(.25, dt));
            w.activeT = Infinity;
            updateThornCharges(w, orbitStats(w, s), dt);
            continue;
        }
        // 쌍권총 연사 버스트
        if (w.burst > 0) {
            w.burstT -= dt;
            if (w.burstT <= 0) {
                w.burstT = BURST_INTERVAL; // 쌍권총 계열 연발 간격 (초고속 연사)
                const t = nearestEnemy(p.x, p.y, 520);
                const [dx, dy, origin] = aimAt(w, t);
                const side = (w.burst % 2 ? 1 : -1) * 0.06;
                const a = Math.atan2(dy, dx) + side;
                const executioner = (w.id === 'pistols' && w.evolved) || w.id === 'guillotine';
                const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: executioner ? 7 : 5, knock: executioner ? 80 : 50, origin });
                // 처형인의 쌍권총: 진홍빛 총구 섬광
                if (executioner) sparks(sh.x, sh.y, 4, w.burst % 2 ? '#ff3b5c' : '#ffd36b', 180);
                animateAttack(w, origin ? origin.x-G.player.x : dx);
                audio.sfx('shot');
                w.burst--;
            }
        }
        // Hybrid weapons retain their separate continuous orbit attack.
        if (['lotus_bloom', 'orbit_saw'].includes(w.id) && (w.activeT > 0 || s.permanent)) {
            if (!s.permanent) w.activeT -= dt;
            w.angle += WEAPONS.thorns.base.speed * dt;
            updateOrbit(w, orbitStats(w, s));
        }
        // 지옥 불꽃길
        if (s.trail) {
            w.trailT -= dt;
            if (w.trailT <= 0 && (p.vx || p.vy)) {
                w.trailT = 0.3;
                spawnHazard('fire', p.x, p.y, { ...hellfireTrailStats(s), weapon: ownerId(w) });
            }
        }
        w.cd -= dt;
        if (w.cd <= 0) {
            if (w.burst > 0) { w.cd = 0.07; continue; }
            w.cd = s.cd;
            FIRE[w.id](w, s);
        }
    }
    flushCannonVolleys();
}

const orbitList = [];
function updateOrbit(w, s) {
    const p = G.player;
    const n = s.amount;
    // 연꽃 가시 궤도(만개 연꽃포)는 반경 고정·꽃잎 크기 성장. 회전 톱날은 기존처럼 범위만큼 넓어진다.
    const thorn = w.id === 'lotus_bloom';
    const R = thorn ? thornOrbitRadius(s) : s.radius * s.area;
    const pr = thorn ? thornPetalRadius(s) : 12 * s.area;
    const stun = thorn ? thornStun({ evolved: true }) : 0;
    const now = G.clock;
    for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * R, oy = p.y - 20 + Math.sin(a) * R * 0.8;
        const list = G.grid.query(ox, oy + 10, pr + 24, orbitList);
        for (const e of list) {
            if (!e.alive) continue;
            const dx = e.x - ox, dy = (e.y - e.radius) - oy;
            const rr = pr + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            ensureHitChannels(e);
            if (now - e.hits[hitChannel(w)] < s.hitCd) continue;
            e.hits[hitChannel(w)] = now;
            const d = hitEnemy(e, s.dmg, { weapon: ownerId(w), kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: thorn ? 45 : 90, crit: s.crit, bleed: s.bleed, stun });
            if (s.lifesteal && d) healPlayer(s.lifesteal);
        }
        const boss = G.boss;
        if (boss && boss.alive && now - (boss.hits[hitChannel(w)] || -9) > s.hitCd) {
            const dx = boss.x - ox, dy = (boss.y - boss.radius) - oy;
            if (dx * dx + dy * dy < (pr + boss.radius) ** 2) {
                boss.hits[hitChannel(w)] = now;
                if (boss.hurt(s.dmg, { weapon: ownerId(w) }) > 0 && thorn) boss.stun(thornStun({ evolved: true }, true));
                if (s.lifesteal) healPlayer(s.lifesteal);
            }
        }
    }
}

const shotList = [];
export function updateShots(dt) {
    const pool = G.shots;
    const cam = G.camera;
    const hw = G.view.w / 2, hh = G.view.h / 2;
    const now = G.clock;
    for (let i = pool.count - 1; i >= 0; i--) {
        const sh = pool.items[i];
        if (sh.kind === 'lob') {
            sh.t += dt;
            const k = Math.min(1, sh.t / sh.dur);
            sh.x = sh.sx + (sh.tx - sh.sx) * k;
            sh.y = sh.sy + (sh.ty - sh.sy) * k - Math.sin(k * Math.PI) * 70;
            sh.spin = (sh.spin || 0) + dt * 12;
            if (k >= 1) {
                const s = sh.s;
                if (sh.hazard === 'fire' || sh.hazard === 'firegas') {
                    limitFriendlyFields('fire', sh.weapon, fieldCap(s, sh.weapon));
                    spawnHazard('fire', sh.tx, sh.ty, { radius: s.radius * s.area, duration: s.duration, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: sh.weapon });
                    embers(sh.tx, sh.ty, 10);
                    audio.sfx('fire');
                } else {
                    limitFriendlyFields('gas', sh.weapon, fieldCap(s, sh.weapon));
                    spawnHazard('gas', sh.tx, sh.ty, { radius: s.radius * s.area, duration: s.duration, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: sh.weapon });
                }
                pool.release(i);
            }
            continue;
        }
        sh.life -= dt;
        if (sh.life <= 0) { pool.release(i); continue; }
        const previousX = sh.x, previousY = sh.y;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.kind === 'saw') {
            sh.spin += dt * 14;
            if (sh.bounce) {
                if (sh.x < cam.x - hw + 10 && sh.vx < 0) sh.vx = -sh.vx;
                if (sh.x > cam.x + hw - 10 && sh.vx > 0) sh.vx = -sh.vx;
                if (sh.y < cam.y - hh + 10 && sh.vy < 0) sh.vy = -sh.vy;
                if (sh.y > cam.y + hh - 10 && sh.vy > 0) sh.vy = -sh.vy;
            }
        }
        // 몸통 캡슐 판정에 맞춰 발밑 좌표 기준으로 넉넉히 조회
        const swept = sh.kind === 'saw' || sh.weapon === 'lotus_gun';
        const travel = swept ? Math.hypot(sh.x - previousX, sh.y - previousY) : 0;
        const list = G.grid.query(swept ? (sh.x + previousX) / 2 : sh.x, (swept ? (sh.y + previousY) / 2 : sh.y) + 45, sh.radius + 95 + travel / 2, shotList);
        let dead = false;
        for (let k = 0; k < list.length && !dead; k++) {
            const e = list[k];
            if (!e.alive) continue;
            const rr = sh.radius + e.radius;
            if ((swept ? sweptBodyDist2(e, previousX, previousY, sh.x, sh.y) : bodyDist2(e, sh.x, sh.y)) > rr * rr) continue;
            if (sh.kind === 'saw') {
                ensureHitChannels(e);
                if (now - e.hits[hitChannel(sh)] < sh.hitCd) continue;
                e.hits[hitChannel(sh)] = now;
            } else {
                if (sh.lastHit.includes(e.id)) continue;
                sh.lastHit.push(e.id);
            }
            const sp = Math.hypot(sh.vx, sh.vy) || 1;
            const directDamage = hitEnemy(e, sh.dmg, { weapon: sh.weapon, kx: sh.vx / sp, ky: sh.vy / sp, knock: sh.knock, crit: precisionCrit(sh, e), critBonus: sh.critBonus, executeChance: sh.executeChance, bleed: sh.bleed, slow: sh.slow });
            if (sh.weapon === 'lotus_gun') bloomLotus(sh, e, directDamage);
            if (sh.precision || (sh.weapon === 'pistols' && sh.evolved) || sh.weapon === 'guillotine') executionerHitFx(e);
            if (--sh.pierce <= 0) dead = true;
        }
        const boss = G.boss;
        if (!dead && boss && boss.alive) {
            const rr = sh.radius + boss.radius;
            if ((swept ? sweptBodyDist2(boss, previousX, previousY, sh.x, sh.y) : bodyDist2(boss, sh.x, sh.y)) < rr * rr) {
                if (sh.kind === 'saw') {
                    if (now - (boss.hits[hitChannel(sh)] || -9) >= sh.hitCd) { boss.hits[hitChannel(sh)] = now; boss.hurt(sh.dmg, { weapon: sh.weapon, crit: precisionCrit(sh, boss), critBonus: sh.critBonus }); }
                } else if (!sh.lastHit.includes(-1)) {
                    sh.lastHit.push(-1);
                    const directDamage = boss.hurt(sh.dmg, { weapon: sh.weapon, crit: precisionCrit(sh, boss), critBonus: sh.critBonus });
                    if (sh.weapon === 'lotus_gun') bloomLotus(sh, boss, directDamage);
                    else sparks(sh.x, sh.y, 3, '#ff5a6a');
                    if (--sh.pierce <= 0) dead = true;
                }
            }
        }
        if (dead) pool.release(i);
    }
    const beams = G.beams;
    for (let i = beams.count - 1; i >= 0; i--) {
        const b = beams.items[i];
        b.life -= dt;
        if (b.life <= 0) beams.release(i);
    }
}

export function drawShots(ctx) {
    const frame = createWeaponVfxFrame(G.lowQ, G.clock, G.visuals), cam = G.camera;
    const hw = G.view.w / 2 + 80, hh = G.view.h / 2 + 80;
    ctx.save();
    const bounds = { x0: cam.x-hw, x1: cam.x+hw, y0: cam.y-hh, y1: cam.y+hh };
    drawFusionResidues(ctx, G.hazards, frame, bounds);
    drawLotusBlooms(ctx, frame, bounds);
    for (let i = 0; i < G.shots.count; i++) {
        const sh = G.shots.items[i];
        if (Math.abs(sh.x - cam.x) > hw + (sh.radius || 12) || Math.abs(sh.y - cam.y) > hh + (sh.radius || 12)) continue;
        drawWeaponProjectile(ctx, sh, frame);
    }
    for (const w of activeWeaponCores(false)) {
        if (!['thorns', 'lotus_bloom', 'orbit_saw'].includes(w.id) || !w.s || !(w.activeT > 0 || w.s.permanent)) continue;
        drawWeaponOrbit(ctx, w, orbitStats(w, w.s), G.player, frame);
    }
    for (let i = 0; i < G.beams.count; i++) {
        const b = G.beams.items[i], bound = b.len + b.width;
        if (Math.abs(b.x - cam.x) > hw + bound || Math.abs(b.y - cam.y) > hh + bound) continue;
        drawWeaponBeam(ctx, b, frame);
    }
    drawButcherSword(ctx, !frame.motion);
    drawFusionHitAccents(ctx, G.enemies, G.boss, frame, bounds);
    drawBeamHitAccents(ctx, G.beams, G.enemies, G.boss, frame);
    drawStunMarks(ctx, G.enemies, G.boss, frame, bounds);
    ctx.restore();
}
