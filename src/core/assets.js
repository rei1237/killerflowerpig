// 에셋 로딩 + 런타임 사전 렌더링 캐시.
// - 아틀라스마다 색조 변형(일반/피격 플래시/엘리트 등)과 좌우 반전본을 로드 시 1회 생성
//   → 매 프레임 ctx.filter / shadowBlur / scale(-1,1) 없이 drawImage 한 번으로 그린다.
// - 글로우·핏자국·젬 등 절차적 스프라이트도 오프스크린 캔버스로 미리 그려 둔다.
import { SPRITES } from '../data/sprites.js';
import { BOSS_ART } from '../game/boss-appearance.js';

export const images = {};
export const atlases = {};

export function loadImage(src, { signal, timeoutMs = 20000 } = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let settled = false;
        let timeout;
        const finish = (image, aborted = false) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            img.onload = img.onerror = null;
            signal?.removeEventListener('abort', abort);
            if (!image) img.removeAttribute?.('src');
            if (aborted) reject(new DOMException('Asset loading was cancelled', 'AbortError'));
            else resolve(image);
        };
        const abort = () => finish(null, true);
        if (signal?.aborted) return abort();
        img.decoding = 'async';
        img.onload = () => finish(img);
        img.onerror = () => finish(null);
        signal?.addEventListener('abort', abort, { once: true });
        timeout = setTimeout(() => finish(null), Math.max(1, Math.min(60000, timeoutMs || 20000)));
        img.src = src;
    });
}

export function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}

const TINTS = {
    normal: null,
    flash: { color: '#ffffff', alpha: 0.72, mode: 'source-atop' },
    elite: { color: '#ff1a1a', alpha: 0.38, mode: 'source-atop' },
    toxic: { color: '#5cff3a', alpha: 0.32, mode: 'source-atop' },
    bloat: { color: '#b04aff', alpha: 0.35, mode: 'source-atop' },
    pale: { color: '#d8e4ff', alpha: 0.3, mode: 'source-atop' },
    shadow: { color: '#000000', alpha: 0.55, mode: 'source-atop' },
    hallu: { color: '#ff3df2', alpha: 0.45, mode: 'source-atop' },
};

class Atlas {
    constructor(img, meta) {
        this.img = img;
        this.meta = meta;
        this.w = meta.w;
        this.h = meta.h;
        this.walkH = meta.walkH;
        this.anims = meta.anims;
        // 반전 프레임 좌표 미리 계산
        for (const frames of Object.values(this.anims)) {
            for (const f of frames) {
                f.fsx = this.w - f.sx - f.sw;
                f.fox = f.sw - f.ox;
            }
        }
        this.variants = {};
    }

    variant(key) {
        let v = this.variants[key];
        if (v) return v;
        const base = makeCanvas(this.w, this.h);
        const g = base.getContext('2d');
        g.drawImage(this.img, 0, 0);
        const t = TINTS[key];
        if (t) {
            g.globalCompositeOperation = t.mode;
            g.globalAlpha = t.alpha;
            g.fillStyle = t.color;
            g.fillRect(0, 0, this.w, this.h);
        }
        const flipped = makeCanvas(this.w, this.h);
        const fg = flipped.getContext('2d');
        fg.translate(this.w, 0);
        fg.scale(-1, 1);
        fg.drawImage(base, 0, 0);
        v = this.variants[key] = { base, flipped };
        return v;
    }

    // (x, y) = 발 위치(몸통 중심). scale = 출력 배율
    draw(ctx, anim, frame, x, y, scale, flip, tint = 'normal') {
        const frames = this.anims[anim] || this.anims.walk;
        const f = frames[frame % frames.length];
        const v = this.variant(tint);
        const w = f.sw * scale, h = f.sh * scale;
        if (flip) {
            ctx.drawImage(v.flipped, f.fsx, f.sy, f.sw, f.sh, x - f.fox * scale, y - h, w, h);
        } else {
            ctx.drawImage(v.base, f.sx, f.sy, f.sw, f.sh, x - f.ox * scale, y - h, w, h);
        }
    }

    frameCount(anim) { return (this.anims[anim] || this.anims.walk).length; }
}

