import { applyTechWeaponBonus } from './tech.js';
import { FUSION_RECIPES } from '../data/fusions.js';
import { firingMuzzle } from './player-motion.js';
import { createWeaponVfxFrame, drawWeaponProjectile, drawWeaponOrbit, drawWeaponBeam, drawBeamHitAccents, drawFusionResidues, drawFusionHitAccents } from './weapon-vfx.js';
// 무기 런타임: 쿨다운 → 발사 패턴, 플레이어 투사체/광선/궤도체 업데이트 및 충돌
import { G, rand } from './state.js';
import { WEAPONS, tierPower } from '../data/weapons.js';
import { fx, glow, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { hitEnemy } from './enemies.js';
import { spawnHazard, limitFriendlyFields } from './hazards.js';
import { sparks, petals, embers, shake, floatText } from './effects.js';
import { healPlayer, triggerPlayerShot } from './player.js';
import { preferredTarget } from './targeting.js';

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
    const acc = { dmg: 0, cd: 0, amount: 0, area: 0, duration: 0, speed: 0, pierce: 0, slow: 0, crit: 0, critBonus: 0 };
    for (let i = 0; i < Math.min(8, Math.max(1, w.level)) - 1; i++) {
        const l = def.levels[i];
        for (const k in acc) if (l[k]) acc[k] += l[k];
    }
    const ev = w.evolved && def.evolve ? def.evolve.mods : {};
    const result = {
        dmg: (b.dmg + acc.dmg) * (ev.dmg || 1) * (w.evolved ? 1.35 : 1) * ps.might,
        cd: b.cd * Math.max(0.25, 1 + acc.cd) * (ev.cd || 1) * ps.cooldown,
        amount: Math.max(1, Math.round((b.amount + acc.amount + ps.amount) * (ev.amount || 1))),
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
        length: (b.length || 0) * ps.projSpeed, width: b.width || 0,
        bonusAmount: ps.amount, durationScale: ps.duration,
    };
    applyTechWeaponBonus(w, result);
    if (w.sourceId) {
        result.dmg = Math.min(600, result.dmg * ((WEAPONS[w.sourceId]?.tier === 'absolute' ? 1.65 : 1.35) + 0.08 * (Math.min(8, Math.max(1, w.fusionLevel || 1)) - 1)));
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

function aimAt(w, target) {
    const p = G.player;
    if (!target) return [p.facingX, p.facingY];
    const dx = target.x - p.x, dy = (target.y - (target.radius || 20)) - (p.y - 22);
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
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

function shoot(w, s, dirX, dirY, opts) {
    const p = G.player;
    const sh = G.shots.spawn();
    sh.kind = 'bullet';
    sh.weapon = ownerId(w); sh.coreId = w.sourceId ? w.id : null; sh.coreIndex = w.coreIndex || 0;
    sh.slot = w.slot;
    const muzzle = images.playerFire ? firingMuzzle(p, G.clock, dirX) : { x: p.x + dirX * 16, y: p.y - 22 + dirY * 10 };
    sh.x = muzzle.x; sh.y = muzzle.y;
    sh.vx = dirX * s.speed; sh.vy = dirY * s.speed;
    sh.angle = Math.atan2(dirY, dirX);
    sh.dmg = s.dmg; sh.pierce = s.pierce; sh.life = s.duration;
    sh.radius = (opts.radius || 5) * s.area;
    sh.img = opts.img;
    sh.crit = s.crit; sh.critBonus = s.critBonus || 0; sh.execute = s.execute; sh.bleed = s.bleed; sh.slow = s.slow || 0;
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
    sh.sx = p.x; sh.sy = p.y - 30; sh.tx = tx; sh.ty = ty;
    sh.x = sh.sx; sh.y = sh.sy;
    sh.t = 0; sh.dur = 0.55; sh.life = 1;
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
    return w.id === 'lotus_bloom' ? { ...s, dmg: s.dmg * 0.28, amount: Math.min(5, 3 + Math.floor((w.level - 1) / 3) + (s.bonusAmount || 0)), radius: 90, duration: Math.min(4.5, 2.8 * (s.durationScale || 1)), permanent: false }
        : s.amount > ORBIT_VISUAL_CAP ? { ...s, amount: ORBIT_VISUAL_CAP, dmg: s.dmg * s.amount / ORBIT_VISUAL_CAP } : s;
}
// 같은 무기의 장판은 한 번 투척 수 + 2 (최소 3)까지만 동시에 유지한다.
// 융합 무기는 자체 상한이 있으므로 제외.
const fieldCap = (s, id) => WEAPONS[id]?.fusionOnly ? Infinity : Math.max(3, Math.round(s.amount) + 2);
export function hellfireTrailStats(s) { return { radius: 64 * s.area, duration: Math.min(10, 6 * (s.durationScale || 1)), dmg: s.dmg * 0.6, tick: 0.3 }; }
export function emberFieldStats(s) { return { ...s, dmg: s.dmg * 0.16, amount: Math.min(2, s.amount), duration: Math.min(6, 3 * (s.durationScale || 1)), radius: 54, tick: 0.3 }; }
const FIRE = {
    absolute_bloom(w, s) { FIRE.cannon(w, s); },
    // 절대 무기: 탄막 사수 — 360도 관통 탄환 + 조준 레일탄 3발
    doom_barrage(w, s) {
        const p = G.player, n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + G.clock * 0.7;
            shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: 5, knock: 60 });
        }
        const t = nearestEnemy(p.x, p.y, 700);
        const [dx, dy] = aimAt(w, t);
        triggerPlayerShot(dx);
        const base = Math.atan2(dy, dx);
        for (const off of [-0.08, 0, 0.08]) shoot(w, { ...s, dmg: s.dmg * 2 }, Math.cos(base + off), Math.sin(base + off), { img: fx.rail, radius: 7, knock: 120 });
        shake(2); audio.sfx('zap');
    },
    // 절대 무기: 역병 화염 — 거대한 역병 화염 장판 다발
    plague_end(w, s) {
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(420, i === 0), p = G.player;
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
            const e = randomEnemyNear(340, !!WEAPONS[w.id].fusionOnly), p = G.player;
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'firegas');
        }
    },
    shotgun(w, s) {
        const t = nearestEnemy(G.player.x, G.player.y, 420);
        const [dx, dy] = aimAt(w, t);
        triggerPlayerShot(dx);
        const base = Math.atan2(dy, dx);
        const n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = base + (n > 1 ? (i / (n - 1) - 0.5) * s.spread : 0) + rand(-0.05, 0.05);
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved ? fx.bossShot : fx.pellet, radius: 4, knock: 90 });
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
        const [dx, dy] = aimAt(w, t);
        triggerPlayerShot(dx);
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < s.amount; i++) {
            const a = base + (i === 0 ? 0 : rand(-0.35, 0.35));
            shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.rail, radius: w.evolved ? 9 : 6, knock: 120 });
        }
        audio.sfx(w.evolved ? 'zap' : 'shot');
    },
    thorns(w, s) {
        w.activeT = s.duration;
    },
    molotov(w, s) {
        const p = G.player;
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(320, !!w.sourceId);
            const tx = e ? e.x : p.x + rand(-200, 200);
            const ty = e ? e.y : p.y + rand(-150, 150);
            lob(w, s, tx, ty, 'fire');
        }
    },
    cannon(w, s) {
        const p = G.player;
        let base;
        const focused = preferredTarget(p.x, p.y, 520);
        const t = focused || nearestEnemy(p.x, p.y, 520);
        if (!focused && (p.vx || p.vy || !t)) base = Math.atan2(p.facingY, p.facingX);
        else { const [dx, dy] = aimAt(w, t); base = Math.atan2(dy, dx); }
        const n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = base + (i / n) * Math.PI * 2 + (w.evolved && !focused ? G.clock * 0.6 : 0);
            fireBeam(w, s, a);
        }
        shake(4);
        audio.sfx('zap');
    },
    gas(w, s) {
        const p = G.player;
        if (s.follow) {
            if (!w.follow || !w.follow.alive) {
                w.follow = spawnHazard('gas', p.x, p.y, { radius: s.radius * s.area, duration: 9999, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: ownerId(w), follow: true });
            } else {
                w.follow.radius = s.radius * s.area; w.follow.dmg = s.dmg; w.follow.slow = s.slow;
            }
            return;
        }
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(300);
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'gas');
        }
    },
    saw(w, s) {
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
            const a = Math.random() * Math.PI * 2;
            const big = w.id === 'carnage_saw';
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved || big ? fx.sawBone : fx.saw, radius: big ? 18 : 14, knock: big ? 70 : 40 });
            sh.kind = 'saw';
            sh.pierce = 9999;
            sh.bounce = true;
            sh.hitCd = s.hitCd;
        }
        audio.sfx('saw');
    },
};

