import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLoadingScreen } from '../src/ui/loading.js';
import { loadAssets, loadImage, atlases } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';

function fakeDocument() {
    const nodes = new Map();
    const root = { reloads: 0, getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, {
            hidden: false, disabled: false, complete: false, naturalWidth: 900, style: {}, dataset: {}, attrs: {}, textContent: '',
            listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
            setAttribute(name, value) { this.attrs[name] = value; }, focus() { root.focused = this; root.activeElement = this; },
        });
        return nodes.get(id);
    } };
    root.defaultView = { location: { reload() { root.reloads++; } } };
    return root;
}
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

test('loading percentage is driven by actual work, ignores invalid/backward events and enters once', async () => {
    const root = fakeDocument(), loading = createLoadingScreen(root), job = deferred();
    let report, starts = 0, ready = 0;
    const run = loading.start(progress => { starts++; report = progress; return job.promise; }, () => ready++);
    report('player', .25, { done: 1, total: 4 });
    assert.equal(root.getElementById('loading-text').textContent, '25%');
    assert.equal(root.getElementById('loading-progress').attrs['aria-valuenow'], '25');
    assert.equal(root.getElementById('loading-count').textContent, '1 / 4 준비 항목 확인');
    report(null, NaN); report(null, .1);
    assert.equal(root.getElementById('loading-text').textContent, '25%');
    await loading.retry(); await loading.start(() => { throw Error('duplicate'); });
    assert.equal(starts, 1); assert.equal(ready, 0);
    report(null, 1, { done: 4, total: 4, phase: 'ready' }); job.resolve();
    assert.equal(await run, true); assert.equal(ready, 1); assert.equal(root.getElementById('loading').hidden, true);
    await loading.retry(); assert.equal(ready, 1);
});

test('asset failure keeps the screen visible, focuses Retry, and resets progress on a clean attempt', async () => {
    const root = fakeDocument(), loading = createLoadingScreen(root), job = deferred();
    let starts = 0, ready = 0, oldProgress, oldSignal;
    await loading.start((progress, signal) => {
        starts++;
        if (starts === 1) { oldProgress = progress; oldSignal = signal; progress(null, .6); throw Error('offline'); }
        return job.promise;
    }, () => ready++);
    assert.equal(root.getElementById('loading').hidden, false);
    assert.equal(root.getElementById('loading').attrs['aria-busy'], 'false');
    assert.equal(root.focused, root.getElementById('loading-retry'));
    assert.equal(oldSignal.aborted, true); assert.equal(ready, 0);
    const retry = loading.retry();
    assert.equal(root.getElementById('loading-text').textContent, '0%');
    oldProgress(null, 1);
    assert.equal(root.getElementById('loading-text').textContent, '0%', 'Stale attempt cannot overwrite new progress');
    await loading.retry(); assert.equal(starts, 2);
    job.resolve(); assert.equal(await retry, true); assert.equal(ready, 1);
    assert.equal(root.focused, root.getElementById('btn-new'));
});

test('failed boot initialization offers reload rather than duplicating game listeners', async () => {
    const root = fakeDocument(), loading = createLoadingScreen(root);
    let initializations = 0;
    await loading.start(async () => {}, () => { initializations++; throw Error('initialization'); });
    assert.equal(root.getElementById('loading-retry').textContent, '새로고침');
    await loading.retry();
    assert.equal(root.reloads, 1); assert.equal(initializations, 1);
});

test('failed or already-broken decorative hero falls back without blocking the game', () => {
    const root = fakeDocument();
    root.getElementById('loading-art').complete = true;
    root.getElementById('loading-art').naturalWidth = 0;
    createLoadingScreen(root);
    assert.equal(root.getElementById('loading-art').hidden, true);
    assert.equal(root.getElementById('loading-art-fallback').hidden, false);
    const second = fakeDocument(); createLoadingScreen(second);
    second.getElementById('loading-art').listeners.error();
    assert.equal(second.getElementById('loading-art-fallback').hidden, false);
});

