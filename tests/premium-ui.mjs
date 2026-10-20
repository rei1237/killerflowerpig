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
globalThis.Image = class { complete=false; naturalWidth=0; };
globalThis.requestAnimationFrame = fn => setTimeout(() => fn(now),16);
globalThis.cancelAnimationFrame = clearTimeout;
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
const { initUI, playStory, showFusion, showTitle, showChest, showLevelUp, showGameOver, showStageClear, togglePause, openModal, closeModal, topModalId, isAnyModalOpen } = await import('../src/ui/screens.js');
const { openPractice, closePractice, isPracticeOpen } = await import('../src/ui/practice.js');
const { openTutorial, closeTutorial, isTutorialOpen } = await import('../src/ui/tutorial.js');
const node = id => document.getElementById(id);
initUI(); initInput(node('game')); input.onPause = togglePause;
G.events.chest = showChest; G.events.levelUp = showLevelUp;
for (const id of ['pellet', 'bullet', 'rail', 'bossShot']) fx[id] = { width: 14, height: 6 };

function freshRun() { showTitle(); newRun(); G.hitstop = 0; }
function takeChest() { node('btn-chest').click(); advanceTime(901); node('btn-chest').click(); }
test.afterEach(() => { if (isTutorialOpen()) closeTutorial(); if (isPracticeOpen()) closePractice(); showTitle(); timers.clear(); clearWorld(); });

test('shot phase uses fixed-size cells and an invariant foot anchor', () => {
    assert.deepEqual([shotFrame(-1), shotFrame(Infinity), shotFrame(0), shotFrame(.05), shotFrame(.075), shotFrame(.12), shotFrame(.18), shotFrame(.23), shotFrame(.28), shotFrame(.3)], [0, 0, 1, 2, 3, 4, 5, 6, 7, 0]);
    const base = firingDrawRect(0);
    for (let i = 0; i < 8; i++) {
        const rect = firingDrawRect(i);
        assert.equal(rect[0], i * FIRING_SPRITE.cellWidth);
        assert.deepEqual(rect.slice(1), base.slice(1));
    }
    const p = { dead: false, flip: false };
    markPlayerShot(p, 10, -1); assert.equal(p.shotFlip, true); assert.equal(p.shotAt, 10);
    p.dead = true; markPlayerShot(p, 20, 1); assert.equal(p.shotAt, 10);
});

test('firing pose starts on an actual shotgun shot and on each actual pistol burst projectile', () => {
    freshRun(); images.playerFire = { width: 3072, height: 256 };
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
    const fire = images.playerFire = { width: 3072, height: 256 };
    G.player.iframes = G.player.hurtT = 0; G.player.shotAt = 4; G.player.vx = 0; G.player.vy = 0;
    const x = G.player.x, y = G.player.y;
    for (const time of [4, 4.05, 4.075, 4.12, 4.18, 4.23, 4.28, 4.31]) { G.clock = time; drawPlayer(ctx); }
    assert.deepEqual(drawCalls.map(c => c[1]), [384, 768, 1152, 1536, 1920, 2304, 2688, 0]);
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
    closeTutorial(); assert.equal(topModalId(), 'practice'); assert.equal(isPracticeOpen(), true);
    closePractice(); assert.equal(topModalId(), 'tech-select', 'start tech is chosen before the story');
    node('btn-tech-go').click(); assert.equal(topModalId(), null); assert.equal(node('story').hidden, false);
    node('story-skip').click(); assert.equal(G.mode, 'play'); assert.equal(G.paused, false);
    assert.ok(G.tech, 'a start tech is applied to the new run');
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
 assert.match(node('cache-rates').textContent,/60%/);assert.match(node('cache-rates').textContent,/3 코인/);
 const before=save.chestCount;node('btn-coin-cache').click();
 assert.equal(save.chestCount,before+1);assert.equal(node('btn-coin-cache').disabled,true);
 node('btn-coin-cache').onclick();assert.equal(save.chestCount,before+1);
 const done=node('cache-result').querySelector('button');done.click();assert.equal(node('cache-result').hidden,true);
 assert.equal(node('btn-coin-cache').disabled,false);assert.equal(node('relic-list').children.length,3);
 closeModal('shop');
});