function fireBeam(w, s, angle) {
    triggerPlayerShot(Math.cos(angle));
    const p = G.player;
    const b = G.beams.spawn();
    const muzzle = images.playerFire ? firingMuzzle(p, G.clock, Math.cos(angle)) : { x: p.x, y: p.y - 22 };
    b.weapon = ownerId(w); b.coreId = w.sourceId ? w.id : null;
    b.x = muzzle.x; b.y = muzzle.y;
    b.angle = angle;
    b.len = s.length * Math.sqrt(s.area);
    b.width = s.width * s.area;
    b.life = s.duration; b.max = s.duration;
    b.evolved = w.evolved;
    // 즉시 판정: 선분-원 거리
    const cx = Math.cos(angle), cy = Math.sin(angle);
    const hw = b.width / 2;
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (!e.alive) continue;
        const ex = e.x - b.x, ey = (e.y - e.radius) - b.y;
        const along = ex * cx + ey * cy;
        if (along < 0 || along > b.len) continue;
        const perp = Math.abs(ex * cy - ey * cx);
        if (perp < hw + e.radius) hitEnemy(e, s.dmg, { weapon: ownerId(w), kx: cx, ky: cy, knock: 160, crit: s.crit });
    }
    const boss = G.boss;
    if (boss && boss.alive) {
        const ex = boss.x - b.x, ey = (boss.y - boss.radius) - b.y;
        const along = ex * cx + ey * cy;
        if (along > 0 && along < b.len && Math.abs(ex * cy - ey * cx) < hw + boss.radius) boss.hurt(s.dmg, { weapon: ownerId(w) });
    }
    for (let i = 0; i < 10; i++) {
        const t = Math.random() * b.len;
        petals(b.x + cx * t, b.y + cy * t, 1);
    }
}

