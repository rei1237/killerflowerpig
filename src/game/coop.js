// 2P 협동: 영냥이(2P)가 연이(1P)와 같은 화면에서 함께 싸운다.
// 기술은 연이 아틀리에(yeoni-atelier)의 '월정석 사냥' 영냥이 키트(사주 성광·별자리 궤도·초승달 부메랑·
// 타로 낙하·달빛 수호부)를 이 게임 전투에 맞게 옮겼다. 영냥이는 장비 선택을 받지 않아 상대적으로 약하므로
// 원작 수치보다 피해 +45~70%, 재사용 대기 -15~20%, 범위·개수를 상향했다.
// - 1P 레벨이 오르면 영냥이 기술도 함께 강해지고(공유 성장), 레벨에 따라 기술이 하나씩 열린다.
// - 2P가 쓰러지면 잠시 뒤 연이 곁에서 부활한다. 런 실패는 1P가 쓰러질 때만이다.
// - 2P 모드에서는 동행 펫 영냥이를 쓸 수 없다 (같은 영냥이가 직접 싸운다).
import { G } from './state.js';
import { playerMove } from '../core/input.js';
import { glow } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { hitEnemy } from './enemies.js';
import { sparks, floatText, damageText } from './effects.js';
import { healPlayer } from './player.js';

export const PARTNER_ID = 'coop_yeongnyang';
export const PARTNER = Object.freeze({
    name: '영냥이', hp: 90, hpPerLevel: 2, speed: 142, radius: 10, bodyOffset: 14,
    reviveTime: 10, reviveHp: 0.5, reviveIframes: 2, hurtIframes: 0.5,
    // 1P 레벨·구역에 따른 공유 성장
    levelPower: 0.075, stagePower: 0.18,
});
// 원작(hunt-kit) 대비: 성광 36→52 피해·0.85→0.7초, 궤도 7→12 피해·별 2→3개, 부메랑 22→34·1.3→1.1초,
// 타로 38→60·2.1→1.8초, 수호부 피해 감소 12→20%·회복 1→3
export const PARTNER_SKILLS = Object.freeze({
    bolt: { name: '사주 성광', unlock: 1, cd: 0.7, dmg: 52, radius: 112, halfArc: Math.PI * 0.5, crit: 0.25, critBonus: 0.6, knock: 70 },
    orbit: { name: '별자리 궤도', unlock: 1, dmg: 12, radius: 80, spin: 3.4, hitGap: 0.45, starRadius: 13, counts: [3, 3, 4, 5, 6] },
    crescent: { name: '초승달 부메랑', unlock: 4, cd: 1.1, dmg: 34, range: 270, speed: 430, hitGap: 0.3, hitRadius: 18, counts: [1, 1, 2, 2, 3] },
    tarot: { name: '타로 낙하', unlock: 8, cd: 1.8, dmg: 60, radius: 64, warn: 0.4, reach: 380, counts: [2, 2, 3, 4, 5] },
    aura: { name: '달빛 수호부', unlock: 12, guard: 0.2, guardPerRank: 0.025, heal: 3, tick: 3, radius: 120 },
});
export const PARTNER_SKILL_ORDER = Object.freeze(['bolt', 'orbit', 'crescent', 'tarot', 'aura']);

const moons = [], cards = [];
const near = [];

export function coopActive() { return !!(G.coop && G.partner); }
export function skillUnlocked(id, level = G.level) { return level >= PARTNER_SKILLS[id].unlock; }
// 해금 후 6레벨마다 1랭크 (최대 5)
export function skillRank(id, level = G.level) { return Math.max(0, Math.min(5, 1 + Math.floor((level - PARTNER_SKILLS[id].unlock) / 6))); }
const count = (id, level) => PARTNER_SKILLS[id].counts[Math.max(0, skillRank(id, level) - 1)];
export function partnerPower(level = G.level, stage = G.stage) {
    const might = G.player?.stats?.might || 1;
    return might * (1 + PARTNER.levelPower * Math.max(0, level - 1)) * (1 + PARTNER.stagePower * Math.max(0, (stage || 1) - 1));
}
export function partnerMaxHp(level = G.level) { return Math.round(PARTNER.hp + PARTNER.hpPerLevel * Math.max(0, level - 1)); }
export function partnerGuard(level = G.level) {
    if (!skillUnlocked('aura', level)) return 0;
    const a = PARTNER_SKILLS.aura;
    return Math.min(0.35, a.guard + a.guardPerRank * (skillRank('aura', level) - 1));
}

