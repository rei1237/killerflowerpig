// 장판/예고: 화염(아군), 독가스(아군, 둔화), 산성(적), 예고 원/선 (보스 패턴용)
import { G } from './state.js';
import { glow } from '../core/assets.js';
import { settings } from '../core/settings.js';
import { hitEnemy } from './enemies.js';
import { damagePlayer } from './player.js';
import { embers, smoke } from './effects.js';

export function spawnHazard(kind, x, y, o = {}) {
    const h = G.hazards.spawn();
    h.kind = kind;
    h.x = x; h.y = y;
    h.radius = o.radius || 40;
    h.duration = o.duration || 2;
    h.t = 0;
    h.dmg = o.dmg || 0;
    h.tick = o.tick || 0.3;
    h.tickT = 0;
    h.slow = o.slow || 0;
    h.weapon = o.weapon || null;
    h.follow = !!o.follow;
    h.alive = true;
    // 예고(telegraph) 전용
    h.delay = o.delay || 0;
    h.onFire = o.onFire || null;
    h.angle = o.angle || 0;
    h.len = o.len || 0;
    h.width = o.width || 0;
    h.color = o.color || '#ff1a3a';
    h.symbol = o.symbol || null; // cosmetic only; reset on pooled reuse
    // 역병 소용돌이 전용: plume 은 플레이어 쪽으로 나선을 그리며 모이고, vortex 는 흡수한 만큼 강해진다.
    h.element = o.element || null;
    h.pull = o.pull || 0;
    h.charge = 0;
    h.spin = o.spin || 1;
    h.flash = 0;
    h.coreFire = 0; h.coreGas = 0;
    return h;
}

// 역병 소용돌이: 바깥에서 피어오른 화염·독가스 덩어리(plume)가 서서히 플레이어에게 모여
// 하나의 소용돌이(vortex)로 흡수된다. 흡수 1회마다 소용돌이 피해가 오르고, 시간이 지나면 천천히 식는다.
// 장판이 화면 곳곳에 수십 장 깔리던 이전 방식 대신 소용돌이 1개 + 이동하는 덩어리 소수만 유지한다.
export const VORTEX = Object.freeze({ base: 0.8, perCharge: 0.1, maxCharge: 10, decay: 0.45, absorb: 0.32, plumeCap: 12 });
export const vortexPower = charge => VORTEX.base + VORTEX.perCharge * Math.min(VORTEX.maxCharge, Math.max(0, charge));
export function findVortex(weapon) {
    const pool = G.hazards;
    for (let i = 0; i < pool.count; i++) {
        const h = pool.items[i];
        if (h.alive && h.kind === 'vortex' && h.weapon === weapon) return h;
    }
    return null;
}
function movePlume(h, dt, p) {
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1;
    const vortex = findVortex(h.weapon);
    if (d < Math.max(36, vortex ? vortex.radius * VORTEX.absorb : 0)) {
        if (vortex) { vortex.charge = Math.min(VORTEX.maxCharge, vortex.charge + 1); vortex.flash = 1; }
        return false;
    }
    // 처음엔 느리게 피어오르고 점점 빨라진다. 접선 성분으로 나선을 그리며 모인다.
    const ramp = Math.min(1, h.t / 2.2), sp = h.pull * (0.25 + 0.75 * ramp * ramp);
    const swirl = 0.55 * h.spin * Math.min(1, d / 160);
    h.x += (dx / d * sp - dy / d * sp * swirl) * dt;
    h.y += (dy / d * sp + dx / d * sp * swirl) * dt;
    return true;
}

// 화면 정리: 같은 무기의 장판이 max개 이상이면 가장 오래된 것부터 0.4초 안에 사라지게 한다.
export function limitFriendlyFields(kind, weapon, max) {
    const pool = G.hazards, live = [];
    for (let i = 0; i < pool.count; i++) {
        const h = pool.items[i];
        if (h.alive && h.kind === kind && h.weapon === weapon && !h.follow && h.duration - h.t > .4) live.push(h);
    }
    live.sort((a, b) => b.t - a.t);
    for (let i = 0; i <= live.length - max; i++) live[i].t = live[i].duration - .4;
}

