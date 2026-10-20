import { G } from './state.js';
import { focusedTarget } from './targeting.js';

export const PLAGUE_TARGET_SCAN_LIMIT = 64;
const CLUSTER_RADIUS = 72;
const finite = value => Number.isFinite(value) ? value : 0;
const fieldKind = kind => kind === 'firegas' ? 'fire' : kind;
const insideField = (point, center, radius) => (point.x - center.x) ** 2 + (point.y - center.y) ** 2 / .49 <= radius ** 2;

function coverageAtArrival(kind, weapon, flight) {
    const fields = [];
    let inspected = 0, freshThrows = 0;
    if (!kind) return { fields, freshThrows };
    // At most 64 coverage objects in total. Reserve a bounded first pass for
    // recent airborne bottles so throws in this same volley avoid each other.
    for (let i = G.shots.count - 1; i >= 0 && inspected < 32; i--, inspected++) {
        const shot = G.shots.items[i];
        if (shot.kind !== 'lob' || fieldKind(shot.hazard) !== kind || (weapon && shot.weapon !== weapon)) continue;
        const radius = finite(shot.s?.radius) * finite(shot.s?.area);
        const timeLeft = Math.max(0, finite(shot.dur) - finite(shot.t));
        if (radius <= 0 || timeLeft + finite(shot.s?.duration) <= flight + (shot.s?.tick || .3)) continue;
        fields.push({ x: shot.tx, y: shot.ty, radius });
        if (shot.t <= .001) freshThrows++;
    }
    for (let i = G.hazards.count - 1; i >= 0 && inspected < PLAGUE_TARGET_SCAN_LIMIT; i--, inspected++) {
        const field = G.hazards.items[i];
        if (!field.alive || field.follow || fieldKind(field.kind) !== kind || (weapon && field.weapon !== weapon)) continue;
        // An expiring field does not reserve a patch past the new bottle's
        // arrival. Require one actual damage tick of useful remaining coverage.
        if (field.duration - field.t <= flight + (field.tick || .3)) continue;
        if (field.radius > 0) fields.push({ x: field.x, y: field.y, radius: field.radius });
    }
    return { fields, freshThrows };
}

// Choose once when throwing. Returning coordinates rather than a tracking
// callback keeps bottles ballistic: a later turn or teleport can still evade.
export function choosePlagueLanding(player, range, flightTime, shotIndex = 0, options = {}) {
    if (!player || !Number.isFinite(range) || range <= 0) return null;
    const reach = Math.min(range, 720), flight = Math.max(0, Math.min(1, finite(flightTime)));
    const candidates = [], seen = new Set();
    let scanned = 0;
    const add = target => {
        if (!target || seen.has(target) || scanned >= PLAGUE_TARGET_SCAN_LIMIT) return;
        seen.add(target); scanned++;
        if (!target.alive || target.hp <= 0 || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
        const distance = Math.hypot(target.x - player.x, target.y - player.y);
        if (distance > reach) return;
        let x = target.x + finite(target.motionVX) * flight;
        let y = target.y + finite(target.motionVY) * flight;
        const ahead = Math.hypot(x - player.x, y - player.y);
        if (ahead > reach) {
            x = player.x + (x - player.x) * reach / ahead;
            y = player.y + (y - player.y) * reach / ahead;
        }
        candidates.push({ x, y, target, distance });
    };
    const focus = focusedTarget();
    add(focus);
    add(G.boss);

    // Walk nearby cells outwards rather than materializing an unbounded grid
    // query. Dense late-game packs still inspect at most 64 enemy objects.
    const grid = G.grid;
    if (grid?.cells && grid.size > 0) {
        const cx = Math.floor(player.x / grid.size), cy = Math.floor(player.y / grid.size);
        const rings = Math.ceil(reach / grid.size) + 1;
        const cell = (x, y) => {
            const list = grid.cells.get(grid.key(x, y));
            if (list) for (let i = 0; i < list.length && scanned < PLAGUE_TARGET_SCAN_LIMIT; i++) add(list[i]);
        };
        for (let ring = 0; ring <= rings && scanned < PLAGUE_TARGET_SCAN_LIMIT; ring++) {
            if (!ring) { cell(cx, cy); continue; }
            for (let offset = -ring; offset <= ring && scanned < PLAGUE_TARGET_SCAN_LIMIT; offset++) {
                cell(cx + offset, cy - ring); cell(cx + offset, cy + ring);
            }
            for (let offset = -ring + 1; offset < ring && scanned < PLAGUE_TARGET_SCAN_LIMIT; offset++) {
                cell(cx - ring, cy + offset); cell(cx + ring, cy + offset);
            }
        }
    }
    // Spawned enemies can exist before the next grid rebuild. This fallback
    // uses only the remaining budget, including skipped/duplicate pool entries.
    const remaining = PLAGUE_TARGET_SCAN_LIMIT - scanned;
    for (let i = 0; i < Math.min(G.enemies.count, remaining); i++) add(G.enemies.items[i]);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.distance - b.distance);
    const index = Math.max(0, Math.min(PLAGUE_TARGET_SCAN_LIMIT - 1, Math.floor(finite(shotIndex))));
    const focused = candidates.find(candidate => candidate.target === focus);
    if (!index && focused) return { x: focused.x, y: focused.y, target: focused.target };

    const radius = finite(options.radius) > 0 ? options.radius : CLUSTER_RADIUS;
    const { fields, freshThrows } = coverageAtArrival(fieldKind(options.kind), options.weapon, flight);
    for (const candidate of candidates) candidate.covered = fields.some(field => insideField(candidate, field, field.radius));
    const uncovered = candidates.filter(candidate => !candidate.covered);
    const pool = uncovered.length ? uncovered : candidates;
    // Match the real ground-damage ellipse, not a cosmetic circular radius.
    // Nearby uncovered enemies count as larger threats; a dense uncovered patch
    // can still beat a lone nearest target. All work remains O(64²).
    const close = (a, b) => insideField(a, b, radius);
    const ranked = pool.map(candidate => ({
        candidate, coverage: pool.reduce((score, other) => score + (close(other, candidate) ? 1 + 2 * (1 - other.distance / reach) : 0), 0),
    })).sort((a, b) => b.coverage - a.coverage || a.candidate.distance - b.candidate.distance);
    // With no actual shots yet, shotIndex can plan a complete distinct volley.
    // During real firing, newly spawned lob snapshots already reserve earlier
    // patches, so avoid advancing past the best remaining uncovered patch.
    const primary = focused && !freshThrows ? focused : ranked[0].candidate;
    const patches = [primary];
    for (const { candidate } of ranked) if (!patches.some(patch => close(patch, candidate))) patches.push(candidate);
    const selected = patches[Math.max(0, index - freshThrows) % patches.length];
    return { x: selected.x, y: selected.y, target: selected.target };
}