export function createPartner() {
    if (!G.coop) { G.partner = null; return null; }
    const maxHp = partnerMaxHp();
    G.partner = {
        x: -40, y: 10, vx: 0, vy: 0, hp: maxHp, maxHp, radius: PARTNER.radius,
        facing: 'down', walk: 0, iframes: 0, hurtT: 0, dead: false, downT: 0,
        boltCd: 0.5, moonCd: 0.8, tarotCd: 1.2, auraT: PARTNER_SKILLS.aura.tick,
        orbitAngle: 0, swing: null, attackAt: -9, bossOrbitAt: -9, bossMoonAt: -9, isPartner: true,
    };
    moons.length = 0; cards.length = 0;
    return G.partner;
}
// 스테이지 시작: 1P 곁에서 다시 시작한다 (쓰러져 있었다면 부활).
export function resetPartner() {
    const q = G.partner;
    if (!q) return;
    const p = G.player;
    q.x = p.x - 40; q.y = p.y + 10; q.vx = q.vy = 0;
    q.maxHp = partnerMaxHp(); q.hp = q.maxHp; q.dead = false; q.downT = 0; q.iframes = 1.5; q.hurtT = 0;
    q.swing = null; moons.length = 0; cards.length = 0;
}

// 적은 더 가까운 쪽 플레이어를 쫓는다. 쓰러진 2P는 표적이 아니다.
export function chaseTarget(e, p1 = G.player) {
    const q = G.partner;
    if (!q || q.dead || !G.coop) return p1;
    if (p1.dead) return q;
    return (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < (p1.x - e.x) ** 2 + (p1.y - e.y) ** 2 ? q : p1;
}
export const partnerBody = q => ({ x: q.x, y: q.y - PARTNER.bodyOffset, radius: q.radius });

export function damagePartner(amount, srcX, srcY) {
    const q = G.partner;
    if (!q || q.dead || q.iframes > 0) return false;
    const armor = (G.player?.stats?.armor || 0) * 0.5;
    const dmg = Math.max(1, amount - armor) * (1 - partnerGuard());
    q.iframes = PARTNER.hurtIframes; q.hurtT = 0.25;
    if (G.godMode) return true;
    q.hp -= dmg;
    audio.sfx('hurt');
    damageText(q.x, q.y - 40, dmg, false, '#c9a7ff');
    sparks(q.x, q.y - 18, 5, '#c9a7ff', 120);
    if (q.hp <= 0) {
        q.hp = 0; q.dead = true; q.downT = PARTNER.reviveTime; q.swing = null;
        floatText(q.x, q.y - 60, `영냥이 쓰러짐… ${PARTNER.reviveTime}초 뒤 부활`, '#c9a7ff', 1.4);
    }
    return true;
}
// 플레이어 판정을 쓰는 모든 적 공격의 공용 진입점
export function hurtTarget(target, amount, srcX, srcY, damagePlayer) {
    return target === G.partner ? damagePartner(amount, srcX, srcY) : damagePlayer(amount, srcX, srcY);
}

function revive(q, p) {
    q.dead = false; q.maxHp = partnerMaxHp(); q.hp = Math.ceil(q.maxHp * PARTNER.reviveHp);
    q.x = p.x - 36; q.y = p.y + 8; q.iframes = PARTNER.reviveIframes;
    sparks(q.x, q.y - 20, 16, '#ffe9a8', 200);
    floatText(q.x, q.y - 60, '✨ 영냥이 부활!', '#ffe9a8', 1.1);
    audio.sfx('heal');
}

function faceToward(q, dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 0.8) q.facing = dx < 0 ? 'left' : 'right';
    else if (dx || dy) q.facing = dy < 0 ? 'up' : 'down';
}

