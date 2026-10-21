// Bounded hitscan aim. The selector and live collision share this exact geometry;
// a visible beam is never steered after its angle has been scored.
export const CANNON_TARGET_LIMIT = 64;
export const CANNON_RAY_LIMIT = 3;
export const cannonFocusMultiplier = count => [1.3,2.6,3.9][Math.max(1, Math.min(CANNON_RAY_LIMIT, Math.floor(finite(count))))-1];
const TAU = Math.PI * 2;
const finite = value => Number.isFinite(value) ? value : 0;
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function collectCannonTargets({ player, grid, enemies, boss, focus, view, camera, length }) {
    const targets = [], seen = new Set();
    let inspected = 0;
    const hw = view.w / 2, hh = view.h / 2;
    const add = target => {
        if (!target || seen.has(target) || inspected >= CANNON_TARGET_LIMIT) return;
        seen.add(target); inspected++;
        const radius = target.radius || 0, height = Math.max(radius * 2, (target.atlas?.walkH || 0) * (target.scale || 0));
        const visible = target.x + radius >= camera.x - hw && target.x - radius <= camera.x + hw &&
            target.y >= camera.y - hh && target.y - height <= camera.y + hh;
        if (target.alive && target.hp > 0 && (target === focus || visible)) targets.push(target);
    };
    add(focus); add(boss);
    if (grid?.cells && grid.size > 0) {
        const cx = Math.floor(player.x / grid.size), cy = Math.floor(player.y / grid.size);
        const reach = Math.min(length + 96, Math.hypot(hw + Math.abs(camera.x - player.x), hh + Math.abs(camera.y - player.y)) + 96);
        const rings = Math.min(32, Math.ceil(reach / grid.size) + 1);
        const cell = (x, y) => {
            const list = grid.cells.get(grid.key(x, y));
            if (list) for (let i = 0; i < list.length && inspected < CANNON_TARGET_LIMIT; i++) add(list[i]);
        };
        for (let r = 0; r <= rings && inspected < CANNON_TARGET_LIMIT; r++) {
            if (!r) { cell(cx, cy); continue; }
            for (let d = -r; d <= r && inspected < CANNON_TARGET_LIMIT; d++) { cell(cx + d, cy - r); cell(cx + d, cy + r); }
            for (let d = -r + 1; d < r && inspected < CANNON_TARGET_LIMIT; d++) { cell(cx - r, cy + d); cell(cx + r, cy + d); }
        }
    }
    // New spawns may not have reached the spatial grid yet.
    const remaining = CANNON_TARGET_LIMIT - inspected;
    for (let i = 0; i < Math.min(enemies.count, remaining); i++) add(enemies.items[i]);
    return { targets, inspected };
}

export function cannonBeamHits(target, ray) {
    const ex = target.x - ray.x, ey = target.y - (target.radius || 0) - ray.y;
    const along = ex * ray.dx + ey * ray.dy;
    if (along < 0) return false;
    const across = Math.abs(ex * ray.dy - ey * ray.dx), radius = target.radius || 0;
    if (ray.segments) {
        for (const segment of ray.segments) if (along <= segment.length && across < segment.width / 2 + radius) return true;
        return false;
    }
    return along <= ray.length && across < ray.width / 2 + radius;
}

// Straight line: every ray of a volley shares one angle and stacks on the same lane.
function writeRays(rays, base, count, length, width, muzzleAt, profiles) {
    for (let i = 0; i < count; i++) {
        const angle = base, dx = Math.cos(angle), dy = Math.sin(angle);
        const muzzle = muzzleAt(dx);
        const ray = rays[i];
        ray.x = muzzle.x; ray.y = muzzle.y; ray.angle = angle;
        ray.dx = dx; ray.dy = dy;
        ray.segments = profiles?.[i] || null;
        ray.length = ray.segments ? ray.segments.maxLength : length;
        ray.width = ray.segments ? ray.segments.maxWidth : width;
    }
    return rays;
}