const list = [];
function releaseAt(pool, i, h) {
    if (i < pool.count && pool.items[i] === h) { pool.release(i); return; }
    const j = pool.items.indexOf(h);
    if (j >= 0 && j < pool.count) pool.release(j);
}
export function updateHazards(dt) {
    const pool = G.hazards;
    const p = G.player;
    for (let i = pool.count - 1; i >= 0; i--) {
        // 보스 피격(페이즈 전환·사망)이 루프 도중 예고 장판을 제거할 수 있으므로,
        // 이미 줄어든 범위의 인덱스는 건너뛰고 해제 전에는 동일 객체인지 확인한다.
        if (i >= pool.count) continue;
        const h = pool.items[i];
        h.t += dt;
        if (h.follow) { h.x = p.x; h.y = p.y; }
        if (h.kind === 'vortex') { h.charge = Math.max(0, h.charge - VORTEX.decay * dt); h.flash = Math.max(0, (h.flash || 0) - dt * 2.5); }
        else if (h.kind === 'plume' && !movePlume(h, dt, p)) { h.alive = false; releaseAt(pool, i, h); continue; }
        if (h.kind === 'tcircle' || h.kind === 'tline') {
            if (h.t >= h.delay) {
                h.onFire?.(h);
                h.alive = false;
                releaseAt(pool, i, h);
            }
            continue;
        }
        if (h.t >= h.duration) { h.alive = false; releaseAt(pool, i, h); continue; }
        h.tickT -= dt;
        if (h.tickT > 0) continue;
        h.tickT = h.tick;
        if (h.kind === 'acid') {
            const dx = p.x - h.x, dy = p.y - h.y;
            if (dx * dx + (dy * dy) / 0.49 < h.radius * h.radius) damagePlayer(h.dmg, h.x, h.y);
            continue;
        }
        // 아군 장판: 범위 내 적에게 틱 피해
        const r = h.radius;
        const dmg = h.kind === 'vortex' ? (h.dmg + h.coreFire + h.coreGas) * vortexPower(h.charge) : h.dmg;
        const found = G.grid.query(h.x, h.y, r + 20, list);
        for (const e of found) {
            if (!e.alive) continue;
            const dx = e.x - h.x, dy = e.y - h.y;
            if (dx * dx + (dy * dy) / 0.49 > r * r) continue;
            hitEnemy(e, dmg, { weapon: h.weapon, silent: Math.random() < (h.kind === 'vortex' || h.kind === 'plume' ? 0.85 : 0.6), slow: h.slow });
        }
        const boss = G.boss;
        if (boss && boss.alive) {
            const dx = boss.x - h.x, dy = boss.y - h.y;
            if (dx * dx + (dy * dy) / 0.49 < (r + boss.radius) ** 2) boss.hurt(dmg, { weapon: h.weapon, silent: true });
        }
        if (h.kind === 'fire') embers(h.x, h.y, 2);
        else if (h.kind === 'gas' && Math.random() < 0.5) smoke(h.x + (Math.random() - 0.5) * r, h.y + (Math.random() - 0.5) * r * 0.6, 1, 'rgba(90,200,40,0.35)');
    }
}

// Draw-only styling: every boundary uses the existing radius and 0.7 Y ratio.
// Reuse two small gradient textures; no per-frame gradients or particle objects.
const FULL_TURN = Math.PI * 2;
const DASH_WARNING = [6, 5], DASH_FRIENDLY = [3, 5], NO_DASH = [];
const motionPreference = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function ellipsePath(ctx, h, radius = h.radius, start = 0, end = FULL_TURN) {
    ctx.beginPath();ctx.ellipse(h.x, h.y, radius, radius * 0.7, 0, start, end);
}

function outline(ctx, h, color, alpha, dashed = false) {
    ctx.globalAlpha = alpha;
    ctx.setLineDash(NO_DASH);ctx.strokeStyle = '#07111b';ctx.lineWidth = 5;
    ellipsePath(ctx, h);ctx.stroke();
    ctx.setLineDash(dashed ? DASH_FRIENDLY : NO_DASH);ctx.strokeStyle = color;ctx.lineWidth = 1.7;
    ellipsePath(ctx, h);ctx.stroke();ctx.setLineDash(NO_DASH);
}