function nearestFoe(q, range) {
    let best = null, bd = range * range;
    const list = G.grid.query(q.x, q.y, range, near);
    for (const e of list) {
        if (!e.alive) continue;
        const d = (e.x - q.x) ** 2 + (e.y - q.y) ** 2;
        if (d < bd) { bd = d; best = e; }
    }
    const b = G.boss;
    if (b?.alive && (b.x - q.x) ** 2 + (b.y - q.y) ** 2 < bd) best = b;
    return best;
}

function strike(target, dmg, opts) {
    const o = { weapon: PARTNER_ID, ...opts };
    if (target === G.boss) return target.hurt(dmg, o);
    return hitEnemy(target, dmg, o);
}

function updateBolt(q, dt, power) {
    const s = PARTNER_SKILLS.bolt;
    q.boltCd -= dt;
    if (q.swing) { q.swing.t += dt; if (q.swing.t > 0.24) q.swing = null; }
    if (q.boltCd > 0) return;
    const t = nearestFoe(q, s.radius * 1.5);
    if (!t) { q.boltCd = 0.12; return; }
    q.boltCd = s.cd;
    const angle = Math.atan2(t.y - q.y, t.x - q.x), r = s.radius * (1 + 0.05 * (skillRank('bolt') - 1));
    q.swing = { angle, t: 0, r };
    q.attackAt = G.clock; faceToward(q, t.x - q.x, t.y - q.y);
    const dmg = s.dmg * power;
    const list = G.grid.query(q.x, q.y, r + 30, near);
    for (const e of list) {
        if (!e.alive) continue;
        const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy);
        if (d > r + e.radius) continue;
        let da = Math.abs(Math.atan2(dy, dx) - angle); if (da > Math.PI) da = Math.PI * 2 - da;
        if (d > e.radius + 18 && da > s.halfArc) continue;
        strike(e, dmg, { crit: s.crit, critBonus: s.critBonus, kx: dx / (d || 1), ky: dy / (d || 1), knock: s.knock });
    }
    const b = G.boss;
    if (b?.alive && Math.hypot(b.x - q.x, b.y - q.y) < r + b.radius) strike(b, dmg, { crit: s.crit, critBonus: s.critBonus });
    audio.sfx('hit');
}

function updateOrbit(q, dt, power) {
    const s = PARTNER_SKILLS.orbit, n = count('orbit'), now = G.clock;
    q.orbitAngle += s.spin * dt;
    const dmg = s.dmg * power;
    for (let i = 0; i < n; i++) {
        const a = q.orbitAngle + i / n * Math.PI * 2;
        const ox = q.x + Math.cos(a) * s.radius, oy = q.y - 16 + Math.sin(a) * s.radius * 0.75;
        const list = G.grid.query(ox, oy + 10, s.starRadius + 24, near);
        for (const e of list) {
            if (!e.alive || now - (e.coopOrbitAt ?? -9) < s.hitGap) continue;
            const dx = e.x - ox, dy = (e.y - e.radius) - oy, rr = s.starRadius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            e.coopOrbitAt = now;
            strike(e, dmg, { silent: Math.random() < 0.5, kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: 40 });
        }
        const b = G.boss;
        if (b?.alive && now - q.bossOrbitAt > s.hitGap && Math.hypot(b.x - ox, b.y - b.radius - oy) < s.starRadius + b.radius) { q.bossOrbitAt = now; strike(b, dmg, { silent: true }); }
    }
}