test('manual charge shortcut is retired; Space does not fire an attack',()=>{
 freshRun();let fires=0;input.onSpecial=()=>fires++;input.enabled=true;
 window.dispatch('keydown',{code:'Space',repeat:false,target:node('game')});assert.equal(fires,0);
 delete input.onSpecial;
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

test('fusion preview pauses safely and consumes two inputs only after explicit confirmation',()=>{
 freshRun();G.weapons=[createWeapon('cannon',0),createWeapon('thorns',1)];G.weapons.forEach(w=>{w.level=8;w.evolved=true;});
 const before=JSON.stringify(G.weapons);togglePause();showFusion();
 assert.equal(topModalId(),'fusion');assert.equal(G.paused,true);assert.equal(JSON.stringify(G.weapons),before);
 assert.equal(node('fusion-recipes').children.length,14);
 const button=node('fusion-recipes').children[0].querySelector('button');assert.equal(button.disabled,false);
 button.click();assert.deepEqual(G.weapons.map(w=>w.id),['lotus_bloom']);assert.equal(G.weapons[0].level,1);
 button.click();assert.equal(G.weapons.length,1);assert.match(node('fusion-status').textContent,/조합 완료/);
 togglePause();assert.equal(topModalId(),'pause');assert.equal(G.paused,true);
 togglePause();assert.equal(G.paused,false);
});
test('fusion rejects stale preview and closing locked recipes never consumes items',()=>{
 freshRun();G.weapons=[createWeapon('shotgun',0),createWeapon('rifle',1)];G.weapons.forEach(w=>{w.level=8;w.evolved=true;});showFusion();
 const button=node('fusion-recipes').children[1].querySelector('button');G.weapons[0].level=4;button.click();
 assert.deepEqual(G.weapons.map(w=>w.id),['shotgun','rifle']);assert.match(node('fusion-status').textContent,/바뀌었습니다/);
 const before=JSON.stringify(G.weapons);closeModal('fusion');assert.equal(JSON.stringify(G.weapons),before);assert.equal(G.paused,false);
});
test('active gameplay no longer exposes global charge or character XP advancement',()=>{
 assert.doesNotMatch(html,/id="btn-petal"|id="hud-character-level"|SPACE · 수동/);
 const screens=fs.readFileSync(new URL('../src/ui/screens.js',import.meta.url),'utf8');
 assert.doesNotMatch(screens,/queueCharacterXP|characterProgress|firePetalCannon/);
});

test('fused weapon level seven to eight selection renders without a legacy evolution recipe',async()=>{
 freshRun();const {WEAPONS,PASSIVES}=await import('../src/data/weapons.js');
 G.weapons=[createWeapon('lotus_bloom',0)];G.weapons[0].level=7;
 G.banished=new Set([...Object.keys(WEAPONS),...Object.keys(PASSIVES)].filter(id=>id!=='lotus_bloom'));
 showLevelUp();assert.equal(topModalId(),'levelup');assert.equal(node('cards').children.length,1);
 node('cards').children[0].querySelector('.choice-select').click();assert.equal(G.weapons[0].level,8);assert.equal(topModalId(),null);
});

test('every fusion resumes real update/render frames after UI confirmation and close',async()=>{
 const {FUSION_RECIPES}=await import('../src/data/fusions.js');
 const {spawnEnemy}=await import('../src/game/enemies.js');
 const {initRender,render}=await import('../src/game/render.js');
 for(const name of ['rabbit1','rabbit2','rabbit3','player'])atlases[name]={walkH:112,frameCount:()=>8,draw:noop};
 for(const name of ['petal','petalBlood','saw','sawBone','bomb'])fx[name]={width:16,height:16};
 fx.gems=Array.from({length:4},()=>({width:16,height:16}));for(const id of ['meat','magnet','chest'])fx[id]={width:16,height:16};
 fx.splats={red:[{width:16,height:16}],black:[{width:16,height:16}],green:[{width:16,height:16}]};
 initRender(node('game'));
 for(const [index,recipe] of FUSION_RECIPES.entries()){
  freshRun();G.godMode=true;G.weapons=recipe.inputs.map((i,slot)=>{const w=createWeapon(i.id,slot);w.level=8;w.evolved=true;return w;});
  spawnEnemy('shambler',180,0);
  showLevelUp();showFusion();
  const button=node('fusion-recipes').children[index].querySelector('button');button.click();button.click();
  assert.equal(G.weapons.filter(w=>w.id===recipe.output).length,1);
  assert.equal(topModalId(),'fusion-reveal');
  node('fusion-reveal').querySelector('.fusion-reveal-skip').click();
  node('fusion-reveal').querySelector('.fusion-reveal-confirm').click();
  assert.equal(topModalId(),'levelup');
  node('cards').querySelector('.choice-select').click();
  while(topModalId())closeModal(topModalId());
  assert.equal(G.paused,false);const clock=G.clock,x=G.player.x;input.move.x=1;
  // Exercise the exact pooled-object reuse that ordinary kills/spawns trigger.
  G.enemies.clear();assert.doesNotThrow(()=>spawnEnemy('shambler',180,0),recipe.id+' pool reuse');
  for(let f=0;f<240;f++){G.hitstop=0;step(1/60);render(1/60);while(topModalId()){if(topModalId()==='levelup')node('cards').querySelector('.choice-select').click();else closeModal(topModalId());}}
  assert.ok(G.clock>clock+3,recipe.id+' clock advances');assert.ok(G.player.x>x,recipe.id+' movement resumes');assert.equal(G.paused,false);
  input.move.x=0;
 }
});

test('upgrade cards show live current levels and all recipe details without selecting on disclosure',()=>{
 freshRun();G.weapons=[createWeapon('cannon',0),createWeapon('thorns',1)];G.weapons.forEach(w=>w.level=5);
 G.banished=new Set([...Object.keys(WEAPONS),...Object.keys(PASSIVES)].filter(id=>id!=='cannon'));
 showLevelUp();const card=node('cards').children[0];
 assert.match(card.querySelector('.card-lv').textContent,/Lv.5 → Lv.6/);
 const details=card.querySelector('details');assert.ok(details);assert.equal(details.querySelectorAll('.choice-recipe-detail').length,4);
 assert.match(details.textContent,/만개 연꽃포/);assert.match(details.textContent,/화염 꽃잎창/);assert.match(details.textContent,/필요 Lv.8/);assert.match(details.textContent,/진화 필요/);
 const event=details.dispatch('click');assert.equal(event.stopped,true);assert.equal(G.weapons[0].level,5);assert.equal(topModalId(),'levelup');
 card.querySelector('.choice-select').click();assert.equal(G.weapons[0].level,6);
 showLevelUp();assert.match(node('cards').children[0].querySelector('.card-lv').textContent,/Lv.6 → Lv.7/);
});


test('story is slow, manual, double-tap safe and cancelled on title/reopen',()=>{
 freshRun();let completed=0;playStory('읽기 테스트','안녕. 천천히 읽어요.\n다음 줄입니다.',()=>completed++,1);
 const clock=G.clock;step(1);assert.equal(G.clock,clock);assert.equal(G.paused,true);
 advanceTime(100);assert.ok(node('story-text').textContent.length<10);
 node('story-next').click();assert.match(node('story-text').textContent,/다음 줄입니다/);
 node('story-next').click();assert.equal(completed,0);
 advanceTime(601);assert.equal(completed,0,'completion is never automatic');node('story-next').click();assert.equal(completed,1);node('story-next').click();assert.equal(completed,1);
 playStory('이전','오래 읽을 이전 이야기',()=>completed++,2);showTitle();advanceTime(10000);assert.equal(completed,1);
 playStory('새 장','새로운 장입니다.',()=>completed++,3);node('story-skip').click();node('story-skip').click();assert.equal(completed,2);
});

test('premium accessory shop shows six actual items with ownership, locks and repeat-safe purchase/equip',async()=>{
 const {save,earnCoins}=await import('../src/core/save.js');
 showTitle();save.maxClearedStage=9;earnCoins(10000,'accessory-ui-test');node('btn-shop').click();
 assert.equal(node('accessory-list').children.length,6);
 const card=node('accessory-list').children[0],button=card.querySelector('button'),gold=save.gold;
 assert.match(card.textContent,/90/);assert.match(card.textContent,/최대 HP \+40/);assert.match(card.textContent,/미보유/);
 button.click();button.click();assert.equal(save.gold,gold-90);assert.equal(save.equippedAccessory,'moon_guard');assert.match(node('accessory-equipped').textContent,/달빛 수호 망토/);
 node('accessory-list').children[0].querySelector('button').click();assert.equal(save.equippedAccessory,null);assert.equal(save.gold,gold-90);
 node('accessory-list').children[0].querySelector('button').click();assert.equal(save.equippedAccessory,'moon_guard');assert.equal(save.gold,gold-90);
 closeModal('shop');save.maxClearedStage=0;node('btn-shop').click();assert.equal(node('accessory-list').children[1].querySelector('button').disabled,true);
});

test('field boxes explain one existing upgrade while boss boxes disclose stronger odds and named premium reward',()=>{
 freshRun();showChest('elite');assert.match(node('chest-description').textContent,/보유 장비 1회 강화/);takeChest();
 showChest('boss');assert.match(node('chest-description').textContent,/기본 강화 2개 확정/);assert.match(node('chest-description').textContent,/20%/);assert.match(node('chest-description').textContent,/10코인/); // stage1 만렙 회수금 8+2*1
 const rng=Math.random;Math.random=()=>.01;
 try{node('btn-chest').click();advanceTime(901);}finally{Math.random=rng;}
 assert.equal(node('rewards').children.length,3);const premium=node('rewards').children[2];assert.match(premium.textContent,/연꽃 정밀 강화재/);assert.match(premium.textContent,/최대 8/);assert.match(premium.querySelector('img').src,/violet-orb/);
 const levels=G.weapons.map(w=>w.level);node('btn-chest').click();showChest('boss');node('btn-chest').click();advanceTime(901);assert.deepEqual(G.weapons.map(w=>w.level),levels,'repeated boss event cannot grant twice');
});

test('practice reopened over pause returns to paused combat without a reward or movement leak', () => {
    freshRun(); togglePause(); const gold=G.gold, x=G.player.x; node('btn-pause-practice').click();
    assert.equal(topModalId(),'practice'); assert.equal(G.paused,true); closePractice();
    assert.equal(topModalId(),'pause'); assert.equal(G.paused,true); assert.equal(G.gold,gold); assert.equal(G.player.x,x);
});

test('next stage story selects that exact stage artwork and never defaults to the final chapter', () => {
    freshRun(); G.stage=2; node('btn-next').click();
    assert.equal(node('story-art').src,'asset/story/stage-03.webp');
    assert.match(node('story-location').textContent,/SECTOR 03/);
    assert.equal(G.paused,true);
});

test('leaving fusion celebration cancels its animation and cannot restart play after title navigation', () => {
    freshRun();G.weapons=[createWeapon('cannon',0),createWeapon('thorns',1)];G.weapons.forEach(w=>{w.level=8;w.evolved=true;});
    showFusion();node('fusion-recipes').children[0].querySelector('button').click();
    assert.equal(topModalId(),'fusion-reveal');showTitle();advanceTime(1800);
    assert.equal(topModalId(),null);assert.equal(node('fusion-reveal').hidden,true);assert.equal(G.mode,'idle');
});

test('each new selection refills rerolls, while duplicate events and reopen do not; stale cards cannot select', () => {
    freshRun();showLevelUp({choiceSessionId:'choice:1'});
    assert.equal(G.rerolls,1);assert.match(node('btn-reroll').textContent,/이번 선택 1\/1회/);
    const stale=node('cards').querySelector('.choice-select'),before=JSON.stringify(G.weapons);
    node('btn-reroll').click();node('btn-reroll').click();assert.equal(G.rerolls,0);
    stale.click();assert.equal(JSON.stringify(G.weapons),before);assert.equal(topModalId(),'levelup');
    const choices=JSON.stringify(G.choiceSession.choices);
    showLevelUp({choiceSessionId:'choice:1'});closeModal('levelup');showLevelUp();
    assert.equal(G.rerolls,0);assert.equal(JSON.stringify(G.choiceSession.choices),choices);
    node('cards').querySelector('.choice-select').click();assert.equal(topModalId(),null);
    showLevelUp({choiceSessionId:'choice:2'});assert.equal(G.rerolls,1);
    node('btn-skip').click();showLevelUp({choiceSessionId:'choice:1'});assert.equal(topModalId(),null);
});

test('restored active choice reopens with the same cards and spent reroll budget', async () => {
    const {snapshotBuild}=await import('../src/game/progression.js');
    freshRun();showLevelUp({choiceSessionId:'choice:1'});node('btn-reroll').click();
    const snap=snapshotBuild(),cards=JSON.stringify(snap.choiceSession.choices);
    showTitle();localStorage.setItem('kfp.run.v1',JSON.stringify(snap));node('btn-continue').click();
    assert.equal(topModalId(),'levelup');assert.equal(G.paused,true);assert.equal(G.rerolls,0);
    assert.equal(JSON.stringify(G.choiceSession.choices),cards);
});

test('loadout exchange pause UI discloses loss, cancels safely, confirms once and restores paused focus', async()=>{
 const {openLoadoutExchange}=await import('../src/ui/loadout-exchange.js');
 freshRun();G.weapons=['cannon','thorns','rifle','pistols','gas','saw'].map((id,i)=>Object.assign(createWeapon(id,i),{level:5}));
 togglePause();node('btn-pause-loadout').focus();node('btn-pause-loadout').click();const modal=node('loadout-exchange');
 assert.equal(topModalId(),'loadout-exchange');assert.equal(G.paused,true);assert.equal(openLoadoutExchange(),false);
 assert.match(modal.textContent,/무기 Lv.8.*Lv.1 이상/);assert.match(modal.textContent,/현재 5/);
 const items=()=>modal.querySelectorAll('.loadout-item');const select=(role,id)=>items().find(b=>b.dataset.role===role&&b.dataset.item===id).click();
 const before=JSON.stringify(G.weapons);select('source','rifle');select('target','shotgun');
 assert.match(modal.querySelector('.loadout-exchange-loss').textContent,/강화 레벨과 진화는 사라지고/);
 modal.querySelector('.loadout-exchange-cancel').click();assert.equal(JSON.stringify(G.weapons),before);
 select('source','rifle');select('target','shotgun');const confirm=modal.querySelector('.loadout-exchange-confirm');confirm.click();confirm.click();
 assert.match(modal.querySelector('.loadout-exchange-budget').textContent,/0\/1회/);assert.equal(G.weapons.length,6);assert.equal(G.weapons.find(w=>w.id==='shotgun').level,1);assert.ok(!G.weapons.some(w=>w.id==='rifle'));
 assert.equal(JSON.parse(localStorage.getItem('kfp.run.v1')).loadoutExchangesUsed,1,'spent exchange persists immediately before stage changes or reload');
 const after=JSON.stringify(G.weapons);modal.querySelector('.loadout-exchange-close').click();
 assert.equal(topModalId(),'pause');assert.equal(G.paused,true);assert.equal(document.activeElement,node('btn-pause-loadout'));
 node('btn-pause-loadout').click();confirm.click();assert.equal(JSON.stringify(G.weapons),after);assert.equal(modal.querySelector('.loadout-exchange-confirm'),null);
 window.dispatch('keydown',{code:'Escape'});assert.equal(topModalId(),'pause');assert.equal(modal.hidden,true);
});
test('loadout stale confirmation refuses changed inventory and detached buttons cannot confirm a new preview',()=>{
 freshRun();G.weapons=['cannon','thorns','rifle','pistols','gas','saw'].map((id,i)=>createWeapon(id,i));togglePause();node('btn-pause-loadout').click();
 const modal=node('loadout-exchange'),select=(role,id)=>modal.querySelectorAll('.loadout-item').find(b=>b.dataset.role===role&&b.dataset.item===id).click();
 select('source','rifle');select('target','shotgun');const old=modal.querySelector('.loadout-exchange-confirm');G.weapons[0].level++;
 old.click();assert.ok(G.weapons.some(w=>w.id==='rifle'));assert.match(modal.querySelector('.loadout-exchange-status').textContent,/상태가 바뀌었습니다/);
 select('source','rifle');select('target','shotgun');const before=JSON.stringify(G.weapons);old.disabled=false;old.click();assert.equal(JSON.stringify(G.weapons),before);
 modal.querySelector('.loadout-exchange-confirm').click();assert.ok(G.weapons.some(w=>w.id==='shotgun'));
});
test('loadout evolution helper describes fused maxima and CSS retains mobile readable touch controls',async()=>{
 const {appendEvolutionInfo}=await import('../src/ui/loadout-exchange.js');const box=document.createElement('div');
 appendEvolutionInfo(box,'lotus_bloom');assert.match(box.textContent,/Lv.8까지 강화.*별도 진화 없음/);
 const css=fs.readFileSync(new URL('../src/ui/loadout-exchange.css',import.meta.url),'utf8');
 assert.match(css,/min-height:44px/);assert.match(css,/overflow:auto/);assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/focus-visible/);assert.match(css,/\[hidden\]/);
});

test('death immediately tombstones checkpoint; retry starts stage one fresh while permanent shop progress survives',async()=>{
 const {loadRun,continueRun,onPlayerDeath,startStage}=await import('../src/game/game.js');
 const {save}=await import('../src/core/save.js');
 freshRun();const checkpoint=loadRun(),oldId=G.runId;assert.equal(continueRun(checkpoint),true);
 G.weapons=[Object.assign(createWeapon('lotus_bloom',0),{level:8})];G.passives={heart:5};G.stage=5;G.loadoutExchangesUsed=1;
 const permanent=JSON.stringify({gold:save.gold,upgrades:save.upgrades,accessories:save.accessories,relics:save.relics});
 onPlayerDeath();assert.equal(loadRun(),null);assert.equal(continueRun(checkpoint),false);assert.equal(G.mode,'dead');assert.equal(startStage(6),false);
 showTitle();node('btn-retry').click();assert.equal(G.stage,1);assert.notEqual(G.runId,oldId);assert.equal(G.level,1);assert.deepEqual(G.passives,{});
 assert.equal(G.weapons.length,1);assert.equal(G.weapons[0].level,1);assert.equal(G.weapons[0].evolved,false);assert.equal(G.loadoutExchangesUsed,0);
 assert.equal(JSON.stringify({gold:save.gold,upgrades:save.upgrades,accessories:save.accessories,relics:save.relics}),permanent);
 assert.equal(continueRun(checkpoint),false,'dead build cannot be loaded after a new run');assert.match(html,/id="btn-retry"[^>]*>[^<]*STAGE 1/);
});
test('death storage failure retains in-memory invalidation and tombstone protection with warning',async()=>{
 const {loadRun,continueRun,onPlayerDeath}=await import('../src/game/game.js');freshRun();const checkpoint=loadRun();
 const remove=localStorage.removeItem;let warnings=0;const handler=G.events.runSaveError;G.events.runSaveError=()=>warnings++;
 localStorage.removeItem=()=>{throw new Error('storage blocked');};
 try{onPlayerDeath();assert.equal(loadRun(),null);assert.equal(continueRun(checkpoint),false);assert.equal(warnings,1);assert.ok(JSON.parse(localStorage.getItem('kfp.dead-runs.v1')).includes(checkpoint.runId));}
 finally{localStorage.removeItem=remove;G.events.runSaveError=handler;}
});
test('fusion UI requires both evolved inputs and displays the actual final tech requirement',()=>{
 freshRun();G.weapons=[createWeapon('cannon',0),createWeapon('thorns',1)];G.weapons.forEach(w=>w.level=8);showFusion();
 assert.equal(node('fusion-recipes').children[0].querySelector('button').disabled,true);assert.match(node('fusion-summary').textContent,/진화 2개 → 최종.*진화 3개 → 절대/);
 assert.match(node('fusion-recipes').children[0].textContent,/진화 필요/);const before=JSON.stringify(G.weapons);
 node('fusion-recipes').children[0].querySelector('button').click();assert.equal(JSON.stringify(G.weapons),before);
});
test('when all death storage operations fail, current session still blocks old continuation and warns',async()=>{
 const {loadRun,continueRun,onPlayerDeath}=await import('../src/game/game.js');freshRun();const checkpoint=loadRun();
 const put=localStorage.setItem,remove=localStorage.removeItem,handler=G.events.runSaveError;let warnings=0;
 G.events.runSaveError=()=>warnings++;localStorage.setItem=localStorage.removeItem=()=>{throw new Error('storage unavailable');};
 try{onPlayerDeath();assert.equal(loadRun(),null);assert.equal(continueRun(checkpoint),false);assert.equal(warnings,1);}
 finally{localStorage.setItem=put;localStorage.removeItem=remove;G.events.runSaveError=handler;}
});
test('absolute recipe UI consumes three evolved ingredients and reveals three-to-one with two freed slots',()=>{
 freshRun();G.weapons=['cannon','thorns','molotov'].map((id,i)=>Object.assign(createWeapon(id,i),{level:8,evolved:true}));showFusion();
 const card=node('fusion-recipes').querySelectorAll('article').find(n=>n.dataset.recipe==='absolute_bloom');
 assert.ok(card);assert.match(card.textContent,/절대/);assert.match(card.textContent,/진화 능력 3개 계승/);assert.match(card.querySelector('.fusion-cost').textContent,/3개.*2칸/);
 const button=card.querySelector('button');assert.equal(button.disabled,false);button.click();button.click();
 assert.deepEqual(G.weapons.map(w=>w.id),['absolute_bloom']);const reveal=node('fusion-reveal');assert.equal(reveal.dataset.tier,'absolute');
 assert.equal(reveal.querySelector('.fusion-reveal-ingredients').children.length,3);assert.match(reveal.querySelector('.fusion-reveal-slots').textContent,/3개.*2칸/);
 reveal.querySelector('.fusion-reveal-skip').click();reveal.querySelector('.fusion-reveal-confirm').click();assert.equal(G.paused,false);
});

test('new and restarted runs apply the modest mob HP increase once without raising player HP', async () => {
    const { spawnEnemy } = await import('../src/game/enemies.js');
    const { onPlayerDeath, retryStage } = await import('../src/game/game.js');
    freshRun();
    const playerMax = G.player.maxHp;
    const first = spawnEnemy('shambler', 400, 0);
    assert.ok(Math.abs(first.hp - 15.39) < 1e-9);
    onPlayerDeath(); retryStage();
    const second = spawnEnemy('shambler', 400, 0);
    assert.ok(Math.abs(second.hp - 15.39) < 1e-9, 'retry does not compound mob toughness');
    assert.equal(G.stage, 1);
    assert.equal(G.player.maxHp, playerMax);
    assert.equal(G.player.hp, playerMax);
});

test('real game step freezes enclosure on pause and releases on lifecycle transitions', async () => {
 const { startEncirclement } = await import('../src/game/encirclement.js');
 const { startStage, beginStageClear, onPlayerDeath, continueRun, loadRun } = await import('../src/game/game.js');
 freshRun(); startStage(5); G.pendingLevelUps=0; G.hitstop=0; assert.equal(startEncirclement(),true);
 G.paused=true; step(2); assert.equal(G.encirclement.age,0); G.paused=false;
 step(1); step(1); assert.equal(G.encirclement.phase,'active');
 G.player.x=10000; step(.01); assert.ok(Math.hypot(G.player.x,G.player.y)<=G.encirclement.radius-G.player.radius+.001);
 beginStageClear(); assert.equal(G.encirclement,null);
 startStage(5); startEncirclement(); const snap=loadRun(); continueRun(snap); assert.equal(G.encirclement,null);
 startEncirclement(); onPlayerDeath(); assert.equal(G.encirclement,null);
 freshRun(); startStage(5); startEncirclement(); G.mode='idle'; step(0); assert.equal(G.encirclement,null);
 freshRun();
});

test('main menu bestiary opens its real modal and Escape restores launcher focus',async()=>{
 const {isBestiaryOpen}=await import('../src/ui/bestiary.js');
 freshRun();showTitle();const launcher=node('btn-bestiary');launcher.focus();launcher.click();
 assert.equal(isBestiaryOpen(),true);assert.equal(topModalId(),'bestiary');assert.equal(node('bestiary').hidden,false);
 window.dispatch('keydown',{code:'Escape',key:'Escape',target:document.activeElement});
 assert.equal(isBestiaryOpen(),false);assert.equal(topModalId(),null);assert.equal(document.activeElement,launcher);
 launcher.click();showTitle();assert.equal(isBestiaryOpen(),false);
});

test('new bloom and butcher runs receive two distinct Lv1 weapon slots once',async()=>{
 const {TECHS}=await import('../src/data/techs.js');
 const {resonanceCount,resonanceTier}=await import('../src/game/tech.js');
 const {loadRun,startStage}=await import('../src/game/game.js');
 const {applyChoice}=await import('../src/game/progression.js');
 const inventory=()=>G.weapons.map(w=>[w.id,w.level,w.evolved,w.slot]);
 for(const id of Object.keys(TECHS)){
  newRun(1,id);
  assert.deepEqual(inventory(),id==='bloom'?[['thorns',1,false,0],['cannon',1,false,1]]:id==='butcher'?[['sword',1,false,0],['saw',1,false,1]]:[[TECHS[id].start.weapon,1,false,0]],id);
  assert.deepEqual(G.passives,{[TECHS[id].start.passive]:1});
  assert.equal(resonanceCount(),['bloom','butcher'].includes(id)?3:2);assert.equal(resonanceTier(),1);
 }
 for(const id of [null,'missing-tech']){
  newRun(1,id);assert.equal(G.tech,null);assert.deepEqual(inventory(),[['shotgun',1,false,0]]);assert.deepEqual(G.passives,{});
 }
 newRun(1,'bloom');const firstRun=G.runId;
 applyChoice({kind:'weapon',id:'cannon',level:2});startStage(2);startStage(3);
 assert.deepEqual(inventory(),[['thorns',1,false,0],['cannon',2,false,1]],'stage transitions neither grant duplicates nor reset levels');
 assert.deepEqual(loadRun().weapons.map(w=>[w.id,w.level]),[['thorns',1],['cannon',2]]);
 newRun(1,'bloom');assert.notEqual(G.runId,firstRun);assert.deepEqual(inventory(),[['thorns',1,false,0],['cannon',1,false,1]]);
 newRun(5,'bloom');assert.deepEqual(inventory(),[['thorns',1,false,0],['cannon',1,false,1]],'advanced stage starts do not grant levels or evolution');
 assert.equal(G.pendingLevelUps,20);assert.deepEqual(G.passives,{regen:1});
});

test('continuing old, dual-starter and fused bloom checkpoints never retroactively grants starter equipment',async()=>{
 const {loadRun,continueRun}=await import('../src/game/game.js');
 const {snapshotBuild}=await import('../src/game/progression.js');
 newRun(1,'bloom');const current=loadRun();
 for(let i=0;i<3;i++){assert.equal(continueRun(current),true);assert.deepEqual(snapshotBuild().weapons,current.weapons);}
 const old={...current,weapons:[{id:'thorns',level:4,evolved:false}],passives:{regen:2}};
 assert.equal(continueRun(old),true);assert.deepEqual(snapshotBuild().weapons,old.weapons);assert.deepEqual(G.passives,{regen:2});
 const evolved={...current,weapons:[{id:'thorns',level:8,evolved:true},{id:'cannon',level:8,evolved:true}],passives:{regen:2,pollen:1}};
 assert.equal(continueRun(evolved),true);assert.deepEqual(snapshotBuild().weapons,evolved.weapons);assert.deepEqual(G.passives,evolved.passives);
 const fused={...current,weapons:[{id:'lotus_bloom',level:3,evolved:false}],consumedItems:['thorns','cannon']};
 assert.equal(continueRun(fused),true);assert.deepEqual(snapshotBuild().weapons,fused.weapons);assert.deepEqual([...G.consumedItems],fused.consumedItems);
});

test('bloom selection shows both starters and correct slot/resonance counts; cancel and double-confirm cannot grant extras',async()=>{
 const {openTechSelect}=await import('../src/ui/tech-select.js');
 const {snapshotBuild}=await import('../src/game/progression.js');
 freshRun();const before=snapshotBuild();let starts=0;
 const pick=(id,difficulty)=>{starts++;newRun(1,id,difficulty);};
 openTechSelect(pick);
 const bloom=node('tech-list').querySelector('[data-tech="bloom"]');bloom.click();
 assert.equal(bloom.querySelector('.tech-arts').children.length,3);
 assert.ok(node('tech-detail').textContent.includes(`${WEAPONS.thorns.name} Lv1 + ${WEAPONS.cannon.name} Lv1 + ${PASSIVES.regen.name} Lv1`));
 assert.match(node('tech-detail').textContent,/무기 2\/6칸 · 공명 3\/6 · I단계/);
 node('btn-tech-back').click();assert.equal(starts,0);assert.deepEqual(snapshotBuild(),before);
 openTechSelect(pick);
 node('tech-list').querySelector('[data-tech="gunline"]').click();
 assert.match(node('tech-detail').textContent,/무기 1\/6칸 · 공명 2\/6/);
 node('tech-list').querySelector('[data-tech="bloom"]').click();
 node('btn-tech-go').click();const runId=G.runId;node('btn-tech-go').click();
 assert.equal(starts,1);assert.equal(G.runId,runId);assert.deepEqual(G.weapons.map(w=>[w.id,w.level]),[['thorns',1],['cannon',1]]);
 openTechSelect(pick);node('btn-tech-back').click();assert.equal(starts,1);assert.equal(G.weapons.length,2);
});

test('pet training shop shows ownership, current-next values, exact price and capped state',async()=>{
 const {renderPetUpgradeShop}=await import('../src/ui/pet-upgrade-shop.js');const {save}=await import('../src/core/save.js');
 const prior={inventory:save.inventory,petUpgrades:save.petUpgrades,gold:save.gold};const list=document.createElement('div');
 save.inventory=[];save.petUpgrades={attack:0,heal:0,support:0};save.gold=2000;renderPetUpgradeShop(list,()=>{});
 assert.equal(list.children.length,3);assert.ok(list.querySelectorAll('button').every(b=>b.disabled));assert.match(list.querySelector('button').textContent,/보유 필요/);
 list.replaceChildren();save.inventory=['pet_yeongnyang'];renderPetUpgradeShop(list,()=>{});assert.match(list.children[0].querySelector('.s-desc').textContent,/14 → 16/);assert.match(list.children[0].querySelector('button').textContent,/30/);
 list.replaceChildren();save.petUpgrades={attack:5,heal:3,support:3};renderPetUpgradeShop(list,()=>{});assert.ok(list.querySelectorAll('button').every(b=>b.disabled));assert.match(list.children[1].querySelector('.s-desc').textContent,/회복 HP 6/);Object.assign(save,prior);
});
