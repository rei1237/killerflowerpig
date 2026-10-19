// Fixed-foot, shot-driven sprite timing. Seconds use G.clock, so pause freezes it.
export const FIRING_SPRITE = Object.freeze({
    cellWidth: 384, cellHeight: 256, anchorX: 192, anchorY: 240, scale: 0.24,
    fireEnd: 0.050, recoilEnd: 0.115, recoverEnd: 0.200,
});
export function shotFrame(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= FIRING_SPRITE.recoverEnd) return 0;
    if (elapsed < FIRING_SPRITE.fireEnd) return 1;
    if (elapsed < FIRING_SPRITE.recoilEnd) return 2;
    return 3;
}
export function markPlayerShot(player, clock, dx) {
    if (!player || player.dead) return;
    player.shotAt = clock;
    // Lock the visual facing for the burst; movement/collision facing is unchanged.
    player.shotFlip = Math.abs(dx) > 0.08 ? dx < 0 : player.flip;
}
export function firingDrawRect(frame) {
    const s = FIRING_SPRITE;
    return [frame*s.cellWidth,0,s.cellWidth,s.cellHeight,
        -s.anchorX*s.scale,-s.anchorY*s.scale,s.cellWidth*s.scale,s.cellHeight*s.scale];
}
export const PLAYER_HIT_RADIUS = 10;
export const PLAYER_BODY_OFFSET = 16;
export function playerBody(player) { return { x: player.x, y: player.y - PLAYER_BODY_OFFSET, radius: player.radius }; }
export function playerBob(player, clock) {
    return Math.abs(Math.sin(clock * 12)) * (player.vx || player.vy ? 2 : 0.5) * (FIRING_SPRITE.scale / 0.30);
}
export function firingMuzzle(player, clock, dx) {
    const flip = Math.abs(dx) > 0.08 ? dx < 0 : player.flip;
    const bob = playerBob(player,clock), s = FIRING_SPRITE;
    return { x: player.x + (flip ? -1 : 1) * (312-s.anchorX)*s.scale, y: player.y + (148-s.anchorY)*s.scale - bob };
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