function updateCrescent(q, dt, power) {
    const s = PARTNER_SKILLS.crescent, now = G.clock;
    if (skillUnlocked('crescent')) {
        q.moonCd -= dt;
        if (q.moonCd <= 0) {
            q.moonCd = s.cd;
            const t = nearestFoe(q, s.range * 1.2);
            const base = t ? Math.atan2(t.y - q.y, t.x - q.x) : { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[q.facing];
            const n = count('crescent'), range = s.range * (1 + 0.06 * (skillRank('crescent') - 1));
            for (let i = 0; i < n; i++) {
                const a = base + (n > 1 ? (i / (n - 1) - 0.5) * 0.7 : 0);
                moons.push({ a, t: 0, dur: 2 * range / s.speed, range, x: q.x, y: q.y - 16, spin: 0 });
            }
            q.attackAt = now;
        }
    }
    const dmg = s.dmg * power;
    for (let i = moons.length - 1; i >= 0; i--) {
        const m = moons[i];
        m.t += dt; m.spin += dt * 14;
        if (m.t >= m.dur) { moons.splice(i, 1); continue; }
        const k = Math.sin(Math.PI * m.t / m.dur);
        m.x = q.x + Math.cos(m.a) * m.range * k; m.y = q.y - 16 + Math.sin(m.a) * m.range * k * 0.8;
        const list = G.grid.query(m.x, m.y + 10, s.hitRadius + 24, near);
        for (const e of list) {
            if (!e.alive || now - (e.coopMoonAt ?? -9) < s.hitGap) continue;
            const dx = e.x - m.x, dy = (e.y - e.radius) - m.y, rr = s.hitRadius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            e.coopMoonAt = now;
            strike(e, dmg, { kx: Math.cos(m.a), ky: Math.sin(m.a), knock: 50 });
        }
        const b = G.boss;
        if (b?.alive && now - q.bossMoonAt > s.hitGap && Math.hypot(b.x - m.x, b.y - b.radius - m.y) < s.hitRadius + b.radius) { q.bossMoonAt = now; strike(b, dmg, {}); }
    }
}

function updateTarot(q, dt, power) {
    const s = PARTNER_SKILLS.tarot;
    if (skillUnlocked('tarot')) {
        q.tarotCd -= dt;
        if (q.tarotCd <= 0) {
            q.tarotCd = s.cd;
            const list = G.grid.query(q.x, q.y, s.reach, near).filter(e => e.alive);
            const n = count('tarot'), r = s.radius * (1 + 0.06 * (skillRank('tarot') - 1));
            if (G.boss?.alive && Math.hypot(G.boss.x - q.x, G.boss.y - q.y) < s.reach) cards.push({ x: G.boss.x, y: G.boss.y, t: 0, r, hit: false });
            for (let i = 0; i < n && list.length; i++) {
                const e = list.splice(Math.floor(Math.random() * list.length), 1)[0];
                cards.push({ x: e.x, y: e.y, t: 0, r, hit: false });
            }
        }
    }
    const dmg = s.dmg * power;
    for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        c.t += dt;
        if (!c.hit && c.t >= s.warn) {
            c.hit = true;
            const list = G.grid.query(c.x, c.y, c.r + 20, near);
            for (const e of list) {
                if (!e.alive) continue;
                const dx = e.x - c.x, dy = e.y - c.y;
                if (dx * dx + dy * dy / 0.49 > (c.r + e.radius) ** 2) continue;
                strike(e, dmg, { kx: dx / (c.r || 1), ky: dy / (c.r || 1), knock: 90 });
            }
            const b = G.boss;
            if (b?.alive && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.radius) strike(b, dmg, {});
            sparks(c.x, c.y - 6, 8, '#d9b8ff', 170);
        }
        if (c.t > s.warn + 0.35) cards.splice(i, 1);
    }
}

function updateAura(q, dt) {
    const s = PARTNER_SKILLS.aura;
    if (!skillUnlocked('aura')) return;
    q.auraT -= dt;
    if (q.auraT > 0) return;
    q.auraT = s.tick;
    const heal = s.heal * (1 + 0.25 * (skillRank('aura') - 1));
    const before = q.hp;
    q.hp = Math.min(q.maxHp, q.hp + heal);
    if (q.hp > before) damageText(q.x, q.y - 44, q.hp - before, false, '#5dff7a');
    // 곁에 있는 연이도 조금 회복시킨다 (협동 보상)
    const p = G.player;
    if (!p.dead && Math.hypot(p.x - q.x, p.y - q.y) < s.radius) healPlayer(heal * 0.5);
}

// 1P와 함께 한 화면에 보이도록 2P를 1P 기준 상자 안에 묶어 둔다 (카메라는 두 사람의 중간을 따라간다).
export function leashBox() { return { x: Math.max(120, G.view.w - 140), y: Math.max(100, G.view.h - 150) }; }

