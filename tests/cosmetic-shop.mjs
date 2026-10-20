// Run: node --test tests/cosmetic-shop.mjs
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
const frames = new Map();
let reduced = false;

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
        this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
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
                const value = attr[1].startsWith('data-') ? this.dataset[attr[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : this.attributes[attr[1]];
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

const previewDraws = [], previewTransforms = [];
const context = new Proxy({ drawImage: (...args) => previewDraws.push(args), translate: (...args) => previewTransforms.push(args), createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }) }, { get: (o, k) => o[k] ?? noop });
const wrapper = new Element('root'); parseInto(wrapper, html);
globalThis.document = Object.assign(new Events(), {
    documentElement: wrapper.querySelector('html'), body: wrapper.querySelector('body'),
    getElementById: id => wrapper.querySelector('#' + id),
    querySelectorAll: selector => wrapper.querySelectorAll(selector),
    createElement: tag => new Element(tag), createTextNode: text => ({ data: text }),
});
document.activeElement = document.body;
globalThis.window = Object.assign(new Events(), { matchMedia: query => ({ matches: query.includes('prefers-reduced-motion') && reduced }), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { hardwareConcurrency: 8, userAgent: 'node-test', standalone: false } });
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
globalThis.setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.setInterval = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: now + delay, interval: delay }); return id; };
globalThis.clearInterval = globalThis.clearTimeout;
globalThis.Image = class { complete=false; naturalWidth=0; };
globalThis.requestAnimationFrame = fn => { const id = ++timerId; frames.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
function frame(ms = 17) { now += ms; for (const [id, fn] of [...frames]) { frames.delete(id); fn(now); } }
function advanceTime(ms) {
    now += ms;
    for (const [id, t] of [...timers]) if (t.due <= now) {
        if (!t.interval) timers.delete(id); else t.due = now + t.interval;
        t.fn();
    }
}

const { G } = await import('../src/game/state.js');
const { images, requestCharacterSheet, clearCharacterCache } = await import('../src/core/assets.js');
const { save, persist } = await import('../src/core/save.js');
const { validateProgress } = await import('../src/core/progression-store.js');
const { COSMETICS } = await import('../src/data/cosmetics.js');
const { initUI, showTitle, openModal, closeModal, topModalId } = await import('../src/ui/screens.js');
const { renderCosmeticShop } = await import('../src/ui/cosmetic-shop.js');
const node = id => document.getElementById(id);
const card = id => node('cosmetic-list').querySelectorAll('article').find(item => item.dataset.item === id);
const action = (id, cls) => card(id).querySelector(cls);
const tryOn = id => action(id, '.cosmetic-try').click();
const buy = id => action(id, '.cosmetic-purchase').click();
const clear = slot => node('cosmetic-equipped-slots').querySelectorAll('button').find(b => b.dataset.cosmeticFocus === `clear-${slot}`).click();
const snapshot = () => JSON.stringify(save);
initUI();
function openShop({ owned = [], equipped = { outfit: null, ornament: null }, gold = 10000, stage = 10 } = {}) {
    showTitle();
    Object.assign(save, validateProgress({ gold, maxClearedStage: stage, cosmeticInventory: owned, equippedCosmetics: equipped, revision: save.revision }));
    assert.equal(persist(), true);
    images.playerFire = { width: 3072, height: 256 };
    images.playerHaloLayer = { width:1536, height:256 };
    for (const item of COSMETICS) if(item.bodySprites)for(const variant of ['normal','lotus'])images[`costume_${item.id}_${variant}`]={width:3072,height:256};
    G.player = { x: 7, y: 13, hp: 83, maxHp: 100, stats: { might: 1.25 }, shotAt: -Infinity };
    node('btn-shop').click();
    assert.equal(topModalId(), 'shop');
}
test.afterEach(() => { showTitle(); clearCharacterCache(); frames.clear(); timers.clear(); previewDraws.length = previewTransforms.length = 0; document.hidden = false; reduced = false; });
const lastBodyFrame = () => previewDraws.findLast(call => call[0]?.width === 3072)?.[1] / 384;

test('unowned try-on changes only the preview, with no debit, persistence, equip or live-player mutation', () => {
    openShop();
    const before = snapshot(), disk = JSON.stringify([...storage]), player = JSON.stringify(G.player);
    tryOn('dusk_lotus_cape');
    assert.match(node('cosmetic-preview-state').textContent, /미리보기.*아직 구매되지 않음/);
    assert.match(node('cosmetic-preview-look').textContent, /황혼 연꽃 망토/);
    node('cosmetic-preview-fire').click(); node('cosmetic-preview-flip').click(); frame();
    assert.equal(snapshot(), before); assert.equal(JSON.stringify([...storage]), disk); assert.equal(JSON.stringify(G.player), player);
    assert.equal(node('cosmetic-preview-reset').disabled, false);
    node('cosmetic-preview-reset').click();
    assert.equal(node('cosmetic-preview-state').textContent, '현재 장착 모습');
    assert.equal(node('cosmetic-preview-reset').disabled, true);
    assert.equal(snapshot(), before);
});

test('locked or unaffordable collections remain tryable, but cannot be purchased', () => {
    openShop({ stage: 0, gold: 0 });
    for (const item of COSMETICS) {
        assert.equal(action(item.id, '.cosmetic-purchase').disabled, true);
        assert.equal(action(item.id, '.cosmetic-try').disabled, false);
        tryOn(item.id); assert.match(node('cosmetic-preview-look').textContent, new RegExp(item.name));
    }
    assert.equal(save.gold, 0); assert.deepEqual(save.cosmeticInventory, []);
    closeModal('shop'); openShop({ gold: 100, stage: 10 });
    assert.match(action('dusk_lotus_cape', '.cosmetic-purchase').textContent, /260 코인 부족/);
});

test('purchase explicitly equips once; worn state is separate from temporary try-on', () => {
    openShop(); tryOn('dusk_lotus_cape');
    const stale = action('dusk_lotus_cape', '.cosmetic-purchase'), player = JSON.stringify(G.player);
    assert.equal(stale.textContent, '구매하고 장착'); stale.click();
    assert.equal(save.gold, 9640); assert.deepEqual(save.cosmeticInventory, ['dusk_lotus_cape']);
    assert.equal(save.equippedCosmetics.outfit, 'dusk_lotus_cape');
    assert.equal(node('cosmetic-preview-state').textContent, '현재 장착 모습');
    assert.match(node('cosmetic-status').textContent, /구매·장착 완료/);
    assert.equal(node('shop-gold').textContent, '● 9640');
    assert.equal(document.activeElement.dataset.cosmeticFocus, 'clear-outfit');
    stale.disabled = false; stale.click(); assert.equal(save.gold, 9640);
    tryOn('jade_lotus_guard');
    assert.equal(save.equippedCosmetics.outfit, 'dusk_lotus_cape');
    assert.equal(JSON.stringify(G.player), player);
});

test('owned outfits switch without charging; ornament is independent and each slot can clear', () => {
    const owned = COSMETICS.map(item => item.id);
    openShop({ owned, equipped: { outfit: 'dusk_lotus_cape', ornament: 'dawn_petal_halo' } });
    const gold = save.gold;
    tryOn('jade_lotus_guard'); assert.match(node('cosmetic-preview-state').textContent, /아직 장착되지 않음/);
    assert.equal(save.equippedCosmetics.outfit, 'dusk_lotus_cape');
    buy('jade_lotus_guard');
    assert.deepEqual(save.equippedCosmetics, { outfit: 'jade_lotus_guard', ornament: 'dawn_petal_halo' });
    assert.equal(save.gold, gold);
    clear('outfit'); assert.deepEqual(save.equippedCosmetics, { outfit: null, ornament: 'dawn_petal_halo' });
    clear('ornament'); assert.deepEqual(save.equippedCosmetics, { outfit: null, ornament: null });
    assert.deepEqual(save.cosmeticInventory, owned); assert.equal(save.gold, gold);
});

test('stale and detached controls cannot purchase after rerender or after shop close', () => {
    openShop();
    const stale = action('jade_lotus_guard', '.cosmetic-purchase');
    tryOn('dusk_lotus_cape'); const before = snapshot(); stale.click(); assert.equal(snapshot(), before);
    const closed = action('jade_lotus_guard', '.cosmetic-purchase'); closeModal('shop'); closed.click(); assert.equal(snapshot(), before);
});

test('concurrent revision and storage failures do not charge or grant and produce recoverable status', () => {
    openShop();
    save.revision++; const before = snapshot(); buy('dusk_lotus_cape');
    assert.equal(snapshot(), before); assert.match(node('cosmetic-status').textContent, /저장 정보가 변경되어/);
    const original = localStorage.setItem; localStorage.setItem = () => { throw new Error('disk full'); };
    try { const beforeWrite = snapshot(); buy('dusk_lotus_cape'); assert.equal(snapshot(), beforeWrite); assert.match(node('cosmetic-status').textContent, /저장하지 못했습니다/); }
    finally { localStorage.setItem = original; }
});

test('one animation loop runs only while the shop is topmost and visible; reopen discards try-on', () => {
    openShop(); assert.equal(frames.size, 1);
    renderCosmeticShop(); renderCosmeticShop(); assert.equal(frames.size, 1);
    tryOn('dusk_lotus_cape'); frame(); assert.equal(frames.size, 1);
    openModal('settings'); assert.equal(frames.size, 0);
    closeModal('settings'); assert.equal(frames.size, 1);
    document.hidden = true; document.dispatch('visibilitychange'); assert.equal(frames.size, 0);
    document.hidden = false; document.dispatch('visibilitychange'); assert.equal(frames.size, 1);
    closeModal('shop'); assert.equal(frames.size, 0);
    node('btn-shop').click(); assert.equal(frames.size, 1);
    assert.equal(node('cosmetic-preview-state').textContent, '현재 장착 모습');
    assert.match(node('cosmetic-preview-look').textContent, /기본 모습/);
    showTitle(); assert.equal(frames.size, 0);
});

test('reduced-motion rests idle but plays one explicitly requested shot at combat speed', () => {
    reduced = true; openShop(); assert.equal(frames.size, 0);
    tryOn('dawn_petal_halo'); node('cosmetic-preview-fire').click();
    assert.equal(frames.size, 1);
    for (let i = 0; i < 20; i++) frame();
    assert.equal(frames.size, 0); assert.match(node('cosmetic-preview-look').textContent, /새벽 꽃잎 광환/);
    node('cosmetic-preview-fire').click(); assert.equal(frames.size, 1);
    node('cosmetic-preview-idle').click(); assert.equal(frames.size, 0);
});

test('missing canvas APIs gracefully show fallback while the shop remains interactive', () => {
    const original = node('cosmetic-preview-canvas');
    const replacement = new Element('canvas', { id: 'cosmetic-preview-canvas' }); replacement.getContext = undefined;
    const parent = original.parentNode, index = parent.children.indexOf(original);
    parent.children[index] = replacement; replacement.parentNode = parent;
    try {
        openShop(); assert.equal(node('cosmetic-preview-fallback').hidden, false); assert.equal(frames.size, 0);
        tryOn('dusk_lotus_cape'); assert.match(node('cosmetic-preview-state').textContent, /미리보기/);
        assert.deepEqual(save.cosmeticInventory, []);
    } finally { showTitle(); parent.children[index] = original; original.parentNode = parent; }
});

test('responsive fitting-room controls use real buttons, visible focus and explicit outfit effect copy', () => {
    const css = fs.readFileSync(new URL('../src/ui/cosmetic-shop.css', import.meta.url), 'utf8');
    assert.match(css, /@media\(max-width:480px\)/); assert.match(css, /min-height:44px/);
    assert.match(css, /focus-visible/); assert.match(css, /prefers-reduced-motion/);
    assert.match(html, /망토는 이동·수집을, 예복은 방어를 돕습니다/);
    assert.match(html, /입어보기는 저장·구매·장착되지 않습니다/);
    assert.match(html, /구매하면 영구 보유되며 해당 슬롯에 바로 장착됩니다/);
    openShop();
    for (const control of node('cosmetic-room').querySelectorAll('button')) assert.equal(control.type, 'button');
});
test('missing wearing atlas is disclosed after its lazy request fails without using a flat inventory icon',async()=>{
 openShop();delete images.costume_jade_lotus_guard_normal;tryOn('jade_lotus_guard');
 assert.match(node('cosmetic-preview-state').textContent,/동작 외형 준비 중/);
 advanceTime(20001); await requestCharacterSheet('costume_jade_lotus_guard_normal'); renderCosmeticShop();
 assert.match(node('cosmetic-preview-state').textContent,/외형 파일을 불러오지 못해 기본 모습 표시/);
 assert.deepEqual(save.cosmeticInventory,[]);
});

test('preview uses all eight combat poses and actual base shotgun cadence, with immediate repeat clicks', () => {
    openShop();
    const before = snapshot(), player = JSON.stringify(G.player);
    node('cosmetic-preview-fire').click(); assert.equal(lastBodyFrame(), 1);
    let last = 0;
    for (const [elapsed, expected] of [[17, 1], [50, 2], [85, 3], [130, 4], [180, 5], [235, 6], [280, 7], [315, 0], [1005, 1]]) {
        frame(elapsed - last); last = elapsed;
        assert.equal(lastBodyFrame(), expected, `preview t=${elapsed}ms`);
    }
    frame(160); assert.equal(lastBodyFrame(), 5);
    node('cosmetic-preview-fire').click(); assert.equal(lastBodyFrame(), 1);
    assert.equal(frames.size, 1);
    assert.equal(snapshot(), before); assert.equal(JSON.stringify(G.player), player);
});

test('legendary preview repeats at the actual 450ms cadence without changing progression or the live player', () => {
    openShop(); save.upgrades.lotus_gun = 1;
    images.playerLotusFire = { width: 3072, height: 256 };
    const before = snapshot(), player = JSON.stringify(G.player);
    node('cosmetic-preview-fire').click(); assert.equal(lastBodyFrame(), 1);
    frame(310); assert.equal(lastBodyFrame(), 0);
    frame(145); assert.equal(lastBodyFrame(), 1);
    frame(230); assert.equal(lastBodyFrame(), 6);
    frame(220); assert.equal(lastBodyFrame(), 1);
    assert.equal(snapshot(), before); assert.equal(JSON.stringify(G.player), player);
});

test('hiding the preview freezes its shot clock and reduced motion removes its bob', () => {
    openShop(); node('cosmetic-preview-fire').click(); frame(85);
    assert.equal(lastBodyFrame(), 3);
    document.hidden = true; document.dispatch('visibilitychange'); assert.equal(frames.size, 0);
    now += 10000;
    document.hidden = false; document.dispatch('visibilitychange'); assert.equal(lastBodyFrame(), 3);
    frame(45); assert.equal(lastBodyFrame(), 4);
    reduced = true;
    node('cosmetic-preview-fire').click(); frame(85);
    assert.equal(lastBodyFrame(), 3);
    assert.deepEqual(previewTransforms.at(-1), [160, 260]);
    for (let i = 0; i < 20; i++) frame();
    assert.equal(frames.size, 0); assert.equal(lastBodyFrame(), 0);
});

test('every card discloses its exact bounded effect and purchase announces the equipped bonus', () => {
    openShop();
    for (const item of COSMETICS) assert.equal(card(item.id).querySelector('.cosmetic-effect').textContent, item.effectDesc);
    buy('jade_lotus_guard');
    assert.ok(node('cosmetic-status').textContent.includes(COSMETICS.find(item => item.id === 'jade_lotus_guard').effectDesc));
    assert.doesNotMatch(node('cosmetic-status').textContent, /능력치는 그대로/);
});

test('six family controls use the real attack renderer, preserve try-on isolation, and return to matching ready stances', () => {
    openShop();
    const before = snapshot(), player = JSON.stringify(G.player);
    const control = node('cosmetic-preview-family');
    assert.equal(control.tagName, 'SELECT');
    for (const family of ['fire','dual','throw','cannon','blade','channel']) {
        const key = family === 'fire' ? 'playerFire' : `player_${family}`;
        images[key] = { id: key, width:3072, height:256 };
        control.value = family; control.dispatch('change');
        node('cosmetic-preview-fire').click();
        let draw = previewDraws.findLast(call => call[0]?.width === 3072);
        assert.equal(draw[0].id, key, family); assert.equal(draw[1],384);
        frame(130);
        draw = previewDraws.findLast(call => call[0]?.width === 3072);
        assert.equal(draw[0].id,key);
        assert.equal(draw[1]/384, family === 'cannon' || family === 'channel' ? 3 : 4, family);
        node('cosmetic-preview-idle').click();
        draw = previewDraws.findLast(call => call[0]?.width === 3072);
        assert.equal(draw[0].id,key);assert.equal(draw[1],0);
    }
    assert.equal(snapshot(),before);assert.equal(JSON.stringify(G.player),player);
    closeModal('shop');assert.equal(frames.size,0);
});
