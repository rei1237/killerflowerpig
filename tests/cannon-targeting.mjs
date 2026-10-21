import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseCannonVolley, collectCannonTargets, cannonBeamHits, cannonFocusMultiplier, CANNON_TARGET_LIMIT } from '../src/game/cannon-targeting.js';
import { G, clearWorld } from '../src/game/state.js';
import { resetBuild } from '../src/game/progression.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons, activeWeaponCores } from '../src/game/weapons.js';
import { firingMuzzle } from '../src/game/player-motion.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { images } from '../src/core/assets.js';
import { save } from '../src/core/save.js';
import { WEAPONS } from '../src/data/weapons.js';

const target = (id, x, y = 0, radius = 12) => ({ id, x, y, radius, alive: true, hp: 1000 });
const origin = () => ({ x: 0, y: 0 });
const ids = targets => targets.map(t => t.id).sort((a, b) => a - b);
test('one ray selects the hittable lane instead of the lone nearest target', () => {
    const lone = target(1, 60, 100), lane = [target(2, 180, 12), target(3, 260, 12), target(4, 340, 12)];
    const chosen = chooseCannonVolley({ targets: [lone, ...lane], width: 20, length: 400, muzzleAt: origin });
    assert.deepEqual(ids(chosen.targets), [2, 3, 4]);
});
test('focus converges exclusively on the selected target, with deterministic geometry', () => {
    const focus = target(1, 250, 12), targets = [focus, target(2, 280, 36), ...[3, 4, 5].map((id, i) => target(id, -100 - i * 50, 100))];
    const options = { targets, focus, count: 1, width: 30, length: 500, muzzleAt: origin };
    const a = chooseCannonVolley(options), b = chooseCannonVolley(options);
    assert.equal(a.focusHit, true); assert.deepEqual(a.targets, [focus]); assert.deepEqual(a.rays, b.rays);
    assert.equal(cannonBeamHits(focus, a.rays[0]), true);
});
test('dead, nonfinite and unreachable focused targets do not steal a hittable volley', () => {
    const live = target(1, 100, 12), dead = { ...target(2, -100), alive: false }, far = target(3, 900);
    for (const focus of [dead, far, { ...target(4, 20), x: NaN }]) {
        const result = chooseCannonVolley({ targets: [live, dead, far], focus, length: 300, width: 20, muzzleAt: origin });
        assert.deepEqual(ids(result.targets), [1]); assert.equal(result.focusHit, false);
    }
});
test('actual mirrored muzzle, target radius, ray width and finite length share one hit test', () => {
    const muzzleAt = dx => ({ x: dx < 0 ? -30 : 30, y: -22 });
    const targets = [target(1, 200, -10), target(2, -200, -10), target(3, 360, -10), target(4, 200, 50)];
    const result = chooseCannonVolley({ targets, count: 2, length: 220, width: 20, muzzleAt });
    assert.deepEqual(ids(result.targets), [1], 'one straight lane: the mirrored target needs the opposite side');
    assert.ok(result.rays.every(r => r.x === (r.dx < 0 ? -30 : 30) && r.angle === result.rays[0].angle));
    const left = chooseCannonVolley({ targets, count: 2, length: 220, width: 20, muzzleAt, fallbackAngle: Math.PI });
    assert.deepEqual(ids(left.targets), [2]); assert.ok(left.rays.every(r => r.x === -30));
    assert.equal(cannonBeamHits(target(5, 100, 33, 25), { x: 0, y: 0, dx: 1, dy: 0, width: 10, length: 110 }), true);
    assert.equal(cannonBeamHits(target(6, 111, 12), { x: 0, y: 0, dx: 1, dy: 0, width: 50, length: 110 }), false);
});
test('overlapping rays count each target once and both search dimensions are bounded', () => {
    const targets = Array.from({ length: 300 }, (_, i) => target(i, 45 + i % 10, 12));
    const result = chooseCannonVolley({ targets, count: 999, width: 300, length: 500, muzzleAt: origin });
    assert.equal(result.rays.length, 3); assert.equal(result.inspected, CANNON_TARGET_LIMIT);
    assert.equal(result.targets.length, 64); assert.ok(result.candidateCount <= 195, result.candidateCount);
});

