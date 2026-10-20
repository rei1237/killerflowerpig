// 배경 연출(소품·대기 입자·안개)은 그리기 전용이다. 가짜 캔버스로 실제 모듈을 실행해 결정성, 화질 단계별 on/off, 전투 무영향을 검증한다.
import test from 'node:test';
import assert from 'node:assert/strict';
const noop = () => {};
function makeCtx() {
    const calls = { drawImage: 0, fillRect: 0, arc: 0, stroke: 0 };
    const ctx = { calls, globalAlpha: 1, globalCompositeOperation: 'source-over', createPattern: () => ({}), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), measureText: s => ({ width: String(s).length * 9 }) };
    for (const name of ['setTransform', 'save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'roundRect', 'clip', 'setLineDash', 'rect', 'arcTo', 'clearRect']) ctx[name] = () => { if (name in calls) calls[name]++; };
    return ctx;
}
globalThis.document = { hidden: false, createElement: () => { const ctx = makeCtx(); return { style: {}, width: 1, height: 1, getContext: () => ctx }; } };
const { G, setVisualTier } = await import('../src/game/state.js');
const scenery = await import('../src/game/scenery.js');
const { STAGES } = await import('../src/data/stages.js');
const view = { x0: -600, y0: -400, x1: 600, y1: 400 };
const screen = { w: 1000, h: 600 };
function frame(stage, tier) {
    G.stage = stage; G.clock = 12.5; G.player = { x: 0, y: 0 }; setVisualTier(tier);
    scenery.invalidateScenery();
    const ctx = makeCtx(), tall = [];
    scenery.drawGroundProps(ctx, view.x0, view.y0, view.x1, view.y1);
    scenery.collectTallProps(tall, view.x0, view.y0, view.x1, view.y1);
    for (const p of tall) scenery.drawProp(ctx, p);
    scenery.drawPropLights(ctx);
    scenery.drawAmbient(ctx, screen, { x: 40, y: -20 });
    return { ctx, tall };
}

test('every stage has an atmosphere and renders props, lights and ambient without touching combat state', () => {
    assert.deepEqual(Object.keys(scenery.STAGE_ATMOSPHERE).map(Number), Object.keys(STAGES).map(Number));
    for (const stage of Object.keys(STAGES).map(Number)) {
        const before = JSON.stringify([G.enemies.count, G.shots.count, G.kills]);
        const { ctx } = frame(stage, 0);
        assert.ok(ctx.calls.drawImage > 0, `stage ${stage} draws something`);
        assert.equal(JSON.stringify([G.enemies.count, G.shots.count, G.kills]), before);
    }
});

test('prop placement is seeded: same stage, same landscape; the spawn point stays clear', () => {
    const a = frame(3, 0).tall.map(p => [p.kind, p.x, p.y]), b = frame(3, 0).tall.map(p => [p.kind, p.x, p.y]);
    assert.deepEqual(a, b);
    for (const stage of Object.keys(STAGES).map(Number)) for (const p of frame(stage, 0).tall) assert.ok(Math.hypot(p.x, p.y) >= 150, `stage ${stage} ${p.kind} blocks the start`);
    assert.notDeepEqual(frame(1, 0).tall.map(p => p.kind + p.x), frame(8, 0).tall.map(p => p.kind + p.x));
});

test('visual tiers carry scenery flags and degrade ambient, lights and props in order', () => {
    const flags = tier => { setVisualTier(tier); const { scenery: s, ambient, sceneryLights } = G.visuals; return { s, ambient, sceneryLights }; };
    assert.deepEqual(flags(0), { s: true, ambient: true, sceneryLights: true });
    assert.deepEqual(flags(1), { s: true, ambient: true, sceneryLights: false });
    assert.deepEqual(flags(2), { s: false, ambient: false, sceneryLights: false });
    const full = frame(5, 0), mid = frame(5, 1), low = frame(5, 2);
    assert.ok(full.ctx.calls.drawImage > mid.ctx.calls.drawImage, 'lights are dropped in tier 1');
    assert.equal(low.tall.length, 0);
    assert.equal(low.ctx.calls.drawImage, 0, 'tier 2 draws no props, fog or particles');
    assert.equal(low.ctx.calls.arc + low.ctx.calls.stroke + low.ctx.calls.fillRect, 0);
});
