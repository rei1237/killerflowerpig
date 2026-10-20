// 배경 연출: 스테이지마다 다른 폐허 소품, 떠다니는 대기 입자, 안개 띠, 번개·박동 같은 환경 효과.
// 전부 절차적으로 그려 미리 캐시한다. 충돌·스폰·전투와 무관한 그리기 전용 레이어다.
// - 소품: 청크(480px)마다 시드 고정 배치 (같은 스테이지는 항상 같은 풍경, 스테이지 밖으로 나가도 이어진다)
// - 낮은 소품(웅덩이·뼈·잔해)은 바닥 위에, 높은 소품(차·가로등·나무)은 캐릭터와 함께 Y 정렬
// - 화질 단계에 따라 입자 수·빛 번짐을 줄이거나 끈다 (G.visuals.scenery / ambient / sceneryLights)
import { G } from './state.js';
import { makeCanvas, glow } from '../core/assets.js';

const TAU = Math.PI * 2;
const CHUNK = 480;
const rngOf = seed => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (a, b, c) => ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0);

// ───────────── 스테이지별 분위기 ─────────────
// props: 소품 종류 가중치 / ambient: 대기 입자 종류 / fog: 안개 띠 색 / weather: 번개·박동
export const STAGE_ATMOSPHERE = Object.freeze({
    1: { props: { car: 3, lamp: 2, barricade: 2, bones: 1, rubble: 2, pool: 1, deadtree: 1 }, ambient: 'ash', fog: 'rgba(120,150,120,0.10)', density: 1.0 },
    2: { props: { neon: 3, car: 2, lamp: 2, tomb: 2, pool: 1, rubble: 1 }, ambient: 'neonrain', fog: 'rgba(190,60,170,0.10)', density: 1.0 },
    3: { props: { barrel: 3, car: 1, rubble: 2, bones: 1, lamp: 1, deadtree: 2, toxicpool: 3 }, ambient: 'spores', fog: 'rgba(110,210,70,0.14)', density: 1.1 },
    4: { props: { rubble: 3, barricade: 2, car: 1, tomb: 1, lamp: 2, bones: 1, deadtree: 1, crate: 2 }, ambient: 'ash', fog: 'rgba(70,95,170,0.12)', density: 1.1 },
    5: { props: { neon: 2, car: 3, barricade: 2, pool: 2, bones: 1, crate: 1, lamp: 2 }, ambient: 'embers', fog: 'rgba(170,50,110,0.12)', density: 1.2 },
    6: { props: { pool: 4, bones: 2, deadtree: 2, tomb: 1, rubble: 1, barrel: 1 }, ambient: 'rain', fog: 'rgba(160,30,30,0.13)', weather: 'lightning', density: 1.2 },
    7: { props: { crate: 2, lamp: 2, neon: 1, bones: 2, flesh: 1, rubble: 2 }, ambient: 'embers', fog: 'rgba(210,70,40,0.12)', density: 1.2 },
    8: { props: { tank: 3, barrel: 2, crate: 1, pool: 1, bones: 1, lamp: 2 }, ambient: 'static', fog: 'rgba(200,90,230,0.10)', weather: 'lightning', density: 1.2 },
    9: { props: { flesh: 3, bones: 3, pool: 2, tomb: 1, deadtree: 1 }, ambient: 'bloodmotes', fog: 'rgba(170,0,40,0.09)', weather: 'heartbeat', density: 1.3 },
    10: { props: { flesh: 3, bones: 3, pool: 3, spire: 2 }, ambient: 'bloodmotes', fog: 'rgba(210,0,40,0.10)', weather: 'heartbeat', density: 1.4 },
});

