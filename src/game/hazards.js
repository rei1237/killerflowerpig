// 장판/예고: 화염(아군), 독가스(아군, 둔화), 산성(적), 예고 원/선 (보스 패턴용)
import { G } from './state.js';
import { glow } from '../core/assets.js';
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
    return h;
}

const list = [];
export function updateHazards(dt) {
    const pool = G.hazards;
    const p = G.player;
    for (let i = pool.count - 1; i >= 0; i--) {
        const h = pool.items[i];
        h.t += dt;
        if (h.follow) { h.x = p.x; h.y = p.y; }
        if (h.kind === 'tcircle' || h.kind === 'tline') {
            if (h.t >= h.delay) {
                h.onFire?.(h);
                h.alive = false;
                pool.release(i);
            }
            continue;
        }
        if (h.t >= h.duration) { h.alive = false; pool.release(i); continue; }
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
        const found = G.grid.query(h.x, h.y, r + 20, list);
        for (const e of found) {
            if (!e.alive) continue;
            const dx = e.x - h.x, dy = e.y - h.y;
            if (dx * dx + (dy * dy) / 0.49 > r * r) continue;
            hitEnemy(e, h.dmg, { weapon: h.weapon, silent: Math.random() < 0.6, slow: h.slow });
        }
        const boss = G.boss;
        if (boss && boss.alive) {
            const dx = boss.x - h.x, dy = boss.y - h.y;
            if (dx * dx + (dy * dy) / 0.49 < (r + boss.radius) ** 2) boss.hurt(h.dmg, { weapon: h.weapon, silent: true });
        }
        if (h.kind === 'fire') embers(h.x, h.y, 2);
        else if (h.kind === 'gas' && Math.random() < 0.5) smoke(h.x + (Math.random() - 0.5) * r, h.y + (Math.random() - 0.5) * r * 0.6, 1, 'rgba(90,200,40,0.35)');
    }
}

// 바닥 장판 (캐릭터 아래 레이어)
export function drawHazards(ctx) {
    const pool = G.hazards;
    const t = G.clock;
    for (let i = 0; i < pool.count; i++) {
        const h = pool.items[i];
        if (h.kind === 'tcircle') {
            const k = Math.min(1, h.t / h.delay);
            ctx.globalAlpha = 0.18 + 0.2 * k;
            ctx.fillStyle = h.color;
            ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = h.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius * k, h.radius * 0.7 * k, 0, 0, Math.PI * 2); ctx.stroke();
            continue;
        }
        if (h.kind === 'tline') {
            const k = Math.min(1, h.t / h.delay);
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.rotate(h.angle);
            ctx.globalAlpha = 0.15 + 0.25 * k;
            ctx.fillStyle = h.color;
            ctx.fillRect(0, -h.width / 2, h.len, h.width);
            ctx.globalAlpha = 0.9;
            ctx.fillRect(0, -1, h.len * k, 2);
            ctx.restore();
            continue;
        }
        const life = Math.min(1, (h.duration - h.t) / 0.4, h.t / 0.15);
        if (h.kind === 'fire') {
            ctx.globalAlpha = 0.55 * life;
            ctx.fillStyle = '#5a1000';
            ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            const g = glow('#ff5a14', 64);
            const fl = 1 + Math.sin(t * 18 + h.x) * 0.08;
            ctx.globalAlpha = 0.75 * life;
            ctx.drawImage(g, h.x - h.radius * fl, h.y - h.radius * 0.75 * fl, h.radius * 2 * fl, h.radius * 1.5 * fl);
            ctx.globalCompositeOperation = 'source-over';
        } else if (h.kind === 'gas') {
            ctx.globalAlpha = 0.35 * life;
            const g = glow('#5cff3a', 64);
            const wob = 1 + Math.sin(t * 3 + h.y) * 0.06;
            ctx.drawImage(g, h.x - h.radius * 1.2 * wob, h.y - h.radius * 0.85 * wob, h.radius * 2.4 * wob, h.radius * 1.7 * wob);
        } else if (h.kind === 'acid') {
            ctx.globalAlpha = 0.6 * life;
            ctx.fillStyle = '#2f5a10';
            ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.5 * life;
            ctx.fillStyle = '#8cff3a';
            const bub = (Math.sin(t * 6 + h.x) + 1) * 0.5;
            ctx.beginPath(); ctx.arc(h.x + h.radius * 0.3, h.y - 3, 2 + bub * 3, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}
