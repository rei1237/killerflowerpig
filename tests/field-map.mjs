import test from 'node:test';
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
// 지도 버튼·캔버스만 흉내 낸다
const els = {};
function el(id) {
    return els[id] ||= { id, attrs: {}, classes: new Set(), textContent: '', clientWidth: 168, width: 0, height: 0, listeners: {},
        classList: { toggle(c, on) { on ? els[id].classes.add(c) : els[id].classes.delete(c); } },
        setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
        addEventListener(t, fn) { this.listeners[t] = fn; },
        getContext: () => new Proxy({}, { get: (_, k) => k in ctxState ? ctxState[k] : () => { ctxState.calls++; }, set: (_, k, v) => { ctxState[k] = v; return true; } }) };
}
const ctxState = { calls: 0 };
globalThis.document = { getElementById: el };
const keys = {};
globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener: (t, fn) => { keys[t] = fn; }, devicePixelRatio: 1 };

const { G } = await import('../src/game/state.js');
const { newRun, step } = await import('../src/game/game.js');
const { atlases } = await import('../src/core/assets.js');
const { updatePickups } = await import('../src/game/pickups.js');
const field = await import('../src/game/field-items.js');
const map = await import('../src/ui/minimap.js');
const { settings } = await import('../src/core/settings.js');
const { xpForLevel, LEVEL_COST_MULTIPLIER } = await import('../src/game/progression.js');
for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1', 'boss2', 'bossKing']) atlases[name] = { walkH: 112, frameCount: () => 8 };
function start(coop = false) { newRun(1, 'gunline', 'easy', coop); Object.assign(G.caps, { particles: 0, texts: 0, decalScale: 0 }); G.events = {}; }

test('levelling is harder: XP costs carry the extra level-cost multiplier', () => {
    assert.ok(LEVEL_COST_MULTIPLIER >= 1.3);
    G.difficulty = 'easy';
    assert.equal(xpForLevel(1), Math.round(12 * LEVEL_COST_MULTIPLIER));
});

test('each stage map holds supply caches (2 in stages 1-2, then 3; 2P +2), one at a time; walking onto one grants a choice', () => {
    assert.deepEqual([1, 2, 3, 10].map(s => field.fieldItemsForStage(s)), [2, 2, 3, 3]);
    assert.equal(field.fieldItemsForStage(5, true), 5);
    start();
    assert.equal(field.fieldItem(), null);
    for (let i = 0; i < 60 * (field.FIELD_ITEM.firstDelay + 0.1); i++) field.updateFieldItems(1 / 60, () => 0.5);
    const it = field.fieldItem();
    assert.ok(it, 'the stage cache spawned');
    const d = Math.hypot(it.x - G.player.x, it.y - G.player.y);
    assert.ok(d > field.FIELD_ITEM.minDistance * 0.7 && d < field.FIELD_ITEM.maxDistance + 1);
    // 끌려오지 않는다: 멀리서는 줍지 못한다
    updatePickups(1 / 60);
    assert.ok(field.fieldItem());
    // 밟으면 장비 선택 +1
    const before = G.pendingLevelUps;
    G.player.x = it.x; G.player.y = it.y + 14;
    updatePickups(1 / 60);
    assert.equal(field.fieldItem(), null);
    assert.equal(G.pendingLevelUps, before + 1);
    // 1구역은 2개: 남은 1개가 나타나고, 그 뒤에는 없다
    assert.equal(field.fieldItemsLeft(), 1);
    let more = 0;
    for (let i = 0; i < 60 * 200; i++) {
        if (field.updateFieldItems(1 / 60)) { more++; const c = field.fieldItem(); G.player.x = c.x; G.player.y = c.y + 14; updatePickups(1 / 60); }
    }
    assert.equal(more, 1);
    assert.equal(field.fieldItem(), null, 'two caches on the first stage map');
    assert.equal(field.fieldItemsLeft(), 0);
    // 다음 구역에서 다시 하나
    field.resetFieldItems();
    for (let i = 0; i < 60 * (field.FIELD_ITEM.firstDelay + 0.1); i++) field.updateFieldItems(1 / 60);
    assert.ok(field.fieldItem());
    // 2P: 두 사람 몫으로 두 개, 한 번에 하나씩
    start(true); field.resetFieldItems();
    let seen = 0;
    for (let i = 0; i < 60 * 200; i++) {
        if (field.updateFieldItems(1 / 60)) {
            seen++;
            assert.equal(G.pickups.items.slice(0, G.pickups.count).filter(p => p.kind === 'cache').length, 1);
            const c = field.fieldItem(); G.player.x = c.x; G.player.y = c.y + 14; updatePickups(1 / 60);
        }
    }
    assert.equal(seen, field.fieldItemsForStage(1, true));
});

test('영냥이 can claim the cache for her own growth choice', () => {
    start(true);
    for (let i = 0; i < 60 * (field.FIELD_ITEM.firstDelay + 0.1); i++) field.updateFieldItems(1 / 60);
    const it = field.fieldItem(), q = G.partner;
    q.x = it.x; q.y = it.y + 14; G.player.x = it.x + 900;
    const before = q.pendingLevelUps, p1 = G.pendingLevelUps;
    updatePickups(1 / 60);
    assert.equal(field.fieldItem(), null);
    assert.equal(q.pendingLevelUps, before + 1); assert.equal(G.pendingLevelUps, p1);
});

test('map toggles with one tap or M, remembers the choice, and draws only while on', () => {
    start(true);
    settings.minimap = true;
    map.initMinimap();
    assert.equal(el('btn-map').getAttribute('aria-pressed'), 'true');
    el('btn-map').listeners.click();
    assert.equal(settings.minimap, false);
    assert.equal(JSON.parse(data.get('kfp.settings.v1')).minimap, false, 'persisted');
    assert.equal(el('btn-map').getAttribute('aria-pressed'), 'false');
    assert.ok(el('btn-map').classes.has('is-off'));
    assert.equal(el('map-state').textContent, '지도 켜기');
    assert.equal(map.drawMinimap(), false, 'nothing drawn when off');
    G.mode = 'play'; G.paused = false;
    keys.keydown({ code: 'KeyM', repeat: false, target: null, preventDefault() {} });
    assert.equal(settings.minimap, true);
    ctxState.calls = 0;
    for (let i = 0; i < 60 * 8; i++) step(1 / 60);
    assert.equal(map.drawMinimap(), true);
    assert.ok(ctxState.calls > 10, 'players, enemies and the cache are drawn');
});