// ───────────── 소품 그리기 (스프라이트 캐시) ─────────────
function jag(g, pts, fill, stroke) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } }
function shade(g, x, y, rx, ry, a = 0.45) { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
function vgrad(g, y0, y1, c0, c1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
function rim(g, color, fn) { g.save(); g.strokeStyle = color; g.lineWidth = 1.5; fn(); g.restore(); }

const PAINT = {
    // 버려진 차: 찌그러진 지붕, 깨진 유리, 녹과 핏자국
    car(g, W, H, r) {
        const hue = [['#3a2e2c', '#241c1b'], ['#2c3640', '#1b222a'], ['#40302a', '#281d19'], ['#2f3a30', '#1c231d']][(r() * 4) | 0];
        const x0 = 8, x1 = W - 8, base = H - 12;
        shade(g, W / 2, base + 4, (x1 - x0) / 2, 7, 0.55);
        g.fillStyle = vgrad(g, base - 36, base, hue[0], hue[1]);
        g.beginPath(); g.moveTo(x0, base); g.lineTo(x0, base - 16); g.quadraticCurveTo(x0 + 6, base - 24, x0 + 26, base - 25); g.lineTo(x0 + 40, base - 40); g.lineTo(x1 - 36, base - 40); g.lineTo(x1 - 18, base - 26); g.quadraticCurveTo(x1, base - 24, x1, base - 14); g.lineTo(x1, base); g.closePath(); g.fill();
        // 창문 (금 간 유리)
        g.fillStyle = 'rgba(70,110,140,0.35)'; jag(g, [[x0 + 44, base - 27], [x0 + 52, base - 37], [x1 - 42, base - 37], [x1 - 28, base - 27]], 'rgba(70,110,140,0.35)');
        g.strokeStyle = 'rgba(210,235,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 70, base - 36); g.lineTo(x0 + 82, base - 28); g.lineTo(x0 + 96, base - 33); g.moveTo(x0 + 82, base - 28); g.lineTo(x0 + 78, base - 40); g.stroke();
        // 녹·핏자국
        for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${90 + r() * 60},${40 + r() * 20},20,${0.12 + r() * 0.2})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), base - 6 - r() * 24, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(100,6,14,0.55)'; for (let i = 0; i < 3; i++) { const hx = x0 + 22 + r() * (x1 - x0 - 44); g.fillRect(hx, base - 22, 2.5, 6 + r() * 12); }
        // 바퀴
        for (const wx of [x0 + 22, x1 - 22]) { g.fillStyle = '#0c0b0b'; g.beginPath(); g.arc(wx, base, 10, 0, TAU); g.fill(); g.fillStyle = '#3b3a39'; g.beginPath(); g.arc(wx, base, 4.5, 0, TAU); g.fill(); }
        rim(g, 'rgba(160,190,210,0.18)', () => { g.beginPath(); g.moveTo(x0 + 40, base - 40); g.lineTo(x1 - 36, base - 40); g.stroke(); });
    },
    // 깨진 가로등: 휘어진 기둥과 꺼질 듯한 전구
    lamp(g, W, H, r) {
        const x = W / 2, base = H - 6;
        shade(g, x, base, 12, 4, 0.5);
        g.fillStyle = vgrad(g, 20, base, '#4b4f55', '#1b1d20'); g.fillRect(x - 2.5, 28, 5, base - 28);
        g.fillStyle = '#26282c'; g.fillRect(x - 6, base - 8, 12, 8);
        g.strokeStyle = '#3d4046'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x + 2, 14, x + 24, 14); g.stroke();
        g.fillStyle = '#d9d2a0'; g.beginPath(); g.ellipse(x + 26, 16, 7, 3.5, 0, 0, TAU); g.fill();
        rim(g, 'rgba(210,220,230,0.2)', () => { g.beginPath(); g.moveTo(x + 1.5, 30); g.lineTo(x + 1.5, base - 8); g.stroke(); });
    },
    // 콘크리트 바리케이드 + 경고 줄무늬
    barricade(g, W, H, r) {
        const base = H - 6, x0 = 6, x1 = W - 6;
        shade(g, W / 2, base + 2, (x1 - x0) / 2, 5, 0.5);
        g.fillStyle = vgrad(g, base - 30, base, '#6c6e6c', '#2f302f');
        g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + 6, base - 30); g.lineTo(x1 - 6, base - 30); g.lineTo(x1, base); g.closePath(); g.fill();
        g.save(); g.beginPath(); g.rect(x0 + 6, base - 24, x1 - x0 - 12, 10); g.clip();
        for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? '#101010' : '#c6a21c'; g.beginPath(); g.moveTo(x0 + i * 14, base - 14); g.lineTo(x0 + i * 14 + 7, base - 14); g.lineTo(x0 + i * 14 + 21, base - 24); g.lineTo(x0 + i * 14 + 14, base - 24); g.fill(); }
        g.restore();
        g.fillStyle = 'rgba(110,8,16,0.5)'; g.fillRect(x0 + 14 + r() * 40, base - 28, 3, 14);
        rim(g, 'rgba(255,255,255,0.14)', () => { g.beginPath(); g.moveTo(x0 + 6, base - 30); g.lineTo(x1 - 6, base - 30); g.stroke(); });
    },
    // 묘비 / 십자가
    tomb(g, W, H, r) {
        const x = W / 2, base = H - 6, cross = r() < 0.4;
        shade(g, x, base, 16, 4.5, 0.5);
        if (cross) {
            g.fillStyle = vgrad(g, 8, base, '#5a4a3a', '#2a2018'); g.fillRect(x - 3, 8, 6, base - 8); g.fillRect(x - 15, 22, 30, 6);
        } else {
            g.fillStyle = vgrad(g, 6, base, '#7b7e80', '#34363a');
            g.beginPath(); g.moveTo(x - 17, base); g.lineTo(x - 17, 26); g.quadraticCurveTo(x - 17, 6, x, 6); g.quadraticCurveTo(x + 17, 6, x + 17, 26); g.lineTo(x + 17, base); g.closePath(); g.fill();
            g.strokeStyle = 'rgba(20,20,24,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 17); g.lineTo(x, 36); g.moveTo(x - 7, 24); g.lineTo(x + 7, 24); g.stroke();
            g.beginPath(); g.moveTo(x + 6, 10); g.lineTo(x + 1, 22); g.lineTo(x + 9, 30); g.stroke();
        }
        g.fillStyle = 'rgba(70,100,50,0.45)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x - 14 + r() * 28, base - r() * 18, 3 + r() * 4, 2 + r() * 2, 0, 0, TAU); g.fill(); }
    },
    // 비틀린 죽은 나무
    deadtree(g, W, H, r) {
        const x = W / 2, base = H - 4;
        shade(g, x, base, 18, 5, 0.5);
        g.strokeStyle = '#0d0b0c'; g.lineCap = 'round';
        const branch = (bx, by, ang, len, w, d) => {
            const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
            g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + ex) / 2 + (r() - 0.5) * 14, (by + ey) / 2, ex, ey); g.stroke();
            if (d > 0) { branch(ex, ey, ang - 0.5 - r() * 0.4, len * 0.7, w * 0.62, d - 1); branch(ex, ey, ang + 0.4 + r() * 0.5, len * 0.66, w * 0.6, d - 1); }
        };
        branch(x, base, -Math.PI / 2 + (r() - 0.5) * 0.3, H * 0.34, 9, 3);
        g.strokeStyle = 'rgba(150,170,190,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, base); g.lineTo(x + 3, base - H * 0.3); g.stroke();
    },
    // 해골 더미 (납작한 소품)
    bones(g, W, H, r) {
        const cx = W / 2, cy = H / 2;
        shade(g, cx, cy + 6, W * 0.4, H * 0.22, 0.4);
        for (let i = 0; i < 9; i++) {
            const a = r() * TAU, d = r() * W * 0.28, bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d * 0.45, l = 10 + r() * 14, ang = r() * TAU;
            g.strokeStyle = '#cfc6b0'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ang) * l, by + Math.sin(ang) * l * 0.5); g.stroke();
            g.fillStyle = '#e2dac6'; g.beginPath(); g.arc(bx, by, 2.5, 0, TAU); g.arc(bx + Math.cos(ang) * l, by + Math.sin(ang) * l * 0.5, 2.5, 0, TAU); g.fill();
        }
        g.fillStyle = '#ddd5c0'; g.beginPath(); g.ellipse(cx + 4, cy - 2, 8, 7, 0, 0, TAU); g.fill();
        g.fillStyle = '#17110f'; g.beginPath(); g.ellipse(cx + 1, cy - 3, 2, 2.4, 0, 0, TAU); g.ellipse(cx + 7, cy - 3, 2, 2.4, 0, 0, TAU); g.fill(); g.fillRect(cx + 2.5, cy + 1, 3, 3);
    },
    // 핏물 웅덩이 (납작)
    pool(g, W, H, r) { PAINT._puddle(g, W, H, r, ['rgba(95,6,14,0.92)', 'rgba(55,2,8,0.95)'], 'rgba(255,120,130,0.35)'); },
    toxicpool(g, W, H, r) { PAINT._puddle(g, W, H, r, ['rgba(120,210,60,0.75)', 'rgba(40,110,30,0.9)'], 'rgba(230,255,170,0.4)'); },
    _puddle(g, W, H, r, [c0, c1], hi) {
        const cx = W / 2, cy = H / 2;
        const gr = g.createRadialGradient(cx, cy, 2, cx, cy, W * 0.46); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.fillStyle = gr; g.beginPath();
        const n = 14; for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = 0.8 + r() * 0.35; const px = cx + Math.cos(a) * W * 0.44 * rr, py = cy + Math.sin(a) * H * 0.4 * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath(); g.fill();
        g.fillStyle = hi; g.beginPath(); g.ellipse(cx - W * 0.1, cy - H * 0.08, W * 0.13, H * 0.06, -0.3, 0, TAU); g.fill();
        g.fillStyle = c1; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + (r() - 0.5) * W * 0.95, cy + (r() - 0.5) * H * 0.8, 1.5 + r() * 3, 0, TAU); g.fill(); }
    },
    // 잔해 더미
    rubble(g, W, H, r) {
        const cx = W / 2, base = H - 6;
        shade(g, cx, base + 1, W * 0.4, 6, 0.5);
        for (let i = 0; i < 12; i++) {
            const x = cx + (r() - 0.5) * W * 0.7, y = base - r() * 14, s = 5 + r() * 11, tone = 60 + r() * 50;
            jag(g, [[x - s, y], [x - s * 0.5, y - s * 0.9], [x + s * 0.4, y - s], [x + s, y - s * 0.2], [x + s * 0.6, y]], `rgb(${tone},${tone - 4},${tone - 8})`);
            g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x - s * 0.4, y - s * 0.95, s * 0.8, 1.5);
        }
        g.strokeStyle = '#2a1c14'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 10, base - 12); g.lineTo(cx + 14 + r() * 8, base - 28 - r() * 8); g.stroke();
    },
    // 독성 드럼통
    barrel(g, W, H, r) {
        const x = W / 2, base = H - 5;
        shade(g, x, base, 16, 5, 0.5);
        g.fillStyle = vgrad(g, base - 36, base, '#4d5a3a', '#222a18'); g.beginPath(); g.roundRect?.(x - 13, base - 36, 26, 36, 4); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; for (const yy of [base - 28, base - 12]) { g.beginPath(); g.moveTo(x - 13, yy); g.lineTo(x + 13, yy); g.stroke(); }
        g.fillStyle = '#b6e639'; g.fillRect(x - 5, base - 24, 10, 8); g.fillStyle = '#10140a'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('☣', x, base - 17);
        g.fillStyle = 'rgba(140,230,60,0.8)'; g.beginPath(); g.moveTo(x - 4, base - 36); g.quadraticCurveTo(x - 6, base - 22, x - 3, base - 8); g.lineTo(x, base - 8); g.quadraticCurveTo(x, base - 24, x + 1, base - 36); g.fill();
    },
    // 상자 / 모래주머니
    crate(g, W, H, r) {
        const x = W / 2, base = H - 5, s = 22;
        shade(g, x, base, 22, 5, 0.5);
        for (const [dx, dy, sz] of [[-10, 0, s], [14, 0, s * 0.8], [2, -s, s * 0.9]]) {
            g.fillStyle = vgrad(g, base + dy - sz, base + dy, '#6a5334', '#33281a'); g.fillRect(x + dx - sz / 2, base + dy - sz, sz, sz);
            g.strokeStyle = 'rgba(15,10,5,0.7)'; g.lineWidth = 2; g.strokeRect(x + dx - sz / 2, base + dy - sz, sz, sz);
            g.beginPath(); g.moveTo(x + dx - sz / 2, base + dy - sz); g.lineTo(x + dx + sz / 2, base + dy); g.moveTo(x + dx + sz / 2, base + dy - sz); g.lineTo(x + dx - sz / 2, base + dy); g.stroke();
        }
    },
    // 네온 간판 (분홍 + 청록)
    neon(g, W, H, r) {
        const x = W / 2, base = H - 5;
        shade(g, x, base, 20, 5, 0.5);
        g.fillStyle = '#17141c'; g.fillRect(x - 3, base - 46, 6, 46);
        g.fillStyle = vgrad(g, 6, 54, '#241d2c', '#120f17'); g.fillRect(x - 28, 6, 56, 48);
        g.strokeStyle = '#2f2638'; g.lineWidth = 2; g.strokeRect(x - 28, 6, 56, 48);
        g.lineWidth = 3; g.lineCap = 'round';
        g.strokeStyle = '#ff4fa8'; g.shadowColor = '#ff4fa8'; g.shadowBlur = 8; g.beginPath(); g.moveTo(x - 20, 20); g.lineTo(x - 20, 40); g.moveTo(x - 20, 30); g.lineTo(x - 8, 30); g.moveTo(x - 8, 20); g.lineTo(x - 8, 40); g.stroke();
        g.strokeStyle = '#4ff0ff'; g.shadowColor = '#4ff0ff'; g.beginPath(); g.arc(x + 12, 30, 9, 0.5, TAU - 0.9); g.stroke();
        g.shadowBlur = 0;
    },
    // 실험체 배양 탱크
    tank(g, W, H, r) {
        const x = W / 2, base = H - 5;
        shade(g, x, base, 20, 5, 0.5);
        g.fillStyle = '#23282d'; g.fillRect(x - 20, base - 8, 40, 8); g.fillRect(x - 20, 6, 40, 8);
        const gr = g.createLinearGradient(x - 16, 0, x + 16, 0); gr.addColorStop(0, 'rgba(90,255,170,0.55)'); gr.addColorStop(0.5, 'rgba(20,120,80,0.7)'); gr.addColorStop(1, 'rgba(90,255,170,0.4)');
        g.fillStyle = gr; g.fillRect(x - 16, 14, 32, base - 22);
        g.fillStyle = 'rgba(8,24,14,0.85)'; g.beginPath(); g.ellipse(x, base - 40, 9, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x, base - 62, 7, 0, TAU); g.fill();
        g.fillStyle = 'rgba(230,255,240,0.5)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x - 10 + r() * 20, 20 + r() * (base - 40), 1 + r() * 1.6, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(220,255,240,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 12, 16); g.lineTo(x - 12, base - 12); g.stroke();
    },
    // 맥동하는 살덩이: 혈관과 눈
    flesh(g, W, H, r) {
        const x = W / 2, base = H - 6;
        shade(g, x, base, W * 0.36, 8, 0.55);
        const gr = g.createRadialGradient(x - 8, base - 34, 4, x, base - 24, W * 0.4); gr.addColorStop(0, '#9a2a40'); gr.addColorStop(0.6, '#5c0f22'); gr.addColorStop(1, '#2a0510');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - W * 0.38, base);
        g.bezierCurveTo(x - W * 0.46, base - 40, x - W * 0.2, base - 70, x, base - 60); g.bezierCurveTo(x + W * 0.25, base - 72, x + W * 0.46, base - 36, x + W * 0.38, base); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(210,60,80,0.55)'; g.lineWidth = 1.6; for (let i = 0; i < 7; i++) { const sx = x - W * 0.3 + r() * W * 0.6; g.beginPath(); g.moveTo(sx, base - 4); g.bezierCurveTo(sx + (r() - 0.5) * 24, base - 22, sx + (r() - 0.5) * 30, base - 40, x + (r() - 0.5) * 20, base - 56); g.stroke(); }
        for (let i = 0; i < 2; i++) { const ex = x - 14 + i * 26 + (r() - 0.5) * 6, ey = base - 30 - r() * 10; g.fillStyle = '#e8dfc4'; g.beginPath(); g.ellipse(ex, ey, 6, 4.5, 0, 0, TAU); g.fill(); g.fillStyle = '#7a0a1e'; g.beginPath(); g.arc(ex + 1, ey, 2.4, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex + 1, ey, 1, 0, TAU); g.fill(); }
        rim(g, 'rgba(255,120,140,0.28)', () => { g.beginPath(); g.moveTo(x - W * 0.3, base - 40); g.bezierCurveTo(x - W * 0.15, base - 66, x + W * 0.1, base - 66, x + W * 0.2, base - 52); g.stroke(); });
    },
    // 뼈 첨탑 (마지막 왕관)
    spire(g, W, H, r) {
        const x = W / 2, base = H - 6;
        shade(g, x, base, 24, 6, 0.55);
        for (const [dx, h, w] of [[-14, H * 0.55, 9], [0, H * 0.9, 12], [15, H * 0.62, 8]]) {
            g.fillStyle = vgrad(g, base - h, base, '#d9d0bc', '#6a6254'); jag(g, [[x + dx - w, base], [x + dx - w * 0.3, base - h * 0.7], [x + dx, base - h], [x + dx + w * 0.4, base - h * 0.6], [x + dx + w, base]], g.fillStyle);
            g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + dx, base - h * 0.9); g.lineTo(x + dx - 1, base - 6); g.stroke();
        }
        g.fillStyle = 'rgba(150,10,30,0.6)'; g.fillRect(x - 18, base - 14, 36, 4);
    },
};

