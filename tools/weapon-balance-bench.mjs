// Weapon/passive balance bench: real spawner, real kiting player, real weapons.
// node tools/weapon-balance-bench.mjs [--ids=shotgun,rifle] [--tiers=base,mid,max,evolved,fused] [--home] [--passives] [--routes]
// --routes: each tech's real route build (family weapons + family passives) per phase, the closest to a played run.
// Arena: stage director at mid-stage, player circles, 40s → kills/min and damage taken.
// Boss: real stage boss (immortal HP, focused by the player), same circling player, 30s → boss DPS.
// No tech, no shop upgrades: weapon identity only. Passive mode adds one passive Lv5 to a fixed Lv4 shotgun+thorns kit.
import { pathToFileURL } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats, updatePlayer } from '../src/game/player.js';
import { createWeapon, updateWeapons, updateShots, resetWeaponRuntime } from '../src/game/weapons.js';
import { updateEnemies, updateEnemyShots, flushExplosions } from '../src/game/enemies.js';
import { updateHazards } from '../src/game/hazards.js';
import { resetSpawner, updateSpawner } from '../src/game/spawner.js';
import { resetBuild } from '../src/game/progression.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { Boss } from '../src/game/boss.js';
import { WEAPONS, PASSIVES } from '../src/data/weapons.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';
import { STAGES } from '../src/data/stages.js';
import { SPRITES } from '../src/data/sprites.js';
import { save } from '../src/core/save.js';
import { atlases, images, fx } from '../src/core/assets.js';
import { input } from '../src/core/input.js';
import { balanceConfiguration } from './cannon-growth-qa.mjs';

export const BASE_IDS = ['shotgun', 'pistols', 'rifle', 'cannon', 'thorns', 'molotov', 'gas', 'saw', 'sword'];
export const FUSED_IDS = FUSION_RECIPES.map(r => r.output);
export const TIERS = {
    base: { level: 1, stage: 2 }, mid: { level: 4, stage: 4 }, max: { level: 8, stage: 6 },
    evolved: { level: 8, stage: 6, evolved: true }, fused: { level: 1, stage: 8 },
};
// The tech each weapon is mostly played in (its start/route tech). Tech power, tags and imprints apply.
export const HOME_TECH = { shotgun: 'gunline', rifle: 'gunline', pistols: 'executioner', thorns: 'bloom', cannon: 'bloom',
    molotov: 'plague', gas: 'plague', saw: 'butcher', sword: 'butcher',
    lotus_bloom: 'bloom', absolute_bloom: 'bloom', scatter_rail: 'gunline', toxic_scatter: 'gunline', doom_barrage: 'gunline',
    plague_fire: 'plague', ember_lance: 'plague', venom_saw: 'plague', plague_end: 'plague',
    burst_rail: 'executioner', guillotine: 'executioner', orbit_saw: 'butcher', sword_wheel: 'butcher', carnage_saw: 'butcher' };
const round = n => +n.toFixed(1);

