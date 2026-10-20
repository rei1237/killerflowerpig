import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { images, atlases, loadAssets, requestCharacterSheet, characterFlash, characterCacheInfo, characterSheetStatus } = await import('../src/core/assets.js');
const { drawAppearance, appearanceAssets, COSTUME_IDS } = await import('../src/game/player-appearance.js');
const { FIRING_SPRITE, HALO_SOURCE_FRAMES, PLAYER_HIT_RADIUS, firingMuzzle, shotFrame, markPlayerShot } = await import('../src/game/player-motion.js');
const TIMES = [1, .016, .05, .085, .13, .18, .235, .28];
function context() {
    const calls = [], c = { calls };
    for (const n of ['save', 'restore', 'translate', 'scale', 'drawImage', 'beginPath', 'ellipse', 'stroke', 'fill', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'rotate']) c[n] = (...a) => calls.push([n, ...a]);
    return c;
}
function installSheets() {
    for (const key of ['playerFire', 'playerLotusFire', ...COSTUME_IDS.flatMap(id => ['normal', 'lotus'].map(variant => `costume_${id}_${variant}`))]) {
        images[key] = { id: key, width: 3072, height: 256 };
        images[`${key}Flash`] = { id: key + 'Flash', width: 3072, height: 256 };
    }
    images.playerHaloLayer = { id: 'halo', width: 1536, height: 256 };
    delete atlases.player;
}
test.beforeEach(installSheets);

test('shared renderer uses eight poses, locked facing, fixed foot and bob without mutation', () => {
    const p = { shotAt: 2, shotFlip: true, flip: false, vx: 100, vy: 0, hp: 33, radius: 10, anim: 2 };
    const before = structuredClone(p), ctx = context();
    assert.equal(drawAppearance(ctx, { x: 30, y: 40, clock: 2.075, player: p,
        appearance: { outfit: 'jade_lotus_guard', ornament: 'dawn_petal_halo' } }), true);
    assert.ok(ctx.calls.some(c => c[0] === 'scale' && c[1] === -1));
    const drawn = ctx.calls.filter(c => c[0] === 'drawImage');
    assert.deepEqual(drawn.map(c => c[1].id), ['halo', 'costume_jade_lotus_guard_normal']);
    assert.equal(drawn[0][2], 2 * 384); assert.equal(drawn[1][2], 3 * 384);
    assert.deepEqual(p, before); assert.equal(PLAYER_HIT_RADIUS, 10);
    assert.equal(FIRING_SPRITE.anchorX, 192); assert.equal(FIRING_SPRITE.anchorY, 240);
    assert.equal(firingMuzzle({ ...p, x: 0, y: 0 }, 2.075, 1).x, 28.799999999999997);
});

