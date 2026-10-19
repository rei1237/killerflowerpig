// 경험치 젬 + 필드 아이템(고기/자석/다이너마이트/관 상자)
import { G, rand, emit } from './state.js';
import { fx, glow } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { addXP } from './progression.js';
import { healPlayer } from './player.js';
import { flash, shake, floatText } from './effects.js';
import { hitEnemy } from './enemies.js';

function tierOf(v) { return v < 4 ? 0 : v < 20 ? 1 : 2; }

export function dropGem(x, y, value) {
    const pool = G.gems;
    if (pool.count >= G.caps.gems) {
        // 젬이 너무 많으면 기존 젬에 합산 (뱀서 방식) → 렌더/업데이트 비용 고정
        const g = pool.items[(Math.random() * pool.count) | 0];
        g.value += value;
        g.tier = tierOf(g.value);
        return;
    }
    const g = pool.spawn();
    g.x = x + rand(-4, 4); g.y = y + rand(-4, 4);
    g.value = value; g.tier = tierOf(value);
    g.pull = false; g.speed = 0;
    g.phase = Math.random() * 6.28;
}

export function dropPickup(kind, x, y) {
    const p = G.pickups.spawn();
    p.kind = kind; p.x = x; p.y = y; p.t = 0; p.pull = false; p.speed = 0; p.boss = false;
    return p;
}

export function magnetAll() {
    const pool = G.gems;
    for (let i = 0; i < pool.count; i++) pool.items[i].pull = true;
}

function detonate() {
    flash(0.8, '#ffdddd');
    shake(14);
    audio.sfx('explode');
    const p = G.player;
    const hw = G.view.w / 2 + 40, hh = G.view.h / 2 + 40;
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (!e.alive || Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
        hitEnemy(e, 40 + G.stage * 30, { silent: true, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y), knock: 300 });
    }
    if (G.boss && G.boss.alive) G.boss.hurt(60 + G.stage * 40, { silent: false });
}

function collect(item) {
    switch (item.kind) {
        case 'meat': healPlayer(30); audio.sfx('heal'); break;
        case 'magnet': magnetAll(); audio.sfx('pickup'); floatText(G.player.x, G.player.y - 60, '굶주림!', '#ff8fa3'); break;
        case 'bomb': detonate(); break;
        case 'chest': audio.sfx('chest'); emit('chest', item.boss ? 'boss' : 'elite'); break;
        default: break;
    }
}

export function updatePickups(dt) {
    const p = G.player;
    const mr = p.stats.magnet;
    const mr2 = mr * mr;
    const pool = G.gems;
    const py = p.y - 14;
    for (let i = pool.count - 1; i >= 0; i--) {
        const g = pool.items[i];
        const dx = p.x - g.x, dy = py - g.y;
        const d2 = dx * dx + dy * dy;
        if (!g.pull && d2 < mr2) g.pull = true;
        if (g.pull) {
            const d = Math.sqrt(d2) || 1;
            g.speed = Math.min(900, g.speed + 1400 * dt);
            g.x += (dx / d) * g.speed * dt;
            g.y += (dy / d) * g.speed * dt;
            if (d < 14) {
                addXP(g.value);
                audio.sfx('gem');
                pool.release(i);
            }
        }
    }
    const pk = G.pickups;
    for (let i = pk.count - 1; i >= 0; i--) {
        const it = pk.items[i];
        it.t += dt;
        const dx = p.x - it.x, dy = py - it.y;
        const d = Math.hypot(dx, dy) || 1;
        if (!it.pull && d < Math.max(40, mr * 0.6)) it.pull = true;
        // 보스 관은 잠시 후 플레이어에게 끌려옴 (놓치지 않게)
        if (!it.pull && it.boss && it.t > 1.6) it.pull = true;
        if (it.pull) {
            it.speed = Math.min(700, it.speed + 1000 * dt);
            it.x += (dx / d) * it.speed * dt;
            it.y += (dy / d) * it.speed * dt;
        }
        if (d < 18) {
            pk.release(i);
            collect(it);
        }
    }
}

export function drawPickups(ctx, vx0, vy0, vx1, vy1) {
    const pool = G.gems;
    const imgs = fx.gems;
    const t = G.clock;
    for (let i = 0; i < pool.count; i++) {
        const g = pool.items[i];
        if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
        const img = imgs[g.tier];
        const bob = Math.sin(t * 4 + g.phase) * 1.5;
        ctx.drawImage(img, g.x - img.width / 2, g.y - img.height / 2 + bob);
    }
    const pk = G.pickups;
    for (let i = 0; i < pk.count; i++) {
        const it = pk.items[i];
        const img = it.kind === 'meat' ? fx.meat : it.kind === 'magnet' ? fx.magnet : it.kind === 'bomb' ? fx.bomb : fx.chest;
        const bob = Math.sin(t * 3 + i) * 2;
        if (it.kind === 'chest') {
            ctx.globalCompositeOperation = 'lighter';
            const gl = glow('#ff2244', 40);
            ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
            ctx.drawImage(gl, it.x - 40, it.y - 52);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(img, it.x - img.width / 2, it.y - img.height + bob);
    }
}
