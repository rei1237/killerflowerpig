import { performance } from 'node:perf_hooks';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons, orbitStats } from '../src/game/weapons.js';
import { resetBuild } from '../src/game/progression.js';
import { save } from '../src/core/save.js';

const results = [];
for (const dt of [1 / 60, .1, .25]) {
    resetBuild(); clearWorld();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null, equippedCosmetics: {}, equippedPet: null });
    Object.assign(G, { tech: 'bloom', mode: 'play', stage: 6, clock: 0, events: {}, damageBy: {},
        caps: { particles: 0, texts: 0 }, lowQ: true });
    createPlayer(); G.player.stats.amount = 100;
    G.weapons = ['absolute_bloom', 'lotus_bloom', 'orbit_saw'].map((sourceId, slot) =>
        Object.assign(createWeapon('thorns', slot), { level: 8, evolved: true, sourceId, coreIndex: 1 }));
    for (let i = 0; i < 180; i++) {
        const a = i * 2.39996323, r = i < 30 ? 70 + (i % 4) * 22 : 450 + (i % 5) * 80;
        Object.assign(G.enemies.spawn(), { id: i + 1, x: Math.cos(a) * r, y: Math.sin(a) * r,
            radius: 12, hp: 1e9, maxHp: 1e9, alive: true, mass: 1, kx: 0, ky: 0, motionVX: 0, motionVY: 0,
            slow: 0, slowT: 0, bleed: 0, bleedT: 0, def: {}, elite: true });
    }
    const samples = [];
    for (let frame = 0; frame < 900; frame++) {
        G.clock += dt;
        // Include fast relative crossings in each low-FPS frame; broad phase
        // must retain the trajectory rather than inspect only endpoint distance.
        const target = G.enemies.items[0];
        target.x = frame % 2 ? 220 : -220; target.y = 0;
        target.motionVX = (frame % 2 ? 440 : -440) / dt;
        const start = performance.now(); updateWeapons(dt); samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const round = n => +n.toFixed(4);
    results.push({ dt, enemies: 180, cores: 3, requestedStatAmounts: G.weapons.map(w => weaponStats(w).amount),
        cappedPetalsPerCore: G.weapons.map(w => orbitStats(w, weaponStats(w)).amount),
        meanMs: round(samples.reduce((a, b) => a + b, 0) / samples.length),
        p95Ms: round(samples[Math.floor(samples.length * .95)]), maxMs: round(samples.at(-1)),
        activePetalsAtEnd: G.weapons.map(w => w.thornState.slots.filter(slot => slot.ready).length) });
}
console.log(JSON.stringify({ method: '900 real updateWeapons calls per dt, three independent inherited thorns cores, 180 enemies with 30 near and one fast crossing. Requested20 stat petals/core are capped to8 actual pets/core. Node wall-time diagnostic, not a mobile-frame guarantee.', results }, null, 2));