export function updateWeapons(dt) {
    const p = G.player;
    if (p.dead) return;
    for (const w of activeWeaponCores()) {
        const s = weaponStats(w);
        w.s = s;
        // 쌍권총 연사 버스트
        if (w.burst > 0) {
            w.burstT -= dt;
            if (w.burstT <= 0) {
                w.burstT = BURST_INTERVAL; // 쌍권총 계열 연발 간격 (초고속 연사)
                const t = nearestEnemy(p.x, p.y, 520);
                const [dx, dy] = aimAt(w, t);
                const side = (w.burst % 2 ? 1 : -1) * 0.06;
                const a = Math.atan2(dy, dx) + side;
                const executioner = (w.id === 'pistols' && w.evolved) || w.id === 'guillotine';
                const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: executioner ? 7 : 5, knock: executioner ? 80 : 50 });
                // 처형인의 쌍권총: 진홍빛 총구 섬광
                if (executioner) sparks(sh.x, sh.y, 4, w.burst % 2 ? '#ff3b5c' : '#ffd36b', 180);
                triggerPlayerShot(dx);
                audio.sfx('shot');
                w.burst--;
            }
        }
        // 연꽃 가시 궤도
        if (['thorns', 'lotus_bloom', 'orbit_saw'].includes(w.id) && (w.activeT > 0 || s.permanent)) {
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
            if (w.id === 'thorns' && s.permanent) { w.cd = 1; continue; }
            if (w.id === 'thorns' && w.activeT > 0) { w.cd = 0.1; continue; }
            if (w.burst > 0) { w.cd = 0.07; continue; }
            w.cd = s.cd;
            FIRE[w.id](w, s);
        }
    }
}

