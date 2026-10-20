import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FIRING_SPRITE, PLAYER_HIT_RADIUS, PLAYER_BODY_OFFSET, HALO_SOURCE_FRAMES,
    shotFrame, markPlayerShot, firingDrawRect, haloDrawRect, firingMuzzle, playerBob,
} from '../src/game/player-motion.js';

test('eight shot poses start immediately and finish a readable 300ms recovery', () => {
    assert.equal(FIRING_SPRITE.frameCount, 8);
    assert.ok(FIRING_SPRITE.recoverEnd >= .28 && FIRING_SPRITE.recoverEnd <= .32);
    for (const [time, frame] of [
        [0, 1], [.0319, 1], [.032, 2], [.0679, 2], [.068, 3], [.1099, 3],
        [.110, 4], [.1599, 4], [.160, 5], [.2099, 5], [.210, 6], [.2599, 6],
        [.260, 7], [.2999, 7], [.300, 0], [1, 0], [-1, 0], [Infinity, 0], [NaN, 0],
    ]) assert.equal(shotFrame(time), frame, `t=${time}`);
});

test('fixed clock freezes the pose and each new actual shot interrupts recovery', () => {
    const p = { x: 1, y: 2, radius: 10, flip: false };
    markPlayerShot(p, 10, -1);
    assert.equal(p.shotAt, 10); assert.equal(p.shotFlip, true);
    const pausedClock = 10.22;
    for (let i = 0; i < 120; i++) assert.equal(shotFrame(pausedClock - p.shotAt), 6);
    markPlayerShot(p, pausedClock, 1);
    assert.equal(shotFrame(pausedClock - p.shotAt), 1);
    assert.equal(p.shotFlip, false);
    for (let i = 1; i <= 12; i++) {
        const clock = pausedClock + i * .02;
        markPlayerShot(p, clock, i % 2 ? -1 : 1);
        assert.equal(shotFrame(clock - p.shotAt), 1);
    }
    assert.deepEqual({ x: p.x, y: p.y, radius: p.radius }, { x: 1, y: 2, radius: 10 });
    const shotAt = p.shotAt;
    p.dead = true; markPlayerShot(p, 12, 1); assert.equal(p.shotAt, shotAt);
    p.dead = false; markPlayerShot(p, NaN, 1); assert.equal(p.shotAt, shotAt);
});

test('every body crop preserves the fixed foot, scale, hitbox and mirrored muzzle', () => {
    const first = firingDrawRect(0).slice(4);
    assert.deepEqual(first, [-46.08, -57.599999999999994, 92.16, 61.44]);
    for (let i = 0; i < 8; i++) {
        assert.deepEqual(firingDrawRect(i).slice(4), first);
        assert.equal(firingDrawRect(i)[0], i * 384);
        assert.equal(firingDrawRect(i), firingDrawRect(i), 'crop arrays are cached');
    }
    assert.equal(PLAYER_HIT_RADIUS, 10); assert.equal(PLAYER_BODY_OFFSET, 16);
    assert.equal(FIRING_SPRITE.anchorX, 192); assert.equal(FIRING_SPRITE.anchorY, 240);
    assert.equal(FIRING_SPRITE.scale, .24);
    assert.equal(FIRING_SPRITE.muzzleX, 312); assert.equal(FIRING_SPRITE.muzzleY, 148);
    const p = { x: 100, y: 100, vx: 0, vy: 0, flip: false };
    assert.deepEqual(firingMuzzle(p, 0, 1), { x: 128.8, y: 77.92 });
    assert.deepEqual(firingMuzzle(p, 0, -1), { x: 71.2, y: 77.92 });
    assert.equal(p.x, 100); assert.equal(p.y, 100);
    assert.equal(firingDrawRect(-1), firingDrawRect(0));
    assert.equal(firingDrawRect(8), firingDrawRect(0));
});

test('four-frame halo maps explicit source poses without stretch or out-of-bounds crops', () => {
    assert.deepEqual(HALO_SOURCE_FRAMES, [0, 1, 2, 2, 3, 3, 3, 0]);
    for (let i = 0; i < 8; i++) {
        const rect = haloDrawRect(i);
        assert.equal(rect[0], HALO_SOURCE_FRAMES[i] * 384);
        assert.ok(rect[0] + rect[2] <= 1536);
        assert.deepEqual(rect.slice(1), firingDrawRect(i).slice(1));
    }
});

test('reduced motion removes idle and walking bob without changing shot timing', () => {
    for (const vx of [0, 135]) {
        assert.equal(playerBob({ vx }, .1, true), 0);
        assert.ok(playerBob({ vx }, .1, false) > 0);
    }
    assert.equal(shotFrame(.075), 3);
});

test('reduced-motion preferences never change projectile emission coordinates', () => {
    const previous = globalThis.window, query = { matches: false };
    globalThis.window = { matchMedia: () => query };
    try {
        const p = { x: 100, y: 120, vx: 135, vy: 0, flip: false };
        const normal = firingMuzzle(p, .11, 1);
        query.matches = true;
        assert.equal(playerBob(p, .11), 0, 'draw-only bob respects the preference');
        assert.deepEqual(firingMuzzle(p, .11, 1), normal, 'actual projectile origin is preference-independent');
        assert.ok(normal.y < p.y + (FIRING_SPRITE.muzzleY-FIRING_SPRITE.anchorY)*FIRING_SPRITE.scale);
    } finally { globalThis.window = previous; }
});
