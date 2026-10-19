// 이펙트: 파티클(피·살점·불꽃·연기), 핏자국 데칼, 데미지 숫자, 화면 흔들림/플래시/히트스톱
import { G, rand } from './state.js';
import { settings, goreProfile } from '../core/settings.js';
import { fx, glow } from '../core/assets.js';

// 파티클 종류
const P_BLOOD = 0, P_GIB = 1, P_SPARK = 2, P_SMOKE = 3, P_PETAL = 4, P_EMBER = 5;

let gore = goreProfile();
export function refreshGore() { gore = goreProfile(); }

function spawnParticle(kind, x, y, vx, vy, life, size, color) {
    const ps = G.particles;
    if (ps.count >= G.caps.particles) return null;
    const p = ps.spawn();
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.z = 0; p.vz = 0;
    p.life = life; p.max = life; p.size = size; p.color = color;
    return p;
}

// 피 분사: 위로 튀었다가 바닥(z=0)에 떨어지면 작은 얼룩을 남김 (의사 3D)
export function blood(x, y, amount, dirX = 0, dirY = 0, color) {
    if (!gore.blood) {
        for (let i = 0; i < Math.min(amount, 4); i++) {
            spawnParticle(P_SMOKE, x, y, rand(-30, 30), rand(-30, 30), rand(0.3, 0.6), rand(4, 8), '#3a3a44');
        }
        return;
    }
    const n = Math.ceil(amount * gore.blood);
    const c = color || gore.bloodColor;
    for (let i = 0; i < n; i++) {
        const sp = rand(40, 180);
        const a = Math.random() * Math.PI * 2;
        const p = spawnParticle(P_BLOOD, x, y,
            Math.cos(a) * sp + dirX * 120, Math.sin(a) * sp * 0.6 + dirY * 120,
            rand(0.5, 0.9), rand(2, 4.5), c);
        if (p) { p.z = rand(4, 18); p.vz = rand(60, 200); }
    }
}

export function gibs(x, y, n, color = '#7a1f2a') {
    if (!gore.gibs) return;
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(60, 220);
        const p = spawnParticle(P_GIB, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(0.7, 1.2), rand(3, 6), i % 3 ? color : '#d9c9b0');
        if (p) { p.z = rand(8, 24); p.vz = rand(100, 260); }
    }
}

export function sparks(x, y, n, color = '#ffd27a', speed = 160) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(speed * 0.3, speed);
        spawnParticle(P_SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.35), rand(1.5, 3), color);
    }
}

export function smoke(x, y, n, color = 'rgba(40,40,46,0.5)') {
    for (let i = 0; i < n; i++) {
        spawnParticle(P_SMOKE, x + rand(-6, 6), y + rand(-6, 6), rand(-20, 20), rand(-30, -5), rand(0.5, 1), rand(6, 14), color);
    }
}

export function petals(x, y, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(40, 140);
        spawnParticle(P_PETAL, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.8), rand(2, 4), i % 2 ? '#ff4fa0' : '#ffd1e8');
    }
}

export function embers(x, y, n) {
    for (let i = 0; i < n; i++) {
        spawnParticle(P_EMBER, x + rand(-10, 10), y + rand(-6, 6), rand(-15, 15), rand(-60, -20), rand(0.3, 0.7), rand(1.5, 3), i % 2 ? '#ff7a1a' : '#ffd23a');
    }
}

// 데칼: 링버퍼 (고어 수위·품질에 따라 상한)
export function decal(x, y, kind = 'red', scale = 1) {
    const max = Math.floor(gore.decals * G.caps.decalScale);
    if (max <= 0 && kind !== 'gray') return;
    const set = fx.splats[kind];
    if (!set) return;
    const cap = Math.max(max, 24);
    const d = { x, y, img: set[(Math.random() * set.length) | 0], s: scale * rand(0.7, 1.15), born: G.clock };
    if (G.decals.length < cap) G.decals.push(d);
    else { G.decals[G.decalHead] = d; G.decalHead = (G.decalHead + 1) % cap; }
}

export function damageText(x, y, value, crit = false, color) {
    if (!settings.damageNumbers) return;
    const ts = G.texts;
    if (ts.count >= G.caps.texts) return;
    const t = ts.spawn();
    t.x = x + rand(-6, 6); t.y = y - 10; t.vy = -45;
    t.text = String(Math.round(value));
    t.life = crit ? 0.8 : 0.55; t.max = t.life;
    t.crit = crit; t.color = color || (crit ? '#ff2a4a' : '#ffffff');
}