// Supply no more than 64 nearby objects from the live world. A hittable focus
// converges the entire volley exclusively on that target. Otherwise the whole
// volley fires as one straight lane aimed to cross the most targets, with a
// stable facing-angle tie.
export function chooseCannonVolley({ targets = [], focus = null, count = 1, length = 520, width = 38,
    fallbackAngle = 0, muzzleAt = () => ({ x: 0, y: 0 }), rayProfiles = null } = {}) {
    count = Math.max(1, Math.min(CANNON_RAY_LIMIT, Math.floor(finite(count))));
    length = Math.max(0, finite(length)); width = Math.max(0, finite(width));
    // A profile is the exact union of at most twelve same-axis source rectangles.
    // A short wide core must never grant its width to another core's long reach.
    const profiles = rayProfiles ? Array.from({length:count}, (_,i) => (rayProfiles[i] || []).slice(0,12).map(s => ({
        length:Math.max(0,finite(s.length)),width:Math.max(0,finite(s.width))}))) : null;
    if (profiles) for (const profile of profiles) { profile.maxLength=Math.max(...profile.map(s=>s.length),0); profile.maxWidth=Math.max(...profile.map(s=>s.width),0); }
    const live = [], seen = new Set();
    let inspected = 0;
    const add = target => {
        if (!target || seen.has(target) || inspected >= CANNON_TARGET_LIMIT) return;
        seen.add(target); inspected++;
        if (target.alive && target.hp > 0 && Number.isFinite(target.x) && Number.isFinite(target.y)) live.push(target);
    };
    add(focus);
    for (let i = 0; i < targets.length && inspected < CANNON_TARGET_LIMIT; i++) add(targets[i]);
    const focused = live.includes(focus) ? focus : null;
    const origins = [muzzleAt(1), muzzleAt(-1)];
    const reference = focused ? Math.atan2(focused.y - (focused.radius || 0) - origins[0].y,
        focused.x - (focused.x < origins[0].x ? origins[1].x : origins[0].x)) : finite(fallbackAngle);
    if (focused) {
        const angles = [];
        for (const origin of origins) {
            const dx = focused.x - origin.x, dy = focused.y - (focused.radius || 0) - origin.y;
            const center = Math.atan2(dy, dx);
            const edge = Math.asin(Math.min(1, (width / 2 + (focused.radius || 0)) / Math.max(1, Math.hypot(dx, dy)))) * .999999;
            angles.push(center, center - edge, center + edge);
        }
        angles.push(Math.PI / 2, -Math.PI / 2);
        for (const angle of angles) {
            const dx = Math.cos(angle), dy = Math.sin(angle), muzzle = muzzleAt(dx);
            const ray = { x: muzzle.x, y: muzzle.y, angle, dx, dy, length, width, segments: profiles?.[0] || null };
            if (!cannonBeamHits(focused, ray)) continue;
            const along = (focused.x - ray.x) * dx + (focused.y - (focused.radius || 0) - ray.y) * dy;
            return { rays: Array.from({ length: count }, (_,i) => ({ ...ray, segments: profiles?.[i] || null,
                    length:profiles ? profiles[i].maxLength : length,
                    width:profiles ? profiles[i].maxWidth : width })), targets: [focused],
                focusHit: true, focused: true, focusTarget: focused, focusTargetId: focused.id,
                focusEndX: ray.x + dx * along, focusEndY: ray.y + dy * along,
                damageMultiplier: cannonFocusMultiplier(count), inspected, candidateCount: angles.length };
        }
    }
    const candidates = [reference];
    const period = TAU, equivalent = new Map();
    const addAngle = angle => {
        const key = Math.round(((angle % period + period) % period) * 1e7);
        const index = equivalent.get(key);
        if (index !== undefined) {
            if (angleDistance(angle, reference) < angleDistance(candidates[index], reference)) candidates[index] = angle;
        } else {
            equivalent.set(key, candidates.length); candidates.push(angle);
        }
    };
    // Center and both beam-edge alignments capture narrow lanes and clusters
    // between targets. Two muzzle sides account for the authored body's offset.
    for (const target of live) for (const origin of origins) {
        const dx = target.x - origin.x, dy = target.y - (target.radius || 0) - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance > length + width / 2 + (target.radius || 0)) continue;
        const center = Math.atan2(dy, dx);
        const actual = muzzleAt(Math.cos(center));
        // Most targets can be aimed at from only one authored muzzle side.
        // Reject the impossible mirrored candidate before doing any scoring.
        if (actual.x !== origin.x || actual.y !== origin.y) {
            // A target between the two hands may have no self-consistent center
            // aim. Its real body can still intersect a vertical authored muzzle.
            // These two shared angles add at most two bounded candidates.
            addAngle(dy < 0 ? -Math.PI / 2 : Math.PI / 2);
            continue;
        }
        // Every ray shares the lane, so the union of all ray profiles decides reach.
        // At most 64 targets * 3 alignments + 2 vertical fallbacks.
        const reachable = profiles?.flat().filter(s=>distance<=s.length+s.width/2+(target.radius||0));
        if (reachable && !reachable.length) continue;
        const candidateWidth = reachable ? Math.max(...reachable.map(s=>s.width)) : width;
        const edge = Math.asin(Math.min(1, (candidateWidth / 2 + (target.radius || 0)) / Math.max(1, distance))) * .999999;
        addAngle(center);addAngle(center-edge);addAngle(center+edge);
    }
    const rays = Array.from({ length: count }, () => ({ x: 0, y: 0, angle: 0, dx: 0, dy: 0, length, width }));
    let bestAngle = reference, bestHits = -1, bestFocus = -1, bestTurn = Infinity;
    for (const angle of candidates) {
        writeRays(rays, angle, count, length, width, muzzleAt, profiles);
        let hits = 0, focusHit = 0;
        for (const target of live) {
            let hit = false;
            for (let i = 0; i < count; i++) if (cannonBeamHits(target, rays[i])) { hit = true; break; }
            if (!hit) continue;
            hits++; if (target === focused) focusHit = 1;
        }
        const turn = angleDistance(angle, reference);
        if (focusHit > bestFocus || focusHit === bestFocus && (hits > bestHits ||
            hits === bestHits && turn < bestTurn - 1e-10)) {
            bestAngle = angle; bestHits = hits; bestFocus = focusHit; bestTurn = turn;
        }
    }
    writeRays(rays, bestAngle, count, length, width, muzzleAt, profiles);
    return { rays, targets: live.filter(target => rays.some(ray => cannonBeamHits(target, ray))),
        focusHit: bestFocus > 0, focused: false, straight: true, damageMultiplier: 1, inspected, candidateCount: candidates.length };
}
