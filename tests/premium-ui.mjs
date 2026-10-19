// Run: node --test tests/premium-ui.mjs
// Real ES modules with a deliberately small DOM/audio/canvas boundary. Layout,
// actual image decoding, and touch-browser behavior still need browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let now = 1000;
let timerId = 0;
const timers = new Map();
const storage = new Map();
const noop = () => {};

class Events {
    listeners = new Map();
    addEventListener(type, fn, options) {
        const list = this.listeners.get(type) || [];
        list.push({ fn, capture: options === true || !!options?.capture });
        this.listeners.set(type, list);
    }
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(x => x.fn !== fn)); }
    dispatch(type, props = {}) {
        const e = { type, code: '', key: '', repeat: false, target: this, currentTarget: this,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.stopped = true; },
            stopImmediatePropagation() { this.immediateStopped = true; }, ...props };
        const listeners = [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture));
        for (const { fn } of listeners) { fn(e); if (e.immediateStopped) break; }
        if (!e.immediateStopped) this['on' + type]?.(e);
        return e;
    }
}

class Element extends Events {
    constructor(tag = 'div', attrs = {}) {
        super(); this.tagName = tag.toUpperCase(); this.attributes = attrs;
        this.id = attrs.id || ''; this.className = attrs.class || ''; this.children = [];
        this.style = {}; this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs;
        this.inert = false; this.value = attrs.value || ''; this.type = attrs.type || '';
        this.checked = 'checked' in attrs;
        this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v]));
        this.classList = {
            contains: cls => this.className.split(/\s+/).includes(cls),
            add: cls => { if (!this.classList.contains(cls)) this.className += ' ' + cls; },
            remove: cls => { this.className = this.className.split(/\s+/).filter(v => v !== cls).join(' '); },
            toggle: (cls, on) => { on = on ?? !this.classList.contains(cls); this.classList[on ? 'add' : 'remove'](cls); return on; },
        };
    }
    get isConnected() { for (let n = this; n; n = n.parentNode) if (n === document.body || n === document.documentElement) return true; return false; }
    get textContent() { return this._text || this.children.map(n => n.textContent || n.data || '').join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    set innerHTML(value) { this._text = ''; this.children = []; parseInto(this, value); }
    get innerHTML() { return ''; }
    append(...nodes) { for (const n of nodes) { n.parentNode = this; this.children.push(n); } }
    appendChild(n) { this.append(n); return n; }
    replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    focus() { document.activeElement = this; }
    click() { if (!this.disabled) this.dispatch('click'); }
    matches(selector) {
        return selector.split(',').some(s => {
            s = s.trim();
            const attr = s.match(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/);
            if (attr) {
                const value = attr[1].startsWith('data-') ? this.dataset[attr[1].slice(5)] : this.attributes[attr[1]];
                if (value === undefined || (attr[2] !== undefined && value !== attr[2])) return false;
                s = s.replace(attr[0], '');
            }
            if (!s) return true;
            if (s.startsWith('#')) return this.id === s.slice(1);
            if (s.startsWith('.')) return this.classList.contains(s.slice(1));
            return this.tagName === s.toUpperCase();
        });
    }
    closest(selector) { for (let n = this; n instanceof Element; n = n.parentNode) if (n.matches(selector)) return n; return null; }
    querySelectorAll(selector) {
        const split = selector.trim().split(/\s+/);
        if (split.length > 1 && !selector.includes(',')) return this.querySelectorAll(split[0]).flatMap(n => n.querySelectorAll(split.slice(1).join(' ')));
        return this.children.filter(n => n instanceof Element).flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getContext() { return context; }
}

function parseInto(root, markup) {
    const stack = [root];
    const voids = new Set(['img', 'input', 'br', 'hr', 'link', 'meta', 'source']);
    for (const m of markup.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
        if (m[0].startsWith('</')) { while (stack.length > 1) if (stack.pop().tagName.toLowerCase() === m[1].toLowerCase()) break; continue; }
        const attrs = {};
        for (const a of m[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? '';
        const node = new Element(m[1], attrs); stack.at(-1).append(node);
        if (!voids.has(m[1].toLowerCase()) && !m[0].endsWith('/>')) stack.push(node);
    }
}

const context = new Proxy({ createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }) }, { get: (o, k) => o[k] ?? noop });
const wrapper = new Element('root'); parseInto(wrapper, html);
globalThis.document = Object.assign(new Events(), {
    documentElement: wrapper.querySelector('html'), body: wrapper.querySelector('body'),
    getElementById: id => wrapper.querySelector('#' + id),
    querySelectorAll: selector => wrapper.querySelectorAll(selector),
    createElement: tag => new Element(tag), createTextNode: text => ({ data: text }),
});
document.activeElement = document.body;
globalThis.window = Object.assign(new Events(), { matchMedia: () => ({ matches: false }), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { hardwareConcurrency: 8, userAgent: 'node-test', standalone: false } });
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
globalThis.setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.setInterval = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: now + delay, interval: delay }); return id; };
globalThis.clearInterval = globalThis.clearTimeout;
function advanceTime(ms) {
    now += ms;
    for (const [id, t] of [...timers]) if (t.due <= now) {
        if (!t.interval) timers.delete(id); else t.due = now + t.interval;
        t.fn();
    }
}

