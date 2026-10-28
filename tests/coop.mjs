import test from 'node:test';
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {} };
const { G } = await import('../src/game/state.js');
const { newRun, step, onPlayerDeath, retryStage, loadRun } = await import('../src/game/game.js');
const { input, setSplitInput, assignPads, padVector, playerMove } = await import('../src/core/input.js');
const { atlases } = await import('../src/core/assets.js');
const { save } = await import('../src/core/save.js');
const { updatePets, drawPets } = await import('../src/game/pets.js');
const coop = await import('../src/game/coop.js');
const { validateStageCheckpoint } = await import('../src/game/stage-checkpoint.js');

for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1', 'boss2', 'bossKing']) atlases[name] = { walkH: 112, frameCount: () => 8 };
function start(isCoop = true) {
    newRun(1, 'plague', 'normal', isCoop);
    Object.assign(G.caps, { particles: 0, texts: 0, decalScale: 0 }); G.events = {};
}
function foe(x, y, hp = 1e6) {
    const e = Object.assign(G.enemies.spawn(), { id: 900 + G.enemies.count, x, y, radius: 12, hp, maxHp: hp, alive: true, elite: true, mass: 1, kx: 0, ky: 0, slow: 0, slowT: 0, bleed: 0, bleedT: 0, hits: new Float32Array(24).fill(-99), def: {}, speed: 0 });
    G.grid.insert(e); return e;
}

test('2P keyboard split: 1P and 2P movement vectors are independent; solo disables the split', () => {
    setSplitInput(true);
    input.move.x = 1; input.move.y = 0; input.move2.x = 0; input.move2.y = -1;
    assert.deepEqual({ ...playerMove(0) }, { x: 1, y: 0 });
    assert.deepEqual({ ...playerMove(1) }, { x: 0, y: -1 });
    setSplitInput(false);
    assert.equal(input.split, false);
    assert.deepEqual({ ...input.move2 }, { x: 0, y: 0 }, 'arrow keys no longer drive a second player');
});

test('gamepads: one pad is the extra 2P controller, two pads map first to 1P and second to 2P', () => {
    const a = { id: 'a', connected: true }, b = { id: 'b', connected: true };
    assert.deepEqual(assignPads([a], true), [null, a]);
    assert.deepEqual(assignPads([a, b], true), [a, b]);
    assert.deepEqual(assignPads([null, a, b], true), [a, b]);
    assert.deepEqual(assignPads([a, b], false), [a, null]);
    assert.deepEqual(padVector({ axes: [0.1, 0.1], buttons: [] }), { x: 0, y: 0 }, 'dead zone');
    const v = padVector({ axes: [0, 0], buttons: Object.assign([], { 15: { pressed: true } }) });
    assert.equal(v.x, 1); assert.equal(v.y, 0);
    input.pad[1].x = 0.5; input.pad[1].y = 0;
    assert.equal(playerMove(1), input.pad[1], 'active pad overrides keyboard');
    input.pad[1].x = 0;
});

test('2P run spawns 영냥이, enables split input and disables the companion pet', () => {
    save.inventory = [...new Set([...(save.inventory || []), 'pet_yeongnyang'])]; save.equippedPet = 'pet_yeongnyang';
    start(true);
    assert.equal(G.coop, true); assert.ok(G.partner); assert.equal(input.split, true);
    assert.equal(G.partner.maxHp, coop.PARTNER.hp);
    updatePets(1 / 60);
    // 펫이 비활성이면 그릴 것이 없다: drawPets 는 아무것도 하지 않는다
    let drew = false; const ctx = new Proxy({}, { get: () => () => { drew = true; } });
    drawPets(ctx);
    assert.equal(drew, false);
    start(false);
    assert.equal(G.coop, false); assert.equal(G.partner, null); assert.equal(input.split, false);
});

test('enemies chase the nearer living player and contact damage hits 2P', () => {
    start(true);
    const q = G.partner, p = G.player;
    q.x = 300; q.y = 0; p.x = 0; p.y = 0;
    const e = { x: 280, y: 0 };
    assert.equal(coop.chaseTarget(e, p), q);
    q.dead = true;
    assert.equal(coop.chaseTarget(e, p), p, 'downed 2P is never chased');
    q.dead = false; q.iframes = 0;
    const before = q.hp;
    assert.ok(coop.damagePartner(20, 290, 0));
    assert.ok(q.hp < before);
    assert.equal(coop.damagePartner(20, 290, 0), false, 'hurt invulnerability');
});