function setup(id = 'cannon', level = 1, evolved = false) {
    resetBuild(); clearWorld(); clearFocus(); save.upgrades = {}; save.equippedCosmetics = {}; save.equippedPet = null;
    createPlayer(); Object.assign(G, { tech: null, clock: 2.3, stage: 1, mode: 'play', paused: false, kills: 0,
        damageBy: {}, events: {}, caps: { enemies: 300, particles: 0, texts: 0, gems: 500, decalScale: 0 } });
    G.camera.x = 0; G.camera.y = 0; G.view.w = 1000; G.view.h = 600;
    G.passives = {}; G.weapons = [Object.assign(createWeapon(id, 0), { level, evolved, cd: 0 })];
    images.playerFire = { width: 3072, height: 256 }; recomputeStats(true); G.player.stats.crit = 0;
    return G.weapons[0];
}
function enemy(id, x, y, hp = 1e6) {
    const e = Object.assign(G.enemies.spawn(), target(id, x, y), { hp, maxHp: hp, mass: 1, kx: 0, ky: 0,
        elite: true, hits: new Float32Array(24).fill(-99), def: {}, scale: .5, state: 'walk', xp: 0 });
    G.grid.insert(e); return e;
}
function predict(w) {
    const s = weaponStats(w), p = G.player, length = s.length * Math.sqrt(s.area);
    // Same visible candidate set the live volley scores; a straight lane has no spare rays to cover unseen targets.
    const { targets } = collectCannonTargets({ player: p, grid: G.grid, enemies: G.enemies, boss: null, focus: null, view: G.view, camera: G.camera, length });
    return chooseCannonVolley({ targets, count: s.amount, length, width: s.width * s.area,
        fallbackAngle: Math.atan2(p.facingY, p.facingX), muzzleAt: dx => firingMuzzle(p, G.clock, dx) });
}
test('actual ordinary/evolved/inherited/final beam collisions exactly match predicted target unions while moving', () => {
    for (const [id, evolved] of [['cannon', false], ['cannon', true], ['lotus_bloom', false], ['absolute_bloom', false]]) {
        const parent = setup(id, 8, evolved); Object.assign(G.player, { vx: -120, vy: 65, facingX: -1, facingY: 0 });
        const enemies = [enemy(1, 210, 15), enemy(2, 280, 28), enemy(3, -240, 70), enemy(4, 340, -190), enemy(5, 900, 0)];
        const core = id === 'cannon' ? parent : activeWeaponCores().find(w => w.id === 'cannon');
        // Isolate each real retained core from its owner's other attacks.
        G.weapons = [core]; core.cd = 0;
        const expected = predict(core); updateWeapons(.001);
        assert.deepEqual(ids(enemies.filter(e => e.hp < e.maxHp)), ids(expected.targets), id);
        assert.equal(G.beams.count, expected.rays.length);
        for (let i = 0; i < G.beams.count; i++) {
            const beam = G.beams.items[i], ray = expected.rays[i];
            assert.equal(beam.x, ray.x); assert.equal(beam.y, ray.y); assert.equal(beam.angle, ray.angle);
        }
    }
});
test('Lv1→4→8 straight lane grows in power, stacks up to three rays and pierces the whole line', () => {
    const lane = [];
    for (const level of [1, 4, 8]) {
        const w = setup('cannon', level); Object.assign(G.player, { vx: -130, vy: 20, facingX: -1, facingY: 0 });
        const line = Array.from({ length: 5 }, (_, i) => enemy(i + 1, 140 + i * 70, 12));
        const decoy = enemy(9, -260, 12);
        const s = weaponStats(w); updateWeapons(.001);
        assert.equal(G.beams.count, Math.min(3, s.amount));
        for (let i = 1; i < G.beams.count; i++) assert.equal(G.beams.items[i].angle, G.beams.items[0].angle);
        assert.ok(line.every(e => e.hp < e.maxHp), `Lv${level}: the lane pierces every enemy on the line`);
        assert.equal(decoy.hp, decoy.maxHp, `Lv${level}: nothing fires in a second direction`);
        lane.push(line[0].maxHp - line[0].hp);
    }
    assert.ok(lane[0] < lane[1] && lane[1] < lane[2], JSON.stringify(lane));
});
test('visible far-edge enemies remain candidates, entirely unseen ones do not, and explicit focus may override', () => {
    setup('cannon', 8); const visible = enemy(1, 508, 0), unseen = enemy(2, 540, 0);
    const options = { player: G.player, grid: G.grid, enemies: G.enemies, boss: null,
        view: G.view, camera: G.camera, length: 900 };
    assert.deepEqual(ids(collectCannonTargets(options).targets), [1]);
    assert.deepEqual(ids(collectCannonTargets({ ...options, focus: unseen }).targets), [1, 2]);
    tapFocusAt(unseen.x, unseen.y - unseen.radius); updateWeapons(.001); assert.ok(unseen.hp < unseen.maxHp);
    assert.ok(visible.hp < visible.maxHp, 'focus pierces an intervening enemy on its path');
});