const { G, clearWorld } = await import('../src/game/state.js');
const { newRun, step } = await import('../src/game/game.js');
const { createWeapon, updateWeapons } = await import('../src/game/weapons.js');
const { drawPlayer } = await import('../src/game/player.js');
const { images, atlases, fx } = await import('../src/core/assets.js');
const { FIRING_SPRITE, shotFrame, firingDrawRect, markPlayerShot } = await import('../src/game/player-motion.js');
const { itemArt } = await import('../src/ui/item-art.js');
const { drawHUD } = await import('../src/ui/hud.js');
const { WEAPONS, PASSIVES } = await import('../src/data/weapons.js');
const { dropPickup, updatePickups } = await import('../src/game/pickups.js');
const { initInput, input } = await import('../src/core/input.js');
const { initUI, showTitle, showChest, showLevelUp, showGameOver, showStageClear, togglePause, openModal, closeModal, topModalId, isAnyModalOpen } = await import('../src/ui/screens.js');
const { openTutorial, closeTutorial, isTutorialOpen } = await import('../src/ui/tutorial.js');
const node = id => document.getElementById(id);
initUI(); initInput(node('game')); input.onPause = togglePause;
G.events.chest = showChest; G.events.levelUp = showLevelUp;
for (const id of ['pellet', 'bullet', 'rail', 'bossShot']) fx[id] = { width: 14, height: 6 };

function freshRun() { showTitle(); newRun(); G.hitstop = 0; }
function takeChest() { node('btn-chest').click(); advanceTime(901); node('btn-chest').click(); }
test.afterEach(() => { if (isTutorialOpen()) closeTutorial(); showTitle(); timers.clear(); clearWorld(); });

test('shot phase uses fixed-size cells and an invariant foot anchor', () => {
    assert.deepEqual([shotFrame(-1), shotFrame(Infinity), shotFrame(0), shotFrame(.05), shotFrame(.115), shotFrame(.2)], [0, 0, 1, 2, 3, 0]);
    const base = firingDrawRect(0);
    for (let i = 0; i < 4; i++) {
        const rect = firingDrawRect(i);
        assert.equal(rect[0], i * FIRING_SPRITE.cellWidth);
        assert.deepEqual(rect.slice(1), base.slice(1));
    }
    const p = { dead: false, flip: false };
    markPlayerShot(p, 10, -1); assert.equal(p.shotFlip, true); assert.equal(p.shotAt, 10);
    p.dead = true; markPlayerShot(p, 20, 1); assert.equal(p.shotAt, 10);
});

test('firing pose starts on an actual shotgun shot and on each actual pistol burst projectile', () => {
    freshRun(); images.playerFire = { width: 1536, height: 256 };
    const p = G.player; const w = G.weapons[0];
    updateWeapons(.01); assert.equal(p.shotAt, -Infinity); assert.equal(G.shots.count, 0);
    G.clock = 10; w.cd = 0; updateWeapons(.016);
    assert.ok(G.shots.count > 0); assert.equal(p.shotAt, 10);
    G.shots.clear(); G.weapons = [createWeapon('pistols', 0)]; p.shotAt = -Infinity;
    G.weapons[0].cd = 0; updateWeapons(.016);
    assert.equal(G.shots.count, 0); assert.equal(p.shotAt, -Infinity, 'arming a burst is not firing');
    G.clock = 11; updateWeapons(.016);
    assert.equal(G.shots.count, 1); assert.equal(p.shotAt, 11);
});

