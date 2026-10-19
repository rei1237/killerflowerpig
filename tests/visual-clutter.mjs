import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/game/state.js';
import { createPlayer } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons, orbitStats, SAW_VISUAL_CAP, ORBIT_VISUAL_CAP } from '../src/game/weapons.js';
import { resetBuild, applyChoice } from '../src/game/progression.js';
import { spawnHazard, limitFriendlyFields, updateHazards } from '../src/game/hazards.js';

function reset() {
    resetBuild(); createPlayer(); G.mode = 'play'; G.stage = 1; G.boss = null;
    G.caps = { enemies: 0, particles: 0, texts: 0 }; G.view = { w: 1000, h: 600 }; G.camera = { x: 0, y: 0 };
    G.grid.reset(); G.shots.clear(); G.hazards.clear(); G.enemies.clear(); G.beams.clear();
}
const saws = () => G.shots.items.slice(0, G.shots.count).filter(s => s.kind === 'saw' && s.life > .15);

test('evolved bone saw shows at most six blades per volley and keeps total damage', () => {
    reset();
    for (let level = 1; level <= 5; level++) applyChoice({ kind: 'passive', id: 'magazine', level });
    const w = Object.assign(createWeapon('saw', 0), { level: 8, evolved: true });
    G.weapons = [w];
    const stats = weaponStats(w);
    assert.ok(stats.amount > SAW_VISUAL_CAP, 'fixture really exceeds the cap');
    w.cd = 0; updateWeapons(.01);
    assert.equal(saws().length, SAW_VISUAL_CAP);
    const total = saws().reduce((sum, s) => sum + s.dmg, 0);
    assert.ok(Math.abs(total - stats.dmg * stats.amount) < 1e-6);
    // The next volley retires the previous one instead of stacking on screen.
    w.cd = 0; updateWeapons(.01);
    assert.equal(saws().length, SAW_VISUAL_CAP);
});

test('orbit petals are capped on screen with damage conserved', () => {
    const s = orbitStats({ id: 'thorns' }, { amount: 12, dmg: 10, radius: 68, area: 1 });
    assert.equal(s.amount, ORBIT_VISUAL_CAP);
    assert.equal(s.amount * s.dmg, 120);
});

test('same-weapon ground fields beyond the cap fade out oldest first, other weapons untouched', () => {
    reset();
    const gas = [];
    for (let i = 0; i < 5; i++) { updateHazards(.5); gas.push(spawnHazard('gas', i * 10, 0, { duration: 20, weapon: 'gas' })); }
    const other = spawnHazard('fire', 0, 0, { duration: 20, weapon: 'molotov' });
    limitFriendlyFields('gas', 'gas', 3);
    updateHazards(.5);
    assert.equal(gas.filter(h => h.alive).length, 2, 'two oldest faded, room left for the incoming field');
    assert.ok(gas[3].alive && gas[4].alive);
    assert.ok(other.alive);
});