// 종류별 규격: [너비, 높이, 높은 소품(Y 정렬) 여부, 변형 수, 빛(glow)]
const SPEC = {
    car: { w: 118, h: 70, tall: true, v: 4 },
    lamp: { w: 64, h: 112, tall: true, v: 2, light: { color: '#ffe8a0', r: 120, dx: 26, dy: -96, flicker: true } },
    barricade: { w: 96, h: 50, tall: true, v: 2 },
    tomb: { w: 54, h: 62, tall: true, v: 3 },
    deadtree: { w: 110, h: 150, tall: true, v: 3 },
    bones: { w: 90, h: 50, tall: false, v: 3 },
    pool: { w: 150, h: 76, tall: false, v: 3 },
    toxicpool: { w: 150, h: 76, tall: false, v: 3, light: { color: '#9be15d', r: 70, dx: 0, dy: 0, flicker: false, alpha: 0.25 } },
    rubble: { w: 100, h: 46, tall: true, v: 3 },
    barrel: { w: 40, h: 56, tall: true, v: 2, light: { color: '#8fe63c', r: 56, dx: 0, dy: -24, flicker: false, alpha: 0.3 } },
    crate: { w: 76, h: 58, tall: true, v: 2 },
    neon: { w: 72, h: 66, tall: true, v: 2, light: { color: '#ff4fa8', r: 100, dx: 0, dy: -36, flicker: true, alpha: 0.5 } },
    tank: { w: 50, h: 100, tall: true, v: 2, light: { color: '#5cff9d', r: 90, dx: 0, dy: -50, flicker: false, alpha: 0.35 } },
    flesh: { w: 110, h: 92, tall: true, v: 3, light: { color: '#ff2a4a', r: 90, dx: 0, dy: -36, flicker: false, alpha: 0.28, pulse: true } },
    spire: { w: 70, h: 116, tall: true, v: 2 },
};

