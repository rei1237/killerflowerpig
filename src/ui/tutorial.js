// Optional field guide. Own storage key; never reads or rewrites player saves.
export const TUTORIAL_KEY = 'kfp.tutorial.v1';
const ART = 'asset/tutorial/';
export const TUTORIAL_STEPS = [
    { label: '이동', title: '움직이면, 길이 열려요', text: '꽃돼지를 움직여 적 사이의 빈틈으로 빠져나가세요. 멈추기보다 넓게 돌아가는 것이 안전해요.', tip: 'PC · WASD / 방향키   |   모바일 · 화면을 누른 채 드래그', image: 'field-guide.webp', alt: '달리며 연꽃 총을 쏘는 꽃돼지', visual: 'move' },
    { label: '자동 공격', title: '공격은 꽃돼지에게 맡겨요', text: '무기는 자동으로 공격해요. 공격 버튼을 누를 필요 없이, 적과 거리를 두고 이동에 집중하세요.', tip: '잠깐 쉬려면 일시정지 버튼 · PC에서는 Esc / P', image: 'field-guide.webp', alt: '민트색 연꽃 총을 발사하는 꽃돼지', visual: 'fire' },
    { label: '아이템 조합', title: '두 장비의 장점을 하나로', text: '꽃잎포도 다른 무기처럼 획득하고 강화하는 자동 공격 아이템이에요. 레시피에 맞는 두 아이템을 필요한 레벨까지 키운 다음, 아이템 조합 화면에서 결과를 확인하고 직접 조합하세요.', tip: '조합하면 재료 두 개가 새 아이템 하나로 바뀌어요. 확인 전에는 소모되지 않아요.', image: 'field-guide.webp', alt: '연꽃 무기를 든 꽃돼지', visual: 'fire' },
    { label: '수집과 성장', title: '젬은 성장, 코인은 준비', text: '파란 경험치 젬을 모으면 아이템을 선택할 수 있어요. 새 무기를 얻거나 보유 아이템의 레벨을 올려 이번 전투를 강화하세요. 금빛 코인은 상점에서 사용해요.', tip: '아이템 가까이 다가가면 자동으로 끌려와요', image: 'field-guide.webp', alt: '꽃돼지 주위의 파란 경험치 젬과 금빛 코인', visual: 'collect' },
    { label: '상점', title: '다음 전투를 더 든든하게', text: '메뉴의 상점에서 모은 코인으로 영구 강화를 구매하세요. 체력, 공격력, 이동 속도를 키우고 날개 유물을 확정 구매할 수 있어요. 코인 상자는 공개된 확률로 유물 1개를 줍니다.', tip: '상자 확률·중복 보상을 먼저 확인하세요. 현금 구매는 없어요', image: 'moon-hat.webp', alt: '영냥이의 초승달 모자 강화 아이템', visual: 'shop' },
    { label: '동행 펫', title: '영냥이와 함께 출발!', text: '상점에서 영냥이를 구매하면 자동으로 동행해요. 가까운 코인을 끌어당기고, 주변 적 최대 3마리를 공격하며 체력을 회복해 줘요. STAGE 2를 클리어하면 상점에서 구매할 수 있어요.', tip: '이 안내는 메뉴와 일시정지 화면에서 다시 볼 수 있어요', image: 'yeongnyang.webp', alt: '초승달 모자를 쓴 하얀 고양이 영냥이', visual: 'pet' },
];
let root, hooks = {}, index = 0, opened = false, returnFocus, doneCallback;
let acknowledged = false;
let isolated = [];
export function shouldOfferTutorial() {
    if (acknowledged) return false;
    try { return localStorage.getItem(TUTORIAL_KEY) !== 'done'; } catch { return true; }
}
function acknowledge() {
    acknowledged = true;
    try { localStorage.setItem(TUTORIAL_KEY, 'done'); } catch { /* Guide remains usable without storage. */ }
}
function el(tag, cls, text) {
    const n = document.createElement(tag); if (cls) n.className = cls;
    if (text) n.textContent = text; return n;
}
function render() {
    const step = TUTORIAL_STEPS[index];
    root.dataset.step = step.visual;
    root.querySelector('.tutorial-art').src = ART + step.image;
    root.querySelector('.tutorial-art').alt = step.alt;
    root.querySelector('#tutorial-heading').textContent = step.title;
    root.querySelector('.tutorial-text').textContent = step.text;
    root.querySelector('.tutorial-tip').textContent = step.tip;
    root.querySelector('.tutorial-count').textContent = `${index + 1} / ${TUTORIAL_STEPS.length} · ${step.label}`;
    const back = root.querySelector('[data-action="back"]');
    back.disabled = index === 0;
    root.querySelector('[data-action="next"]').textContent = index === TUTORIAL_STEPS.length - 1 ? '준비 완료' : '다음';
    root.querySelectorAll('.tutorial-dot').forEach((dot, i) => {
        dot.classList.toggle('is-current', i === index);
        dot.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
}
export function initTutorial(options = {}) {
    hooks = options;
    if (root) return;
    root = el('section', 'tutorial-overlay'); root.id = 'tutorial'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'tutorial-heading');
    const panel = el('div', 'tutorial-panel');
    const top = el('div', 'tutorial-top'); top.append(el('span', 'tutorial-eyebrow', 'FLOWERPIG · FIELD GUIDE'));
    const skip = el('button', 'tutorial-skip', '건너뛰기'); skip.type = 'button'; skip.dataset.action = 'skip';
    skip.addEventListener('click', () => closeTutorial()); top.append(skip);
    const picture = el('div', 'tutorial-picture'); const art = el('img', 'tutorial-art'); art.width = 700; art.height = 600; picture.append(art);
    const copy = el('div', 'tutorial-copy');
    const count = el('p', 'tutorial-count'); const heading = el('h2'); heading.id = 'tutorial-heading'; heading.tabIndex = -1;
    const live = el('div', 'tutorial-live'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    live.append(count, heading, el('p', 'tutorial-text'));
    copy.append(live, el('p', 'tutorial-tip'));
    const footer = el('div', 'tutorial-footer');
    const back = el('button', 'tutorial-back', '이전'); back.type = 'button'; back.dataset.action = 'back';
    back.addEventListener('click', () => navigate(-1));
    const dots = el('div', 'tutorial-dots'); dots.setAttribute('aria-label', '안내 단계');
    for (const step of TUTORIAL_STEPS) { const d = el('span', 'tutorial-dot'); d.setAttribute('aria-label', step.label); dots.append(d); }
    const next = el('button', 'tutorial-next', '다음'); next.type = 'button'; next.dataset.action = 'next';
    next.addEventListener('click', () => index === TUTORIAL_STEPS.length - 1 ? closeTutorial() : navigate(1));
    footer.append(back, dots, next); panel.append(top, picture, copy, footer); root.append(panel); document.body.append(root);
    // Capture stops game-level Escape/P and movement shortcuts while reading.
    window.addEventListener('keydown', handleKey, true);
}
function navigate(delta) {
    index = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index + delta)); render();
    root.querySelector('#tutorial-heading').focus({ preventScroll: true });
}
function handleKey(e) {
    if (!opened) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); closeTutorial(); return; }
    if (e.code === 'ArrowRight') { e.preventDefault(); navigate(1); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); navigate(-1); return; }
    if (e.code !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button')].filter(n => !n.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
}
export function isTutorialOpen() { return opened; }
export function openTutorial({ onDone } = {}) {
    if (opened) return false;
    if (!root) initTutorial(hooks);
    opened = true; index = 0; doneCallback = onDone; returnFocus = document.activeElement;
    hooks.onOpen?.();
    // Preserve existing inert state so nested pause/menu dialogs stay intact.
    isolated = [...document.body.children].filter(n => n !== root).map(n => [n, n.inert]);
    for (const [n] of isolated) n.inert = true;
    render(); root.hidden = false; root.querySelector('[data-action="next"]').focus({ preventScroll: true });
    return true;
}
export function closeTutorial() {
    if (!opened) return false;
    opened = false; root.hidden = true; acknowledge();
    for (const [n, wasInert] of isolated) n.inert = wasInert;
    isolated = [];
    const callback = doneCallback; doneCallback = null;
    hooks.onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    callback?.();
    return true;
}