test('live draw and preview share code; missing costume art falls back without pasted icons', () => {
    assert.match(fs.readFileSync(new URL('../src/game/player.js', import.meta.url), 'utf8'), /drawAppearance\(ctx/);
    assert.match(fs.readFileSync(new URL('../src/ui/cosmetic-shop.js', import.meta.url), 'utf8'), /drawAppearance\(context/);
    delete images.costume_dusk_lotus_cape_normal;
    const ctx = context();
    drawAppearance(ctx, { appearance: { outfit: 'dusk_lotus_cape' }, player: { vx: 135 } });
    assert.deepEqual(ctx.calls.filter(c => c[0] === 'drawImage').map(c => c[1].id), ['playerFire']);
    assert.deepEqual(appearanceAssets({ outfit: 'dusk_lotus_cape' }, false).missing, ['dusk_lotus_cape']);
    assert.ok(!ctx.calls.some(c => ['fill', 'stroke'].includes(c[0])), 'missing costume has no signature');
});

test('invalid slots cannot render; missing base uses the legacy atlas or returns safely', () => {
    const ctx = context();
    drawAppearance(ctx, { appearance: { ornament: 'jade_lotus_guard', outfit: 'bogus' } });
    assert.deepEqual(ctx.calls.filter(c => c[0] === 'drawImage').map(c => c[1].id), ['playerFire']);
    delete images.playerFire;
    let fallbacks = 0; atlases.player = { draw() { fallbacks++; } };
    assert.equal(drawAppearance(context(), { appearance: {}, lotusGun: false }), true);
    assert.equal(fallbacks, 1);
    delete atlases.player;
    assert.equal(drawAppearance(context(), { appearance: {}, lotusGun: false }), false);
});

test('legendary ownership chooses one complete sheet and tint; missing art has disclosed fallbacks', () => {
    let ctx = context();
    drawAppearance(ctx, { lotusGun: true, clock: 1, player: { shotAt: .98 }, appearance: { outfit: 'jade_lotus_guard' } });
    let calls = ctx.calls.filter(c => c[0] === 'drawImage');
    assert.deepEqual(calls.map(c => c[1].id), ['costume_jade_lotus_guard_lotus']); assert.equal(calls[0][2], 384);
    ctx = context(); drawAppearance(ctx, { lotusGun: false, appearance: {} });
    assert.equal(ctx.calls.find(c => c[0] === 'drawImage')[1].id, 'playerFire');
    ctx = context(); drawAppearance(ctx, { lotusGun: true, tint: 'flash', appearance: {} });
    assert.equal(ctx.calls.find(c => c[0] === 'drawImage')[1].id, 'playerLotusFireFlash');
    delete images.costume_jade_lotus_guard_lotus;
    assert.deepEqual(appearanceAssets({ outfit: 'jade_lotus_guard' }, true).missing, ['jade_lotus_guard']);
    delete images.playerLotusFire;
    ctx = context(); drawAppearance(ctx, { lotusGun: true, appearance: {} });
    assert.equal(ctx.calls.find(c => c[0] === 'drawImage')[1].id, 'playerFire');
    assert.deepEqual(appearanceAssets({}, true).missing, ['lotus_gun']);
    delete images.playerHaloLayer;
    assert.deepEqual(appearanceAssets({ ornament: 'dawn_petal_halo' }, false).missing, ['dawn_petal_halo']);
});

test('all six complete body variants and both facings preserve every frame and the four-cell halo', () => {
    for (const outfit of [null, ...COSTUME_IDS]) for (const variant of ['normal', 'lotus']) for (const flip of [false, true]) {
        const key = outfit ? `costume_${outfit}_${variant}` : variant === 'lotus' ? 'playerLotusFire' : 'playerFire';
        for (let frame = 0; frame < TIMES.length; frame++) {
            const ctx = context();
            drawAppearance(ctx, { appearance: { outfit, ornament: 'dawn_petal_halo' }, lotusGun: variant === 'lotus',
                clock: 10, player: { shotAt: 10 - TIMES[frame], shotFlip: flip, flip }, tint: 'flash' });
            const calls = ctx.calls.filter(c => c[0] === 'drawImage');
            assert.equal(calls.length, 2); assert.equal(calls[0][1].id, 'halo'); assert.equal(calls[1][1].id, key + 'Flash');
            assert.equal(calls[1][2], frame * 384); assert.equal(calls[0][2], HALO_SOURCE_FRAMES[frame] * 384);
            assert.ok(calls[0][2] + calls[0][4] <= 1536);
            assert.deepEqual(calls[0].slice(3), calls[1].slice(3), 'source cells and destination anchors are identical');
            assert.ok(ctx.calls.some(c => c[0] === 'scale' && c[1] === (flip ? -1 : 1)));
        }
    }
});

test('paused renders stay identical and another shot immediately restarts the flash facing', () => {
    const p = { shotAt: 10, shotFlip: false, flip: true }, clock = 10.24;
    const first = context(); drawAppearance(first, { player: p, clock, appearance: {} });
    for (let i = 0; i < 20; i++) {
        const ctx = context(); drawAppearance(ctx, { player: p, clock, appearance: {} });
        assert.deepEqual(ctx.calls, first.calls);
    }
    markPlayerShot(p, clock, -1);
    const next = context(); drawAppearance(next, { player: p, clock, appearance: {} });
    assert.equal(next.calls.find(c => c[0] === 'drawImage')[2], 384);
    assert.ok(next.calls.some(c => c[0] === 'scale' && c[1] === -1));
});

test('costumes stay within body plus halo plus one signature; reduced motion has neither bob nor effects', () => {
    for (const outfit of COSTUME_IDS) for (const reducedMotion of [false, true]) {
        const p = { vx: 135, vy: 0, shotAt: 2, outfitGuardHitAt: 2 };
        const before = structuredClone(p), ctx = context();
        drawAppearance(ctx, { x: 30, y: 40, clock: 2.08, player: p, reducedMotion,
            appearance: { outfit, ornament: 'dawn_petal_halo' } });
        assert.equal(ctx.calls.filter(c => c[0] === 'drawImage').length, 2);
        assert.equal(ctx.calls.filter(c => c[0] === 'stroke').length, reducedMotion ? 0 : 1);
        assert.equal(ctx.calls.filter(c => c[0] === 'fill').length, 0);
        assert.equal(ctx.calls.find(c => c[0] === 'drawImage' && c[1].id !== 'halo')[2], shotFrame(.08) * 384);
        if (reducedMotion) assert.deepEqual(ctx.calls.find(c => c[0] === 'translate'), ['translate', 30, 40]);
        assert.deepEqual(p, before);
    }
    for (const [outfit, player] of [['dusk_lotus_cape', {}], ['jade_lotus_guard', {}], ['jade_lotus_guard', { outfitGuardHitAt: 1 }]]) {
        const ctx = context(); drawAppearance(ctx, { appearance: { outfit }, player, clock: 2 });
        assert.equal(ctx.calls.filter(c => c[0] === 'stroke').length, 0);
    }
    const source = fs.readFileSync(new URL('../src/game/player-appearance.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.spawn\(|G\.particles|createElement|new (?:Image|Array)/);
});

test('boot loads only ready bodies; family sheets and flash caches load lazily with validated dimensions', async () => {
    const invalid = new Set(), requested = [];
    globalThis.Image = class {
        constructor() { this.width = 64; this.height = 64; }
        set src(value) {
            requested.push(value);
            if (/asset\/sprites\/player-.*\.png$/.test(value)) {
                this.width = value.includes('halo') ? 1536 : 3072; this.height = 256;
                if (invalid.has(value)) this.width = value.includes('halo') ? 3072 : 1536;
            }
            queueMicrotask(() => this.onload?.());
        }
        removeAttribute() {}
    };
    const ctx = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] ?? (() => {}) });
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    const result = await loadAssets();
    assert.deepEqual(result.optionalFailures, []);
    assert.equal(images.playerFire.width, 3072); assert.equal(images.playerFireFlash, undefined);
    assert.equal(images.playerLotusFire, undefined, 'legendary atlas is not decoded before its actual use');
    assert.equal(images.playerHaloLayer.width, 1536);
    for (const key of ['playerLotusFire', 'costume_dusk_lotus_cape_normal', 'costume_jade_lotus_guard_lotus', 'player_throw']) {
        assert.equal((await requestCharacterSheet(key)).width, 3072);
        assert.equal(characterFlash(key).width, 3072);
        assert.ok(characterCacheInfo().bodies.length <= 4); assert.ok(characterCacheInfo().flashes.length <= 2);
    }
    invalid.add('asset/sprites/player-fire.png'); invalid.add('asset/sprites/player-jade-lotus-fire.png'); invalid.add('asset/sprites/player-halo-layer.png');
    const bad = await loadAssets();
    for (const key of ['playerFire', 'playerHaloLayer']) {
        assert.equal(images[key], null); assert.ok(bad.optionalFailures.includes(key));
    }
    assert.equal(images.playerFireFlash, undefined, 'stale flash is released on reload');
    await requestCharacterSheet('costume_jade_lotus_guard_lotus');
    assert.equal(characterSheetStatus('costume_jade_lotus_guard_lotus'), 'failed');
    assert.equal(images.costume_jade_lotus_guard_lotus, null);
    assert.ok(atlases.player, 'required legacy player survives optional body failures');
    await requestCharacterSheet('playerLotusFire');
    assert.equal(appearanceAssets({ outfit: 'jade_lotus_guard' }, true).body, images.playerLotusFire);
});
