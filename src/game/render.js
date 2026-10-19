// 월드 렌더링. 캔버스 1장, 레이어 순서로 그리며 화면 밖 객체는 컬링.
import { G, VIEW_H } from './state.js';
import { STAGES } from '../data/stages.js';
import { images, fx, makeCanvas, makeGroundTile, vignette, hurtEdge, glow } from '../core/assets.js';
import { goreProfile } from '../core/settings.js';
import { input } from '../core/input.js';
import { drawDecals, drawParticles, drawTexts } from './effects.js';
import { drawHazards } from './hazards.js';
import { drawPickups } from './pickups.js';
import { drawEnemy, drawEnemyShots } from './enemies.js';
import { drawPlayer } from './player.js';
import { drawShots } from './weapons.js';
import { drawHUD } from '../ui/hud.js';

let canvas, ctx;
let backdrop = null;
let groundPattern = null;
let groundStage = 0;
export const screen = { w: 0, h: 0, pr: 1, zoom: 1, cssW: 0, cssH: 0 };

export function initRender(c) {
    canvas = c;
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
}

export function resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const pr = G.lowQ ? Math.min(dpr, 1) : Math.min(dpr, 2);
    screen.cssW = cssW; screen.cssH = cssH; screen.pr = pr;
    screen.w = canvas.width = Math.round(cssW * pr);
    screen.h = canvas.height = Math.round(cssH * pr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    // 짧은 변 기준으로 월드 600 단위가 보이도록 → 가로/세로·기기와 무관하게 비슷한 난이도
    screen.zoom = Math.min(screen.w, screen.h) / VIEW_H;
    G.view.w = screen.w / screen.zoom;
    G.view.h = screen.h / screen.zoom;
    backdrop = null;
}

function buildBackdrop() {
    const st = STAGES[G.stage] || STAGES[1];
    const c = makeCanvas(screen.w, screen.h);
    const g = c.getContext('2d');
    g.fillStyle = '#050304';
    g.fillRect(0, 0, c.width, c.height);
    const img = images[st.bg];
    if (img) {
        const s = Math.max(c.width / img.width, c.height / img.height);
        g.globalAlpha = 0.9;
        g.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s);
        g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(5,0,2,0.55)';
    g.fillRect(0, 0, c.width, c.height);
    backdrop = c;
}

function ensureGround() {
    if (groundPattern && groundStage === G.stage) return;
    const gs = (STAGES[G.stage] || STAGES[1]).ground;
    const tile = makeGroundTile(gs.seed * 977, gs.base, gs.stain, gs.crack);
    groundPattern = ctx.createPattern(tile, 'repeat');
    groundStage = G.stage;
}

export function invalidateStageVisuals() { backdrop = null; groundPattern = null; }

const drawList = [];
const byY = (a, b) => a.y - b.y;