export function floatText(x, y, text, color = '#ffd23a', life = 1.2) {
    const ts = G.texts;
    if (ts.count >= G.caps.texts + 8) return;
    const t = ts.spawn();
    t.x = x; t.y = y; t.vy = -30; t.text = text; t.life = life; t.max = life; t.crit = true; t.color = color; t.big = true;
}

export function shake(amount) {
    if (!settings.shake) return;
    G.shake = Math.min(18, Math.max(G.shake, amount));
}

export function flash(alpha, color = '#ffffff') {
    const a = settings.flash ? alpha : alpha * 0.25;
    if (a > G.flash) { G.flash = a; G.flashColor = color; }
}

export function hitstop(sec) { G.hitstop = Math.max(G.hitstop, sec); }

export function updateEffects(dt) {
    const ps = G.particles;
    for (let i = ps.count - 1; i >= 0; i--) {
        const p = ps.items[i];
        p.life -= dt;
        if (p.life <= 0) { ps.release(i); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === P_BLOOD || p.kind === P_GIB) {
            p.vz -= 700 * dt;
            p.z += p.vz * dt;
            if (p.z <= 0) {
                // 착지: 작은 핏방울 데칼을 남기고 소멸 (데칼 수 제한 위해 일부만)
                if (p.kind === P_BLOOD && Math.random() < 0.08) decal(p.x, p.y, 'red', 0.25);
                ps.release(i);
                continue;
            }
            p.vx *= 0.98;
        } else if (p.kind === P_SMOKE) {
            p.size += 10 * dt;
        } else {
            p.vx *= 0.92; p.vy *= 0.92;
        }
    }
    const ts = G.texts;
    for (let i = ts.count - 1; i >= 0; i--) {
        const t = ts.items[i];
        t.life -= dt;
        if (t.life <= 0) { ts.release(i); continue; }
        t.y += t.vy * dt;
        t.vy *= 0.92;
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3);
}

export function drawDecals(ctx, vx0, vy0, vx1, vy1) {
    const ds = G.decals;
    const now = G.clock;
    for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        const w = d.img.width * d.s, h = d.img.height * d.s;
        if (d.x + w < vx0 || d.x - w > vx1 || d.y + h < vy0 || d.y - h > vy1) continue;
        const age = now - d.born;
        ctx.globalAlpha = age < 0.15 ? age / 0.15 : (age > 40 ? Math.max(0.25, 1 - (age - 40) / 40) : 0.9);
        ctx.drawImage(d.img, d.x - w / 2, d.y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
}

export function drawParticles(ctx, vx0, vy0, vx1, vy1) {
    const ps = G.particles;
    // 1) 피/살점/연기 (일반 합성)
    for (let i = 0; i < ps.count; i++) {
        const p = ps.items[i];
        if (p.kind === P_SPARK || p.kind === P_EMBER) continue;
        if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
        const a = p.life / p.max;
        ctx.fillStyle = p.color;
        if (p.kind === P_SMOKE) {
            ctx.globalAlpha = a * 0.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === P_PETAL) {
            ctx.globalAlpha = a;
            ctx.fillRect(p.x - p.size, p.y - p.size * 0.5, p.size * 2, p.size);
        } else {
            ctx.globalAlpha = Math.min(1, a * 1.5);
            ctx.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
        }
    }
    // 2) 불꽃/잉걸 (가산 합성, 사전 렌더 글로우)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ps.count; i++) {
        const p = ps.items[i];
        if (p.kind !== P_SPARK && p.kind !== P_EMBER) continue;
        if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
        ctx.globalAlpha = p.life / p.max;
        const g = glow(p.color, 16);
        const s = p.size * 4;
        ctx.drawImage(g, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}

export function drawTexts(ctx) {
    const ts = G.texts;
    if (!ts.count) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#120004';
    let lastFont = '';
    for (let i = 0; i < ts.count; i++) {
        const t = ts.items[i];
        const a = Math.min(1, (t.life / t.max) * 2);
        const font = t.big ? 'bold 15px "Press Start 2P", monospace' : (t.crit ? 'bold 13px "Press Start 2P", monospace' : '9px "Press Start 2P", monospace');
        if (font !== lastFont) { ctx.font = font; lastFont = font; }
        ctx.globalAlpha = a;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
}