test('combat draws the animated firing atlas with no per-frame scaling or static UI portrait', () => {
    freshRun(); const drawCalls = []; const transforms = [];
    const ctx = { globalAlpha: 1, save: noop, restore: noop, translate: (...v) => transforms.push(v), scale: noop, drawImage: (...v) => drawCalls.push(v) };
    const fire = images.playerFire = { width: 1536, height: 256 };
    G.player.iframes = G.player.hurtT = 0; G.player.shotAt = 4; G.player.vx = 0; G.player.vy = 0;
    const x = G.player.x, y = G.player.y;
    for (const time of [4, 4.06, 4.15, 4.3]) { G.clock = time; drawPlayer(ctx); }
    assert.deepEqual(drawCalls.map(c => c[1]), [384, 768, 1152, 0]);
    for (const call of drawCalls) { assert.equal(call[0], fire); assert.deepEqual(call.slice(2), drawCalls[0].slice(2)); }
    assert.equal(G.player.x, x); assert.equal(G.player.y, y);
    assert.ok(transforms.every(([tx]) => tx === x));
    const playerCode = fs.readFileSync(new URL('../src/game/player.js', import.meta.url), 'utf8');
    assert.doesNotMatch(playerCode, /ui-flowerpig|ui-rabbit/);
    delete images.playerFire;
    let fallback = 0; atlases.player = { draw() { fallback++; } }; drawPlayer(ctx); assert.equal(fallback, 1);
    delete atlases.player;
});

test('pause freezes the shot clock and simulation until explicitly resumed', () => {
    freshRun(); G.clock = 12; G.player.shotAt = 12; G.weapons[0].cd = 0;
    togglePause(); step(1); assert.equal(G.clock, 12); assert.equal(G.shots.count, 0);
    assert.equal(shotFrame(G.clock - G.player.shotAt), 1);
    togglePause(); step(.016); assert.equal(G.clock, 12.016); assert.ok(G.shots.count > 0);
});

test('ID-based modal bookkeeping is idempotent and rejects underlying closes', () => {
    freshRun(); openModal('pause'); openModal('pause'); openModal('settings');
    assert.equal(closeModal('pause'), false); assert.equal(topModalId(), 'settings'); assert.equal(G.paused, true);
    closeModal('settings'); assert.equal(topModalId(), 'pause'); assert.equal(G.paused, true);
    closeModal('pause'); assert.equal(topModalId(), null); assert.equal(G.paused, false);
    assert.equal(closeModal('pause'), false); assert.equal(isAnyModalOpen(), false);
});

test('Escape dismisses nested settings before the underlying pause screen', () => {
    freshRun(); togglePause(); node('btn-pause-settings').click();
    assert.equal(topModalId(), 'settings'); assert.equal(node('pause').inert, true);
    window.dispatch('keydown', { code: 'Escape', key: 'Escape', target: node('btn-settings-close') });
    assert.equal(topModalId(), 'pause'); assert.equal(node('settings').hidden, true);
    assert.equal(node('pause').hidden, false); assert.equal(node('pause').inert, false); assert.equal(G.paused, true);
});

test('two chests collected in one update are presented and rewarded separately', () => {
    freshRun(); dropPickup('chest', 0, -14); dropPickup('chest', 0, -14); updatePickups(.016);
    assert.equal(G.pickups.count, 0); assert.equal(topModalId(), 'chest'); assert.equal(G.paused, true);
    takeChest(); assert.equal(topModalId(), 'chest'); assert.equal(G.paused, true);
    takeChest(); assert.equal(topModalId(), null); assert.equal(G.paused, false);
    assert.equal(G.weapons[0].level, 3, 'both one-item rewards were applied');
});

test('same-frame chest and level-up screens are serialized', () => {
    freshRun(); showChest('elite'); showLevelUp();
    assert.equal(topModalId(), 'chest'); assert.equal(node('levelup').hidden, true);
    takeChest(); assert.equal(topModalId(), 'levelup'); assert.equal(G.paused, true);
    node('btn-skip').click(); assert.equal(topModalId(), null); assert.equal(G.paused, false);
});

test('returning to title invalidates an unfinished chest animation', () => {
    freshRun(); showChest('elite'); node('btn-chest').click(); const before = G.weapons[0].level;
    showTitle(); advanceTime(2000);
    assert.equal(G.weapons[0].level, before); assert.equal(topModalId(), null); assert.equal(G.mode, 'idle');
});

test('first new game optionally offers the guide before entering the stage story', () => {
    showTitle(); node('btn-new').click(); assert.equal(isTutorialOpen(), true); assert.equal(topModalId(), 'tutorial');
    closeTutorial(); assert.equal(topModalId(), null); assert.equal(node('story').hidden, false);
    node('story-skip').click(); assert.equal(G.mode, 'play'); assert.equal(G.paused, false);
});

