// Paired real-runtime saw probe; no game source edits.
// node tools/saw-hit-qa.mjs [--trials=40] [--seconds=2.4]
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const variant = args.variant || 'current';
if (variant === 'before') {
    registerHooks({
        load(url, context, nextLoad) {
            const result = nextLoad(url, context);
            if (!url.endsWith('/src/game/weapons.js')) return result;
            let source = String(result.source);
            const aim = 'const firstAim = aimed ? sawAimDirection(p, aimed, s.speed, origin) : null;';
            const origin = 'const origin = aimed && images.playerFire ? firingMuzzle(p, G.clock, aimed.x-p.x) : null;';
            const sweep = "const swept = sh.kind === 'saw';";
            assert.ok(source.includes(aim) && source.includes(origin) && source.includes(sweep), 'pre-fix reference transformations must match current runtime');
            // Isolate the three repairs. All damage, RNG, sizes, target selection,
            // cooldowns, lifetime and collision/reward handlers remain identical.
            source = source.replace(aim, 'const firstAim = aimed ? aimAt(w, aimed, false) : null;')
                .replace(origin, 'const origin = null;')
                .replace(sweep, 'const swept = false;');
            return { ...result, source };
        },
    });
}
const { G, clearWorld } = await import('../src/game/state.js');
const { createPlayer, recomputeStats, updatePlayer } = await import('../src/game/player.js');
const { resetBuild } = await import('../src/game/progression.js');
const { createWeapon, updateWeapons, updateShots } = await import('../src/game/weapons.js');
const { spawnEnemy, updateEnemies } = await import('../src/game/enemies.js');
const { clearFocus, tapFocusAt } = await import('../src/game/targeting.js');
const { atlases, images } = await import('../src/core/assets.js');
const { save } = await import('../src/core/save.js');
const { input } = await import('../src/core/input.js');
const round = n => n == null ? null : +n.toFixed(4);

