// Fixed-foot, shot-driven sprite timing. Seconds use G.clock, so pause freezes it.
export const FIRING_SPRITE = Object.freeze({
    cellWidth: 384, cellHeight: 256, frameCount: 8,
    anchorX: 192, anchorY: 240, muzzleX: 312, muzzleY: 148, scale: 0.24,
    // The projectile is already fired at t=0. These are visual phases only;
    // the next real shot can interrupt any part of the 300ms recovery.
    fireEnd: 0.032, recoilEnd: 0.068, peakEnd: 0.110,
    settleEnd: 0.160, returnEnd: 0.210, clothEnd: 0.260, recoverEnd: 0.300,
});
const SHOT_FRAME_ENDS = Object.freeze([
    FIRING_SPRITE.fireEnd, FIRING_SPRITE.recoilEnd, FIRING_SPRITE.peakEnd,
    FIRING_SPRITE.settleEnd, FIRING_SPRITE.returnEnd, FIRING_SPRITE.clothEnd,
    FIRING_SPRITE.recoverEnd,
]);
// The halo remains its original 4-cell, 1536px sheet. Pick a matching source
// pose explicitly; never enlarge it to a fictional eight-cell atlas.
export const HALO_SOURCE_FRAMES = Object.freeze([0, 1, 2, 2, 3, 3, 3, 0]);
export function shotFrame(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= FIRING_SPRITE.recoverEnd) return 0;
    for (let i = 0; i < SHOT_FRAME_ENDS.length; i++) if (elapsed < SHOT_FRAME_ENDS[i]) return i + 1;
    return 0;
}
export function markPlayerShot(player, clock, dx) {
    if (!player || player.dead || !Number.isFinite(clock)) return;
    player.shotAt = clock;
    // Lock the visual facing for the burst; movement/collision facing is unchanged.
    player.shotFlip = Math.abs(dx) > 0.08 ? dx < 0 : player.flip;
}
const DRAW_RECTS = Object.freeze(Array.from({ length: FIRING_SPRITE.frameCount }, (_, frame) => {
    const s = FIRING_SPRITE;
    return Object.freeze([frame*s.cellWidth,0,s.cellWidth,s.cellHeight,
        -s.anchorX*s.scale,-s.anchorY*s.scale,s.cellWidth*s.scale,s.cellHeight*s.scale]);
}));
export function firingDrawRect(frame) { return DRAW_RECTS[frame] || DRAW_RECTS[0]; }
export function haloDrawRect(frame) { return DRAW_RECTS[HALO_SOURCE_FRAMES[frame] ?? 0]; }
export const PLAYER_HIT_RADIUS = 10;
export const PLAYER_BODY_OFFSET = 16;
export function playerBody(player) { return { x: player.x, y: player.y - PLAYER_BODY_OFFSET, radius: player.radius }; }
let motionQuery;
export function reducedPlayerMotion() {
    if (!motionQuery && typeof window !== 'undefined') motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    return !!motionQuery?.matches;
}
export function playerBob(player, clock, reducedMotion = reducedPlayerMotion()) {
    if (reducedMotion) return 0;
    return Math.abs(Math.sin(clock * 12)) * (player.vx || player.vy ? 2 : 0.5) * (FIRING_SPRITE.scale / 0.30);
}
export function firingMuzzle(player, clock, dx) {
    const flip = Math.abs(dx) > 0.08 ? dx < 0 : player.flip;
    const bob = playerBob(player,clock,false), s = FIRING_SPRITE;
    return { x: player.x + (flip ? -1 : 1) * (s.muzzleX-s.anchorX)*s.scale, y: player.y + (s.muzzleY-s.anchorY)*s.scale - bob };
}

// Shared by live play and the disposable guided practice scene.
export function advancePlayerMovement(p, move, dt) {
    const s = p.stats;
    const mx = move.x, my = move.y;
    p.vx = mx * s.speed;
    p.vy = my * s.speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const moving = mx !== 0 || my !== 0;
    if (moving) {
        const l = Math.hypot(mx, my);
        p.facingX = mx / l; p.facingY = my / l;
        if (Math.abs(mx) > 0.15) p.flip = mx < 0;
    }
    p.animT += dt;
    const frameDur = moving ? 0.09 : 0.16;
    if (p.animT > frameDur) { p.animT = 0; p.anim = (p.anim + 1) % 8; }

}