test('downed 2P revives near 1P after the timer; only 1P death fails the run', () => {
    start(true);
    const q = G.partner;
    q.iframes = 0; coop.damagePartner(1e6, 0, 0);
    assert.equal(q.dead, true); assert.equal(G.mode, 'play');
    for (let i = 0; i < 60 * (coop.PARTNER.reviveTime + 0.5); i++) { coop.updatePartner(1 / 60); }
    assert.equal(q.dead, false);
    assert.equal(q.hp, Math.ceil(q.maxHp * coop.PARTNER.reviveHp));
    assert.ok(Math.hypot(q.x - G.player.x, q.y - G.player.y) < 60);
});

test('2P stays within one screen of 1P and the camera frames both', () => {
    start(true);
    const q = G.partner;
    input.move2.x = 1; input.move2.y = 0;
    for (let i = 0; i < 60 * 20; i++) coop.updatePartner(1 / 60);
    input.move2.x = 0;
    const box = coop.leashBox();
    assert.ok(q.x - G.player.x <= box.x + 1e-9);
    const f = coop.cameraFocus(G.player);
    assert.equal(f.x, (G.player.x + q.x) / 2);
});

test('영냥이 skills deal real damage, grow with her own build, and are buffed over the original hunt kit', () => {
    start(true);
    const S = coop.PARTNER_SKILLS;
    // 원작 hunt-kit: 성광 36·0.85초, 궤도 7·2개, 부메랑 22·1.3초, 타로 38·2.1초, 수호부 12%
    assert.ok(S.bolt.dmg / S.bolt.cd > 36 / 0.85 * 1.5);
    assert.ok(S.orbit.dmg > 7 && S.orbit.counts[0] > 2);
    assert.ok(S.crescent.dmg / S.crescent.cd > 22 / 1.3 * 1.5);
    assert.ok(S.tarot.dmg / S.tarot.cd > 38 / 2.1 * 1.5);
    assert.ok(S.aura.guard > 0.12);
    const q = G.partner;
    assert.equal(coop.skillLevel('bolt'), 1); assert.equal(coop.skillUnlocked('tarot'), false);
    for (const id of coop.PARTNER_SKILL_ORDER) q.skills[id] = 5;
    assert.ok(coop.skillPower('bolt') > 1.7);
    q.x = 0; q.y = 0; G.player.x = -500;
    G.grid.reset();
    const targets = [foe(60, 0), foe(-200, 40), foe(150, -150), foe(380, 0)];
    const random = Math.random; Math.random = () => 0.5;
    try { for (let i = 0; i < 60 * 6; i++) { G.clock += 1 / 60; coop.updatePartner(1 / 60); } } finally { Math.random = random; }
    assert.ok(G.damageBy[coop.PARTNER_ID] > 0);
    assert.ok(targets.every(e => e.hp < e.maxHp), 'melee, ranged star bolts, boomerang and tarot reach near and far foes');
    assert.ok(coop.partnerGuard() > S.aura.guard);
});

test('영냥이 eats XP gems herself, shares with 연이, and levels up into her own choice window', async () => {
    const { updatePickups } = await import('../src/game/pickups.js');
    start(true);
    const q = G.partner, p = G.player;
    p.x = -600; p.y = 0; q.x = 0; q.y = 0;
    const g = G.gems.spawn(); Object.assign(g, { x: 20, y: -14, value: 10, tier: 0, pull: false, speed: 0, toPartner: false, phase: 0 });
    const p1Before = G.xp;
    for (let i = 0; i < 30; i++) updatePickups(1 / 60);
    assert.equal(G.gems.count, 0);
    assert.ok(q.level > 1 || q.xp === 10, 'the full gem value goes to 영냥이');
    assert.ok(G.xp > p1Before, '연이 receives a share');
    // 레벨업 → 성장 선택 창 이벤트
    let opened = 0; G.events.partnerLevelUp = () => opened++;
    coop.addPartnerXP(q.xpNext * 3);
    assert.ok(q.level >= 2 && q.pendingLevelUps >= 1);
    G.pendingLevelUps = 0;
    step(1 / 60);
    assert.equal(opened, 1);
});