const orbitList = [];
function updateOrbit(w, s) {
    const p = G.player;
    const n = s.amount;
    const R = s.radius * s.area;
    const pr = 12 * s.area;
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
            const d = hitEnemy(e, s.dmg, { weapon: ownerId(w), kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: 90, crit: s.crit, bleed: s.bleed });
            if (s.lifesteal && d) healPlayer(s.lifesteal);
        }
        const boss = G.boss;
        if (boss && boss.alive && now - (boss.hits[hitChannel(w)] || -9) > s.hitCd) {
            const dx = boss.x - ox, dy = (boss.y - boss.radius) - oy;
            if (dx * dx + dy * dy < (pr + boss.radius) ** 2) {
                boss.hits[hitChannel(w)] = now;
                boss.hurt(s.dmg, { weapon: ownerId(w) });
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
                    spawnHazard('fire', sh.tx, sh.ty, { radius: s.radius * s.area, duration: s.duration, dmg: s.dmg, tick: s.tick, slow: sh.hazard === 'firegas' ? s.slow : 0, weapon: sh.weapon });
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
        const list = G.grid.query(sh.x, sh.y + 45, sh.radius + 95, shotList);
        let dead = false;
        for (let k = 0; k < list.length && !dead; k++) {
            const e = list[k];
            if (!e.alive) continue;
            const rr = sh.radius + e.radius;
            if (bodyDist2(e, sh.x, sh.y) > rr * rr) continue;
            if (sh.kind === 'saw') {
                ensureHitChannels(e);
                if (now - e.hits[hitChannel(sh)] < sh.hitCd) continue;
                e.hits[hitChannel(sh)] = now;
            } else {
                if (sh.lastHit.includes(e.id)) continue;
                sh.lastHit.push(e.id);
            }
            const sp = Math.hypot(sh.vx, sh.vy) || 1;
            hitEnemy(e, sh.dmg, { weapon: sh.weapon, kx: sh.vx / sp, ky: sh.vy / sp, knock: sh.knock, crit: sh.crit, critBonus: sh.critBonus, execute: sh.execute, bleed: sh.bleed, slow: sh.slow });
            if ((sh.weapon === 'pistols' && sh.evolved) || sh.weapon === 'guillotine') executionerHitFx(e);
            if (--sh.pierce <= 0) dead = true;
        }
        const boss = G.boss;
        if (!dead && boss && boss.alive) {
            const rr = sh.radius + boss.radius;
            if (bodyDist2(boss, sh.x, sh.y) < rr * rr) {
                if (sh.kind === 'saw') {
                    if (now - (boss.hits[hitChannel(sh)] || -9) >= sh.hitCd) { boss.hits[hitChannel(sh)] = now; boss.hurt(sh.dmg, { weapon: sh.weapon, crit: sh.crit, critBonus: sh.critBonus }); }
                } else if (!sh.lastHit.includes(-1)) {
                    sh.lastHit.push(-1);
                    boss.hurt(sh.dmg, { weapon: sh.weapon, crit: sh.crit, critBonus: sh.critBonus });
                    sparks(sh.x, sh.y, 3, '#ff5a6a');
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
    drawFusionHitAccents(ctx, G.enemies, G.boss, frame, bounds);
    drawBeamHitAccents(ctx, G.beams, G.enemies, G.boss, frame);
    ctx.restore();
}