const spriteCache = new Map();
function sprite(kind, variant, stage) {
    const key = `${kind}:${variant}:${stage}`;
    let c = spriteCache.get(key);
    if (c) return c;
    const spec = SPEC[kind];
    c = makeCanvas(spec.w, spec.h);
    const g = c.getContext('2d');
    PAINT[kind](g, spec.w, spec.h, rngOf(hash(variant + 11, stage, kind.length * 977)));
    spriteCache.set(key, c);
    return c;
}

// ───────────── 월드 배치 ─────────────
const chunkCache = new Map();
function pickKind(props, r) {
    let total = 0; for (const k in props) total += props[k];
    let roll = r() * total;
    for (const k in props) { roll -= props[k]; if (roll <= 0) return k; }
    return Object.keys(props)[0];
}
function chunkProps(stage, cx, cy) {
    const key = `${stage}:${cx}:${cy}`;
    let list = chunkCache.get(key);
    if (list) return list;
    if (chunkCache.size > 500) chunkCache.clear();
    const atmo = STAGE_ATMOSPHERE[stage] || STAGE_ATMOSPHERE[1];
    const r = rngOf(hash(stage, cx, cy));
    const n = Math.floor(r() * 3.2 * atmo.density);
    list = [];
    for (let i = 0; i < n; i++) {
        const kind = pickKind(atmo.props, r), spec = SPEC[kind];
        const x = cx * CHUNK + 30 + r() * (CHUNK - 60), y = cy * CHUNK + 40 + r() * (CHUNK - 80);
        if (Math.hypot(x, y) < 150) continue; // 시작 지점은 비워 둔다
        list.push({ isProp: true, kind, x, y, spec, v: Math.floor(r() * spec.v), flip: r() < 0.5, scale: 0.9 + r() * 0.35, ph: r() * TAU, tall: spec.tall });
    }
    chunkCache.set(key, list);
    return list;
}