test('level-up choices upgrade skills and charms; a Lv5 skill plus its paired charm combines into an evolution', () => {
    start(true);
    const q = G.partner;
    const picks = coop.rollPartnerChoices(3, () => 0.3);
    assert.equal(picks.length, 3);
    assert.ok(picks.every(c => ['skill', 'charm'].includes(c.kind)));
    q.skills.bolt = 4;
    const up = { kind: 'skill', id: 'bolt' };
    assert.ok(coop.applyPartnerChoice(up)); assert.equal(q.skills.bolt, 5);
    assert.equal(coop.applyPartnerChoice(up), false, 'max level');
    assert.deepEqual(coop.readyCombos(), [], 'needs the paired charm');
    assert.ok(coop.applyPartnerChoice({ kind: 'charm', id: 'bell' }));
    assert.deepEqual(coop.readyCombos(), ['bolt']);
    const roll = coop.rollPartnerChoices(3);
    assert.equal(roll[0].kind, 'combo', 'a ready combination is always offered first');
    assert.match(roll[0].recipe, /사주 성광 Lv5 \+ 🔔 별 방울 → 🌙 사주 월광참/);
    const before = coop.skillPower('bolt');
    assert.ok(coop.applyPartnerChoice(roll[0]));
    assert.equal(q.evolved.bolt, true);
    assert.ok(coop.skillPower('bolt') > before * 1.4);
    assert.deepEqual(coop.readyCombos(), []);
    // 부적 효과: 생선 비축 → 최대 HP
    const hp = q.maxHp; coop.applyPartnerChoice({ kind: 'charm', id: 'fish_stock' }); assert.equal(q.maxHp, hp + 20);
});

test('영냥이 complements 연이: tech-specific starting skill, complement weight and damage bonus', async () => {
    const kit = await import('../src/data/partner-kit.js');
    // 근접 도살자 → 원거리 별빛 탄환으로 시작, 원거리 탄막 사수 → 근접 궤도
    G.tech = 'butcher'; assert.ok(coop.startingSkills().starshot);
    G.tech = 'gunline'; assert.ok(coop.startingSkills().orbit);
    for (const [tech, c] of Object.entries(kit.PARTNER_COMPLEMENT)) {
        assert.ok(c.skills.length >= 2 && c.why.length > 8, tech);
        assert.ok(c.skills.every(id => kit.PARTNER_SKILL_KIT[id]), tech);
    }
    assert.ok(kit.PARTNER_COMPLEMENT.butcher.skills.some(id => kit.PARTNER_RANGED.includes(id)), 'melee 연이 gets ranged help');
    assert.ok(!kit.PARTNER_COMPLEMENT.gunline.skills.some(id => kit.PARTNER_RANGED.includes(id)), 'ranged 연이 gets close guard');
    start(true); G.tech = 'butcher';
    const q = G.partner; q.skills = { bolt: 1, starshot: 1 };
    assert.ok(coop.isComplement('starshot'));
    assert.ok(Math.abs(coop.skillPower('starshot') - (1 + kit.PARTNER_COMPLEMENT_BONUS)) < 1e-9);
    assert.equal(coop.skillPower('orbit', { skills: { orbit: 1 }, evolved: {} }), 1);
    // 보완 기술이 선택지에 더 자주 나온다
    let comp = 0, other = 0;
    for (let i = 0; i < 400; i++) for (const c of coop.rollPartnerChoices(3)) if (c.kind === 'skill') (coop.isComplement(c.id) ? comp++ : other++);
    assert.ok(comp > other * 0.8, `${comp} vs ${other}`);
    const card = coop.rollPartnerChoices(3, () => 0).find(c => c.kind === 'skill' && coop.isComplement(c.id));
    if (card) assert.match(card.complement, /연이 보완/);
});

test('영냥이 build survives stage checkpoints and retries; bad saved builds are rejected', () => {
    start(true);
    const q = G.partner;
    q.level = 7; q.skills.crescent = 3; q.charms.paw = 2;
    const snap = coop.partnerSnapshot();
    assert.deepEqual(coop.sanitizePartnerBuild(snap).skills, q.skills);
    assert.equal(coop.sanitizePartnerBuild({ skills: { bolt: 9 } }), null);
    assert.equal(coop.sanitizePartnerBuild({ skills: { bolt: 5 }, evolved: { bolt: true } }).evolved.bolt, undefined, 'evolution needs its charm');
    const p2 = coop.createPartner(snap);
    assert.equal(p2.level, 7); assert.equal(p2.skills.crescent, 3); assert.equal(p2.charms.paw, 2);
});

