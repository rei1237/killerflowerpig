// 전투 지도(미니맵): 연이 중심 주변을 위에서 내려다본다. 탭/클릭 한 번 또는 M 키로 켜고 끈다(설정에 기억).
// 표시: 연이(분홍 화살표)·영냥이(보라)·적(빨강, 엘리트는 크게)·보스(맥박)·보급품(금빛 별, 범위 밖이면 가장자리 화살표)·상자·회복·다이너마이트·포위 안개.
import { G } from '../game/state.js';
import { settings, setSetting } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { FIELD_ITEM, fieldItemsLeft } from '../game/field-items.js';

export const MINIMAP = Object.freeze({ range: 1100, maxEnemies: 220 });
const $ = id => document.getElementById(id);
let canvas = null, ctx = null, dpr = 1, size = 0;

export function minimapOn() { return settings.minimap !== false; }
export function toggleMinimap(on = !minimapOn()) {
    setSetting('minimap', !!on);
    syncMinimapButton();
    return minimapOn();
}
export function syncMinimapButton() {
    const b = $('btn-map');
    if (!b) return;
    const on = minimapOn();
    b.classList?.toggle('is-off', !on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '지도 끄기 (M)' : '지도 켜기 (M)');
    const label = $('map-state');
    if (label) label.textContent = on ? '지도 끄기' : '지도 켜기';
}
export function initMinimap() {
    const b = $('btn-map');
    if (!b) return;
    b.addEventListener('click', () => { audio.sfx('click'); toggleMinimap(); });
    window.addEventListener('keydown', e => {
        if (e.code !== 'KeyM' || e.repeat || e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
        if (!['play', 'boss', 'clearing'].includes(G.mode) || G.paused) return;
        toggleMinimap(); e.preventDefault();
    });
    syncMinimapButton();
}

function ensureCanvas() {
    canvas ||= $('minimap');
    if (!canvas?.getContext) return null;
    const css = canvas.clientWidth || 168, ratio = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    if (css !== size || ratio !== dpr) {
        size = css; dpr = ratio;
        canvas.width = Math.round(css * ratio); canvas.height = Math.round(css * ratio);
        ctx = null;
    }
    ctx ||= canvas.getContext('2d');
    return ctx;
}

// 월드 → 지도 좌표 (연이 중심, 원 밖은 테두리로 밀어낸다)
function project(x, y, cx, cy, r, scale, clamp = false) {
    let dx = (x - cx) * scale, dy = (y - cy) * scale;
    const d = Math.hypot(dx, dy);
    const out = d > r;
    if (out && clamp) { dx *= r / d; dy *= r / d; }
    return { x: r + dx, y: r + dy, out };
}

let lastSupply = -1;
// 이 구역에 남은 보급품 수 (지도를 꺼도 버튼에 보인다)
function syncSupplyBadge() {
    const n = G.player ? fieldItemsLeft() : 0;
    if (n === lastSupply) return;
    lastSupply = n;
    const badge = $('map-supply');
    if (!badge) return;
    badge.hidden = !n;
    badge.textContent = `📦 ${n}`;
    badge.title = `이 구역에 남은 장비 보급품 ${n}개`;
}
export function drawMinimap() {
    syncSupplyBadge();
    if (!minimapOn() || !G.player) return false;
    const c = ensureCanvas();
    if (!c) return false;
    const p = G.player, R = size / 2, scale = R / MINIMAP.range, t = G.clock;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0a1016e6'; c.fillRect(0, 0, size, size);
    // 거리 고리 + 지금 화면에 보이는 범위
    c.strokeStyle = '#ffffff14'; c.lineWidth = 1;
    for (const k of [1 / 3, 2 / 3]) { c.beginPath(); c.arc(R, R, R * k, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = '#ffffff2e';
    const vw = G.view.w * scale, vh = G.view.h * scale, cam = project(G.camera.x, G.camera.y, p.x, p.y, R, scale);
    c.strokeRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);
    const ring = G.encirclement;
    if (ring) { const o = project(ring.x, ring.y, p.x, p.y, R, scale); c.strokeStyle = '#b5df56aa'; c.lineWidth = 1.5; c.beginPath(); c.arc(o.x, o.y, ring.radius * scale, 0, Math.PI * 2); c.stroke(); }
    // 적
    let drawn = 0;
    const pool = G.enemies;
    for (let i = 0; i < pool.count && drawn < MINIMAP.maxEnemies; i++) {
        const e = pool.items[i];
        if (!e.alive) continue;
        const o = project(e.x, e.y, p.x, p.y, R, scale);
        if (o.out) continue;
        drawn++;
        c.fillStyle = e.elite ? '#ff9a4a' : '#e8475e';
        const s = e.elite ? 4 : 2;
        c.fillRect(o.x - s / 2, o.y - s / 2, s, s);
    }
    // 바닥 물자
    for (let i = 0; i < G.pickups.count; i++) {
        const it = G.pickups.items[i];
        if (it.kind === 'coin' || it.kind === FIELD_ITEM.kind) continue;
        const o = project(it.x, it.y, p.x, p.y, R, scale);
        if (o.out) continue;
        c.fillStyle = it.kind === 'chest' ? '#ffd76a' : it.kind === 'meat' ? '#71ffae' : it.kind === 'bomb' ? '#ff7a1a' : '#9fd8ff';
        c.fillRect(o.x - 2.5, o.y - 2.5, 5, 5);
    }
    // 보스
    const b = G.boss;
    if (b?.alive) {
        const o = project(b.x, b.y, p.x, p.y, R - 6, scale, true);
        c.fillStyle = '#ff2244'; c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.3;
        c.beginPath(); c.arc(o.x + 6, o.y + 6, 7, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('☠', o.x + 6, o.y + 6.5);
    }
    // 보급품: 범위 밖이어도 테두리에 붙여 방향을 알려 준다
    for (let i = 0; i < G.pickups.count; i++) {
        const it = G.pickups.items[i];
        if (it.kind !== FIELD_ITEM.kind) continue;
        const o = project(it.x, it.y, p.x, p.y, R - 7, scale, true), x = o.x + 7, y = o.y + 7, pulse = 1 + Math.sin(t * 5) * 0.2;
        c.fillStyle = '#ffe28a'; c.strokeStyle = '#3a2a10'; c.lineWidth = 1.5;
        star(c, x, y, 6 * pulse, 2.6 * pulse); c.fill(); c.stroke();
    }
    // 영냥이 · 연이
    const q = G.coop ? G.partner : null;
    if (q) {
        const o = project(q.x, q.y, p.x, p.y, R - 4, scale, true);
        c.fillStyle = q.dead ? '#6b6478' : '#c9a7ff'; c.strokeStyle = '#140f20'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(o.x + 4, o.y + 4, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    const a = Math.atan2(p.facingY || 0, p.facingX || 1);
    c.translate(R, R); c.rotate(a);
    c.fillStyle = '#ff8fb0'; c.strokeStyle = '#140f20'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-2, 0); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.strokeStyle = '#c9d6dd55'; c.lineWidth = 1.5; c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.stroke();
    return true;
}
function star(c, x, y, outer, inner) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? inner : outer, a = -Math.PI / 2 + i * Math.PI / 5;
        i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
}
