// 캔버스 HUD: 꿰맨 살점 경험치 바, 혈관 HP 바, 무기/패시브 슬롯, 타이머, 보스 체력
import { G } from '../game/state.js';
import { STAGES } from '../data/stages.js';
import { WEAPONS, PASSIVES, WEAPON_MAX_LEVEL } from '../data/weapons.js';
import { icon } from '../core/assets.js';

let bossTrail = 1;
let xpShown = 0;
const FONT = '"Press Start 2P", monospace';

function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function stitchedBar(ctx, x, y, w, h, ratio, fill, glowFill) {
    ctx.fillStyle = '#16050a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = glowFill;
    ctx.fillRect(x, y, w * ratio, Math.max(1, h * 0.3));
    // 꿰맨 자국
    ctx.strokeStyle = 'rgba(220,190,170,0.55)';
    ctx.lineWidth = Math.max(1, h * 0.12);
    ctx.beginPath();
    const step = h * 2.2;
    for (let sx = x + step / 2; sx < x + w; sx += step) {
        ctx.moveTo(sx - h * 0.35, y - h * 0.25);
        ctx.lineTo(sx + h * 0.35, y + h * 1.25);
    }
    ctx.stroke();
    ctx.strokeStyle = '#3d0a12';
    ctx.lineWidth = Math.max(1, h * 0.15);
    ctx.strokeRect(x, y, w, h);
}

