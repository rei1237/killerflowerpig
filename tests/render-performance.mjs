// node --test tests/render-performance.mjs
// RENDER_BENCHMARK=1 PERF_ROOT=/path/to/snapshot node tests/render-performance.mjs
// The benchmark measures Node JS + a counting Canvas shim, not GPU raster time,
// browser FPS, battery use, or real-phone performance. No dependencies/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance as hostClock } from 'node:perf_hooks';
import os from 'node:os';

const root = process.env.PERF_ROOT || path.resolve(import.meta.dirname, '..');
const moduleAt = p => import(pathToFileURL(path.join(root, 'src', p)));
const noop = () => {};
const media = { matches: true };
globalThis.window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, matchMedia: () => media };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { hardwareConcurrency: 8 } });
globalThis.localStorage = { getItem: () => null, setItem: noop };
let canvasCreates = 0;
function makeContext() {
    const counts = {};
    const ctx = { counts, globalAlpha: 1, globalCompositeOperation: 'source-over',
        createPattern: () => ({}), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
        measureText: text => ({ width: String(text).length * 9 }),
    };
    for (const name of ['setTransform', 'save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'roundRect', 'clip', 'setLineDash']) {
        ctx[name] = () => { counts[name] = (counts[name] || 0) + 1; };
    }
    return ctx;
}
const nodes = new Map();
function node() { return { style: {}, children: [], textContent: '', hidden: false, setAttribute: noop,
    appendChild(n) { this.children.push(n); }, replaceChildren(...children) { this.children = children; } }; }
globalThis.document = { hidden: false, createElement(tag) {
    if (tag !== 'canvas') return node();
    canvasCreates++; const ctx = makeContext(); return { width: 1, height: 1, style: {}, getContext: () => ctx };
}, getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); } };

const state = await moduleAt('game/state.js');
const { G, configureCaps, clearWorld } = state;
const { settings, setSetting } = await moduleAt('core/settings.js');
const { images, fx } = await moduleAt('core/assets.js');
const effects = await moduleAt('game/effects.js');
const renderer = await moduleAt('game/render.js');
const { spawnHazard } = await moduleAt('game/hazards.js');
const { input } = await moduleAt('core/input.js');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const sprite = { width: 64, height: 64, complete: true, naturalWidth: 64, naturalHeight: 64 };
const enemyAtlas = { walkH: 112, frameCount: () => 8, draw(c, _a, _f, x, y) { c.drawImage(sprite, x - 18, y - 48, 36, 48); } };
function resetCounts() { for (const key of Object.keys(ctx.counts)) delete ctx.counts[key]; }
function calls() { return Object.values(ctx.counts).reduce((a, b) => a + b, 0); }
function place(i, far = false) { return { x: far ? 2400 + i * 5 : (i * 67 % 560) - 280, y: far ? 2600 : (i * 53 % 1100) - 550 }; }