function setup({ stage, weapons, passives = {}, seed, tech = null }) {
    resetBuild(); clearWorld(); clearFocus(); resetWeaponRuntime(); resetSpawner();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: { outfit: null, ornament: null }, equippedPet: null });
    Object.assign(G, { tech, stage, mode: 'play', time: STAGES[stage].duration * .5, clock: 0, eventIdx: 999,
        difficulty: 'easy', kills: 0, gold: 0, events: {}, damageBy: {}, boss: null, lowQ: true, godMode: false, paused: false,
        caps: { enemies: 160, particles: 0, texts: 0, gems: 300, pickups: 30, decalScale: 0 }, view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    for (const [name, data] of Object.entries(SPRITES)) atlases[name] = { walkH: data.walkH, frameCount: () => 8, draw() {} };
    fx.splats = { dark: [{ width: 64, height: 64 }], red: [{ width: 64, height: 64 }] };
    images.playerFire = { width: 3072, height: 256 };
    createPlayer();
    G.weapons = weapons.map((w, slot) => Object.assign(createWeapon(w.id, slot), { level: w.level, evolved: !!w.evolved, cd: 0 }));
    G.passives = { ...passives }; recomputeStats(true);
    G.player.hp = G.player.maxHp = 1e7; // measure damage taken without dying
    let rng = seed >>> 0;
    return () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function kite(dt) {
    const a = G.clock * G.player.stats.speed / 140;
    Object.assign(input.move, { x: -Math.sin(a), y: Math.cos(a) });
    updatePlayer(dt); G.camera.x = G.player.x; G.camera.y = G.player.y;
}
export function arena(build, { seconds = 40, seed = 1 } = {}) {
    const original = Math.random;
    try {
        Math.random = setup({ ...build, seed });
        const dt = 1 / 60, startHp = G.player.hp;
        for (let i = 0; i < seconds * 60; i++) {
            G.clock += dt; G.time = Math.min(G.time + dt, STAGES[G.stage].duration - 1);
            G.player.iframes = Math.max(0, (G.player.iframes || 0) - dt);
            kite(dt); updateSpawner(dt); updateEnemies(dt); flushExplosions();
            updateWeapons(dt); updateShots(dt); updateEnemyShots(dt); updateHazards(dt);
        }
        return { kpm: G.kills / seconds * 60, taken: (startHp - G.player.hp) / seconds };
    } finally { Math.random = original; Object.assign(input.move, { x: 0, y: 0 }); }
}
export function boss(build, { seconds = 30, seed = 1 } = {}) {
    const original = Math.random;
    try {
        Math.random = setup({ ...build, seed });
        G.mode = 'boss'; G.time = STAGES[G.stage].duration;
        const b = new Boss(G.stage); b.x = 220; b.y = 0; b.hp = b.maxHp = 1e9; G.boss = b;
        tapFocusAt(b.x, b.y - b.radius); // boss fights are played with the boss focused
        const dt = 1 / 60;
        for (let i = 0; i < seconds * 60; i++) {
            if (G.hitstop > 0) { G.hitstop -= dt; continue; }
            G.clock += dt; G.player.iframes = Math.max(0, (G.player.iframes || 0) - dt);
            kite(dt); updateEnemies(dt); flushExplosions(); updateWeapons(dt); updateShots(dt); updateEnemyShots(dt); updateHazards(dt); b.update(dt);
        }
        return { dps: (1e9 - b.hp) / seconds };
    } finally { Math.random = original; Object.assign(input.move, { x: 0, y: 0 }); }
}
export function measure(build, seeds = [1, 7, 13]) {
    const a = seeds.map(seed => arena(build, { seed })), b = seeds.map(seed => boss(build, { seed }));
    const mean = (rows, key) => rows.reduce((s, r) => s + r[key], 0) / rows.length;
    return { kpm: round(mean(a, 'kpm')), taken: round(mean(a, 'taken')), bossDps: round(mean(b, 'dps')) };
}
export function weaponBuild(id, tier, home = false) {
    const t = TIERS[tier], fused = !WEAPONS[id].evolve && WEAPONS[id].fusionOnly;
    const passives = t.evolved && WEAPONS[id].evolve ? { [WEAPONS[id].evolve.with]: 1 } : {};
    return { stage: t.stage, weapons: [{ id, level: fused ? 1 : t.level, evolved: !!t.evolved }], passives, tech: home ? HOME_TECH[id] : null };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.replace(/^--/, '').split('=')));
    if (process.argv.includes('--routes')) {
        const stages = { equal_starter: 2, mid: 4, evolved: 6, final: 8 }, out = {};
        for (const phase of Object.keys(stages)) for (const tech of ['gunline', 'executioner', 'bloom', 'plague', 'butcher']) {
            const c = balanceConfiguration(tech, phase);
            out[`${phase}:${tech}`] = measure({ stage: stages[phase], tech, passives: c.passives,
                weapons: c.build.map(([id, level, evolved]) => ({ id, level, evolved })) });
        }
        console.log(JSON.stringify(out, null, 1));
    } else if (process.argv.includes('--passives')) {
        const kit = [{ id: 'shotgun', level: 4 }, { id: 'thorns', level: 4 }];
        const rows = { none: measure({ stage: 4, weapons: kit }) };
        for (const id of Object.keys(PASSIVES)) rows[id] = measure({ stage: 4, weapons: kit, passives: { [id]: 5 } });
        console.log(JSON.stringify(rows, null, 1));
    } else {
        const tiers = (args.tiers || 'base,mid,max,evolved,fused').split(',');
        const out = {};
        for (const tier of tiers) {
            const ids = args.ids ? args.ids.split(',') : tier === 'fused' ? FUSED_IDS : BASE_IDS;
            for (const id of ids) { if (tier === 'fused' ? !FUSED_IDS.includes(id) : !BASE_IDS.includes(id)) continue; out[`${tier}:${id}`] = measure(weaponBuild(id, tier, process.argv.includes('--home'))); }
        }
        console.log(JSON.stringify(out, null, 1));
    }
}