function installImageBoundary(fail = () => false, hang = () => false) {
    const instances = [];
    globalThis.Image = class {
        constructor() { this.width = 64; this.height = 64; instances.push(this); }
        set src(value) { this.url = value; if (/player-.*(?:fire|layer)\.png$/.test(value)) { this.width = value.includes('halo') ? 1536 : 3072; this.height = 256; } if (!hang(value)) queueMicrotask(() => fail(value) ? this.onerror?.() : this.onload?.()); }
        removeAttribute(name) { if (name === 'src') this.removed = true; }
    };
    const context = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, {
        get: (target, key) => target[key] || (() => {}), set: (target, key, value) => (target[key] = value, true),
    });
    globalThis.document = { createElement: () => ({ getContext: () => context }) };
    return instances;
}

test('image timeout and abort release handlers so late events cannot complete stale work', async () => {
    const images = installImageBoundary(() => false, () => true);
    assert.equal(await loadImage('stalled.webp', { timeoutMs: 5 }), null);
    assert.equal(images[0].onload, null); assert.equal(images[0].onerror, null); assert.equal(images[0].removed, true);
    const abort = new AbortController();
    const pending = loadImage('cancelled.webp', { signal: abort.signal, timeoutMs: 5000 });
    abort.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(images[1].onload, null);
});

test('real asset progress includes cache preparation and required failure never reaches 100%', async () => {
    installImageBoundary(src => src === SPRITES.player.image);
    const failedProgress = [];
    await assert.rejects(loadAssets((key, ratio, detail) => failedProgress.push({ ratio, ...detail }), { timeoutMs: 10 }), error => error.code === 'ASSET_LOAD_FAILED');
    assert.equal(atlases.player, undefined);
    assert.ok(failedProgress.every(entry => entry.ratio < 1));
    installImageBoundary();
    const progress = [];
    const result = await loadAssets((key, ratio, detail) => progress.push({ ratio, ...detail }), { timeoutMs: 10 });
    assert.ok(atlases.player); assert.equal(result.optionalFailures.length, 0);
    assert.equal(progress[0].ratio, 0); assert.equal(progress.at(-1).ratio, 1);
    assert.equal(progress.at(-1).phase, 'ready');
    assert.ok(progress.some(entry => entry.phase === 'prepare' && entry.ratio < 1));
    assert.equal(progress.at(-1).done, progress.at(-1).total);
    for (let n = 1; n < progress.length; n++) assert.ok(progress[n].ratio >= progress[n - 1].ratio);
});

test('optional art failure keeps safe fallbacks and required image stalls become retryable failures', async () => {
    installImageBoundary(src => src.includes('/ui/'));
    const result = await loadAssets(() => {}, { timeoutMs: 10 });
    assert.ok(result.optionalFailures.includes('title')); assert.ok(atlases.player);
    installImageBoundary(() => false, src => src === SPRITES.player.image);
    await assert.rejects(loadAssets(() => {}, { timeoutMs: 5 }), error => error.code === 'ASSET_LOAD_FAILED');
});

test('loading markup has accessible progress, actual hero art and a mobile/short-screen scroll fallback', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../src/ui/loading.css', import.meta.url), 'utf8');
    const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    assert.match(html, /id="loading-progress"[^>]+role="progressbar"/);
    assert.match(html, /id="loading-error"[^>]+role="alert"/);
    assert.match(html, /id="loading-art"[^>]+src="asset\/branding\/slayer-launch-900.webp"/);
    assert.ok(fs.existsSync(new URL('../asset/branding/slayer-launch-900.webp', import.meta.url)));
    assert.match(css, /#loading\{[^}]*overflow-y:auto/);
    assert.match(css, /#loading-art\{[^}]*object-fit:contain/);
    assert.match(css, /#loading-retry\{[^}]*min-height:48px/);
    assert.match(css, /@media\(max-width:640px\)/);
    assert.match(css, /@media\(max-height:520px\) and \(orientation:landscape\)/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(main, /loading\.start\(\(progress, signal\) => loadAssets\(progress, \{ signal \}\)/);
    assert.doesNotMatch(main, /document\.fonts|loading-fill|loading-text/);
});
