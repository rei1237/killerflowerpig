import { drawEncirclement, updateEncirclementCamera } from './encirclement.js';
import { drawPets } from './pets.js';
// 월드 렌더링. 캔버스 1장, 레이어 순서로 그리며 화면 밖 객체는 컬링.
import { G, VIEW_H, setVisualTier } from './state.js';
import { STAGES } from '../data/stages.js';
import { images, fx, makeCanvas, makeGroundTile, vignette, hurtEdge, glow } from '../core/assets.js';
import { settings, goreProfile, onSettingsChange } from '../core/settings.js';
import { input } from '../core/input.js';
import { drawDecals, drawParticles, drawTexts } from './effects.js';
import { drawHazards } from './hazards.js';
import { drawPickups } from './pickups.js';
import { drawEnemy, drawEnemyShots } from './enemies.js';
import { drawAffixRings } from './affixes.js';
import { drawPlayer } from './player.js';
import { drawShots } from './weapons.js';
import { drawHUD } from '../ui/hud.js';
import { focusedTarget, tapFocusAt } from './targeting.js';
import { drawGroundProps, collectTallProps, drawProp, drawPropLights, drawAmbient, invalidateScenery } from './scenery.js';

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)');
let canvas, ctx;
let backdrop = null;
let groundPattern = null;
let groundStage = 0;
let frameValid = false, framePlayer = null, frameClock = -1, frameMode = '', frameStage = -1, frameJoy = false, frameVisuals;
let costStart = 0, costSum = 0, costSamples = 0, slowWindows = 0, fastWindows = 0, lastTierChange = -Infinity;
export const screen = { w: 0, h: 0, pr: 1, zoom: 1, cssW: 0, cssH: 0, worldTx: 0, worldTy: 0 };

onSettingsChange(() => { frameValid = false; costStart = costSum = costSamples = slowWindows = fastWindows = 0; });

// Caller measures only render CPU time. Conservative auto-mode fallback with
// separate degradation/recovery windows; no inference about actual display FPS.
export function observeRenderCost(renderMs, nowMs = performance.now()) {
    if (settings.quality !== 'auto' || G.paused || G.mode === 'idle' || document.hidden || !Number.isFinite(renderMs) || renderMs < 0) {
        costStart = costSum = costSamples = slowWindows = fastWindows = 0;
        return;
    }
    if (!costSamples) costStart = nowMs;
    costSum += Math.min(renderMs, 100);
    costSamples++;
    if (nowMs - costStart < 1000 || costSamples < 30) return;
    const mean = costSum / costSamples;
    costStart = costSum = costSamples = 0;
    slowWindows = mean > 12 ? slowWindows + 1 : 0;
    fastWindows = mean < 5 ? fastWindows + 1 : 0;
    if (nowMs - lastTierChange < 8000) return;
    const base = G.lowQ ? 1 : 0;
    const tier = G.visuals.tier;
    const next = slowWindows >= 2 ? Math.min(2, tier + 1) : fastWindows >= 5 ? Math.max(base, tier - 1) : tier;
    if (next === tier) return;
    setVisualTier(next);
    lastTierChange = nowMs;
    slowWindows = fastWindows = 0;
    resize();
}

export function initRender(c) {
    canvas = c;
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    input.onTap = (x, y) => {
        const point = clientToWorld(x, y);
        if (!point || !input.enabled) return;
        tapFocusAt(point.x, point.y, 8 / (screen.zoom / screen.pr));
        frameValid = false;
    };
}

// Invert the exact last rendered world transform, including camera/shake and
// CSS scaling. Client coordinates are CSS pixels; DPR must never be counted twice.
export function clientToWorld(clientX, clientY) {
    if (!canvas || !screen.zoom) return null;
    const rect = canvas.getBoundingClientRect?.() || { left: 0, top: 0, width: screen.cssW, height: screen.cssH };
    if (!rect.width || !rect.height) return null;
    return { x: ((clientX - rect.left) * canvas.width / rect.width - screen.worldTx) / screen.zoom,
        y: ((clientY - rect.top) * canvas.height / rect.height - screen.worldTy) / screen.zoom };
}