test('2P choice is saved in the stage checkpoint and restored on retry', () => {
    start(true);
    assert.equal(loadRun().coop, true);
    assert.equal(validateStageCheckpoint({ ...loadRun(), coop: 'yes' }).coop, false);
    onPlayerDeath(); G.mode = 'dead';
    assert.ok(retryStage());
    assert.equal(G.coop, true); assert.ok(G.partner); assert.equal(G.partner.dead, false);
    step(1 / 60);
});

test('2P raises the population over 2x and makes every enemy and boss stronger', async () => {
    const { COOP_PRESSURE } = await import('../src/data/difficulty.js');
    const { spawnEnemy } = await import('../src/game/enemies.js');
    const { Boss } = await import('../src/game/boss.js');
    assert.ok(COOP_PRESSURE.count >= 2 && COOP_PRESSURE.hp > 1 && COOP_PRESSURE.dmg > 1);
    const sample = isCoop => {
        start(isCoop); G.enemies.clear();
        const e = spawnEnemy('shambler', 400, 0, { noAffix: true }), b = new Boss(1);
        return { hp: e.hp, dmg: e.dmg, xp: e.xp, cap: G.caps.enemies, boss: b.maxHp };
    };
    const solo = sample(false), duo = sample(true);
    assert.ok(Math.abs(duo.hp / solo.hp - COOP_PRESSURE.hp) < 1e-9);
    assert.ok(Math.abs(duo.dmg / solo.dmg - COOP_PRESSURE.dmg) < 1e-9);
    assert.ok(duo.xp < solo.xp, 'more enemies give less XP each');
    assert.ok(duo.cap > solo.cap);
    assert.ok(Math.abs(duo.boss / solo.boss - COOP_PRESSURE.boss.hp) < 1e-9);
    // 실제 디렉터: 같은 시간 동안 살아 있는 적 수가 2배 이상
    const alive = isCoop => {
        start(isCoop); G.godMode = true; G.stage = 5; let peak = 0;
        for (let f = 0; f < 60 * 60; f++) { step(1 / 60); G.pendingLevelUps = 0; let n = 0; for (let i = 0; i < G.enemies.count; i++) if (G.enemies.items[i].alive) n++; peak = Math.max(peak, n); }
        G.godMode = false; return peak;
    };
    const random = Math.random; let seed = 7; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    try { const a = alive(false), b = alive(true); assert.ok(b >= a * 1.9, `${a} -> ${b}`); } finally { Math.random = random; }
});

test('boss telegraphs alternate between 연이 and 영냥이, and boss hits damage whoever stands inside', async () => {
    const { Boss } = await import('../src/game/boss.js');
    start(true); G.boss = null; G.hazards.clear();
    const p = G.player, q = G.partner, b = new Boss(1);
    p.x = 0; p.y = 0; q.x = 300; q.y = 0; b.x = 150; b.y = -100;
    const picks = [b.pickTarget(), b.pickTarget(), b.pickTarget(), b.pickTarget()];
    assert.ok(picks.includes(q) && picks.includes(p), 'both players are targeted over consecutive patterns');
    // 표적이 영냥이일 때 예고 원은 영냥이 발밑에 깔린다
    b.target = q; G.hazards.clear();
    b.task_pools();
    const first = G.hazards.items[0];
    assert.equal(first.kind, 'tcircle'); assert.equal(first.x, q.x); assert.equal(first.y, q.y);
    // 판정은 범위 안 모든 플레이어: 영냥이만 맞고 멀리 있는 연이는 무사
    q.iframes = 0; p.iframes = 0;
    const qBefore = q.hp, pBefore = p.hp;
    b.circleHit({ x: q.x, y: q.y, radius: 60, color: '#fff' });
    assert.ok(q.hp < qBefore); assert.equal(p.hp, pBefore);
    // 둘이 함께 서 있으면 둘 다 맞는다
    q.x = 10; q.iframes = 0; p.iframes = 0;
    const both = [p.hp, q.hp];
    b.lineHit({ x: -50, y: 0, angle: 0, len: 200, width: 40, color: '#fff' });
    assert.ok(p.hp < both[0] && q.hp < both[1]);
    // 쓰러진 영냥이는 표적이 되지 않는다
    q.dead = true;
    for (let i = 0; i < 4; i++) assert.equal(b.pickTarget(), p);
    assert.equal(b.prey, p);
});

test('solo boss always targets 연이', async () => {
    const { Boss } = await import('../src/game/boss.js');
    start(false); G.boss = null;
    const b = new Boss(1);
    for (let i = 0; i < 4; i++) assert.equal(b.pickTarget(), G.player);
});