let visible = [];
function gather(vx0, vy0, vx1, vy1) {
    const stage = G.stage; visible.length = 0;
    const c0 = Math.floor((vx0 - 80) / CHUNK), c1 = Math.floor((vx1 + 80) / CHUNK), r0 = Math.floor((vy0 - 160) / CHUNK), r1 = Math.floor((vy1 + 160) / CHUNK);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) for (const p of chunkProps(stage, cx, cy)) visible.push(p);
    return visible;
}

function drawSprite(ctx, p) {
    const img = sprite(p.kind, p.v, G.stage), w = p.spec.w * p.scale, h = p.spec.h * p.scale;
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h + (p.spec.tall ? 4 : h * 0.5), w, h);
    ctx.restore();
}

export function drawGroundProps(ctx, vx0, vy0, vx1, vy1) {
    if (!G.visuals.scenery) return;
    for (const p of gather(vx0, vy0, vx1, vy1)) if (!p.tall) drawSprite(ctx, p);
}
export function collectTallProps(list, vx0, vy0, vx1, vy1) {
    if (!G.visuals.scenery) return;
    for (const p of visible) if (p.tall && p.x > vx0 - 60 && p.x < vx1 + 60 && p.y > vy0 - 40 && p.y < vy1 + 80) list.push(p);
}
export function drawProp(ctx, p) { drawSprite(ctx, p); }