test('focused volleys aggregate once with a bounded bonus on the focus, pierce enemies on the path, and spare enemies behind it', () => {
    for (const [id, level, evolved] of [['cannon', 1, false], ['cannon', 4, false], ['cannon', 8, false],
        ['cannon', 8, true], ['lotus_bloom', 8, false], ['absolute_bloom', 8, false]]) {
        const w = setup(id, level, evolved); w.fusionCores = [];
        const focus = enemy(1, 240, 12), bystander = enemy(2, 140, 12), behind = enemy(3, 340, 12);
        tapFocusAt(focus.x, focus.y - focus.radius);
        const s = weaponStats(w); updateWeapons(.001);
        assert.ok(Math.abs(focus.maxHp - focus.hp - s.focusBeamDamage * cannonFocusMultiplier(s.amount)) < 1e-6, id);
        // 경로 위의 적은 집중 배율 없이 일반 광선 피해만 받는다. 집중 대상 뒤의 적은 맞지 않는다.
        const pathDamage = bystander.maxHp - bystander.hp;
        assert.ok(pathDamage > 0, `${id}: path enemy hit`);
        assert.ok(pathDamage < focus.maxHp - focus.hp, `${id}: focus bonus only on the focus`);
        assert.equal(behind.hp, behind.maxHp);
        const beams = G.beams.items.slice(0, G.beams.count);
        assert.equal(beams.filter(b => b.focusPrimary).length, 1); assert.equal(beams.filter(b => b.focusHit).length, 1);
        assert.ok(beams.every(b => b.focused && b.focusCount === s.amount && b.focusEndX <= focus.x + focus.radius));
        assert.ok(cannonFocusMultiplier(s.amount) <= 3.3 + 1e-9);
    }
});
test('a killed focus is not replaced mid-volley; next attack releases lock and resets pooled focus metadata', () => {
    const w = setup('cannon', 8, true);
    const focus = enemy(1, 240, 12, 1), other = enemy(2, 150, 12);
    tapFocusAt(focus.x, focus.y - focus.radius); updateWeapons(.001);
    assert.equal(focus.alive, false); const afterFirst = other.hp;
    assert.ok(afterFirst < other.maxHp, 'enemy on the focus path is pierced');
    G.beams.clear(); w.cd = 0; updateWeapons(.001);
    assert.ok(other.hp < afterFirst);
    for (const b of G.beams.items.slice(0, G.beams.count)) {
        assert.equal(b.focused, false); assert.equal(b.focusPrimary, false); assert.equal(b.focusHit, false);
        assert.equal(b.focusEndX, null); assert.equal(b.focusEndY, null); assert.equal(b.focusCount, 0);
    }
});
test('focus endpoint is a launch snapshot and confirmed-hit effects require actual HP loss', () => {
    setup('cannon', 8);
    const boss = G.boss = { id: -1, x: 240, y: 0, radius: 25, hp: 1000, alive: true, hurt() {} };
    tapFocusAt(boss.x, boss.y-boss.radius); updateWeapons(.001);
    const beam = G.beams.items[0], end = [beam.focusEndX, beam.focusEndY];
    assert.equal(beam.focused, true); assert.equal(beam.focusPrimary, true); assert.equal(beam.focusHit, false);
    boss.x = -200; boss.y = 100;
    assert.deepEqual([beam.focusEndX,beam.focusEndY], end);
});


test('two equipped Cannon-derived owners share three visible rays and retain both scheduled contributions', () => {
    setup('lotus_bloom',8); const second=Object.assign(createWeapon('absolute_bloom',1),{level:8,cd:0});G.weapons.push(second);
    const focus=enemy(1,240,12), bystander=enemy(2,120,12);tapFocusAt(focus.x,focus.y-focus.radius);
    const cores=activeWeaponCores(), expected=new Map();
    for(const w of cores) if(['cannon','lotus_bloom','absolute_bloom'].includes(w.id)) {
        const s=weaponStats(w), id=w.sourceId||w.id;expected.set(id,(expected.get(id)||0)+s.focusBeamDamage*cannonFocusMultiplier(s.amount));
    }
    updateWeapons(.001);assert.equal(G.beams.count,3);
    const pathDamage=bystander.maxHp-bystander.hp;assert.ok(pathDamage>0,'enemy on the focus path is pierced');
    // 각 소유자 기록 = 집중 대상 피해 + 경로 위 적 피해. 합계로 정확히 맞춘다.
    for(const [id,damage] of expected) assert.ok(G.damageBy[id]>=damage-1e-6,`${id}: ${G.damageBy[id]} vs ${damage}`);
    const total=Object.values(G.damageBy).reduce((a,b)=>a+b,0),focusTotal=[...expected.values()].reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(total-focusTotal-pathDamage)<1e-6);
    assert.ok(Math.abs(focus.maxHp-focus.hp-[...expected.values()].reduce((a,b)=>a+b,0))<1e-6);
    for(let tick=0;tick<120;tick++){G.clock+=1/60;updateWeapons(1/60);assert.ok(G.beams.count<=3,'lingering beams never exceed the global cap');}
});