function mist(ctx, h, time, alpha, hostile, count) {
    const g = glow(hostile ? '#b6db56' : '#57cfae', 64);
    // Soft wisps stay INSIDE the damage footprint. The border is the safe edge.
    ctx.save();ellipsePath(ctx, h);ctx.clip();
    for (let n = 0; n < count; n++) {
        const phase = n * 2.4 + h.x * 0.013 + h.y * 0.007;
        const x = h.x + Math.sin(time * 0.7 + phase) * h.radius * 0.28;
        const y = h.y + Math.cos(time * 0.55 + phase) * h.radius * 0.17;
        const r = h.radius * (n === 0 ? 0.78 : 0.56);
        ctx.globalAlpha = alpha * (n === 0 ? 0.28 : 0.19);
        ctx.drawImage(g, x - r, y - r * 0.68, r * 2, r * 1.36);
    }
    ctx.restore();
}

function dangerMark(ctx, h, alpha) {
    const s = Math.min(9, h.radius * 0.2), y = h.y - h.radius * 0.36;
    ctx.globalAlpha = alpha;ctx.fillStyle = '#172519';
    ctx.beginPath();ctx.moveTo(h.x, y - s);ctx.lineTo(h.x + s, y + s * 0.65);ctx.lineTo(h.x - s, y + s * 0.65);ctx.closePath();ctx.fill();
    ctx.strokeStyle = '#e8ed9e';ctx.lineWidth = 1.3;ctx.stroke();
    ctx.fillStyle = '#e8ed9e';ctx.fillRect(h.x - 0.8, y - s * 0.42, 1.6, s * 0.65);ctx.fillRect(h.x - 0.8, y + s * 0.34, 1.6, 1.6);
}

// 역병 소용돌이: 화염·독가스 나선 팔이 중심으로 감겨 들고, 흡수량(charge)만큼 심장부가 밝아진다.
// 캐시된 글로우 텍스처 몇 장만 가산 합성으로 겹쳐 그린다 (입자·그라디언트 생성 없음).
const VORTEX_FIRE = '#ff6a1f', VORTEX_GAS = '#7be04a', VORTEX_CORE = '#ffe9a8';
const DASH_VORTEX = [14, 10];
function blot(ctx, tex, x, y, size, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(tex, x - size, y - size * 0.7, size * 2, size * 1.4);
}
function drawVortex(ctx, h, time, life, motion) {
    const r = h.radius, power = Math.min(1, h.charge / VORTEX.maxCharge), flash = h.flash || 0;
    ctx.globalAlpha = (0.24 + 0.12 * power) * life;ctx.fillStyle = '#1b0d07';
    ellipsePath(ctx, h);ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const arms = G.lowQ ? 2 : 3, beads = G.lowQ ? 4 : 6;
    const fire = glow(VORTEX_FIRE, 64), gas = glow(VORTEX_GAS, 64);
    const rot = time * (1.1 + power * 0.9) * h.spin;
    for (let a = 0; a < arms * 2; a++) {
        const tex = a % 2 ? gas : fire, base = rot + a * Math.PI / arms;
        for (let b = 0; b < beads; b++) {
            const k = (b + 1) / beads, ang = base + k * 2.4 * h.spin, rr = r * (0.16 + 0.78 * k);
            blot(ctx, tex, h.x + Math.cos(ang) * rr, h.y + Math.sin(ang) * rr * 0.7,
                r * (0.3 - 0.13 * k) * (1 + power * 0.3), life * (0.32 - 0.18 * k) * (0.8 + power * 0.5));
        }
    }
    const pulse = motion ? 1 + Math.sin(time * 5) * 0.05 : 1;
    blot(ctx, glow(VORTEX_CORE, 64), h.x, h.y, r * (0.26 + 0.14 * power + 0.12 * flash) * pulse, life * (0.42 + 0.35 * power + 0.3 * flash));
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.6;ctx.setLineDash(DASH_VORTEX);
    ctx.globalAlpha = 0.55 * life;ctx.strokeStyle = VORTEX_FIRE;ctx.lineDashOffset = -time * 40 * h.spin;
    ellipsePath(ctx, h);ctx.stroke();
    ctx.globalAlpha = 0.45 * life;ctx.strokeStyle = VORTEX_GAS;ctx.lineDashOffset = time * 28 * h.spin;
    ellipsePath(ctx, h, r * 0.93);ctx.stroke();
    ctx.setLineDash(NO_DASH);ctx.lineDashOffset = 0;
}
function drawPlume(ctx, h, time, life, motion) {
    const fire = h.element === 'fire', tex = glow(fire ? VORTEX_FIRE : VORTEX_GAS, 64), p = G.player;
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const grow = Math.min(1, 0.45 + h.t / 0.4), r = h.radius * grow;
    ctx.globalAlpha = 0.2 * life;ctx.fillStyle = fire ? '#3a0c00' : '#0f3a2c';
    ellipsePath(ctx, h, r);ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // 꼬리는 소용돌이 반대쪽으로 흐른다: 모여드는 방향이 한눈에 읽힌다.
    for (let n = G.lowQ ? 1 : 3; n >= 1; n--) blot(ctx, tex, h.x - ux * r * 0.42 * n, h.y - uy * r * 0.3 * n, r * (0.62 - 0.12 * n), life * (0.36 - 0.08 * n));
    const wob = motion ? 1 + Math.sin(time * 7 + h.x * 0.05) * 0.06 : 1;
    blot(ctx, tex, h.x, h.y, r * 0.8 * wob, 0.6 * life);
    blot(ctx, glow(VORTEX_CORE, 64), h.x, h.y, r * 0.3, 0.5 * life);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.35 * life;ctx.strokeStyle = fire ? '#ff9a52' : '#8fe86a';ctx.lineWidth = 1.2;
    ctx.setLineDash(DASH_FRIENDLY);ellipsePath(ctx, h, r);ctx.stroke();ctx.setLineDash(NO_DASH);
}

