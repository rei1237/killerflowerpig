import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { firingMuzzle } from '../src/game/player-motion.js';
import { cannonBeamHits } from '../src/game/cannon-targeting.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { images } from '../src/core/assets.js';
import { save } from '../src/core/save.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixedRandom(run) {
    const original = Math.random; Math.random = () => .5;
    try { return run(); } finally { Math.random = original; }
}
function setup(id, x, y, modern = true, flip = x > 0) {
    resetBuild(); clearWorld(); clearFocus();
    Object.assign(save, { upgrades: {}, relics: [], accessoryInventory: [], equippedAccessory: null,
        cosmeticInventory: [], equippedCosmetics: {}, equippedPet: null });
    Object.assign(G, { tech: id === 'saw' ? 'butcher' : 'executioner', mode: 'play', stage: 1, clock: 10, time: 0, paused: false,
        godMode: false, damageBy: {}, events: {}, lowQ: true, caps: { enemies: 100, particles: 0, texts: 0 },
        view: { w: 1000, h: 600 } });
    G.camera.x = G.camera.y = 0;
    if (modern) images.playerFire = { width: 3072, height: 256 }; else delete images.playerFire;
    createPlayer();
    G.player.flip = flip; // Default movement-facing opposes target side.
    G.player.vx = 40; G.player.vy = -30; // Also exercise the real moving muzzle bob.
    G.weapons = [Object.assign(createWeapon(id, 0), { cd: 0, fusionCores: [] })];
    G.passives = {}; recomputeStats();
    const e = Object.assign(G.enemies.spawn(), { id: 1, x, y, radius: 12, scale: .44,
        atlas: { walkH: 112 }, hp: 100000, maxHp: 100000, alive: true, elite: true,
        mass: 1, kx: 0, ky: 0, slow: 0, slowT: 0, bleed: 0, bleedT: 0,
        hits: new Float32Array(24).fill(-99), def: {} });
    G.grid.insert(e); tapFocusAt(e.x, e.y - e.radius);
    fixedRandom(() => { updateWeapons(.001); updateWeapons(.001); });
    return e;
}

for (const id of ['pistols', 'rifle', 'shotgun', 'burst_rail', 'guillotine', 'scatter_rail', 'doom_barrage', 'saw']) {
    for (const side of [-1, 1]) {
        test(`${id}: retained ${side < 0 ? 'left' : 'right'} muzzle hits a near-vertical enemy without flipping origins`, () => {
            const e = setup(id, side * 5, 150), hp = e.hp;
            const expected = firingMuzzle(G.player, G.clock, e.x - G.player.x);
            const shots = G.shots.items.slice(0, G.shots.count);
            assert.ok(shots.length);
            // Doom's radial spread is intentionally unaimed; its last three
            // projectiles are the aimed rail volley tested here.
            const aimed = id === 'doom_barrage' ? shots.slice(-3) : shots;
            for (const shot of aimed) { near(shot.x, expected.x); near(shot.y, expected.y); }
            assert.equal(G.player.attackPose.flip, side < 0);
            // Crucial case: projectile points inward from the outward hand.
            assert.ok(aimed.some(shot => Math.sign(shot.vx) === -side));
            fixedRandom(() => {
                for (let i = 0; i < 60; i++) { G.clock += 1 / 60; updateShots(1 / 60); }
            });
            assert.ok(e.hp < hp, 'real collision must deal damage; no target teleport or forced hit');
        });
    }
}

test('a saw fired exactly vertically hits from either starting hand, above and below the player', () => {
    for (const flip of [false, true]) for (const y of [-150, 150]) {
        const e = setup('saw', 0, y, true, flip), hp = e.hp;
        const sh = G.shots.items[0], origin = firingMuzzle(G.player, G.clock, 0);
        near(sh.x, origin.x); near(sh.y, origin.y);
        assert.ok(Math.sign(sh.vx) === -Math.sign(origin.x));
        fixedRandom(() => {
            for (let i = 0; i < 60; i++) { G.clock += 1 / 60; updateShots(1 / 60); }
        });
        assert.ok(e.hp < hp, `hand=${flip ? 'left' : 'right'}, targetY=${y}`);
    }
});

test('above-player near-vertical targets also receive real pistol hits from either hand', () => {
    for (const side of [-1, 1]) {
        const e = setup('pistols', side * 5, -150), hp = e.hp;
        fixedRandom(() => {
            for (let i = 0; i < 60; i++) { G.clock += 1 / 60; updateShots(1 / 60); }
        });
        assert.ok(e.hp < hp);
    }
});

test('the no-sprite fallback retains its previous direction-relative origin', () => {
    setup('rifle', 20, 150, false);
    const sh = G.shots.items[0], speed = Math.hypot(sh.vx, sh.vy);
    near(sh.x, sh.vx / speed * 16);
    near(sh.y, -22 + sh.vy / speed * 10);
});

test('Cannon scores the actual authored muzzle and hits during its release update', () => {
    const e = setup('cannon', 20, 150);
    assert.ok(G.beams.count > 0);
    const beam=G.beams.items[0];
    assert.ok(cannonBeamHits(e,{...beam,dx:Math.cos(beam.angle),dy:Math.sin(beam.angle),length:beam.len}));
    const muzzle=firingMuzzle(G.player,G.clock,Math.cos(beam.angle));near(beam.x,muzzle.x);near(beam.y,muzzle.y);
    assert.ok(e.hp<e.maxHp,'hitscan damage must already be applied before updateShots');
    near(beam.len,(e.x-beam.x)*Math.cos(beam.angle)+(e.y-e.radius-beam.y)*Math.sin(beam.angle));
});