// 소품의 빛 번짐 (가산 합성). 가로등은 깜빡이고, 살덩이는 맥동한다.
export function drawPropLights(ctx) {
    if (!G.visuals.sceneryLights) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of visible) {
        const L = p.spec.light; if (!L) continue;
        let a = L.alpha ?? 0.4;
        if (L.flicker) a *= Math.sin(G.clock * 9 + p.ph * 5) > 0.55 && Math.sin(G.clock * 2.3 + p.ph) > 0.2 ? 0.25 : 0.85 + Math.sin(G.clock * 3 + p.ph) * 0.1;
        if (L.pulse) a *= 0.7 + 0.3 * Math.sin(G.clock * 2.2 + p.ph);
        const r = L.r * p.scale, img = glow(L.color, 64);
        ctx.globalAlpha = a;
        ctx.drawImage(img, p.x + (p.flip ? -L.dx : L.dx) * p.scale - r, p.y + L.dy * p.scale - r, r * 2, r * 2);
    }
    ctx.restore();
}

// ───────────── 대기: 안개 띠 + 떠다니는 입자 + 번개/박동 ─────────────
const PARTICLE = {
    ash: { n: 70, color: 'rgba(200,205,200,0.55)', size: [1, 2.4], vx: [-14, 4], vy: [10, 26], kind: 'dot' },
    embers: { n: 56, color: 'rgba(255,150,60,0.85)', size: [1, 2.6], vx: [-8, 12], vy: [-44, -14], kind: 'glow' },
    spores: { n: 60, color: 'rgba(160,255,110,0.6)', size: [1.2, 3], vx: [-8, 8], vy: [-12, 8], kind: 'glow' },
    neonrain: { n: 54, color: 'rgba(255,90,190,0.5)', size: [1, 1.4], vx: [-30, -20], vy: [320, 440], kind: 'streak', alt: 'rgba(90,240,255,0.5)' },
    rain: { n: 95, color: 'rgba(180,200,230,0.38)', size: [1, 1.3], vx: [-90, -70], vy: [520, 700], kind: 'streak' },
    static: { n: 46, color: 'rgba(220,160,255,0.7)', size: [1, 2], vx: [-30, 30], vy: [-30, 30], kind: 'blink' },
    bloodmotes: { n: 60, color: 'rgba(230,30,60,0.7)', size: [1, 2.8], vx: [-6, 6], vy: [-30, -8], kind: 'glow' },
};
let ambientStage = 0, motes = [], fogTex = null, fogTexStage = 0;
function buildAmbient(stage) {
    const atmo = STAGE_ATMOSPHERE[stage] || STAGE_ATMOSPHERE[1], def = PARTICLE[atmo.ambient];
    const r = rngOf(hash(stage, 7, 13));
    motes = [];
    for (let i = 0; i < def.n; i++) motes.push({ x: r(), y: r(), s: def.size[0] + r() * (def.size[1] - def.size[0]), vx: def.vx[0] + r() * (def.vx[1] - def.vx[0]), vy: def.vy[0] + r() * (def.vy[1] - def.vy[0]), ph: r() * TAU, alt: r() < 0.5, depth: 0.4 + r() * 0.9 });
    ambientStage = stage;
    // 안개 띠 텍스처: 가로로 길게 번지는 부드러운 덩어리 (좌우 이음 매끄럽게)
    const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
    const fogA = Math.min(0.42, parseFloat(atmo.fog.match(/([\d.]+)\)$/)[1]) * 3.2).toFixed(3);
    for (let i = 0; i < 9; i++) {
        const x = r() * W, y = H * (0.3 + r() * 0.4), rad = 70 + r() * 110;
        for (const ox of [-W, 0, W]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad); gr.addColorStop(0, atmo.fog.replace(/0\.\d+\)/, `${fogA})`)); gr.addColorStop(1, atmo.fog.replace(/0\.\d+\)/, '0)')); g.fillStyle = gr; g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2); }
    }
    // 위아래 가장자리를 부드럽게 지워 띠 경계가 보이지 않게 한다
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, 0, 0, H); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.3, 'rgba(0,0,0,1)'); fade.addColorStop(0.7, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    fogTex = c; fogTexStage = stage;
}
export function invalidateScenery() { ambientStage = 0; fogTex = null; chunkCache.clear(); }

