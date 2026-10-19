import { mountItemArt } from './item-art.js';
let root, hooks = {}, opened = false, timer = null, onDone, returnFocus, isolated = [];
const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
function reveal() {
    if (!opened) return;
    clearTimeout(timer); timer = null;
    root.dataset.phase = 'result';
    root.querySelector('.fusion-reveal-result').hidden = false;
    root.querySelector('.fusion-reveal-skip').hidden = true;
    const confirm = root.querySelector('.fusion-reveal-confirm'); confirm.hidden = false; confirm.focus();
}
export function initFusionReveal(options = {}) {
    hooks = options;
    if (root) return;
    root = el('section', 'fusion-reveal'); root.id = 'fusion-reveal'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'fusion-reveal-heading');
    const panel = el('div', 'fusion-reveal-panel');
    const heading = el('h2', '', '새로운 아이템 탄생!'); heading.id = 'fusion-reveal-heading';
    const ingredients = el('div', 'fusion-reveal-ingredients');
    const halo = el('div', 'fusion-reveal-halo'); halo.setAttribute('aria-hidden','true');
    for (let i=0;i<12;i++) { const petal=el('span','fusion-reveal-petal'); petal.style?.setProperty?.('--petal-angle',`${i*30}deg`); halo.append(petal); }
    panel.append(halo);
    const result = el('div', 'fusion-reveal-result'); result.setAttribute('aria-live', 'polite');
    const skip = el('button', 'fusion-reveal-skip', '즉시 보기'); skip.type = 'button'; skip.addEventListener('click', reveal);
    const confirm = el('button', 'fusion-reveal-confirm', '확인'); confirm.type = 'button'; confirm.addEventListener('click', closeFusionReveal);
    panel.append(el('p', 'fusion-reveal-eyebrow', 'FUSION COMPLETE'), heading, ingredients, result, skip, confirm); root.append(panel); document.body.append(root);
    window.addEventListener('keydown', e => {
        if (!opened) return;
        e.stopImmediatePropagation();
        if (e.code === 'Escape') { e.preventDefault(); closeFusionReveal(); }
        if (e.code === 'Tab') { e.preventDefault(); root.querySelector(root.dataset.phase === 'result' ? '.fusion-reveal-confirm' : '.fusion-reveal-skip').focus(); }
    }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reveal(); });
}
export function openFusionReveal({ ingredients, output, statText = '', onDone: done } = {}) {
    if (opened || !Array.isArray(ingredients) || ![2, 3].includes(ingredients.length) || !output?.id) return false;
    if (!root) initFusionReveal(hooks);
    const absolute = output.tier === 'absolute' || ingredients.length === 3;
    root.dataset.tier = absolute ? 'absolute' : 'final';
    root.querySelector('#fusion-reveal-heading').textContent = absolute ? '절대 무기 · 만개 각성' : '최종 무기 탄생!';
    root.querySelector('.fusion-reveal-eyebrow').textContent = absolute ? 'ABSOLUTE AWAKENING · 3 → 1' : 'FINAL FUSION · 2 → 1';
    const source = root.querySelector('.fusion-reveal-ingredients'); source.replaceChildren();
    for (const item of ingredients) {
        const card = el('div', 'fusion-reveal-source'), art = el('div', 'fusion-reveal-art');
        mountItemArt(art, item.id, 'weapon', item.name || item.id);
        card.append(art, el('span', '', `${item.name || item.id} · Lv.${item.level || 8}`)); source.append(card);
    }
    const result = root.querySelector('.fusion-reveal-result'), art = el('div', 'fusion-reveal-output-art');
    mountItemArt(art, output.id, 'weapon', output.name || output.id);
    result.replaceChildren(art, el('h3', '', `${output.name || output.id} · Lv.1`), el('p', '', output.desc || ''), el('p', 'fusion-reveal-stats', statText), el('p', 'fusion-reveal-slots', `진화 재료 ${ingredients.length}개 → ${absolute ? '절대' : '최종'} 무기 1개 · 무기 슬롯 ${ingredients.length-1}칸 확보`));
    result.hidden = true; root.querySelector('.fusion-reveal-confirm').hidden = true; root.querySelector('.fusion-reveal-skip').hidden = false;
    returnFocus = document.activeElement; isolated = Array.from(document.body.children).filter(n => n !== root).map(n => [n, n.inert]);
    isolated.forEach(([n]) => { n.inert = true; });
    opened = true; onDone = done; root.dataset.phase = 'bloom'; root.hidden = false; hooks.onOpen?.();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.hidden) reveal();
    else { root.querySelector('.fusion-reveal-skip').focus(); timer = setTimeout(reveal, absolute ? 1800 : 900); }
    return true;
}
export function closeFusionReveal() {
    if (!opened) return false;
    clearTimeout(timer); timer = null; opened = false; root.hidden = true;
    isolated.forEach(([n, inert]) => { n.inert = inert; }); isolated = [];
    const done = onDone; onDone = null;
    if (returnFocus?.isConnected) returnFocus.focus();
    hooks.onClose?.(); done?.(); return true;
}
