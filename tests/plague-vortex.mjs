import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, updateWeapons, updateShots } from '../src/game/weapons.js';
import { updateHazards, findVortex, vortexPower, VORTEX } from '../src/game/hazards.js';
import { clearFocus } from '../src/game/targeting.js';
import { save } from '../src/core/save.js';

// 역병 종언(절대 무기): 화면 곳곳에 장판을 쌓는 대신, 적 위에서 피어오른 화염·독가스가
// 서서히 플레이어에게 모여 하나의 소용돌이로 흡수된다. 장판 수가 크게 줄어 후반 렉을 막는다.
function setup() {
    resetBuild(); clearWorld(); clearFocus();
    save.upgrades = {}; save.equippedPet = null; save.equippedCosmetics = {};
    createPlayer();
    Object.assign(G, { tech: 'plague', mode: 'play', paused: false, stage: 1, clock: 1, boss: null, damageBy: {}, caps: { particles: 0, texts: 0 }, lowQ: true });
    G.passives = { spread: 5, sap: 5, pollen: 1 }; G.grid.reset(); recomputeStats();
    const targets = [];
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, r = 120 + (i % 4) * 70;
        const e = Object.assign(G.enemies.spawn(), { id: i + 1, x: Math.cos(a) * r, y: Math.sin(a) * r, radius: 12, hp: 1e8, maxHp: 1e8, alive: true, elite: true, mass: 1, kx: 0, ky: 0, slow: 0, slowT: 0, bleed: 0, bleedT: 0, hits: new Float32Array(24).fill(-99), def: {} });
        G.grid.insert(e); targets.push(e);
    }
    G.weapons = [Object.assign(createWeapon('plague_end', 0), { level: 8, cd: 0 })];
    return targets;
}
const plumes = () => G.hazards.items.slice(0, G.hazards.count).filter(h => h.kind === 'plume');

test('plague end raises one following vortex and plumes on enemies instead of thrown floor fields', () => {
    setup(); updateWeapons(.001);
    const vortex = findVortex('plague_end');
    assert.ok(vortex && vortex.follow, 'one player-following vortex');
    assert.ok(plumes().length >= 4, 'fire and gas plumes rise immediately');
    assert.ok(plumes().some(h => h.element === 'fire') && plumes().some(h => h.element === 'gas'));
    assert.equal(G.shots.items.slice(0, G.shots.count).filter(s => s.kind === 'lob').length, 0, 'no bottles are lobbed');
});

test('plumes slowly converge on the moving player and charge the vortex when absorbed', () => {
    setup(); updateWeapons(.001);
    const p = G.player, start = plumes().map(h => Math.hypot(h.x - p.x, h.y - p.y));
    const tracked = plumes().slice();
    for (let f = 0; f < 30; f++) updateHazards(1 / 60);
    // 처음 0.5초는 느리게 피어오른다 (서서히 모인다)
    tracked.forEach((h, i) => { const d = Math.hypot(h.x - p.x, h.y - p.y); assert.ok(d < start[i] && start[i] - d < 40, `${start[i]} -> ${d}`); });
    p.x = 120; p.y = -40;
    for (let f = 0; f < 60 * 8; f++) { G.clock += 1 / 60; updateWeapons(1 / 60); updateHazards(1 / 60); }
    const vortex = findVortex('plague_end');
    assert.ok(vortex.charge > 0, 'absorbed plumes charge the vortex');
    assert.equal(vortex.x, p.x); assert.equal(vortex.y, p.y);
    assert.ok(vortexPower(vortex.charge) > VORTEX.base);
});

test('late-game plague end keeps the field count small, with no hellfire trail carpet', () => {
    setup();
    let peak = 0;
    for (let f = 0; f < 60 * 30; f++) {
        G.clock += 1 / 60;
        G.player.vx = 200; G.player.x += 200 / 60; // 이동 중에도 지옥 불꽃길 장판을 깔지 않는다
        updateWeapons(1 / 60); updateShots(1 / 60); updateHazards(1 / 60);
        peak = Math.max(peak, G.hazards.count);
    }
    // 이전 방식(장판 + 이동 불꽃길)은 같은 조건에서 최대 59장이었다.
    assert.ok(peak <= 24, `peak ${peak} hazards`);
    assert.equal(G.hazards.items.slice(0, G.hazards.count).filter(h => h.kind === 'fire' || h.kind === 'gas').length, 0);
});

test('the vortex expires on its own once the absolute weapon is gone', () => {
    setup(); updateWeapons(.001);
    G.weapons = [];
    for (let f = 0; f < 60 * 8; f++) updateHazards(1 / 60);
    assert.equal(findVortex('plague_end'), null);
});