let lightning = 0, nextBolt = 6;
export function drawAmbient(ctx, screen, cam) {
    const stage = G.stage;
    if (!G.visuals.ambient || !G.player) return;
    if (ambientStage !== stage) buildAmbient(stage);
    const atmo = STAGE_ATMOSPHERE[stage] || STAGE_ATMOSPHERE[1], def = PARTICLE[atmo.ambient];
    const W = screen.w, H = screen.h, t = G.clock, tier = G.visuals.tier;
    ctx.save();
    // 안개 띠 두 겹 (느리게, 카메라와 시차)
    const fogH = Math.min(H * 0.55, 380);
    for (let k = 0; k < 2; k++) {
        const speed = k ? -9 : 14, par = k ? 0.12 : 0.22;
        const off = (((t * speed - cam.x * par) % 1024) + 1024) % 1024;
        ctx.globalAlpha = k ? 0.4 : 0.6;
        const y = H * (k ? 0.08 : 0.5) + Math.sin(t * 0.2 + k) * 8, scale = W / 1024 * 1.1;
        for (let x = -off * scale; x < W; x += 1024 * scale) ctx.drawImage(fogTex, x, y, 1024 * scale, fogH * (k ? 0.8 : 1));
    }
    // 대기 입자
    const count = tier === 0 ? motes.length : tier === 1 ? motes.length >> 1 : 0;
    for (let i = 0; i < count; i++) {
        const m = motes[i];
        const px = ((m.x * W + m.vx * t * m.depth - cam.x * 0.35 * m.depth) % W + W) % W;
        const py = ((m.y * H + m.vy * t * m.depth - cam.y * 0.2 * m.depth) % H + H) % H;
        const col = def.alt && m.alt ? def.alt : def.color;
        if (def.kind === 'streak') { ctx.strokeStyle = col; ctx.lineWidth = m.s; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + m.vx * 0.045, py + m.vy * 0.045); ctx.stroke(); }
        else if (def.kind === 'blink') { if (Math.sin(t * 7 + m.ph * 3) > 0.35) { ctx.fillStyle = col; ctx.fillRect(px, py, m.s * 2.4, m.s * 0.8); } }
        else {
            const a = def.kind === 'glow' ? 0.5 + 0.5 * Math.sin(t * 2 + m.ph) : 1;
            ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py + Math.sin(t * 1.3 + m.ph) * 4, m.s, 0, TAU); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    // 날씨: 번개 / 심장 박동
    if (atmo.weather === 'lightning') {
        if (t > nextBolt) { lightning = 1; nextBolt = t + 9 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 14; }
        if (lightning > 0.01) { ctx.fillStyle = `rgba(210,225,255,${lightning * 0.28})`; ctx.fillRect(0, 0, W, H); lightning *= 0.9; }
    } else if (atmo.weather === 'heartbeat') {
        const beat = Math.max(0, Math.sin(t * (stage >= 10 ? 2.6 : 2.0))) ** 8;
        if (beat > 0.02) { const r = Math.hypot(W, H) / 2, gr = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r); gr.addColorStop(0, 'rgba(120,0,20,0)'); gr.addColorStop(1, `rgba(150,0,28,${beat * (stage >= 10 ? 0.34 : 0.24)})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    }
    ctx.restore();
}