export function drawHUD(ctx, screen) {
    const p = G.player;
    if (!p || G.mode === 'idle') return;
    const pr = screen.pr;
    const u = pr * Math.min(1.25, Math.max(0.7, screen.cssH / 560));
    const W = screen.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = 'middle';

    // ── 경험치 바 (상단 전체) ──
    const xpR = Math.min(1, G.xp / G.xpNext);
    xpShown += (xpR - xpShown) * 0.25;
    if (xpR < xpShown - 0.5) xpShown = xpR;
    const barH = 10 * u;
    stitchedBar(ctx, 0, 0, W, barH, xpShown, '#8c1230', '#e0405f');

    // ── HP 바 (좌상단, 맥동하는 혈관) ──
    const hpR = Math.max(0, p.hp / p.maxHp);
    const beat = hpR < 0.35 ? 1 + Math.sin(G.clock * (8 + (0.35 - hpR) * 30)) * 0.08 : 1;
    const hx = 10 * u, hy = barH + 8 * u, hw = 150 * u * beat, hh = 12 * u;
    ctx.fillStyle = '#16050a';
    ctx.fillRect(hx - 2 * u, hy - 2 * u, hw + 4 * u, hh + 4 * u);
    ctx.fillStyle = hpR > 0.5 ? '#b3122c' : hpR > 0.25 ? '#d9442a' : '#ff1030';
    ctx.fillRect(hx, hy, hw * hpR, hh);
    // 혈관 하이라이트
    ctx.strokeStyle = 'rgba(255,170,180,0.45)';
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
        const xx = hx + (hw * hpR) * (i / 10);
        const yy = hy + hh * 0.35 + Math.sin(i * 1.7 + G.clock * 3) * hh * 0.18;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = '#5a0a18';
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(hx, hy, hw, hh);
    ctx.font = `${7 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd9df';
    ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, hx + 4 * u, hy + hh / 2 + u);
    // 레벨 배지
    ctx.font = `${9 * u}px ${FONT}`;
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`LV${G.level}`, hx + 150 * u + 10 * u, hy + hh / 2 + u);

    // ── 슬롯 (무기 / 패시브) ──
    const isz = 20 * u, gap = 3 * u;
    let sy = hy + hh + 8 * u;
    const drawSlot = (x, y, emoji, lv, max, evolved) => {
        ctx.fillStyle = evolved ? '#4a0614' : 'rgba(20,6,10,0.8)';
        ctx.fillRect(x, y, isz, isz);
        ctx.strokeStyle = evolved ? '#ff2a4a' : '#5a1a24';
        ctx.lineWidth = 1.5 * u;
        ctx.strokeRect(x, y, isz, isz);
        ctx.drawImage(icon(emoji, Math.round(isz)), x, y, isz, isz);
        // 레벨 핍
        const pip = Math.max(1.5, 2 * u);
        for (let i = 0; i < lv; i++) {
            ctx.fillStyle = lv >= max ? '#ffd23a' : '#ff6a80';
            ctx.fillRect(x + 1 + (i % 8) * (pip + 0.5), y + isz - pip - 1, pip, pip);
        }
    };
    let sx = hx;
    for (const w of G.weapons) {
        const def = WEAPONS[w.id];
        drawSlot(sx, sy, w.evolved ? def.evolve.icon : def.icon, w.level, WEAPON_MAX_LEVEL, w.evolved);
        sx += isz + gap;
    }
    sy += isz + gap;
    sx = hx;
    for (const id in G.passives) {
        drawSlot(sx, sy, PASSIVES[id].icon, G.passives[id], 5, false);
        sx += isz + gap;
    }

    // ── 타이머 / 스테이지 ──
    const st = STAGES[G.stage];
    ctx.textAlign = 'center';
    const cx = W / 2;
    if (G.boss && G.boss.alive) {
        ctx.font = `${13 * u}px ${FONT}`;
        ctx.fillStyle = Math.floor(G.clock * 3) % 2 ? '#ff2244' : '#ff8899';
        ctx.fillText('☠ BOSS ☠', cx, barH + 16 * u);
    } else if (st) {
        const remain = Math.max(0, st.duration - G.time);
        ctx.font = `${14 * u}px ${FONT}`;
        ctx.fillStyle = remain < 10 ? '#ff4a5a' : '#f2e6e8';
        ctx.fillText(fmtTime(Math.min(G.time, st.duration)), cx, barH + 16 * u);
        ctx.font = `${6 * u}px ${FONT}`;
        ctx.fillStyle = '#b08890';
        ctx.fillText(`STAGE ${G.stage} · ${st.name}`, cx, barH + 32 * u);
        // 보스까지 진행 바
        const pw = 120 * u;
        ctx.fillStyle = '#2a0a10';
        ctx.fillRect(cx - pw / 2, barH + 38 * u, pw, 3 * u);
        ctx.fillStyle = '#c21d3c';
        ctx.fillRect(cx - pw / 2, barH + 38 * u, pw * Math.min(1, G.time / st.duration), 3 * u);
    }

    // ── 킬 / 골드 (우상단) ──
    ctx.textAlign = 'right';
    ctx.font = `${8 * u}px ${FONT}`;
    ctx.fillStyle = '#e8d8d8';
    const rx = W - Math.max(60 * pr, 10 * u);
    ctx.fillText(`☠ ${G.kills}`, rx, barH + 18 * u);
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`● ${G.gold}`, rx, barH + 32 * u);

    // ── 보스 체력 (하단) ──
    const b = G.boss;
    if (b && (b.alive || b.deadT < 1.2)) {
        const ratio = Math.max(0, b.hp / b.maxHp);
        bossTrail = Math.max(ratio, bossTrail - 0.004);
        if (bossTrail < ratio) bossTrail = ratio;
        const bw = Math.min(W * 0.7, 520 * u), bh = 12 * u;
        const bx = (W - bw) / 2, by = screen.h - 34 * u;
        ctx.fillStyle = '#0d0205';
        ctx.fillRect(bx - 3 * u, by - 3 * u, bw + 6 * u, bh + 6 * u);
        ctx.fillStyle = '#f2e6e8';
        ctx.fillRect(bx, by, bw * bossTrail, bh);
        ctx.fillStyle = b.phase >= 2 ? '#ff0022' : '#a8102a';
        ctx.fillRect(bx, by, bw * ratio, bh);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        for (const t of [0.6, 0.25]) ctx.fillRect(bx + bw * t - u, by, 2 * u, bh);
        ctx.strokeStyle = '#6b0a1c';
        ctx.lineWidth = 2 * u;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.textAlign = 'center';
        ctx.font = `${8 * u}px ${FONT}`;
        ctx.fillStyle = '#ffccd4';
        ctx.fillText(b.def.name + (b.phase ? ` — PHASE ${b.phase + 1}` : ''), W / 2, by - 10 * u);
    } else bossTrail = 1;
}