function seedScene() {
    settings.quality = 'auto'; media.matches = true; document.hidden = false; configureCaps(); clearWorld();
    G.mode = 'play'; G.paused = false; G.clock = 20; G.stage = 7; G.time = 60;
    G.camera.x = 0; G.camera.y = -20; G.weapons = []; G.passives = {}; G.shake = 0;
    G.player = { x: 0, y: 0, vx: 0, vy: 0, hp: 100, maxHp: 100, dead: false, shotAt: 19.96, shotFlip: false, iframes: 0, hurtT: 0, anim: 0, stats: { magnet: 70 } };
    images.playerFire = { width: 1536, height: 256 }; images.playerFireFlash = images.playerFire;
    for (const key of ['bullet', 'rail', 'bossShot', 'enemyShot', 'petal', 'petalBlood', 'saw', 'bomb', 'meat', 'magnet', 'chest']) fx[key] = sprite;
    fx.gems = [sprite, sprite, sprite]; fx.splats = { red: [sprite] };
    for (let i = 0; i < 180; i++) Object.assign(G.enemies.spawn(), { ...place(i, i % 4 === 0), alive: true, atlas: enemyAtlas, radius: 14, state: 'walk', anim: i % 8, scale: .52, flip: false, tint: 'normal', id: i, hp: 10, maxHp: 10, flash: 0, elite: false });
    for (let i = 0; i < 150; i++) Object.assign(G.shots.spawn(), { ...place(i, i % 3 === 0), kind: 'bullet', weapon: 'shotgun', radius: 4, angle: i / 10, img: sprite, vx: 200, vy: 20, dmg: 12, life: .8, pierce: 2 });
    for (let i = 0; i < 60; i++) Object.assign(G.enemyShots.spawn(), { ...place(i, i % 3 === 0), radius: 7, kind: 'boss', dmg: 8, life: 2 });
    for (let i = 0; i < 300; i++) Object.assign(G.gems.spawn(), { ...place(i, i % 2 === 0), tier: i % 3, phase: 0, value: 1 });
    for (let i = 0; i < 20; i++) Object.assign(G.pickups.spawn(), { ...place(i), kind: 'coin', value: 1 });
    for (let i = 0; i < 260; i++) Object.assign(G.particles.spawn(), { ...place(i), kind: i % 6, size: 3, life: .5, max: 1, z: i % 20, color: '#ff8fa3', vx: 1, vy: 1 });
    for (let i = 0; i < 44; i++) Object.assign(G.texts.spawn(), { ...place(i, i % 2 === 0), text: '123', life: .5, max: 1, color: '#fff', big: false, crit: false });
    for (let i = 0; i < 72; i++) G.decals.push({ ...place(i), img: sprite, s: 1, born: 2 });
    for (let i = 0; i < 12; i++) { const h = spawnHazard(i % 2 ? 'gas' : 'acid', (i % 4) * 100 - 150, Math.floor(i / 4) * 120 - 120, { radius: 55, duration: 4, dmg: 7, tick: .4 }); h.t = 1; }
    G.boss = { x: 120, y: 50, radius: 42, alive: true, hp: 500, maxHp: 1000, phase: 0, def: { name: 'Stress boss' }, draw(c) { c.drawImage(sprite, 70, -100, 100, 150); } };
    input.joy.active = false;
    renderer.initRender(canvas); renderer.invalidateStageVisuals();
}
function gameplaySnapshot() {
    return JSON.stringify({ caps: G.caps, player: G.player, enemyCount: G.enemies.count, enemies: G.enemies.items.slice(0, G.enemies.count).map(e => [e.x, e.y, e.hp]), shots: G.shots.items.slice(0, G.shots.count), enemyShots: G.enemyShots.items.slice(0, G.enemyShots.count), hazards: G.hazards.items.slice(0, G.hazards.count), gems: G.gems.count, particles: G.particles.count });
}