// 바닥 장판 (캐릭터 아래 레이어). State/timing/collision are never modified here.
export function drawHazards(ctx) {
    const pool = G.hazards;
    const motion = settings.flash && !motionPreference?.matches;
    const time = motion ? G.clock : 0;
    const view = G.view, camera = G.camera;
    let mistBudget = G.lowQ ? 16 : 48;
    // 아군 장판(화염·독가스)은 겹쳐 쌓이면 픽셀 채우기 비용이 폭증한다 (지옥 불꽃길은 최대 34장).
    // 화면 면적 기준 예산을 넘으면 글로우를 생략하고, 채우기 예산을 넘으면 외곽선만 그린다.
    // 적의 산성 장판과 보스 예고는 예산과 무관하게 항상 전부 그린다.
    const screenArea = view.w * view.h, vis = G.visuals;
    let glowBudget = screenArea * (vis.fieldGlowScreens ?? 1.2);
    let fillBudget = screenArea * (vis.fieldFillScreens ?? 3);
    ctx.save();
    for (let i = 0; i < pool.count; i++) {
        const h = pool.items[i];
        const bound = h.kind === 'tline' ? h.len + h.width : h.radius + 12;
        if (Math.abs(h.x - camera.x) > view.w / 2 + bound + 60 || Math.abs(h.y - camera.y) > view.h / 2 + bound + 80) continue;
        if (h.kind === 'tcircle') {
            const k = Math.min(1, Math.max(0, h.t / (h.delay || 0.001)));
            ctx.setLineDash(NO_DASH);ctx.globalAlpha = 0.12 + k * 0.13;ctx.fillStyle = h.color;
            ellipsePath(ctx, h);ctx.fill();
            // Full footprint remains visible from the first warning frame.
            outline(ctx, h, h.color, 0.82);
            ctx.globalAlpha = 0.95;ctx.strokeStyle = '#fff0d4';ctx.lineWidth = 2.5;
            ellipsePath(ctx, h, h.radius * 0.93, -Math.PI / 2, -Math.PI / 2 + FULL_TURN * k);ctx.stroke();
            // Existing countdown only; this renderer never postpones damage.
            ctx.globalAlpha = 0.45 + k * 0.3;ctx.strokeStyle = h.color;ctx.lineWidth = 1;
            ctx.setLineDash(DASH_WARNING);ellipsePath(ctx, h, h.radius * (0.25 + k * 0.65));ctx.stroke();ctx.setLineDash(NO_DASH);
            if (h.symbol === 'hourglass') {
                // Financier contract: a fixed sandglass, never a flashing overlay.
                const x = h.x, y = h.y, r = Math.min(11, h.radius * .2);
                ctx.globalAlpha = .9;ctx.strokeStyle = '#fff0c4';ctx.lineWidth = 1.7;
                ctx.beginPath();ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y-r);ctx.lineTo(x-r,y+r);ctx.lineTo(x+r,y+r);ctx.lineTo(x-r,y-r);ctx.stroke();
                ctx.fillStyle = h.color;ctx.fillRect(x-r*.65,y+r-2-r*.55*k,r*1.3,2+r*.55*k);
            }
            continue;
        }
        if (h.kind === 'tline') {
            const k = Math.min(1, Math.max(0, h.t / (h.delay || 0.001)));
            ctx.save();ctx.translate(h.x, h.y);ctx.rotate(h.angle);
            ctx.globalAlpha = 0.18 + 0.16 * k;ctx.fillStyle = h.color;ctx.fillRect(0, -h.width / 2, h.len, h.width);
            ctx.setLineDash(NO_DASH);ctx.globalAlpha = 0.9;ctx.strokeStyle = '#08101b';ctx.lineWidth = 4;
            ctx.strokeRect(0, -h.width / 2, h.len, h.width);
            ctx.strokeStyle = h.color;ctx.lineWidth = 1.3;ctx.strokeRect(0, -h.width / 2, h.len, h.width);
            ctx.globalAlpha = 0.88;ctx.fillStyle = '#fff1d3';ctx.fillRect(0, -1, h.len * k, 2);
            ctx.restore();continue;
        }
        const fade = Math.max(0, Math.min(1, (h.duration - h.t) / 0.45));
        const life = Math.max(0, Math.min(fade, h.t / 0.18));
        const footprint = Math.PI * h.radius * h.radius * 0.7;
        if (h.kind === 'vortex') { drawVortex(ctx, h, time, life, motion); continue; }
        if (h.kind === 'plume') { drawPlume(ctx, h, time, life, motion); continue; }
        if (h.kind !== 'acid' && fillBudget <= 0) {
            // 예산 초과 아군 장판: 점선 없는 얇은 외곽선 1회만 (경로 래스터 비용 최소화)
            ctx.setLineDash(NO_DASH);ctx.globalAlpha = 0.3 * life;
            ctx.strokeStyle = h.kind === 'fire' ? '#ff7a3a' : '#64d7bc';ctx.lineWidth = 1.5;
            ellipsePath(ctx, h);ctx.stroke();
            continue;
        }
        if (h.kind !== 'acid') fillBudget -= footprint;
        if (h.kind === 'fire') {
            ctx.globalAlpha = 0.5 * life;ctx.fillStyle = '#5a1000';
            ellipsePath(ctx, h);ctx.fill();
            const quad = h.radius * h.radius * 2.8;
            if (glowBudget > 0) {
                glowBudget -= quad;
                ctx.globalCompositeOperation = 'lighter';
                const g = glow('#ff5a14', 64), fl = motion ? 1 + Math.sin(time * 6 + h.x) * 0.035 : 1;
                ctx.globalAlpha = 0.58 * life;
                ctx.drawImage(g, h.x - h.radius * fl, h.y - h.radius * 0.7 * fl, h.radius * 2 * fl, h.radius * 1.4 * fl);
                ctx.globalCompositeOperation = 'source-over';
            } else {
                ctx.globalAlpha = 0.35 * life;ctx.fillStyle = '#c2410c';
                ellipsePath(ctx, h, h.radius * 0.55);ctx.fill();
            }
        } else if (h.kind === 'gas' || h.kind === 'acid') {
            const hostile = h.kind === 'acid';
            ctx.globalAlpha = (hostile ? 0.48 : 0.2) * life;
            ctx.fillStyle = hostile ? '#27381d' : '#16463f';ellipsePath(ctx, h);ctx.fill();
            if (mistBudget > 0 && life > 0 && (hostile || glowBudget > 0)) {
                if (!hostile) glowBudget -= footprint;
                const count = Math.min(mistBudget, G.lowQ ? 1 : 3);
                mist(ctx, h, time, life, hostile, count);
                mistBudget -= count;
            }
            // The fog thins out, but an active damaging edge never disappears.
            const edge = hostile ? 0.4 + fade * 0.5 : fade * 0.5;
            outline(ctx, h, hostile ? '#c3e66d' : '#64d7bc', edge, !hostile);
            if (hostile) {
                dangerMark(ctx, h, 0.35 + fade * 0.45);
                if (!G.lowQ) {
                    ctx.globalAlpha = 0.22 * life;ctx.strokeStyle = '#deef97';ctx.lineWidth = 1;
                    const phase = motion ? Math.sin(time * 1.6 + h.x) : 0;
                    ctx.beginPath();ctx.ellipse(h.x + h.radius * 0.34, h.y + h.radius * 0.14, 3 + phase * 0.5, 1.6, 0, 0, FULL_TURN);ctx.stroke();
                }
            }
        }
    }
    ctx.restore();
}