test('guide reopened from pause keeps the parent pause and restores focus/input ownership', () => {
    freshRun(); togglePause(); node('btn-pause-tutorial').focus(); node('btn-pause-tutorial').click();
    assert.equal(topModalId(), 'tutorial'); assert.equal(G.paused, true); assert.equal(node('app').inert, true);
    window.dispatch('keydown', { code: 'Escape', key: 'Escape', target: document.activeElement });
    assert.equal(isTutorialOpen(), false); assert.equal(topModalId(), 'pause'); assert.equal(G.paused, true);
    assert.equal(node('pause').hidden, false); assert.equal(node('app').inert, false); assert.equal(input.enabled, false);
});

test('HUD inventory uses actual item images and keeps the level label', () => {
    freshRun(); G.weapons = [createWeapon('shotgun', 0)]; G.passives = { heart: 2 }; now += 101; drawHUD();
    const slots = node('hud-build').children;
    assert.equal(slots.length, 2);
    assert.equal(slots[0].children[0].tagName, 'IMG'); assert.equal(slots[0].children[0].src, itemArt('shotgun'));
    assert.equal(slots[0].children[1].textContent, '1'); assert.match(slots[0].getAttribute('aria-label'), /Lv.1/);
    for (const id of [...Object.keys(WEAPONS), ...Object.keys(PASSIVES)]) assert.notEqual(itemArt(id), 'asset/items/salvage-cache.png', id);
});


test('repeated result notifications settle stage rewards only once', async()=>{
    const {save}=await import('../src/core/save.js');
    freshRun(); G.kills=20; G.stageKillsStart=0; G.damageBy={};
    const gold=save.gold,kills=save.kills; showGameOver();const earned=save.gold-gold;
    showGameOver();assert.equal(save.gold,gold+earned);assert.equal(save.kills,kills+20);
    freshRun();G.kills=10;G.stageKillsStart=0;G.damageBy={};const g=save.gold,k=save.kills;
    showStageClear();const reward=save.gold-g;showStageClear();assert.equal(save.gold,g+reward);assert.equal(save.kills,k+10);
});

test('coin chest shows current odds and locks repeat opening until result acknowledgement',async()=>{
 const {save,earnCoins}=await import('../src/core/save.js');
 showTitle();save.maxClearedStage=4;earnCoins(3000,'premium-cache-test');node('btn-shop').click();
 assert.match(node('cache-rates').textContent,/60%/);assert.match(node('cache-rates').textContent,/20 코인/);
 const before=save.chestCount;node('btn-coin-cache').click();
 assert.equal(save.chestCount,before+1);assert.equal(node('btn-coin-cache').disabled,true);
 node('btn-coin-cache').onclick();assert.equal(save.chestCount,before+1);
 const done=node('cache-result').querySelector('button');done.click();assert.equal(node('cache-result').hidden,true);
 assert.equal(node('btn-coin-cache').disabled,false);assert.equal(node('relic-list').children.length,3);
 closeModal('shop');
});

test('Space special input ignores held repeats and editable controls',()=>{
 freshRun();let fires=0;input.onSpecial=()=>fires++;input.enabled=true;
 window.dispatch('keydown',{code:'Space',repeat:true,target:node('game')});assert.equal(fires,0);
 window.dispatch('keydown',{code:'Space',repeat:false,target:node('game')});assert.equal(fires,1);
 window.dispatch('keydown',{code:'Space',repeat:false,target:{tagName:'INPUT'}});assert.equal(fires,1);
 input.enabled=false;window.dispatch('keydown',{code:'Space',target:node('game')});assert.equal(fires,1);
});

test('smaller flowerpig reduces real contact and projectile hit boundaries',async()=>{
 const {spawnEnemy,updateEnemies,fireEnemyShot,updateEnemyShots}=await import('../src/game/enemies.js');
 freshRun();G.godMode=false;G.player.iframes=0;const p=G.player,hp=p.hp,speed=p.stats.speed;
 assert.equal(p.radius,10);assert.equal(FIRING_SPRITE.scale,.24);
 atlases.rabbit1={frameCount:()=>8,walkH:112};
 const e=spawnEnemy('shambler',26,0);updateEnemies(0);assert.equal(p.hp,hp,'old radius13 would hit at26');
 e.x=23;updateEnemies(0);assert.ok(p.hp<hp,'inside new contact boundary still hits');
 G.enemies.clear();p.iframes=0;p.hp=hp;
 fireEnemyShot(18,-16,0,0,0,8);updateEnemyShots(0);assert.equal(p.hp,hp,'outside torso radius plus projectile radius misses');
 fireEnemyShot(16,-16,0,0,0,8);updateEnemyShots(0);assert.ok(p.hp<hp,'inside torso boundary hits');
 assert.equal(p.stats.speed,speed);assert.equal(p.x,0);assert.equal(p.y,0);
});
