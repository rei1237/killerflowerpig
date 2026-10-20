// Finite-enemy, actual incoming-damage pressure diagnostic, not a balance verdict.
// node tools/tech-survival-qa.mjs > /tmp/tech-survival-final.json
// Optional: --seconds=60 --seeds=1,7,13 --muzzle=modern|legacy
// Isolated candidates: --techs=plague --plague-variant=area20|amount1|tier2damage25|level5damage25
// Restrict stages with --phases=equal_mid|actual_starter|equal_evolved.
// Movement-policy comparison: --kite-radius=150 or --kite-radius=300.
// Historical runtime: --baseline=bddb389 (read-only in-memory module loading).
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const requestedBaseline = process.argv.find(arg => arg.startsWith('--baseline='))?.split('=')[1];
const baselineCommit = requestedBaseline
    ? execFileSync('git', ['rev-parse', '--verify', `${requestedBaseline}^{commit}`], { cwd: repoRoot, encoding: 'utf8' }).trim() : null;
function baselineSource(file) {
    return execFileSync('git', ['show', `${baselineCommit}:${file}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
if (baselineCommit) registerHooks({
    load(url, context, nextLoad) {
        if (!url.startsWith('file:')) return nextLoad(url, context);
        const path = fileURLToPath(url);
        if (!path.startsWith(`${repoRoot}src/`) || !path.endsWith('.js')) return nextLoad(url, context);
        return { format: 'module', source: baselineSource(path.slice(repoRoot.length)), shortCircuit: true };
    },
});
const { G, clearWorld } = await import('../src/game/state.js');
const { createPlayer, recomputeStats, updatePlayer } = await import('../src/game/player.js');
const { resetBuild } = await import('../src/game/progression.js');
const { createWeapon, weaponStats, updateWeapons, updateShots } = await import('../src/game/weapons.js');
const { spawnEnemy, updateEnemies, updateEnemyShots } = await import('../src/game/enemies.js');
const { updateHazards } = await import('../src/game/hazards.js');
const { clearFocus } = await import('../src/game/targeting.js');
const { resonanceTier } = await import('../src/game/tech.js');
const { TECHS, techStartingWeapons } = await import('../src/data/techs.js');
const { WEAPONS } = await import('../src/data/weapons.js');
const { atlases, images } = await import('../src/core/assets.js');
const { save } = await import('../src/core/save.js');
const { input } = await import('../src/core/input.js');

const ROUTES = Object.freeze({
    gunline: ['shotgun', 'rifle'], bloom: ['thorns', 'cannon'], plague: ['molotov', 'gas'],
    executioner: ['pistols', 'rifle'], butcher: WEAPONS.sword ? ['sword', 'saw'] : ['saw', 'thorns'],
});
const round = n => +n.toFixed(3);
const PHASES = ['actual_starter', 'equal_mid', 'equal_evolved'];
const DEFAULT_PHASES = ['actual_starter', 'equal_mid'];
const sourceFiles = [
    'src/game/weapons.js', 'src/game/enemies.js', 'src/game/player.js', 'src/game/player-motion.js',
    'src/game/hazards.js', 'src/game/tech.js', 'src/game/butcher-sword.js', 'src/game/plague-targeting.js',
    'src/data/weapons.js', 'src/data/techs.js', 'src/data/enemies.js', 'src/data/fusions.js',
];
function sourceHashes() {
    return Object.fromEntries(sourceFiles.map(file => {
        let source;
        try { source = baselineCommit ? baselineSource(file) : readFileSync(new URL(`../${file}`, import.meta.url)); }
        catch (error) { if (baselineCommit) return [file, null]; throw error; }
        return [file, createHash('sha256').update(source).digest('hex')];
    }));
}
export function encounterConfig(tech, phase) {
    const definition = TECHS[tech];
    assert.ok(definition && PHASES.includes(phase));
    if (phase === 'actual_starter') return {
            stage: 1, build: techStartingWeapons(definition).map(id => ({ id, level: 1, evolved: false })),
            passives: { [definition.start.passive]: 1 }, investment: techStartingWeapons(definition).length + 1,
            evolutionRewards: 0, spawnEveryFrames: 54, spawnTypes: ['runner', 'shambler', 'shambler', 'shambler', 'shambler'] };
    const evolved = phase === 'equal_evolved';
    const passives = evolved && tech === 'executioner' ? { focus: 3, scope: 3, madness: 3 }
        : evolved && tech === 'butcher' && !WEAPONS.sword ? { whet: 3, hide: 3, regen: 3 }
            : Object.fromEntries(definition.family.passives.map(id => [id, 3]));
    const config = { stage: 6, build: ROUTES[tech].map(id => ({ id, level: evolved ? 8 : 6, evolved })),
        passives, investment: evolved ? 25 : 21, evolutionRewards: evolved ? 2 : 0,
        spawnEveryFrames: 36, spawnTypes: ['shambler', 'runner', 'brute', 'spitter', 'gunner'] };
    for (const weapon of config.build) if (weapon.evolved) {
        const partner = WEAPONS[weapon.id].evolve?.with;
        assert.ok(partner && config.passives[partner], `${tech}: missing actual evolution partner ${partner}`);
    }
    assert.equal(config.build.reduce((sum, w) => sum + w.level, 0) + Object.values(passives).reduce((sum, level) => sum + level, 0), config.investment);
    return config;
}

export function runSurvivalEncounter({ tech, phase, seed = 1, seconds = 60, muzzle = 'modern', kiteRadius = 150 }) {
    const config = encounterConfig(tech, phase);
    resetBuild(); clearWorld(); clearFocus();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null }, equippedPet: null });
    Object.assign(G, { tech, difficulty: 'easy', mode: 'play', stage: config.stage, clock: 0, time: 0,
        kills: 0, gold: 0, events: {}, damageBy: {}, boss: null, lowQ: true, godMode: false, paused: false,
        caps: { enemies: 100, particles: 0, texts: 0, gems: 200, pickups: 30, decalScale: 0 }, view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    for (const id of ['rabbit1', 'rabbit2', 'rabbit3']) atlases[id] = { walkH: 112, frameCount: () => 8 };
    if (muzzle === 'modern') images.playerFire = { width: 3072, height: 256 };
    else delete images.playerFire;
    createPlayer();
    G.weapons = config.build.map((w, slot) => Object.assign(createWeapon(w.id, slot), w));
    G.passives = { ...config.passives };
    recomputeStats(true);
    assert.equal(G.player.dead, false);
    assert.equal(G.godMode, false);
    // No weapon suppression here: the actual registry determines the kit.
    const stats = { ...G.player.stats }, tier = resonanceTier();
    const weapons = G.weapons.map(w => ({ ...config.build.find(b => b.id === w.id), stats: weaponStats(w) }));
    let hp = G.player.hp, hpLost = 0, hpRestored = 0, damagingHits = 0;
    Object.defineProperty(G.player, 'hp', {
        configurable: true, enumerable: true, get: () => hp,
        set(value) {
            const previous = Math.max(0, hp), next = Math.max(0, value);
            if (next < previous) { hpLost += previous - next; damagingHits++; }
            else hpRestored += next - previous;
            hp = value;
        },
    });
    let rng = seed >>> 0, spawned = 0, attempts = 0, peakEnemies = 0, peakEnemyShots = 0, peakFriendlyShots = 0;
    const original = Math.random;
    Math.random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
    const dt = 1 / 60, frames = Math.round(seconds / dt);
    try {
        for (let frame = 0; frame < frames && !G.player.dead; frame++) {
            G.clock = G.time = (frame + 1) * dt;
            // Same prescribed full-speed circular movement for every tech.
            const angle = G.clock * G.player.stats.speed / kiteRadius;
            Object.assign(input.move, { x: -Math.sin(angle), y: Math.cos(angle) });
            updatePlayer(dt);
            G.camera.x = G.player.x; G.camera.y = G.player.y;
            if (frame % config.spawnEveryFrames === 0) {
                const angle = attempts * 2.39996323 + seed;
                const type = config.spawnTypes[attempts % config.spawnTypes.length];
                attempts++;
                if (spawnEnemy(type, G.player.x + Math.cos(angle) * 210, G.player.y + Math.sin(angle) * 180, { force: true })) spawned++;
            }
            updateEnemies(dt);
            if (!G.player.dead) updateWeapons(dt);
            updateShots(dt);
            updateEnemyShots(dt);
            updateHazards(dt);
            peakEnemies = Math.max(peakEnemies, G.enemies.count);
            peakEnemyShots = Math.max(peakEnemyShots, G.enemyShots.count);
            peakFriendlyShots = Math.max(peakFriendlyShots, G.shots.count);
        }
        const alive = G.enemies.items.slice(0, G.enemies.count).filter(e => e.alive).length;
        return { tech, name: TECHS[tech].name, phase, seed, kiteRadius, config, stats, resonanceTier: tier, weapons,
            survivalSeconds: round(Math.min(seconds, G.clock)), survived: !G.player.dead,
            hpRemaining: round(G.player.hp), maxHp: G.player.maxHp, hpRemainingFraction: round(G.player.hp / G.player.maxHp),
            hpLost: round(hpLost), hpRestored: round(hpRestored), damagingHits,
            kills: G.kills, spawned, attempts, aliveEnemies: alive,
            killsPerSecondAlive: round(G.kills / G.clock),
            peakEnemies, peakEnemyShots, peakFriendlyShots,
            damageBy: Object.fromEntries(Object.entries(G.damageBy).map(([id, value]) => [id, round(value)])) };
    } finally {
        Math.random = original;
        Object.assign(input.move, { x: 0, y: 0 }); clearFocus();
    }
}

function summarize(rows) {
    const range = key => [Math.min(...rows.map(r => r[key])), Math.max(...rows.map(r => r[key]))];
    const mean = key => round(rows.reduce((sum, r) => sum + r[key], 0) / rows.length);
    return { runs: rows.length, survived: rows.filter(r => r.survived).length,
        survivalSeconds: { range: range('survivalSeconds'), mean: mean('survivalSeconds') },
        kills: { range: range('kills'), mean: mean('kills') },
        hpRemaining: { range: range('hpRemaining'), mean: mean('hpRemaining') },
        maxHp: rows[0].maxHp, hpLost: { range: range('hpLost'), mean: mean('hpLost') },
        spawned: { range: range('spawned'), mean: mean('spawned') } };
}

async function runChild(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], { cwd: repoRoot });
        let stdout = '', stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error(`${args.join(' ')}: ${stderr || stdout}`));
            try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
        });
    });
}
async function runLimited(jobs, concurrency = 4) {
    const results = new Array(jobs.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
        while (next < jobs.length) { const i = next++; results[i] = await jobs[i](); }
    }));
    return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
    const seconds = Math.max(1, Number(args.seconds) || 60), muzzle = args.muzzle || 'modern';
    assert.ok(['modern', 'legacy'].includes(muzzle));
    const kiteRadius = args['kite-radius'] === undefined ? 150 : Number(args['kite-radius']);
    assert.ok(Number.isFinite(kiteRadius) && kiteRadius >= 50 && kiteRadius <= 1000);
    const plagueVariant = args['plague-variant'] || 'current';
    assert.ok(['current', 'area20', 'amount1', 'tier2damage25', 'level5damage25'].includes(plagueVariant));
    if (args.single) {
        // Diagnostic-only in-memory candidate. No source or save writes.
        if (plagueVariant === 'area20') TECHS.plague.tiers[0].weapon.area = (TECHS.plague.tiers[0].weapon.area || 0) + .2;
        if (plagueVariant === 'amount1') TECHS.plague.tiers[0].weapon.amount = (TECHS.plague.tiers[0].weapon.amount || 0) + 1;
        if (plagueVariant === 'tier2damage25') TECHS.plague.tiers[1].weapon.dmg = (TECHS.plague.tiers[1].weapon.dmg || 0) + .25;
        if (plagueVariant === 'level5damage25') TECHS.plague.imprints[5].mod.dmg = (TECHS.plague.imprints[5].mod.dmg || 0) + .25;
        console.log(JSON.stringify(runSurvivalEncounter({ tech: args.tech, phase: args.phase, seed: +args.seed, seconds, muzzle, kiteRadius })));
    } else {
        const seeds = (args.seeds || '1,7,13').split(',').map(Number);
        assert.ok(seeds.length && seeds.every(Number.isSafeInteger));
        const techs = (args.techs || Object.keys(ROUTES).join(',')).split(',');
        assert.ok(techs.length && techs.every(tech => Object.hasOwn(ROUTES, tech)));
        const phases = (args.phases || DEFAULT_PHASES.join(',')).split(',');
        assert.ok(phases.length && phases.every(phase => PHASES.includes(phase)));
        const hashesBefore = sourceHashes(), summary = {}, jobs = [];
        for (const phase of phases) for (const tech of techs) for (const seed of seeds) jobs.push(() =>
            // Fresh process resets internal enemy IDs, separation parity and
            // module-local counters, not just the public world pools.
            runChild(['--single=1', `--tech=${tech}`, `--phase=${phase}`, `--seed=${seed}`,
                `--seconds=${seconds}`, `--muzzle=${muzzle}`, `--plague-variant=${plagueVariant}`,
                `--kite-radius=${kiteRadius}`,
                ...(baselineCommit ? [`--baseline=${baselineCommit}`] : [])]));
        const runs = await runLimited(jobs);
        for (const phase of phases) summary[phase] = Object.fromEntries(techs.map(tech =>
            [tech, summarize(runs.filter(row => row.phase === phase && row.tech === tech))]));
        const hashesAfter = sourceHashes();
        assert.deepEqual(hashesAfter, hashesBefore, 'combat source changed during report; rerun against one stable snapshot');
        console.log(JSON.stringify({
            method: 'Finite actual enemies, incoming contact/ranged/hazard damage and real player, weapon, projectile and hazard updates at60Hz. Fresh isolated process per tech/phase/seed. Runtime is loaded from the named immutable baseline commit or the unchanged working-tree source hashes.',
            budgets: 'Actual starter uses true new-run weapon(s) plus one Lv1 passive. Equal mid: two Lv6 weapons plus three Lv3 family passives = 21 item levels, zero evolution rewards. Equal evolved: two Lv8 evolved weapons plus three Lv3 passives = 25 item levels and two separate evolution rewards. Required evolution partners are asserted; evolved Executioner replaces whet with scope, retaining focus/scope/madness and resonanceII. Current Butcher uses sword+saw; a baseline without sword uses saw+thorns.',
            pressure: `Prescribed full-speed circular kiting with radius ${kiteRadius}; spawn ellipse 210x180 follows player. Stage1: one every 0.9s, four shamblers per runner. Stage6: one every 0.6s, cycling shambler/runner/brute/spitter/gunner. Normal finite HP, speed and incoming damage use real stage scaling. No boss or manual focus.`,
            limitations: [
                `One prescribed movement pattern and ${seeds.length} seeds are a stress diagnostic, not proof of overall parity, win rate, boss balance or player skill.`,
                'Each build is a fixed legal combat preset, not a full progression simulation; equal_mid is intentionally unevolved, while equal_evolved includes its actual partner passives and two separate evolution rewards.',
                'No pickup collection, health drops, level-ups, equipment, relics, permanent upgrades, pets, costumes, adaptive dodging or real spawner scheduling.',
                'Different weapons consume different amounts of RNG; seeds and spawn schedules match, but subsequent random speed/drop draws can diverge.',
                'Survival is capped at the requested duration; early deaths face fewer spawns, so compare kill counts with survival and spawned counts.',
                'Current report uses the selected muzzle and isolated module state. Older ephemeral probes may differ in muzzle or module-counter state, so their ranges are directional context rather than a controlled before/after.',
            ],
            seconds, seeds, muzzle, kiteRadius, plagueVariant, baselineCommit, sourceHashes: hashesBefore, summary, runs,
        }, null, 2));
    }
}