export function runSawEncounter({ seed = 1, dt = 1 / 60, scene = 'lateral', count = 1, seconds = 2.4, focused = false, bearing = 0 } = {}) {
    resetBuild(); clearWorld(); clearFocus();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null }, equippedPet: null });
    Object.assign(G, { tech: 'butcher', mode: 'play', stage: 1, clock: 10, time: 0, paused: false,
        godMode: true, kills: 0, gold: 0, damageBy: {}, events: {}, lowQ: true,
        caps: { particles: 0, texts: 0, gems: 500, enemies: 100, decalScale: 0 }, view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    atlases.rabbit1 = { walkH: 112, frameCount: () => 8 };
    images.playerFire = { width: 3072, height: 256 };
    createPlayer();
    G.player.swordCooldown = Infinity;
    G.weapons = [Object.assign(createWeapon('saw', 0), { level: 1, cd: 0 })];
    G.passives = {}; recomputeStats(true);
    let rng = seed >>> 0;
    const original = Math.random;
    Math.random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
    try {
        const targets = [], damage = new Map();
        const sign = seed % 2 ? 1 : -1, distance = 180 + (seed * 37 % 181);
        for (let i = 0; i < count; i++) {
            const angle = bearing + (i === 0 ? sign * ((seed % 7 - 3) * .07) : sign * (1.3 + i * .8));
            const radius = distance + i * 25;
            const opts = scene === 'lateral' ? { lineX: -Math.sin(angle) * sign, lineY: Math.cos(angle) * sign } : {};
            const e = spawnEnemy('runner', Math.cos(angle) * radius, Math.sin(angle) * radius, { ...opts, hpMul: 10000 });
            targets.push(e);
        }
        // Begin kiting before the shot so aim sees measured pursuit velocity
        // and the real moving-player muzzle, rather than a stationary opener.
        Object.assign(input.move, { x: scene === 'kiting' ? -0.65 : 0, y: scene === 'kiting' ? sign * Math.sqrt(1 - .65 ** 2) : 0 });
        for (let i = 0; i < 3; i++) {
            G.clock += dt;
            updatePlayer(dt);
            G.camera.x = G.player.x; G.camera.y = G.player.y;
            updateEnemies(dt);
        }
        if (scene === 'kiting') assert.ok(Math.hypot(G.player.x, G.player.y) > 0 && Math.hypot(G.player.vx, G.player.vy) > 0);
        if (focused) {
            const e = targets.at(-1);
            tapFocusAt(e.x, e.y - e.radius);
        }
        updateWeapons(.001); // One real Lv1 volley, never a manually created projectile.
        const shotCount = G.shots.count;
        assert.equal(shotCount, 1, 'Lv1 reference launches exactly one saw');
        let firstHit = null, directHit = false, hitEvents = 0;
        for (let frame = 0; frame < Math.ceil(seconds / dt); frame++) {
            const elapsed = (frame + 1) * dt;
            G.clock += dt;
            updatePlayer(dt);
            G.camera.x = G.player.x; G.camera.y = G.player.y;
            updateEnemies(dt);
            const before = targets.map(e => e.hp);
            updateShots(dt);
            targets.forEach((e, i) => {
                // Only the real shot collision's HP change is counted. Bleed,
                // movement, companion arcs and geometric predictions are excluded.
                if (e.hp < before[i]) {
                    const dealt = before[i] - e.hp;
                    damage.set(e.id, (damage.get(e.id) || 0) + dealt);
                    hitEvents++;
                    firstHit ??= elapsed;
                    if (elapsed <= 1.2 + 1e-9) directHit = true;
                }
            });
        }
        return { hit: damage.size > 0, directHit, firstHit, targetsHit: damage.size,
            hitEvents, shotCount, damage: [...damage.values()].reduce((a, b) => a + b, 0) };
    } finally {
        Math.random = original; Object.assign(input.move, { x: 0, y: 0 }); clearFocus();
    }
}

function summarize(rows) {
    const times = rows.flatMap(r => r.firstHit == null ? [] : [r.firstHit]).sort((a, b) => a - b);
    return { trials: rows.length, volleysHit: times.length, hitRate: round(times.length / rows.length),
        hitWithin1_2s: round(rows.filter(r => r.directHit).length / rows.length),
        firstHitMeanSeconds: times.length ? round(times.reduce((a, b) => a + b, 0) / times.length) : null,
        firstHitP90Seconds: times.length ? round(times[Math.ceil(times.length * .9) - 1]) : null,
        meanTargetsHit: round(rows.reduce((a, r) => a + r.targetsHit, 0) / rows.length),
        meanHitEvents: round(rows.reduce((a, r) => a + r.hitEvents, 0) / rows.length) };
}
function singleReport(trials, seconds) {
    const results = {};
    for (const bearing of [0, Math.PI / 2]) for (const dt of [1 / 60, .1]) for (const count of [1, 3]) for (const scene of ['lateral', 'approach', 'kiting']) for (const focused of [false, true]) {
        const key = `${bearing ? 'vertical' : 'horizontal'}:${scene}:${count}enemies:${dt === .1 ? '10' : '60'}Hz:${focused ? 'focused' : 'auto'}`;
        results[key] = summarize(Array.from({ length: trials }, (_, i) => runSawEncounter({ seed: i + 1, dt, scene, count, seconds, focused, bearing })));
    }
    return results;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const trials = Math.max(1, Number(args.trials) || 40), seconds = Math.max(.1, Number(args.seconds) || 2.4);
    if (args.variant) console.log(JSON.stringify(singleReport(trials, seconds)));
    else {
        const run = variant => {
            const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--variant=${variant}`, `--trials=${trials}`, `--seconds=${seconds}`], { encoding: 'utf8', maxBuffer: 10e6 });
            if (result.status !== 0) throw new Error(`${variant} probe failed: ${result.stderr || result.stdout}`);
            return JSON.parse(result.stdout);
        };
        const before = run('before'), after = run('current');
        console.log(JSON.stringify({
            method: 'Paired seeds, real Lv1 butcher saw firing and collision. Before is the same current runtime with only predictive aim, shared aiming/spawn muzzle and swept collision disabled through an isolated in-memory module hook. Targets use real runner movement, finite but deliberately high HP, normal dimensions, slow and knockback. One volley per trial; no sword equipped, pets, upgrades or DOT damage counted. This measures contact reliability, not kill balance or survival.',
            scenarios: '1 or3 runner enemies at180–410px, with horizontal and vertical initial bearings. Lateral uses supported straight-line enemy motion; approach uses normal pursuit; kiting uses normal pursuit plus full-speed diagonal player movement. Focus chooses the last enemy; auto chooses normally. Modern visible muzzle and actual camera ricochet remain enabled.',
            trials, seconds, before, after,
            changes: Object.fromEntries(Object.keys(after).map(key => [key, { hitRateDelta: round(after[key].hitRate - before[key].hitRate),
                firstHitMeanDeltaSeconds: before[key].firstHitMeanSeconds == null || after[key].firstHitMeanSeconds == null ? null :
                    round(after[key].firstHitMeanSeconds - before[key].firstHitMeanSeconds) }])),
        }, null, 2));
    }
}