if (process.env.RENDER_BENCHMARK) {
    seedScene();
    const before = gameplaySnapshot();
    for (let i = 0; i < 100; i++) { G.clock += 1 / 60; renderer.render(1 / 60); }
    resetCounts(); G.clock += 1 / 60; renderer.render(1 / 60);
    const activeCalls = { ...ctx.counts };
    const samples = [];
    for (let i = 0; i < 600; i++) { const t = hostClock.now(); G.clock += 1 / 60; renderer.render(1 / 60); samples.push(hostClock.now() - t); }
    samples.sort((a, b) => a - b);
    G.paused = true; renderer.render(0); resetCounts();
    for (let i = 0; i < 120; i++) renderer.render(0);
    console.log(JSON.stringify({ environment: { node: process.version, platform: process.platform, cpu: os.cpus()[0]?.model, backend: 'counting Canvas shim; no browser/GPU/phone' }, fixture: { viewport: [390, 844], devicePixelRatio: 3, quality: 'auto/coarse', enemies: 180, friendlyShots: 150, hostileShots: 60, hazards: 12, gems: 300, particles: 260, decals: 72, texts: 44 }, rasterPixels: canvas.width * canvas.height, activeCanvasCalls: activeCalls, activeCallsTotal: Object.values(activeCalls).reduce((a,b) => a+b,0), paused120FramesCalls: calls(), jsShimMedianMs: samples[300], jsShimP95Ms: samples[570], gameplayUnchanged: gameplaySnapshot() === before, canvasCreates }, null, 2));
} else {
    test('visual tiers never change enemy/spawn pools, damage or logical field of view', () => {
        seedScene(); const before = gameplaySnapshot(); const view = { ...G.view }; const lowQ = G.lowQ;
        for (const tier of [0, 1, 2]) { state.setVisualTier(tier); renderer.resize(); renderer.render(.016); assert.deepEqual(G.view, view); assert.equal(G.lowQ, lowQ); assert.equal(gameplaySnapshot(), before); }
    });
    test('mobile DPR is bounded and degraded raster keeps the same visible world', () => {
        seedScene(); assert.equal(renderer.screen.pr, 1); const view = { ...G.view };
        state.setVisualTier(2); renderer.resize(); assert.equal(renderer.screen.pr, .75); assert.deepEqual(G.view, view);
        assert.ok(canvas.width * canvas.height < 390 * 844 * .57);
    });
    test('paused/static renders are reused; resize and resume force redraw', () => {
        seedScene(); renderer.render(.016); G.paused = true; renderer.render(0); resetCounts();
        for (let i = 0; i < 120; i++) renderer.render(0); assert.equal(calls(), 0);
        renderer.resize(); renderer.render(0); assert.ok(calls() > 0); resetCounts();
        G.paused = false; renderer.render(.016); assert.ok(calls() > 0);
        resetCounts(); document.hidden = true; renderer.render(.016); assert.equal(calls(), 0); document.hidden = false;
    });
    test('decorative particle draws are bounded without removing live particles', () => {
        seedScene(); state.setVisualTier(1); resetCounts(); effects.drawParticles(ctx, -1000, -1000, 1000, 1000);
        const drawn = (ctx.counts.fillRect || 0) + (ctx.counts.drawImage || 0) + (ctx.counts.fill || 0);
        assert.equal(drawn, 160); assert.equal(G.particles.count, 260);
        assert.equal(ctx.counts.drawImage || 0, 0, 'mobile spark cores avoid additive glow textures');
        state.setVisualTier(2); resetCounts(); effects.drawDecals(ctx, -1000, -1000, 1000, 1000); assert.equal(ctx.counts.drawImage, 36); assert.equal(G.decals.length, 72);
    });
    test('offscreen text is culled and reused damage text loses stale large-font state', () => {
        seedScene(); resetCounts(); effects.drawTexts(ctx, -1000, -1000, 1000, 1000); assert.equal(ctx.counts.fillText, 22);
        G.texts.clear(); effects.floatText(0, 0, 'large'); G.texts.release(0); effects.damageText(0, 0, 5); assert.equal(G.texts.items[0].big, false);
    });
    test('adaptive CPU fallback has hysteresis, respects manual quality, and leaves simulation caps unchanged', () => {
        seedScene(); const caps = JSON.stringify(G.caps); let time = 100000;
        const feed = (cost, seconds) => { for (let i = 0; i < seconds * 60; i++) { time += 1000 / 60; renderer.observeRenderCost(cost, time); } };
        feed(18, 1); assert.equal(G.visuals.tier, 1); feed(18, 2); assert.equal(G.visuals.tier, 2); assert.equal(JSON.stringify(G.caps), caps);
        feed(1, 3); assert.equal(G.visuals.tier, 2, 'does not bounce quality immediately'); feed(1, 8); assert.equal(G.visuals.tier, 1);
        setSetting('quality', 'high'); configureCaps(); feed(18, 10); assert.equal(G.visuals.tier, 0);
        setSetting('quality', 'auto'); configureCaps();
    });
}

if (!process.env.RENDER_BENCHMARK) test('active enclosure keeps mobile fog wall visible and tap transform accurate at every edge', async () => {
 const {startEncirclement,updateEncirclement,clearEncirclement}=await moduleAt('game/encirclement.js');
 seedScene(); G.player.radius=10; assert.equal(startEncirclement(),true); updateEncirclement(2); G.shake=100;
 for(const [x,y] of [[220,0],[-220,0],[0,220],[0,-220]]) {
  G.player.x=x; G.player.y=y; G.clock+=.016; renderer.render(.016);
  assert.equal(G.camera.x,0); assert.equal(G.camera.y,0);
  const {zoom,worldTx,worldTy,cssW,cssH}=renderer.screen;
  const extent=G.encirclement.radius+31;
  assert.ok(worldTx-extent*zoom>=0 && worldTx+extent*zoom<=canvas.width);
  assert.ok(worldTy-extent*zoom>=0 && worldTy+extent*zoom<=canvas.height);
  const point=renderer.clientToWorld((x*zoom+worldTx)/canvas.width*cssW,(y*zoom+worldTy)/canvas.height*cssH);
  assert.ok(Math.abs(point.x-x)<1e-8 && Math.abs(point.y-y)<1e-8);
 }
 clearEncirclement();
});