test('coalesced sources retain their own range and width instead of inheriting the largest envelope', () => {
    const short=setup('cannon',1);short.sourceId='lotus_bloom';short.fusionLevel=1;
    const long=Object.assign(createWeapon('absolute_bloom',1),{level:1,cd:0,fusionCores:[]});G.weapons.push(long);
    const focus=enemy(1,650,12);tapFocusAt(focus.x,focus.y-focus.radius);
    const longStats=weaponStats(long), shortStats=weaponStats(short);
    assert.ok(shortStats.length*Math.sqrt(shortStats.area)<600);
    updateWeapons(.001);
    assert.equal(G.damageBy.lotus_bloom||0,0,'short source cannot borrow long range');
    assert.ok(Math.abs(G.damageBy.absolute_bloom-longStats.focusBeamDamage*cannonFocusMultiplier(longStats.amount))<1e-6);
    assert.equal(G.beams.count,3);
});


test('mixed short-wide and long-narrow geometry is an exact union, never a phantom wide-far rectangle', () => {
    const ray={x:0,y:0,dx:1,dy:0,length:500,width:100,segments:[{length:100,width:100},{length:500,width:10}]};
    assert.equal(cannonBeamHits(target(1,400,41,1),ray),false);
    assert.equal(cannonBeamHits(target(2,80,41,1),ray),true);
    assert.equal(cannonBeamHits(target(3,400,5,1),ray),true);
    const targets=[target(1,400,1,1),target(2,100,42,1),target(3,-200,347,1)];
    const profiles=[[{length:100,width:100},{length:500,width:10}],[{length:100,width:10}],[{length:100,width:10}]];
    const chosen=chooseCannonVolley({targets,count:3,length:500,width:100,rayProfiles:profiles,muzzleAt:origin});
    assert.equal(chosen.rays[0].length,500);assert.equal(chosen.rays[1].length,100);assert.equal(chosen.rays[1].width,10);
    assert.deepEqual(ids(chosen.targets),ids(targets.filter(t=>chosen.rays.some(r=>cannonBeamHits(t,r)))));
    assert.ok(chosen.candidateCount<=579);
    for(const ray of chosen.rays.slice(1))assert.equal(cannonBeamHits(target(99,ray.dx*400,1+ray.dy*400,1),ray),false);
});

test('live final beam profiles preserve long-narrow primary and short-wide inherited rays', () => {
    const original=WEAPONS.lotus_bloom.base;WEAPONS.lotus_bloom.base={...original,length:2000,width:20};
    try {
    const main=setup('lotus_bloom',1), core=activeWeaponCores().find(w=>w.id==='cannon');
    const a=weaponStats(main),b=weaponStats(core);
    assert.ok(a.length*Math.sqrt(a.area)>b.length*Math.sqrt(b.area));
    assert.ok(a.width*a.area<b.width*b.area);
    updateWeapons(.001);assert.equal(G.beams.count,3);
    assert.equal(G.beams.items[0].segments.length,2);
    for(const beam of G.beams.items.slice(1,3)){
        assert.equal(beam.segments.length,1);
        assert.equal(beam.len,b.length*Math.sqrt(b.area));
        assert.equal(beam.width,b.width*b.area);
    }
    const primary=G.beams.items[0],angle=primary.angle;
    const beyondCore=b.length*Math.sqrt(b.area)+100,off=(a.width*a.area+b.width*b.area)/4;
    const point=target(999,primary.x+Math.cos(angle)*beyondCore-Math.sin(angle)*off,
        1+primary.y+Math.sin(angle)*beyondCore+Math.cos(angle)*off,1);
    assert.equal(cannonBeamHits(point,{...primary,dx:Math.cos(angle),dy:Math.sin(angle),length:primary.len}),false);
    } finally {WEAPONS.lotus_bloom.base=original;}
});


test('unfocused targets between the authored hands still receive real vertical auto-aim hits', () => {
    for(const y of [-200,200]) {
        const w=setup('cannon',1),e=enemy(1,0,y);
        Object.assign(G.player,{facingX:1,facingY:0,vx:100,vy:0});
        const expected=predict(w);assert.deepEqual(expected.targets,[e]);
        updateWeapons(.001);assert.ok(e.hp<e.maxHp);assert.equal(G.beams.count,1);
        assert.ok(Math.abs(Math.cos(G.beams.items[0].angle))<1e-8);
    }
});
