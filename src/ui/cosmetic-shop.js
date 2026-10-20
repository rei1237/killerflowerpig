// The fitting room is a read-only projection until a separate buy/equip action.
// Its model never references G.player, so animation and try-on cannot affect a run.
import { COSMETICS } from '../data/cosmetics.js';
import { save, buyCosmetic, setCosmetic } from '../core/save.js';
import { shopAccess } from '../core/shop-access.js';
import { drawAppearance, appearanceAssets } from '../game/player-appearance.js';
import { audio } from '../core/audio.js';

const $ = id => document.getElementById(id);
const SLOT_NAMES = { outfit: '의상', ornament: '장식' };
let overrides = {};
let animation = 'idle';
let flipped = false;
let animationStart = 0;
let frameId = null;
let generation = 0;
let context = null;
let canvas = null;
let visibilityBound = false;
let refreshShop = () => renderCosmeticShop();
let isActive = () => !$('shop')?.hidden;

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}
function button(className, text, focusId) {
    const element = node('button', className, text);
    element.type = 'button';
    if (focusId) element.dataset.cosmeticFocus = focusId;
    return element;
}
function actualAppearance() {
    return { outfit: save.equippedCosmetics?.outfit || null, ornament: save.equippedCosmetics?.ornament || null };
}
function previewAppearance() { return { ...actualAppearance(), ...overrides }; }
function itemName(id) { return COSMETICS.find(item => item.id === id)?.name || '기본 모습'; }
function owns(id) { return !!save.cosmeticInventory?.includes(id); }
function active() { return !!$('shop') && !$('shop').hidden && isActive() && !document.hidden; }
function reducedMotion() { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
function announce(message) { const status = $('cosmetic-status'); if (status) status.textContent = message; }

function updatePreviewLabels() {
    const actual = actualAppearance(), look = previewAppearance();
    const changed = Object.keys(SLOT_NAMES).filter(slot => look[slot] !== actual[slot]);
    const unpaid = changed.some(slot => look[slot] && !owns(look[slot]));
    $('cosmetic-preview-state').textContent = changed.length
        ? unpaid ? '미리보기 · 아직 구매되지 않음' : '미리보기 · 아직 장착되지 않음'
        : '현재 장착 모습';
    $('cosmetic-preview-state').dataset.preview = String(changed.length > 0);
    $('cosmetic-preview-name').textContent = changed.length === 1 ? itemName(look[changed[0]]) : changed.length ? '나만의 연꽃 조합' : '꽃돼지 · 나의 장비';
    $('cosmetic-preview-look').textContent = `의상 · ${itemName(look.outfit)} / 장식 · ${look.ornament ? itemName(look.ornament) : '없음'}`;
    if (appearanceAssets(look).missing.length) $('cosmetic-preview-state').textContent += ' · 외형 파일을 불러오지 못해 기본 모습 표시';
    $('cosmetic-preview-reset').disabled = !changed.length;
    $('cosmetic-preview-canvas').setAttribute('aria-label', `꽃돼지 외형 미리보기. ${$('cosmetic-preview-look').textContent}`);
}

function paintPreview(timestamp = 0) {
    if (!context || !canvas) return;
    const clock = timestamp / 1000;
    const phase = reducedMotion() ? 0.025 : Math.max(0.025, (clock - animationStart) % 1.2);
    // This temporary object is never installed as the live player.
    const player = { anim: Math.floor(clock * 7) % 8, animT: 0, flip: flipped,
        shotAt: animation === 'fire' ? clock - phase : -Infinity,
        shotFlip: flipped, hurtT: 0, iframes: 0, vx: 0, vy: 0, dead: false };
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(canvas.width / 320, canvas.height / 312);
    const drawn = drawAppearance(context, { x: 160, y: 260, clock, player,
        appearance: previewAppearance(), scale: 3.35 });
    context.restore();
    $('cosmetic-preview-fallback').hidden = drawn !== false;
}

function tick(timestamp) {
    frameId = null;
    if (!active()) return;
    paintPreview(timestamp);
    if (!reducedMotion() && typeof requestAnimationFrame === 'function') frameId = requestAnimationFrame(tick);
}

export function startCosmeticPreview() {
    if (!active() || !context || frameId !== null) return;
    paintPreview(typeof performance !== 'undefined' ? performance.now() : 0);
    if (!reducedMotion() && typeof requestAnimationFrame === 'function') frameId = requestAnimationFrame(tick);
}

export function stopCosmeticPreview() {
    if (frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
    frameId = null;
}

function preparePreview() {
    const nextCanvas = $('cosmetic-preview-canvas');
    if (nextCanvas !== canvas) {
        stopCosmeticPreview();
        canvas = nextCanvas;
        try { context = canvas?.getContext?.('2d') || null; } catch { context = null; }
        if (context && typeof context.clearRect !== 'function') context = null;
        if (canvas) {
            const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
            canvas.width = Math.round(320 * dpr);
            canvas.height = Math.round(312 * dpr);
        }
        $('cosmetic-preview-fallback').hidden = !!context;
    }
    if (!visibilityBound && document.addEventListener) {
        document.addEventListener('visibilitychange', () => document.hidden ? stopCosmeticPreview() : startCosmeticPreview());
        visibilityBound = true;
    }
    for (const mode of ['idle', 'fire']) {
        const control = $(`cosmetic-preview-${mode}`);
        control.setAttribute('aria-pressed', String(animation === mode));
        control.onclick = () => {
            if (!active()) return;
            animation = mode;
            animationStart = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
            preparePreview();
            paintPreview(animationStart * 1000);
        };
    }
    const flip = $('cosmetic-preview-flip');
    flip.setAttribute('aria-pressed', String(flipped));
    flip.onclick = () => { if (!active()) return; flipped = !flipped; preparePreview(); paintPreview(performance.now()); };
    $('cosmetic-preview-reset').onclick = () => {
        if (!active()) return;
        overrides = {};
        renderCosmeticShop();
        announce('미리보기를 닫고 실제 장착 모습으로 돌아왔습니다.');
    };
}

function transaction(action, item, revision, renderId, control) {
    if (control.disabled || renderId !== generation || !active()) return;
    control.disabled = true;
    let result;
    try {
        result = action === 'buy' ? buyCosmetic(item.id, revision)
            : setCosmetic(item.slot, action === 'clear' ? null : item.id, revision);
    } catch { result = { ok: false, code: 'STORAGE_ERROR' }; }
    if (result.ok) delete overrides[item.slot];
    refreshShop();
    if (result.ok) $('cosmetic-room').querySelector(`[data-cosmetic-focus="${action === 'clear' ? `try-${item.id}` : `clear-${item.slot}`}"]`)?.focus({ preventScroll: true });
    if (!result.ok) {
        const message = result.code === 'REVISION_CONFLICT'
            ? '보유 정보가 갱신되었습니다. 코인과 장착 상태를 확인하고 다시 선택하세요.'
            : result.code === 'STAGE_LOCKED' ? '필요한 스테이지를 클리어한 뒤 구매할 수 있습니다.'
            : result.code === 'INSUFFICIENT_FUNDS' || result.code === 'INSUFFICIENT_GOLD' ? '코인이 부족합니다. 표시된 잔액을 확인하세요.'
            : '변경 사항을 저장하지 못했습니다. 코인과 장착 상태를 확인하고 다시 시도하세요.';
        announce(message);
        return;
    }
    audio.sfx('levelup');
    announce(action === 'buy' ? `${item.name} 구매·장착 완료. 전투 능력치는 그대로입니다.`
        : action === 'clear' ? `${SLOT_NAMES[item.slot]} 장착을 해제했습니다.` : `${item.name} 장착 완료. 전투 능력치는 그대로입니다.`);
}

function renderSlots(renderId) {
    const slots = $('cosmetic-equipped-slots');
    slots.replaceChildren();
    const appearance = actualAppearance(), revision = save.revision;
    for (const [slot, label] of Object.entries(SLOT_NAMES)) {
        const row = node('div', 'cosmetic-slot');
        const copy = node('div', 'cosmetic-slot-copy');
        copy.append(node('small', '', `${label} 슬롯`), node('strong', '', appearance[slot] ? itemName(appearance[slot]) : '장착 없음'));
        const clear = button('cosmetic-slot-clear', '해제', `clear-${slot}`);
        clear.disabled = !appearance[slot];
        clear.setAttribute('aria-label', `${label} 장착 해제`);
        clear.onclick = () => transaction('clear', { id: appearance[slot], slot }, revision, renderId, clear);
        row.append(copy, clear); slots.appendChild(row);
    }
}

function renderCards(renderId) {
    const list = $('cosmetic-list'); list.replaceChildren();
    const look = previewAppearance(), equipped = actualAppearance();
    COSMETICS.forEach((item, index) => {
        const owned = owns(item.id), selected = look[item.slot] === item.id, worn = equipped[item.slot] === item.id;
        const access = shopAccess(save, item), revision = save.revision;
        const card = node('article', `cosmetic-card cosmetic-${item.id}${selected ? ' is-preview' : ''}${worn ? ' is-equipped' : ''}`);
        card.dataset.item = item.id;
        const art = node('div', 'cosmetic-card-art');
        const img = node('img'); img.src = item.art; img.alt = item.name; img.loading = 'lazy'; img.decoding = 'async';
        art.append(img, node('span', 'cosmetic-edition', `0${index + 1}`));
        const copy = node('div', 'cosmetic-card-copy');
        const top = node('div', 'cosmetic-card-top');
        top.append(node('span', 'cosmetic-category', `${SLOT_NAMES[item.slot]} · 외형 전용`), node('span', `cosmetic-ownership${worn ? ' on' : ''}`, worn ? '장착 중' : owned ? '보유 중' : '컬렉션'));
        const name = node('h4', '', item.name);
        const desc = node('p', 'cosmetic-description', item.desc);
        const price = node('div', 'cosmetic-price', owned ? '구매 완료' : `${item.price.toLocaleString()} 코인`);
        const unlock = node('small', 'cosmetic-unlock', owned ? '추가 결제 없이 자유롭게 장착' : access.unlocked ? '해금 완료 · 한 번 구매하면 영구 보유' : access.message);
        copy.append(top, name, desc, price, unlock);
        const actions = node('div', 'cosmetic-card-actions');
        const tryOn = button('cosmetic-button cosmetic-try', selected ? '미리보기 중' : '입어보기', `try-${item.id}`);
        tryOn.setAttribute('aria-label', `${item.name} 입어보기`);
        tryOn.setAttribute('aria-pressed', String(selected));
        tryOn.onclick = () => {
            if (renderId !== generation || !active()) return;
            overrides = { ...overrides, [item.slot]: item.id };
            renderCosmeticShop();
            announce(`${item.name} 미리보기. 코인과 실제 장착은 변경되지 않습니다.`);
        };
        const purchase = button('cosmetic-button cosmetic-purchase', owned ? worn ? '장착 중' : '장착하기'
            : !access.unlocked ? `STAGE ${access.requiredStage} 클리어 필요`
            : save.gold < item.price ? `${(item.price - save.gold).toLocaleString()} 코인 부족` : '구매하고 장착', `${owned ? 'equip' : 'buy'}-${item.id}`);
        purchase.disabled = owned ? worn : !access.unlocked || save.gold < item.price;
        purchase.setAttribute('aria-label', owned ? `${item.name} ${worn ? '장착 중' : '장착하기'}` : `${item.name} ${item.price} 코인으로 구매하고 장착`);
        purchase.onclick = () => transaction(owned ? 'equip' : 'buy', item, revision, renderId, purchase);
        actions.append(tryOn, purchase); card.append(art, copy, actions); list.appendChild(card);
    });
}

export function renderCosmeticShop(options = {}) {
    if (!$('cosmetic-list')) return;
    if (options.onChange) refreshShop = options.onChange;
    if (options.isActive) isActive = options.isActive;
    if (options.resetPreview) { overrides = {}; animation = 'idle'; flipped = false; announce(''); }
    const focusId = document.activeElement?.dataset?.cosmeticFocus;
    const renderId = ++generation;
    preparePreview();
    updatePreviewLabels();
    renderSlots(renderId);
    renderCards(renderId);
    if (focusId) $('cosmetic-room').querySelector(`[data-cosmetic-focus="${focusId}"]`)?.focus({ preventScroll: true });
    startCosmeticPreview();
}