export function updatePartner(dt) {
    const q = G.partner;
    if (!q || !G.coop) return;
    const p = G.player;
    if (q.dead) {
        if (!p.dead) { q.downT -= dt; if (q.downT <= 0) revive(q, p); }
        return;
    }
    const mv = playerMove(1);
    q.vx = mv.x * PARTNER.speed; q.vy = mv.y * PARTNER.speed;
    q.x += q.vx * dt; q.y += q.vy * dt;
    const box = leashBox();
    q.x = Math.max(p.x - box.x, Math.min(p.x + box.x, q.x));
    q.y = Math.max(p.y - box.y, Math.min(p.y + box.y, q.y));
    if (mv.x || mv.y) { q.walk += Math.hypot(q.vx, q.vy) * dt / 22; if (G.clock - q.attackAt > 0.36) faceToward(q, mv.x, mv.y); }
    if (q.iframes > 0) q.iframes -= dt;
    if (q.hurtT > 0) q.hurtT -= dt;
    const target = partnerMaxHp();
    if (target > q.maxHp) { q.hp += target - q.maxHp; q.maxHp = target; }
    if (p.dead || G.mode === 'clearing') return;
    const power = partnerPower();
    updateBolt(q, dt, power);
    updateOrbit(q, dt, power);
    updateCrescent(q, dt, power);
    updateTarot(q, dt, power);
    updateAura(q, dt);
}

// 카메라 초점: 2P가 서 있으면 두 사람의 중간, 아니면 1P
export function cameraFocus(p) {
    const q = G.partner;
    if (!q || q.dead || !G.coop) return { x: p.x, y: p.y };
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

// ── 그리기 ──────────────────────────────────────────────
// 연이 아틀리에 영냥이 시트: 걷기 4×4(128px, 행 = 아래·왼쪽·오른쪽·위), 공격 4×4(192×160).
export const PARTNER_SHEETS = Object.freeze({
    walk: { src: 'asset/sprites/coop-yeongnyang-walk.webp', w: 128, h: 128, ax: 64, ay: 122, size: 64 },
    attack: { src: 'asset/sprites/coop-yeongnyang-attack.webp', w: 192, h: 160, ax: 96, ay: 154, size: 80 },
});
const ROWS = { down: 0, left: 1, right: 2, up: 3 };
const sheetImages = {};
function sheet(key) {
    if (typeof Image === 'undefined') return null;
    let img = sheetImages[key];
    if (!img) { img = sheetImages[key] = new Image(); img.decoding = 'async'; img.src = PARTNER_SHEETS[key].src; }
    return img.complete && img.naturalWidth ? img : null;
}
export function partnerFrame(q, clock = G.clock) {
    const attacking = clock - q.attackAt < 0.36;
    const key = attacking ? 'attack' : 'walk';
    const moving = !!(q.vx || q.vy);
    const col = attacking ? Math.min(3, Math.floor((clock - q.attackAt) / 0.09)) : moving ? Math.floor(q.walk) % 4 : 0;
    return { key, row: ROWS[q.facing] ?? 0, col };
}

export function drawPartnerShadow(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.moveTo(q.x + 13, q.y);
    ctx.ellipse(q.x, q.y, 13, 4.5, 0, 0, Math.PI * 2);
}

export function drawPartner(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.save();
    const aura = skillUnlocked('aura') && !q.dead;
    if (aura) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 + Math.sin(G.clock * 3) * 0.04;
        const g = glow('#b9a3ff', 64), r = PARTNER_SKILLS.aura.radius;
        ctx.drawImage(g, q.x - r, q.y - r * 0.7, r * 2, r * 1.4);
        ctx.globalCompositeOperation = 'source-over';
    }
    const f = partnerFrame(q), def = PARTNER_SHEETS[f.key], img = sheet(f.key);
    const blink = q.iframes > 0 && !q.dead && Math.floor(G.clock * 20) % 2 === 0;
    ctx.globalAlpha = q.dead ? 0.45 : blink ? 0.55 : 1;
    if (img) {
        const s = def.size / def.h;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, f.col * def.w, f.row * def.h, def.w, def.h, q.x - def.ax * s, q.y - def.ay * s, def.w * s, def.h * s);
    } else {
        ctx.fillStyle = '#fff5f8'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 16, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 24); ctx.lineTo(q.x + 2, q.y - 46); ctx.lineTo(q.x + 15, q.y - 24); ctx.fill();
    }
    if (q.hurtT > 0 && img) {
        ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glow('#ff6b8a', 32), q.x - 22, q.y - 44, 44, 44);
        ctx.globalCompositeOperation = 'source-over';
    }
    // 머리 위 2P 표시 + 체력
    ctx.globalAlpha = 1;
    const w = 34, y = q.y - 62;
    ctx.fillStyle = '#0b0f1acc'; ctx.fillRect(q.x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = q.dead ? '#6b6478' : '#b98bea'; ctx.fillRect(q.x - w / 2, y, w * Math.max(0, q.hp / q.maxHp), 3);
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8dcff';
    ctx.fillText(q.dead ? `부활 ${Math.ceil(q.downT)}` : '2P', q.x, y - 3);
    ctx.restore();
}