// ---------------------------------------------------------------------------
// 절차적 스프라이트 캐시
// ---------------------------------------------------------------------------
const glowCache = new Map();
export function glow(color, radius = 32) {
    const key = color + radius;
    let c = glowCache.get(key);
    if (c) return c;
    c = makeCanvas(radius * 2, radius * 2);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + '88');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    glowCache.set(key, c);
    return c;
}

function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 핏자국 데칼: 불규칙한 웅덩이 + 튄 방울
function makeSplat(seed, color, size) {
    const r = rng(seed);
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    g.fillStyle = color;
    g.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = size * (0.18 + r() * 0.14);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.7;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.fill();
    for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2, d = size * (0.22 + r() * 0.26);
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 1 + r() * size * 0.05, 1 + r() * size * 0.035, a, 0, Math.PI * 2);
        g.fill();
    }
    // 젖은 하이라이트
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.ellipse(cx - size * 0.06, cy - size * 0.05, size * 0.08, size * 0.04, -0.4, 0, Math.PI * 2);
    g.fill();
    return c;
}

function makeGem(fill, edge, size) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const h = size / 2;
    g.fillStyle = edge;
    g.beginPath();
    g.moveTo(h, 1); g.lineTo(size - 2, h); g.lineTo(h, size - 1); g.lineTo(2, h);
    g.closePath(); g.fill();
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(h, 3); g.lineTo(size - 4, h); g.lineTo(h, size - 3); g.lineTo(4, h);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fillRect(h - 2, 4, 2, size * 0.25);
    return c;
}

function makeBullet(color, len, wid) {
    const c = makeCanvas(len + 8, wid + 8);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(c.width / 2, c.height / 2, len / 2, wid / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(c.width / 2 + len * 0.15, c.height / 2, len * 0.25, wid * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    return c;
}

function makePetal(color, size) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    for (let i = 0; i < 5; i++) {
        g.rotate(Math.PI * 2 / 5);
        g.fillStyle = i % 2 ? color : '#ffd1e8';
        g.beginPath();
        g.ellipse(0, -size * 0.22, size * 0.13, size * 0.24, 0, 0, Math.PI * 2);
        g.fill();
    }
    g.fillStyle = '#7a0030';
    g.beginPath(); g.arc(0, 0, size * 0.1, 0, Math.PI * 2); g.fill();
    return c;
}

function makeSaw(size, color) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const h = size / 2;
    g.translate(h, h);
    g.fillStyle = color;
    g.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 ? h * 0.72 : h * 0.98;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#3a2420';
    g.beginPath(); g.arc(0, 0, h * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8b0000';
    g.beginPath(); g.arc(h * 0.35, -h * 0.5, h * 0.12, 0, Math.PI * 2); g.fill();
    return c;
}

function makeChest(size) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    // 살점으로 감싼 관(棺) 상자
    g.fillStyle = '#3b1010';
    g.fillRect(4, size * 0.3, size - 8, size * 0.6);
    g.fillStyle = '#6b1a1a';
    g.fillRect(4, size * 0.18, size - 8, size * 0.2);
    g.fillStyle = '#c9a54a';
    g.fillRect(size / 2 - 4, size * 0.32, 8, 10);
    g.strokeStyle = '#b3243a'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(6, size * (0.45 + i * 0.13));
        g.bezierCurveTo(size * 0.3, size * (0.4 + i * 0.13), size * 0.6, size * (0.52 + i * 0.13), size - 6, size * (0.46 + i * 0.13));
        g.stroke();
    }
    return c;
}

