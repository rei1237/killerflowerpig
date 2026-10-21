// Finite real-runtime wave-clear and isolated first-volley coverage diagnostics.
// node tools/nongun-wave-qa.mjs > docs/nongun-wave-evidence.json
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats, updatePlayer } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, activeWeaponCores, resetWeaponRuntime } from '../src/game/weapons.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { updateHazards } from '../src/game/hazards.js';
import { resetBuild } from '../src/game/progression.js';
import { clearFocus } from '../src/game/targeting.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ENEMY_TOUGHNESS_MULTIPLIER } from '../src/data/enemies.js';
import { TECHS } from '../src/data/techs.js';
import { save } from '../src/core/save.js';
import { atlases, images } from '../src/core/assets.js';
import { input } from '../src/core/input.js';

export const NONGUN_IDS = ['saw', 'sword', 'molotov', 'gas', 'thorns'];
export const WAVE_SCENES = ['dense', 'spread', 'moving'];
export const WAVE_PHASES = ['base', 'mid', 'evolved'];
const sourceFiles = ['src/data/weapons.js', 'src/data/techs.js', 'src/data/enemies.js', 'src/data/fusions.js',
    'src/game/weapons.js', 'src/game/enemies.js', 'src/game/hazards.js', 'src/game/player.js',
    'src/game/butcher-sword.js', 'src/game/plague-targeting.js', 'src/game/thorn-charges.js', 'tools/nongun-wave-qa.mjs'];
