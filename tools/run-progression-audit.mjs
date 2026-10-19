import { BOSS_XP_GEMS, bossGemValue } from '../src/data/boss-rewards.js';
// Bounded planning audit, NOT an autonomous combat/survival playtest.
// Wave XP uses the real director, spawn/death/drop code under declared residency
// assumptions. Choices, rerolls, chest evolution, exchanges and fusion are real.
import { pathToFileURL } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer } from '../src/game/player.js';
import { createWeapon } from '../src/game/weapons.js';
import { STARTING_WEAPON, WEAPONS, MAX_WEAPONS } from '../src/data/weapons.js';
import { STAGES } from '../src/data/stages.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';
import { resetSpawner, updateSpawner } from '../src/game/spawner.js';
import { updateEncirclement } from '../src/game/encirclement.js';
import { hitEnemy, flushExplosions } from '../src/game/enemies.js';
import { resetBuild, addXP, xpForLevel, rollChoices, applyChoice, beginChoiceSession,
    consumeChoiceReroll, finishChoiceSession, rollBossChest } from '../src/game/progression.js';
import { previewFusion, fuseItems } from '../src/game/fusion.js';
import { settings } from '../src/core/settings.js';

export const XP_SCENARIOS = [
    { id: 'slow', residency: 24, collection: .70 },
    { id: 'central', residency: 16, collection: .85 },
    { id: 'fast', residency: 8, collection: .95 },
];
export const PLAN_RECIPES = {
    planned: ['scatter_rail', 'lotus_bloom', 'plague_fire'],
    twoFinal: ['scatter_rail', 'lotus_bloom'],
    absolute: ['absolute_bloom', 'scatter_rail'],
};
export function seeded(seed) {
    let state = seed >>> 0;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function world() {
    clearWorld(); resetBuild(); createPlayer();
    Object.assign(G, { mode: 'play', paused: false, stage: 1, time: 0, clock: 0, gold: 0, kills: 0,
        events: {}, damageBy: {}, lowQ: false, stageStartTime: 0,
        view: { w: 1000, h: 600 }, caps: { enemies: 252, particles: 0, texts: 0, gems: 500, decalScale: 0 } });
}

export function estimateWaveXP({ residency = 16, seed = 7, lowQ = false, dt = .1 } = {}) {
    if (!(residency > 0 && dt > 0)) throw Error('Positive residency and timestep required');
    const original = Math.random, gore = settings.gore;
    Math.random = seeded(seed); settings.gore = 'off';
    try {
        const rows = [];
        for (let stage = 1; stage <= 10; stage++) {
            world(); G.stage = stage; G.lowQ = lowQ; G.caps.enemies = lowQ ? 156 : 252;
            resetSpawner(); const expires = new Map(); let xp = 0, peak = 0, eliteKills = 0;
            G.events.kill = e => { if (e.elite) eliteKills++; };
            for (let frame = 0; frame < Math.ceil(STAGES[stage].duration / dt); frame++) {
                G.time = G.clock = frame * dt; updateEncirclement(dt); updateSpawner(dt);
                peak = Math.max(peak, G.enemies.count);
                for (let i = G.enemies.count - 1; i >= 0; i--) {
                    const e = G.enemies.items[i];
                    if (!expires.has(e.id)) expires.set(e.id, G.time + residency * (e.elite ? 3 : 1));
                    if (!e.alive) { e.deadT += dt; if (e.deadT > .15) G.enemies.release(i); }
                    else if (G.time >= expires.get(e.id)) hitEnemy(e, e.hp + 1, { silent: true });
                }
                // Empty collision grid: no unmodeled explosion chain damage.
                // Real killEnemy still produces splitter children and all XP drops.
                flushExplosions();
                for (let i = 0; i < G.gems.count; i++) xp += G.gems.items[i].value;
                G.gems.clear(); G.pickups.clear(); G.hazards.clear();
            }
            rows.push({ stage, waveXP: xp, bossXP: BOSS_XP_GEMS * bossGemValue(stage), kills: G.kills,
                eliteKills, peak, uncreditedSurvivors: G.enemies.items.slice(0, G.enemies.count).filter(e => e.alive).length });
        }
        return rows;
    } finally { Math.random = original; settings.gore = gore; }
}

function build() {
    return { level: G.level, weapons: G.weapons.map(w => ({ id: w.id, level: w.level, evolved: !!w.evolved })),
        passives: { ...G.passives }, stats: { ...G.player.stats },
        finals: G.weapons.filter(w => WEAPONS[w.id].fusionOnly && WEAPONS[w.id].tier !== 'absolute').length,
        absolutes: G.weapons.filter(w => WEAPONS[w.id].tier === 'absolute').length };
}
function recipesFor(mode) { return (PLAN_RECIPES[mode] || FUSION_RECIPES.map(r => r.id)).map(id => FUSION_RECIPES.find(r => r.id === id)); }
function fuseReady(mode, log) {
    for (const recipe of recipesFor(mode)) {
        const preview = previewFusion(recipe.id);
        if (!preview.ok) continue;
        const result = fuseItems(recipe.id, preview.signature);
        if (!result.ok) throw Error(`Rejected valid fusion: ${recipe.id}`);
        log.push({ stage: G.stage, id: recipe.id, level: G.level });
    }
}
function scoreCard(c, mode) {
    const recipes = recipesFor(mode).filter(r => !G.weapons.some(w => w.id === r.output));
    const parentIndex = recipes.findIndex(r => r.inputs.some(i => i.id === c.id));
    if (c.kind === 'weapon' && parentIndex >= 0) return 200 - parentIndex * 25 + c.level * 3;
    if (c.kind === 'passive') {
        const required = recipes.flatMap(r => r.inputs).filter(i => WEAPONS[i.id].evolve.with === c.id);
        if (required.length) {
            const ready = required.some(i => G.weapons.some(w => w.id === i.id && w.level >= 7 && !w.evolved));
            if (c.isNew) return ready ? 320 : 140;
            return 60 + c.level;
        }
        // An absolute + one final leaves one optional passive slot for damage.
        if (mode === 'absolute' && c.id === 'whet') return c.isNew ? 90 : 60 + c.level;
        if (mode === 'twoFinal' && ['whet', 'heart'].includes(c.id)) return c.isNew ? 90 : 60 + c.level;
        const allRequired = new Set(recipesFor(mode).flatMap(r => r.inputs).map(i => WEAPONS[i.id].evolve.with));
        if (allRequired.has(c.id)) return 50 + c.level;
    }
    if (c.kind === 'weapon' && recipesFor(mode).some(r => r.output === c.id)) return 100 + c.level;
    return -1;
}

export function simulatePlan({ rows, collection = .85, mode = 'planned', seed = 1, chestFirst = true } = {}) {
    if (!Array.isArray(rows) || rows.length !== 10) throw Error('Exactly ten XP rows required');
    const original = Math.random; Math.random = seeded(seed);
    try {
        world(); G.weapons = [createWeapon(STARTING_WEAPON, 0)];
        const log = { choices: 0, rerolls: 0, skips: 0, itemChoices: {}, fusions: [], exchanges: [],
            evolutions: [], chestUpgrades: 0, premiumUpgrades: 0, stages: [] };
        function processXP(xp) {
            addXP(xp);
            while (G.pendingLevelUps > 0) {
                G.pendingLevelUps--; const session = beginChoiceSession(); let cards = rollChoices(3);
                if (mode !== 'scattered' && Math.max(...cards.map(c => scoreCard(c, mode))) < 140) {
                    const reroll = consumeChoiceReroll(session.id, session.revision);
                    if (reroll.ok) { log.rerolls++; cards = rollChoices(3); }
                }
                const selected = mode === 'scattered' ? cards[Math.floor(Math.random() * cards.length)]
                    : cards.slice().sort((a, b) => scoreCard(b, mode) - scoreCard(a, mode))[0];
                if (mode !== 'scattered' && scoreCard(selected, mode) < 0) log.skips++;
                else {
                    if (!applyChoice(selected)) throw Error(`Invalid real choice ${selected.id}`);
                    log.itemChoices[selected.id] = (log.itemChoices[selected.id] || 0) + 1;
                }
                log.choices++; finishChoiceSession(session.id);
                fuseReady(mode, log.fusions);
                if (G.weapons.length > MAX_WEAPONS) throw Error('Slot budget exceeded');
            }
        }
        for (const row of rows) {
            G.stage = row.stage;
            processXP(row.waveXP * collection);
            fuseReady(mode, log.fusions);
            const beforeBoss = build();
            if (!chestFirst) processXP(row.bossXP * collection);
            const reward = rollBossChest(`audit:${seed}:${mode}:${row.stage}`);
            if (!reward.ok) throw Error('Boss chest failed');
            for (const r of reward.rewards) {
                if (r.kind === 'evolve') log.evolutions.push({ stage: row.stage, id: r.id });
                else if (r.levelsGained) { log.chestUpgrades += r.levelsGained; if (r.premium) log.premiumUpgrades += r.levelsGained; }
            }
            fuseReady(mode, log.fusions);
            if (chestFirst) processXP(row.bossXP * collection);
            log.stages.push({ stage: row.stage, beforeBoss, afterReward: build(),
                chestEvolutions: reward.rewards.filter(r => r.kind === 'evolve').length,
                waitingForChest: G.weapons.filter(w => !w.evolved && w.level === 8 && WEAPONS[w.id].evolve && G.passives[WEAPONS[w.id].evolve.with]).map(w => w.id) });
        }
        return { seed, mode, collection, chestFirst, ...log };
    } finally { Math.random = original; }
}
function distribution(values) { const out = {}; for (const n of values) out[n] = (out[n] || 0) + 1; return out; }
function quantiles(values) { const sorted = values.slice().sort((a, b) => a - b); return [0, .1, .5, .9, 1].map(p => sorted[Math.floor((sorted.length - 1) * p)]); }
export function summarizePlans(runs) {
    return { seeds: runs.length, beforeBoss10Finals: distribution(runs.map(r => r.stages[9].beforeBoss.finals)),
        beforeBoss10Absolutes: distribution(runs.map(r => r.stages[9].beforeBoss.absolutes)),
        afterBoss10Finals: distribution(runs.map(r => r.stages[9].afterReward.finals)),
        choicesMinP10P50P90Max: quantiles(runs.map(r => r.choices)),
        skipsMinP10P50P90Max: quantiles(runs.map(r => r.skips)),
        exchangesUsed: runs.filter(r => r.exchanges.length).length,
        firstFusionStage: distribution(runs.map(r => r.fusions[0]?.stage || 'none')),
        beforeBossByStage: Array.from({ length: 10 }, (_, i) => ({ stage: i + 1,
            levels: quantiles(runs.map(r => r.stages[i].beforeBoss.level)),
            finals: distribution(runs.map(r => r.stages[i].beforeBoss.finals)),
            absolutes: distribution(runs.map(r => r.stages[i].beforeBoss.absolutes)) })),
        representative: runs[Math.floor(runs.length / 2)] };
}
export function runAudit({ seeds = 200 } = {}) {
    return { method: 'Synthetic residency + actual director/death XP. No survival simulation. Chest-first; one free reroll per planned choice, optional one run exchange; no purchases.',
        xpCurve: { level1: xpForLevel(1), level20: xpForLevel(20), level40: xpForLevel(40) },
        scenarios: XP_SCENARIOS.map(s => {
            const rows = estimateWaveXP(s);
            return { ...s, rows, collectedXP: rows.reduce((n, r) => n + (r.waveXP + r.bossXP) * s.collection, 0),
                plans: Object.fromEntries(['planned', 'scattered', 'absolute'].map(mode => [mode,
                    summarizePlans(Array.from({ length: seeds }, (_, i) => simulatePlan({ rows, collection: s.collection, mode, seed: i + 1 }))) ])) };
        }) };
}
export function makeBossBuildFixtures() {
    const rows = estimateWaveXP({ residency: 16, seed: 7 });
    const specs = [['mid invested/evolved build', 'planned', 1, 5], ['late two-final build', 'twoFinal', 101, 10],
        ['late three-final build', 'planned', 101, 10], ['late absolute plus one final', 'absolute', 101, 10]];
    return { method: 'Actual rollChoices/rollBossChest; 16s ordinary/48s elite synthetic residency, 85% collected XP, spawn seed7, chest before boss XP, no permanent purchases. Pre-boss snapshots.',
        builds: specs.map(([name, mode, seed, stage]) => ({ name, mode, seed, stage, distance: 130,
            ...simulatePlan({ rows, collection: .85, mode, seed }).stages[stage - 1].beforeBoss })) };
}
export function runSensitivity({ seeds = 100 } = {}) {
    const result = { spawnSensitivity: [] };
    for (const residency of [8, 16, 24]) {
        const totals = Array.from({ length: 10 }, (_, i) => estimateWaveXP({ residency, seed: i + 1 }).reduce((n, r) => n + r.waveXP + r.bossXP, 0));
        result.spawnSensitivity.push({ residency, min: Math.min(...totals), max: Math.max(...totals) });
    }
    for (const lowQ of [false, true]) {
        const rows = estimateWaveXP({ lowQ });
        result[lowQ ? 'lowQuality' : 'highQuality'] = { totalXP: rows.reduce((n, r) => n + r.waveXP + r.bossXP, 0) * .85,
            ...summarizePlans(Array.from({ length: seeds }, (_, i) => simulatePlan({ rows, seed: i + 1 }))) };
    }
    const rows = estimateWaveXP();
    result.chestXPFirst = summarizePlans(Array.from({ length: seeds }, (_, i) => simulatePlan({ rows, seed: i + 1, chestFirst: false })));
    return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const flags = new Set(process.argv.slice(2));
    const seeds = Number(process.argv.slice(2).find(s => /^\d+$/.test(s))) || 200;
    const result = flags.has('--fixtures') ? makeBossBuildFixtures()
        : flags.has('--sensitivity') ? { audit: runAudit({ seeds }), sensitivity: runSensitivity() } : runAudit({ seeds });
    console.log(JSON.stringify(result, flags.has('--compact') ? (key, value) => key === 'representative' ? undefined : value : null, 2));
}