export function render(dt) {
    if (!ctx) return;
    const cam = G.camera;
    const p = G.player;
    if (!backdrop) buildBackdrop();
    ensureGround();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // 플레이 중에는 불투명 바닥이 화면 전체를 덮으므로 배경 그림은 생략 (전체 화면 합성 1회 절약)
    if (!p) { ctx.drawImage(backdrop, 0, 0); return; }

    // 카메라 (부드럽게 추적 + 흔들림)
    const k = Math.min(1, dt * 10);
    cam.x += (p.x - cam.x) * k;
    cam.y += (p.y - 20 - cam.y) * k;
    const sh = G.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0;
    const sy = sh ? (Math.random() - 0.5) * sh : 0;
    const z = screen.zoom;
    const hw = G.view.w / 2, hh = G.view.h / 2;
    const vx0 = cam.x - hw - 60, vx1 = cam.x + hw + 60;
    const vy0 = cam.y - hh - 60, vy1 = cam.y + hh + 120;
    ctx.setTransform(z, 0, 0, z, (hw - cam.x + sx) * z, (hh - cam.y + sy) * z);

    // 1. 바닥
    ctx.fillStyle = groundPattern;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

    // 2~4. 데칼, 장판, 젬
    drawDecals(ctx, vx0, vy0, vx1, vy1);
    drawHazards(ctx);
    drawPickups(ctx, vx0, vy0, vx1, vy1);

    // 5. 그림자 (한 번의 path 로 일괄)
    drawList.length = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
        drawList.push(e);
        if (e.alive) {
            ctx.moveTo(e.x + e.radius, e.y);
            ctx.ellipse(e.x, e.y, e.radius, e.radius * 0.35, 0, 0, Math.PI * 2);
        }
    }
    ctx.moveTo(p.x + 14, p.y);
    ctx.ellipse(p.x, p.y, 14, 5, 0, 0, Math.PI * 2);
    const boss = G.boss;
    if (boss) {
        ctx.moveTo(boss.x + boss.radius * 1.3, boss.y);
        ctx.ellipse(boss.x, boss.y, boss.radius * 1.3, boss.radius * 0.4, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // 6. Y 정렬 캐릭터
    drawList.push(p);
    if (boss) drawList.push(boss);
    drawList.sort(byY);
    for (let i = 0; i < drawList.length; i++) {
        const o = drawList[i];
        if (o === p) drawPlayer(ctx);
        else if (o === boss) boss.draw(ctx);
        else drawEnemy(ctx, o);
    }

    // 7. 투사체
    drawEnemyShots(ctx, fx);
    drawShots(ctx);

    // 8~9. 파티클, 숫자
    drawParticles(ctx, vx0, vy0, vx1, vy1);
    drawTexts(ctx);

    // 플레이어 주변 약한 빛 (가산)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12;
    const lg = glow('#ff8fb0', 64);
    ctx.drawImage(lg, p.x - 110, p.y - 120, 220, 200);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // ---- 화면 공간 ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 스테이지 안개 색 + 비네트를 한 장으로 미리 합성해 둔 오버레이
    const st = STAGES[G.stage];
    ctx.drawImage(vignette(screen.w, screen.h, st ? st.fog : null), 0, 0);

    // 저체력/피격: 혈관이 뻗은 붉은 가장자리
    const hpR = p.hp / p.maxHp;
    let edge = p.hurtT > 0 ? p.hurtT * 3 : 0;
    if (hpR < 0.35 && !p.dead) edge = Math.max(edge, (0.35 - hpR) * 2.4 * (0.6 + 0.4 * Math.sin(G.clock * (6 + (0.35 - hpR) * 20))));
    if (goreProfile().screenBlood && hpR < 0.2) edge = Math.max(edge, 0.7);
    if (edge > 0.01) {
        ctx.globalAlpha = Math.min(1, edge);
        ctx.drawImage(hurtEdge(screen.w, screen.h), 0, 0);
        ctx.globalAlpha = 1;
    }

    // 환각 (사이코틱 킹/얼티메이트 원)
    if (G.hallucinate > 0) {
        ctx.globalCompositeOperation = 'difference';
        ctx.globalAlpha = 0.18 + Math.sin(G.clock * 2.3) * 0.12;
        ctx.fillStyle = '#ff40c0';
        ctx.fillRect(0, 0, screen.w, screen.h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    if (G.flash > 0) {
        ctx.globalAlpha = Math.min(0.85, G.flash);
        ctx.fillStyle = G.flashColor;
        ctx.fillRect(0, 0, screen.w, screen.h);
        ctx.globalAlpha = 1;
    }

    drawHUD(ctx, screen);
    drawJoystick();
}

function drawJoystick() {
    const j = input.joy;
    if (!j.active) return;
    const pr = screen.pr;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ff4a6a';
    ctx.lineWidth = 3 * pr;
    ctx.beginPath(); ctx.arc(j.ox * pr, j.oy * pr, j.radius * pr, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#8b0d22';
    ctx.beginPath(); ctx.arc(j.x * pr, j.y * pr, 22 * pr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
}