function makeMeat(size) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    g.fillStyle = '#8c1c24';
    g.beginPath(); g.ellipse(size * 0.45, size * 0.5, size * 0.33, size * 0.26, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d4485a';
    g.beginPath(); g.ellipse(size * 0.42, size * 0.46, size * 0.22, size * 0.15, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe6d2';
    g.fillRect(size * 0.68, size * 0.28, size * 0.22, size * 0.1);
    g.beginPath(); g.arc(size * 0.9, size * 0.28, size * 0.07, 0, Math.PI * 2); g.fill();
    return c;
}

function makeIcon(emoji, size, bg) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, size, size);
    }
    g.font = `${Math.floor(size * 0.7)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, size / 2, size / 2 + size * 0.05);
    return c;
}

const iconCache = new Map();
export function icon(emoji, size = 28) {
    const k = emoji + size;
    let c = iconCache.get(k);
    if (!c) { c = makeIcon(emoji, size); iconCache.set(k, c); }
    return c;
}

// 비네트(가장자리 어둡게) — 화면 크기 바뀔 때만 재생성
let vignetteCanvas = null;
let vignetteKey = '';
export function vignette(w, h, fog) {
    const key = `${Math.ceil(w)}x${Math.ceil(h)}:${fog}`;
    if (vignetteCanvas && vignetteKey === key) return vignetteCanvas;
    vignetteKey = key;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    if (fog) { g.fillStyle = fog; g.fillRect(0, 0, w, h); }
    const r = Math.hypot(w, h) / 2;
    const grad = g.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(10,0,2,0.45)');
    grad.addColorStop(1, 'rgba(20,0,4,0.9)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    vignetteCanvas = c;
    return c;
}

// 붉은 피격 가장자리 (저체력 맥동용)
let hurtCanvas = null;
export function hurtEdge(w, h) {
    if (hurtCanvas && hurtCanvas.width === Math.ceil(w) && hurtCanvas.height === Math.ceil(h)) return hurtCanvas;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const r = Math.hypot(w, h) / 2;
    const grad = g.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
    grad.addColorStop(0, 'rgba(140,0,10,0)');
    grad.addColorStop(1, 'rgba(160,0,12,0.85)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // 혈관 줄기
    const rand = rng(7);
    g.strokeStyle = 'rgba(90,0,8,0.7)';
    for (let i = 0; i < 26; i++) {
        const side = i % 4;
        let x = side === 0 ? 0 : side === 1 ? w : rand() * w;
        let y = side === 2 ? 0 : side === 3 ? h : rand() * h;
        g.lineWidth = 1 + rand() * 3;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
            x += (w / 2 - x) * 0.08 + (rand() - 0.5) * 40;
            y += (h / 2 - y) * 0.08 + (rand() - 0.5) * 40;
            g.lineTo(x, y);
            g.lineWidth *= 0.8;
        }
        g.stroke();
    }
    hurtCanvas = c;
    return c;
}

// 스테이지별 바닥 타일(절차 생성): 균열 아스팔트, 마른 핏자국, 잔해. 384px 반복(경계 이음매 없음).
export function makeGroundTile(seed, base, stain, crack) {
    const S = 512; // 타일이 클수록 반복이 덜 눈에 띈다
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // 타일 경계에서 감싸도록 9방향 복제해서 그리는 헬퍼
    const wrap = (fn) => { for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) fn(ox, oy); };
    // 큰 명암 얼룩
    for (let i = 0; i < 40; i++) {
        const x = r() * S, y = r() * S, rad = 30 + r() * 70, a = 0.05 + r() * 0.08;
        const dark = r() < 0.6;
        wrap((ox, oy) => {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
            gr.addColorStop(0, dark ? `rgba(0,0,0,${a * 2})` : `rgba(255,255,255,${a * 0.5})`);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
        });
    }
    // 보도블록/타일 줄눈 (희미하게)
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.lineWidth = 2;
    for (let y = 0; y < S; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let y = 0; y < S; y += 48) {
        const off = (y / 48) % 2 ? 48 : 0;
        for (let x = off; x < S; x += 96) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 48); g.stroke(); }
    }
    // 스테이지 색 얼룩 (독, 피 등)
    for (let i = 0; i < 16; i++) {
        const x = r() * S, y = r() * S, rad = 10 + r() * 34, rot = r() * 3;
        wrap((ox, oy) => {
            g.fillStyle = stain;
            g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * 0.6, rot, 0, Math.PI * 2); g.fill();
        });
    }
    // 마른 핏자국 줄기
    for (let i = 0; i < 4; i++) {
        let x = r() * S, y = r() * S;
        const pts = [];
        for (let k = 0; k < 7; k++) { pts.push([x, y]); x += (r() - 0.3) * 26; y += (r() - 0.5) * 18; }
        const lw = 3 + r() * 3;
        wrap((ox, oy) => {
            g.strokeStyle = 'rgba(70,0,8,0.35)';
            g.lineWidth = lw;
            g.beginPath();
            pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)));
            g.stroke();
        });
    }
    // 잔해 조각
    for (let i = 0; i < 110; i++) {
        const x = r() * S, y = r() * S, w = 2 + r() * 5, h = 2 + r() * 4;
        g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(200,190,180,0.08)';
        g.fillRect(x, y, w, h);
    }
    // 균열
    g.strokeStyle = crack;
    for (let i = 0; i < 9; i++) {
        let x = r() * S, y = r() * S;
        const pts = [];
        for (let k = 0; k < 6; k++) { pts.push([x, y]); x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; }
        const lw = 1 + r() * 1.5;
        wrap((ox, oy) => {
            g.lineWidth = lw;
            g.beginPath();
            pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)));
            g.stroke();
        });
    }
    // 젖은 웅덩이: 어두운 광택 + 하이라이트 (비 온 뒤 썩은 물)
    for (let i = 0; i < 5; i++) {
        const x = r() * S, y = r() * S, rx = 18 + r() * 38, ry = rx * (0.35 + r() * 0.25);
        wrap((ox, oy) => {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rx);
            gr.addColorStop(0, 'rgba(8,12,16,0.55)'); gr.addColorStop(1, 'rgba(8,12,16,0)');
            g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(190,210,230,0.08)'; g.beginPath(); g.ellipse(x + ox - rx * 0.25, y + oy - ry * 0.3, rx * 0.35, ry * 0.18, 0, 0, Math.PI * 2); g.fill();
        });
    }
    // 탄피와 뼛조각, 종잇조각 (전투가 지나간 자리)
    for (let i = 0; i < 26; i++) {
        const x = r() * S, y = r() * S, k = r();
        if (k < 0.4) { g.fillStyle = 'rgba(214,170,70,0.38)'; g.fillRect(x, y, 3, 1.6); }
        else if (k < 0.7) { g.strokeStyle = 'rgba(214,206,186,0.22)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5 + r() * 6, y + (r() - 0.5) * 3); g.stroke(); }
        else { g.fillStyle = 'rgba(210,210,200,0.09)'; g.save(); g.translate(x, y); g.rotate(r() * 3); g.fillRect(0, 0, 6, 8); g.restore(); }
    }
    // 끌린 핏자국: 길고 가는 선
    for (let i = 0; i < 3; i++) {
        let x = r() * S, y = r() * S; const a = r() * Math.PI * 2;
        g.strokeStyle = 'rgba(70,0,10,0.22)'; g.lineWidth = 4 + r() * 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 60 + 18, y + Math.sin(a) * 60, x + Math.cos(a) * 130, y + Math.sin(a) * 130); g.stroke();
    }
    return c;
}

export const fx = {};

export async function loadAssets(onProgress, { signal, timeoutMs = 20000 } = {}) {
    const jobs = [];
    const add = (key, src, store, required = false) => jobs.push({ key, src, store, required });

    for (const [id, meta] of Object.entries(SPRITES)) {
        add(id, meta.image, (img) => { if (img) atlases[id] = new Atlas(img, meta); else delete atlases[id]; }, true);
    }
    for (const n of [1, 3, 5, 7, 9]) add(`bg${n}`, `asset/bg/stage${n}.webp`, (img) => { images[`bg${n}`] = img; });
    for (const n of ['title', 'victory', 'gameover', 'clear']) add(n, `asset/ui/${n}.webp`, (img) => { images[n] = img; });

    for (const [key, file] of [['cacheArt','salvage-cache'],['medArt','medical-kit'],['magnetArt','field-magnet']])
        add(key, `asset/items/${file}.png`, img => { images[key] = img; });
    for (let stage = 1; stage <= 10; stage++) {
        add(`bossArt${stage}`, BOSS_ART[stage].src, img => { images[`bossArt${stage}`] = img; });
    }
    // Optional dedicated role art: keep the original rabbit atlases as a safe fallback.
    for (const role of ['suicider', 'gunner']) {
        add(`enemyRole_${role}`, `asset/enemies/rabbit-${role}.png`, img => {
            const key = `enemyRole_${role}`;
            if (!img) { delete atlases[key]; return; }
            const h = 112, w = Math.max(1, Math.round(img.width * h / img.height));
            const canvas = makeCanvas(w, h);
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const frame = () => ({ sx: 0, sy: 0, sw: w, sh: h, ox: w / 2 });
            atlases[key] = new Atlas(canvas, { w, h, walkH: h, anims: { walk: [frame()], attack: [frame()], dead: [frame()] } });
            for (const tint of ['normal', 'flash', 'elite', 'hallu']) atlases[key].variant(tint);
        });
    }
    add('petYeongnyang', 'asset/items/pet-yeongnyang.png', img => { images.petYeongnyang = img; });
    add('playerFire', 'asset/sprites/player-fire.png', (img) => {
        if (!img) return;
        images.playerFire = img;
        const flash = makeCanvas(img.width, img.height);
        const g = flash.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(255,255,255,0.72)';
        g.fillRect(0, 0, img.width, img.height);
        images.playerFireFlash = flash;
    });
    // The final unit is real work too: building the procedural rendering caches.
    // Never report completion merely because all image requests have settled.
    const total = jobs.length + 1;
    let done = 0;
    const failed = [];
    onProgress?.(null, 0, { done, total, phase: 'images' });
    await Promise.all(jobs.map(async ({ key, src, store, required }) => {
        const img = await loadImage(src, { signal, timeoutMs });
        if (signal?.aborted) throw new DOMException('Asset loading was cancelled', 'AbortError');
        if (!img) failed.push({ key, src, required });
        store(img);
        done++;
        onProgress?.(key, done / total, { done, total, phase: 'images' });
    }));
    if (signal?.aborted) throw new DOMException('Asset loading was cancelled', 'AbortError');
    if (failed.some(job => job.required)) {
        const error = new Error('Required game images could not be loaded');
        error.code = 'ASSET_LOAD_FAILED';
        error.failed = failed.filter(job => job.required).map(job => job.key);
        throw error;
    }

    onProgress?.(null, done / total, { done, total, phase: 'prepare' });
    buildFx();
    for (const [key, target, size] of [['cacheArt','chest',44],['medArt','meat',30],['magnetArt','magnet',30]]) {
        const img = images[key];
        if (!img) continue;
        const c = makeCanvas(size,size), g = c.getContext('2d');
        const scale = Math.min(size/img.width,size/img.height);
        g.drawImage(img,(size-img.width*scale)/2,(size-img.height*scale)/2,img.width*scale,img.height*scale);
        fx[target] = c;
    }
    done++;
    onProgress?.(null, 1, { done, total, phase: 'ready' });
    return { loaded: jobs.length - failed.length, optionalFailures: failed.map(job => job.key) };
}

function buildFx() {
    fx.splats = { red: [], dark: [], green: [], gray: [] };
    for (let i = 0; i < 6; i++) {
        fx.splats.red.push(makeSplat(11 + i * 7, '#5c0710', 64));
        fx.splats.dark.push(makeSplat(91 + i * 5, '#2a0306', 72));
        fx.splats.green.push(makeSplat(51 + i * 3, '#2d5a12', 64));
        fx.splats.gray.push(makeSplat(31 + i * 9, '#24242c', 56));
    }
    fx.gems = [
        makeGem('#71b8cf', '#183b50', 14), // 경험치 조각 (1)
        makeGem('#5bd3be', '#174e49', 18), // 경험치 결정 (5)
        makeGem('#4aa8ff', '#0b2a5a', 22), // 푸른 결정 (25)
    ];
    fx.bullet = makeBullet('#ffd27a', 14, 6);
    fx.pellet = makeBullet('#ffb36b', 9, 5);
    fx.rail = makeBullet('#9ef0ff', 30, 6);
    fx.enemyShot = makeBullet('#7dff4a', 14, 12);
    fx.bossShot = makeBullet('#ff3355', 18, 16);
    fx.petal = makePetal('#ff4fa0', 26);
    fx.petalBlood = makePetal('#b3002d', 30);
    fx.saw = makeSaw(34, '#cfc6b8');
    fx.sawBone = makeSaw(44, '#e9dcc0');
    fx.chest = makeChest(40);
    fx.meat = makeMeat(30);
    fx.magnet = icon('🧲', 28);
    fx.bomb = icon('🧨', 28);
    fx.gold = icon('🪙', 20);
}