export function resize() {
    if (!canvas) return;
    const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    const pr = Math.min(dpr, G.visuals.maxDpr);
    screen.cssW = cssW; screen.cssH = cssH; screen.pr = pr;
    screen.w = canvas.width = Math.round(cssW * pr);
    screen.h = canvas.height = Math.round(cssH * pr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    // 짧은 변 기준으로 월드 600 단위가 보이도록 → 가로/세로·기기와 무관하게 비슷한 난이도
    // Logical view stays identical when raster resolution changes.
    const logicalZoom = Math.min(cssW, cssH) / VIEW_H;
    screen.zoom = logicalZoom * pr;
    G.view.w = cssW / logicalZoom;
    G.view.h = cssH / logicalZoom;
    screen.worldTx = (G.view.w / 2 - G.camera.x) * screen.zoom;
    screen.worldTy = (G.view.h / 2 - G.camera.y) * screen.zoom;
    backdrop = null;
    frameValid = false;
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

export function invalidateStageVisuals() { backdrop = null; groundPattern = null; frameValid = false; invalidateScenery(); }

const drawList = [];
const byY = (a, b) => a.y - b.y;

export function render(dt) {
    if (!ctx || document.hidden) return;
    const cam = G.camera;
    const p = G.player;
    const frozen = G.paused || G.mode === 'idle';
    if (frozen && frameValid && framePlayer === p && frameClock === G.clock && frameMode === G.mode && frameStage === G.stage && frameJoy === input.joy.active && frameVisuals === G.visuals) return;
    frameValid = true; framePlayer = p; frameClock = G.clock; frameMode = G.mode; frameStage = G.stage; frameJoy = input.joy.active; frameVisuals = G.visuals;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // 플레이 중에는 불투명 바닥이 화면 전체를 덮으므로 배경 그림은 생략 (전체 화면 합성 1회 절약)
    if (!p) { if (!backdrop) buildBackdrop(); ctx.drawImage(backdrop, 0, 0); return; }
    ensureGround();

    // 카메라 (부드럽게 추적 + 흔들림)
    const enclosed = updateEncirclementCamera(dt);
    // A fixed active camera must not shake the far fog edge outside mobile view.
    const sh = enclosed || reducedMotion?.matches ? 0 : G.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0;
    const sy = sh ? (Math.random() - 0.5) * sh : 0;
    const z = screen.zoom;
    const hw = G.view.w / 2, hh = G.view.h / 2;
    const vx0 = cam.x - hw - 60, vx1 = cam.x + hw + 60;
    const vy0 = cam.y - hh - 60, vy1 = cam.y + hh + 120;
    screen.worldTx = (hw - cam.x + sx) * z;
    screen.worldTy = (hh - cam.y + sy) * z;
    ctx.setTransform(z, 0, 0, z, screen.worldTx, screen.worldTy);

    // 1. 바닥
    // 불투명 바닥은 정확히 보이는 영역(+흔들림 여유)만 칠한다. 컬링용 vx0..vy1 은 여유를 더 둔 별도 범위.
    const pad = 2 + Math.abs(sx) + Math.abs(sy);
    ctx.fillStyle = groundPattern;
    ctx.fillRect(cam.x - hw - pad, cam.y - hh - pad, G.view.w + pad * 2, G.view.h + pad * 2);

    // 1.5 바닥 소품 (핏물 웅덩이·뼈 더미) — 데칼 아래
    drawGroundProps(ctx, vx0, vy0, vx1, vy1);

    // 2~4. 데칼, 장판, 젬
    drawDecals(ctx, vx0, vy0, vx1, vy1);
    drawHazards(ctx);
    drawEncirclement(ctx);
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
    // 5.5 변이 고리 (색별 일괄)
    drawAffixRings(ctx, drawList);

    // 6. Y 정렬 캐릭터
    drawList.push(p);
    if (boss) drawList.push(boss);
    collectTallProps(drawList, vx0, vy0, vx1, vy1);
    drawList.sort(byY);
    for (let i = 0; i < drawList.length; i++) {
        const o = drawList[i];
        if (o === p) drawPlayer(ctx);
        else if (o === boss) boss.draw(ctx);
        else if (o.isProp) drawProp(ctx, o);
        else drawEnemy(ctx, o);
    }

    drawPets(ctx, images.petYeongnyang);

    // 소품 빛 번짐 (가로등·네온·독 드럼통)
    drawPropLights(ctx);

    // 7. 투사체
    drawShots(ctx);
    // Hostile projectiles stay legible above friendly beam effects.
    drawEnemyShots(ctx, fx);

    // 8~9. 파티클, 숫자
    drawParticles(ctx, vx0, vy0, vx1, vy1);
    drawTexts(ctx, vx0, vy0, vx1, vy1);
    drawFocusMarker(vx0, vy0, vx1, vy1);

    // 플레이어 주변 약한 빛 (가산)
    if (G.visuals.playerGlow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.12;
        const lg = glow('#ff8fb0', 64);
        ctx.drawImage(lg, p.x - 110, p.y - 120, 220, 200);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // ---- 화면 공간 ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 스테이지 안개 색 + 비네트를 한 장으로 미리 합성해 둔 오버레이
    const st = STAGES[G.stage];
    // 최저 화질 단계에서는 전체 화면 합성 1회를 아끼기 위해 안개·비네트 오버레이를 생략
    drawAmbient(ctx, screen, cam);
    if (G.visuals.vignette) ctx.drawImage(vignette(screen.w, screen.h, st ? st.fog : null), 0, 0);

    // 저체력/피격: 혈관이 뻗은 붉은 가장자리
    const hpR = p.hp / p.maxHp;
    let edge = p.hurtT > 0 ? p.hurtT * 3 : 0;
    if (hpR < 0.35 && !p.dead) edge = Math.max(edge, (0.35 - hpR) * 2.4 * (reducedMotion?.matches ? 0.8 : 0.6 + 0.4 * Math.sin(G.clock * (6 + (0.35 - hpR) * 20))));
    if (goreProfile().screenBlood && hpR < 0.2) edge = Math.max(edge, 0.7);
    if (edge > 0.01) {
        ctx.globalAlpha = Math.min(1, edge);
        ctx.drawImage(hurtEdge(screen.w, screen.h), 0, 0);
        ctx.globalAlpha = 1;
    }

    // 환각 (사이코틱 킹/얼티메이트 원)
    if (G.hallucinate > 0) {
        ctx.globalCompositeOperation = 'difference';
        ctx.globalAlpha = reducedMotion?.matches ? 0.18 : 0.18 + Math.sin(G.clock * 2.3) * 0.12;
        ctx.fillStyle = '#ff40c0';
        ctx.fillRect(0, 0, screen.w, screen.h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    if (G.flash > 0 && !reducedMotion?.matches) {
        ctx.globalAlpha = Math.min(0.85, G.flash);
        ctx.fillStyle = G.flashColor;
        ctx.fillRect(0, 0, screen.w, screen.h);
        ctx.globalAlpha = 1;
    }

    drawHUD(ctx, screen);
    drawJoystick();
}

function drawFocusMarker(vx0, vy0, vx1, vy1) {
    const target = focusedTarget();
    if (!target || target.x < vx0 || target.x > vx1 || target.y < vy0 || target.y > vy1) return;
    const unit = screen.pr / screen.zoom;
    const radius = Math.max(12, target.radius || 16) + 4 * unit;
    const label = `집중 · ${(target.def?.name || (target === G.boss ? '보스' : '적')).slice(0, 18)}`;
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffe5a3'; ctx.lineWidth = 2 * unit;
    ctx.beginPath(); ctx.ellipse(target.x, target.y, radius, radius * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `bold ${11 * unit}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 12 * unit;
    const top = target.y - (target.radius || 16) * 2 - 18 * unit;
    ctx.fillStyle = '#11172ee8'; ctx.fillRect(target.x - width / 2, top - 8 * unit, width, 16 * unit);
    ctx.fillStyle = '#ffe5a3'; ctx.fillText(label, target.x, top);
    ctx.restore();
}

function drawJoystick() {
    const j = input.joy;
    if (!j.active) return;
    const pr = screen.pr;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#a5edcd';
    ctx.lineWidth = 3 * pr;
    ctx.beginPath(); ctx.arc(j.ox * pr, j.oy * pr, j.radius * pr, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#568e7e';
    ctx.beginPath(); ctx.arc(j.x * pr, j.y * pr, 22 * pr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
}