const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file,
    file === 'src/game/weapons.js' && globalThis.__nongunRuntimeBaseline
        ? globalThis.__nongunRuntimeBaseline.sha256
        : createHash('sha256').update(fs.readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex')]));
const ROUTES = { gunline: ['shotgun', 'rifle'], executioner: ['pistols', 'rifle'],
    bloom: ['thorns', 'cannon'], plague: ['molotov', 'gas'], butcher: ['sword', 'saw'] };
const round = value => +value.toFixed(3);
// 무기 데이터 전후 비교는 측정 당시의 적 체력(강인함 1.62)에 고정한다. 이후 적 강화가 무기 비교를 흔들지 않게.
const BENCH_HP = 1.62 / ENEMY_TOUGHNESS_MULTIPLIER;
const baseline = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/nongun-data-before.json', import.meta.url)));
export function withBeforeData(run) {
    const current = Object.fromEntries(NONGUN_IDS.map(id => [id, WEAPONS[id]]));
    try {
        for (const id of NONGUN_IDS) WEAPONS[id] = structuredClone(baseline.weapons[id]);
        return run();
    } finally { for (const id of NONGUN_IDS) WEAPONS[id] = current[id]; }
}
export function waveConfiguration(id, phase, route = false) {
    assert.ok(WAVE_PHASES.includes(phase));
    const level = { base: 1, mid: 4, evolved: 8 }[phase];
    const stage = { base: 2, mid: 4, evolved: 6 }[phase];
    const passiveLevel = { base: 1, mid: 2, evolved: 5 }[phase];
    const ids = route ? ROUTES[id] : [id];
    const tech = route ? id : { saw: 'butcher', sword: 'butcher', molotov: 'plague', gas: 'plague', thorns: 'bloom',
        shotgun: 'gunline', rifle: 'gunline', pistols: 'executioner' }[id];
    assert.ok(ids && tech);
    const partners = phase === 'base' ? [TECHS[tech].start.passive] : route
        ? tech === 'executioner' ? ['focus', 'scope', 'madness'] : TECHS[tech].family.passives
        : [WEAPONS[id].evolve.with];
    const passives = Object.fromEntries(partners.map(partner => [partner, passiveLevel]));
    if (!route) {
        // Single-weapon comparisons use their own actual evolution partner.
        for (const key of Object.keys(passives)) delete passives[key];
        passives[WEAPONS[id].evolve.with] = passiveLevel;
    }
    const build = ids.map(id => ({ id, level, evolved: phase === 'evolved' }));
    const investment = build.reduce((sum, w) => sum + w.level, 0) + Object.values(passives).reduce((a, b) => a + b, 0);
    for (const w of build) if (w.evolved) assert.ok(passives[WEAPONS[w.id].evolve.with], `missing ${w.id} partner`);
    return { tech, stage, build, passives, investment, evolutionRewards: phase === 'evolved' ? build.length : 0 };
}

export function runFiniteWave({ id = 'saw', phase = 'mid', scene = 'dense', route = false,
    seed = 1, seconds = 45, oneCast = false, count = 12, legendary = false, godMode = true, configOverride = null } = {}) {
    assert.ok(WAVE_SCENES.includes(scene));
    const config = configOverride || waveConfiguration(id, phase, route);
    resetBuild(); clearWorld(); clearFocus(); resetWeaponRuntime();
    Object.assign(save, { upgrades: legendary ? { lotus_gun: 1 } : {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null }, equippedPet: null });
    Object.assign(G, { tech: config.tech, stage: config.stage, mode: 'play', time: 0, clock: 0,
        difficulty: 'easy', kills: 0, gold: 0, events: {}, damageBy: {}, boss: null, lowQ: true,
        godMode, paused: false, caps: { enemies: 100, particles: 0, texts: 0, gems: 300, pickups: 30, decalScale: 0 },
        view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    for (const sheet of ['rabbit1', 'rabbit2', 'rabbit3']) atlases[sheet] = { walkH: 112, frameCount: () => 8 };
    images.playerFire = { width: 3072, height: 256 };
    createPlayer();
    G.weapons = config.build.map((w, slot) => Object.assign(createWeapon(w.id, slot), w, { cd: 0 }));
    G.passives = { ...config.passives }; recomputeStats(true);
    const stats = G.weapons.map(w => ({ id: w.id, ...weaponStats(w) }));
    const originalRandom = Math.random; let rng = seed >>> 0;
    Math.random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
    const targets = [], hitIds = new Set(), firstCastHitIds = new Set();
    let effectiveDamage = 0, hitEvents = 0, clearTime = null, t50 = null, t90 = null;
    let peakShots = 0, peakFields = 0, casts = 0;
    try {
        for (let i = 0; i < count; i++) {
            const angle = i * Math.PI * 2 / count + seed * .17;
            const type = i % 5 === 0 ? 'brute' : i % 3 === 0 ? 'runner' : 'shambler';
            const radius = 190 + (i % 3) * 35;
            const x = scene === 'dense' ? 130 + (i % 6) * 26 : Math.cos(angle) * radius;
            const y = scene === 'dense' ? (Math.floor(i / 6) - 1.5) * 28 : Math.sin(angle) * radius * .8;
            const enemy = spawnEnemy(type, x, y, { hpMul: BENCH_HP });
            assert.ok(enemy, 'wave must fit the real population cap');
            // Stable IDs reset separation parity between runs. Normal targets retain
            // real finite stage HP, movement, hitbox, slow, bleed, knockback and death.
            enemy.id = i + 1;
            let hp = enemy.hp;
            const target = { enemy, hp: enemy.maxHp, type, id: i + 1, firstHit: null };
            Object.defineProperty(enemy, 'hp', { configurable: true, enumerable: true, get: () => hp, set(value) {
                if (value < hp && hp > 0) {
                    effectiveDamage += Math.min(hp, hp - value); hitEvents++; hitIds.add(target.id);
                    if (oneCast) firstCastHitIds.add(target.id);
                    target.firstHit ??= G.clock;
                }
                hp = value;
            } });
            targets.push(target);
            G.grid.insert(enemy);
        }
        const dt = 1 / 60, limit = oneCast ? 4 : seconds;
        for (let frame = 0; frame < Math.ceil(limit / dt); frame++) {
            G.clock = (frame + 1) * dt;
            // Spawn HP is stage-start HP; no artificial immortal/elite probe or HP multiplier.
            // Only moving scene kites. Every scene uses real enemy pursuit/separation.
            const angle = G.clock * G.player.stats.speed / 100;
            Object.assign(input.move, { x: scene === 'moving' ? -Math.sin(angle) : 0,
                y: scene === 'moving' ? Math.cos(angle) : 0 });
            updatePlayer(dt);
            G.camera.x = G.player.x; G.camera.y = G.player.y;
            updateEnemies(dt);
            const due = G.weapons.map(w => ({ w, due: w.cd <= dt, priorSwing: G.player.swordSwing?.at }));
            if (oneCast && casts > 0) for (const w of activeWeaponCores()) { w.cd = Infinity; w.trailT = Infinity; }
            updateWeapons(dt);
            if (oneCast) for (const w of G.weapons) if (w.thornState) {
                // One-cast coverage for charge thorns means the initial ready
                // petals only, not later regenerated charges in this 4s window.
                for (const slot of w.thornState.slots) if (!slot.ready) slot.readyAt = Infinity;
            }
            for (const { w, due: ready, priorSwing } of due) if (ready && (!oneCast || casts === 0)) {
                if (w.id !== 'sword' || G.player.swordSwing?.at !== priorSwing) casts++;
            }
            // A melee opening with no enemy in reach should wait for one actual release,
            // not record an empty ready attempt as a cast.
            if (oneCast && id === 'sword' && casts === 0) G.weapons[0].cd = 0;
            updateShots(dt); updateHazards(dt);
            peakShots = Math.max(peakShots, G.shots.count); peakFields = Math.max(peakFields, G.hazards.count);
            const killed = targets.filter(t => !t.enemy.alive).length;
            if (killed >= count / 2) t50 ??= G.clock;
            if (killed >= Math.ceil(count * .9)) t90 ??= G.clock;
            // Complete the even frame budget after clear so the runtime's alternating
            // separation parity begins identically in the next before/after probe.
            if (killed === count) clearTime ??= G.clock;
        }
        return { id, phase, scene, route, seed, oneCast, legendary, godMode, playerHP: G.player.hp, config, stats,
            hpRange: [Math.min(...targets.map(t => t.hp)), Math.max(...targets.map(t => t.hp))].map(round),
            totalHp: round(targets.reduce((sum, t) => sum + t.hp, 0)), kills: targets.filter(t => !t.enemy.alive).length,
            remainingHp: round(targets.reduce((sum, t) => sum + (t.enemy.alive ? Math.max(0, t.enemy.hp) : 0), 0)),
            effectiveDamage: round(effectiveDamage), hitEvents, uniqueTargets: hitIds.size,
            firstCastUniqueTargets: oneCast ? firstCastHitIds.size : null, casts,
            t50: t50 === null ? null : round(t50), t90: t90 === null ? null : round(t90),
            clearTime: clearTime === null ? null : round(clearTime), observedSeconds: round(G.clock),
            peakShots, peakFields };
    } finally {
        for (const { enemy } of targets) { const hp = enemy.hp; delete enemy.hp; enemy.hp = hp; }
        Math.random = originalRandom; Object.assign(input.move, { x: 0, y: 0 }); clearFocus();
    }
}

export function summarizeWaves(rows) {
    const mean = key => round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
    const cleared = rows.filter(row => row.clearTime !== null);
    return { runs: rows.length, cleared: cleared.length, meanKills: mean('kills'),
        meanClearTime: cleared.length === rows.length ? round(cleared.reduce((sum, row) => sum + row.clearTime, 0) / cleared.length) : null,
        meanCappedClearTime: round(rows.reduce((sum, row) => sum + (row.clearTime ?? row.observedSeconds), 0) / rows.length),
        meanUniqueTargets: mean('uniqueTargets'), meanEffectiveDamage: mean('effectiveDamage'),
        peakShots: Math.max(...rows.map(row => row.peakShots)), peakFields: Math.max(...rows.map(row => row.peakFields)) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
    const seeds = (args.seeds || '1,7,13').split(',').map(Number);
    const phases = (args.phases || WAVE_PHASES.join(',')).split(',');
    assert.ok(seeds.every(Number.isSafeInteger) && phases.every(phase => WAVE_PHASES.includes(phase)));
    const ids = (args.ids || NONGUN_IDS.join(',')).split(',');
    const routes = (args.routes || 'gunline,executioner,bloom,plague,butcher').split(',').filter(Boolean);
    const hashes = sourceHashes(), runs = [], summary = {};
    const variants = args.variant === 'before' ? [true] : args.variant === 'after' ? [false] : [true, false];
    for (const before of variants) {
        const label = before ? 'before' : 'after';
        const execute = () => {
            for (const phase of phases) for (const scene of WAVE_SCENES) {
                for (const route of [false, true]) for (const id of route ? routes : ids) {
                    for (const oneCast of route ? [false] : [true, false]) {
                        const rows = seeds.map(seed => runFiniteWave({ id, phase, scene, route, seed, oneCast }));
                        runs.push(...rows.map(row => ({ variant: label, ...row })));
                        summary[`${label}:${route ? 'route' : 'weapon'}:${id}:${phase}:${scene}:${oneCast ? 'oneCast' : 'wave'}`] = summarizeWaves(rows);
                    }
                }
            }
        };
        if (before) withBeforeData(execute); else execute();
    }
    console.log(JSON.stringify({
        method: '60Hz real finite enemy spawn, pursuit, separation, slow, bleed, knockback, collision, weapon, projectile, field and death updates. 24 fixed targets, 45-second clear limit; independent one-cast probes observe 4 seconds. Player is invulnerable solely to isolate clear efficiency.',
        budgets: 'Equal two-weapon route budgets: base 3 item levels; mid 14; evolved 31 plus two evolution rewards. Single weapons use their own evolution partner and equal 2/6/13 item levels.',
        limitations: ['Not a survival or full progression/win-rate model; one prescribed kiting policy.',
            'One-cast unique hits is a finite four-second coverage probe, not static DPS. Bleed counts as delivered damage; expired distant projectiles and fixed fields cannot acquire credit without collision.',
            'Data-only before/after changes exactly saw, sword, molotov, gas and thorns; cannon and shared runtime stay identical within the report.',
            'Same seeds and spawn positions, but crit/effect RNG can diverge between weapon kits; aggregate three seeds.',
            'Stage-start HP at stages 2/4/6; no elites, bosses, pickups, equipment, pets, relics or permanent upgrades.'],
        runtimeBaseline: globalThis.__nongunRuntimeBaseline || null,
        sourceHashes: hashes, sourceFilesChangedOnDiskDuringRun: Object.entries(sourceHashes()).filter(([file, hash]) => hash !== hashes[file]).map(([file]) => file),
        seeds, phases, summary, runs,
    }, null, 2));
}