export function drawPartnerEffects(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const star = glow('#ffe9a8', 32), moon = glow('#c9b6ff', 32), card = glow('#d9b8ff', 64);
    if (!q.dead) {
        const s = PARTNER_SKILLS.orbit, n = count('orbit');
        for (let i = 0; i < n; i++) {
            const a = q.orbitAngle + i / n * Math.PI * 2;
            const ox = q.x + Math.cos(a) * s.radius, oy = q.y - 16 + Math.sin(a) * s.radius * 0.75;
            ctx.globalAlpha = 0.85; ctx.drawImage(star, ox - 13, oy - 13, 26, 26);
            ctx.globalAlpha = 1; ctx.fillStyle = '#fff7da';
            ctx.fillRect(ox - 4, oy - 0.8, 8, 1.6); ctx.fillRect(ox - 0.8, oy - 4, 1.6, 8);
        }
    }
    if (q.swing) {
        const k = q.swing.t / 0.24, s = PARTNER_SKILLS.bolt;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 6 * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 14, q.swing.r * (0.7 + 0.3 * k), q.swing.r * 0.7 * (0.7 + 0.3 * k), 0, q.swing.angle - s.halfArc, q.swing.angle + s.halfArc); ctx.stroke();
        ctx.strokeStyle = '#b98bea'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 14, q.swing.r * 0.55, q.swing.r * 0.4, 0, q.swing.angle - s.halfArc * 0.8, q.swing.angle + s.halfArc * 0.8); ctx.stroke();
    }
    for (const m of moons) {
        ctx.globalAlpha = 0.7; ctx.drawImage(moon, m.x - 20, m.y - 20, 40, 40);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#f6ce73'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(m.x, m.y, 9, m.spin, m.spin + Math.PI * 1.25); ctx.stroke();
    }
    const warn = PARTNER_SKILLS.tarot.warn;
    for (const c of cards) {
        if (!c.hit) {
            const k = Math.min(1, c.t / warn), fall = (1 - k) * 160;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.25 + 0.35 * k; ctx.strokeStyle = '#d9b8ff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * k, c.r * 0.7 * k, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.95; ctx.fillStyle = '#2a1f4a'; ctx.fillRect(c.x - 9, c.y - 40 - fall, 18, 26);
            ctx.strokeStyle = '#f6ce73'; ctx.lineWidth = 1.5; ctx.strokeRect(c.x - 9, c.y - 40 - fall, 18, 26);
            ctx.fillStyle = '#f6ce73'; ctx.fillRect(c.x - 1, c.y - 31 - fall, 2, 8);
            ctx.globalCompositeOperation = 'lighter';
        } else {
            const k = Math.min(1, (c.t - warn) / 0.35);
            ctx.globalAlpha = 0.7 * (1 - k); ctx.drawImage(card, c.x - c.r * 1.2, c.y - c.r * 0.85, c.r * 2.4, c.r * 1.7);
        }
    }
    ctx.restore();
}
