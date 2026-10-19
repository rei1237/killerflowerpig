// 아군 장판(화염·독가스) 시각 예산 회귀 테스트: 겹친 장판이 수십 장이어도
// 글로우 픽셀 면적이 화질 단계 예산을 넘지 않고, 적 산성 장판은 항상 그려진다.
import test from 'node:test';
import assert from 'node:assert/strict';

const noop = () => {};
globalThis.window = { innerWidth: 844, innerHeight: 390, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { hardwareConcurrency: 8 } });
globalThis.localStorage = { getItem: () => null, setItem: noop };
function makeCtx() {
    const log = { glowArea: 0, fills: [], strokes: 0 };
    const ctx = { log, globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 1,
        createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => ({}) };
    for (const n of ['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'clip', 'setLineDash', 'fillRect', 'strokeRect', 'setTransform']) ctx[n] = noop;
    ctx.ellipse = (x, y, rx) => { ctx._r = rx; };
    ctx.fill = () => log.fills.push({ color: ctx.fillStyle, r: ctx._r });
    ctx.stroke = () => { log.strokes++; if (ctx.lineWidth === 1.5) log.thin = (log.thin || 0) + 1; };
    ctx.drawImage = (img, x, y, w, h) => { if (w !== undefined) log.glowArea += w * h; };
    return ctx;
}
globalThis.document = { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => makeCtx() }), getElementById: () => ({ style: {} }) };

const { G, clearWorld, setVisualTier } = await import('../src/game/state.js');
const { spawnHazard, drawHazards } = await import('../src/game/hazards.js');

function scene(tier) {
    clearWorld();
    setVisualTier(tier);
    G.view = { w: 1000, h: 460 }; G.camera = { x: 0, y: 0 }; G.clock = 1; G.lowQ = tier > 0;
    for (let i = 0; i < 34; i++) spawnHazard('fire', (i % 6) * 40 - 100, Math.floor(i / 6) * 30 - 60, { radius: 138, duration: 6 });
    for (let i = 0; i < 12; i++) spawnHazard('gas', i * 20, 0, { radius: 120, duration: 6 });
    const acid = [spawnHazard('acid', 300, 100, { radius: 50, duration: 6 }), spawnHazard('acid', -300, -100, { radius: 50, duration: 6 })];
    for (let i = 0; i < G.hazards.count; i++) G.hazards.items[i].t = 1; // 완전히 페이드인 된 상태
    const ctx = makeCtx();
    drawHazards(ctx);
    return { ctx, acid };
}

test('friendly field glow area stays within the visual tier budget even with 34 overlapping trails', () => {
    for (const tier of [0, 1, 2]) {
        const { ctx } = scene(tier);
        const screen = G.view.w * G.view.h;
        const quad = 138 * 2 * 138 * 1.4; // 한 장 초과 허용(예산을 마지막으로 넘긴 한 장)
        assert.ok(ctx.log.glowArea <= screen * G.visuals.fieldGlowScreens + quad * 1.1, `tier ${tier}: ${ctx.log.glowArea / screen} screens`);
    }
    const unbounded = 34 * 138 * 2 * 138 * 1.4;
    assert.ok(scene(2).ctx.log.glowArea < unbounded * 0.15, 'lowest tier removes most stacked glow');
});

test('hostile acid is always filled and over-budget friendly fields keep a visible outline', () => {
    for (const tier of [0, 1, 2]) {
        const { ctx } = scene(tier);
        const acidFills = ctx.log.fills.filter(f => f.color === '#27381d');
        assert.equal(acidFills.length, 2, `tier ${tier}: both enemy acid pools drawn`);
        const filled = ctx.log.fills.filter(f => f.color === '#5a1000' || f.color === '#16463f').length;
        assert.equal(filled + (ctx.log.thin || 0), 34 + 12, `tier ${tier}: every friendly field is filled or outlined`);
    }
});
