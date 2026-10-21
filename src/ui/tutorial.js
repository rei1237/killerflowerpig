// Optional field guide. Own storage key; never reads or rewrites player saves.
export const TUTORIAL_KEY = 'kfp.tutorial.v2';
const ART = 'asset/tutorial/';
export const TUTORIAL_STEPS = [
    { label: '이동', title: '움직이면, 길이 열려요', text: '꽃돼지를 움직여 적 사이의 빈틈으로 빠져나가세요. 멈추기보다 넓게 돌아가는 것이 안전해요.', tip: 'PC · WASD / 방향키   |   모바일 · 화면을 누른 채 드래그', image: 'field-guide.webp', alt: '달리며 연꽃 총을 쏘는 꽃돼지', visual: 'move' },
    { label: '자동 공격', title: '공격은 꽃돼지에게 맡겨요', text: '무기는 자동으로 공격해요. 적을 짧게 클릭하거나 탭하면 사거리 안에서 그 적을 우선 조준해요. 같은 적을 다시 누르면 집중 조준을 해제해요.', tip: '드래그는 이동, 짧은 탭은 조준이에요. 적이 죽거나 너무 멀어지면 자동 조준으로 돌아와요.', image: 'field-guide.webp', alt: '민트색 연꽃 총을 발사하는 꽃돼지', visual: 'fire' },
    { label: '아이템 조합', title: '두 장비의 장점을 하나로', text: '연꽃 정원은 연꽃 가시 Lv.1 + 꽃잎포 Lv.1, 재생하는 살점 Lv.1로 시작해요. 꽃잎포도 강화하는 자동 공격 무기예요. 기본 무기를 Lv.8까지 키우고 짝 보조 아이템 Lv.1 이상을 갖춘 뒤 상자로 진화시키세요. 진화 무기 2개를 모으면 최종 무기, 꽃잎포·연꽃 가시·화염병 3개를 모두 진화시키면 절대 무기 만개로 조합할 수 있어요.', tip: '연꽃 정원의 시작 무기는 6칸 중 2칸을 써요. 무기 교체는 도전당 1회, 보조 아이템은 칸 제한이 없어요. 최종은 진화 2개, 절대는 진화 3개를 소모해요.', image: 'field-guide.webp', alt: '연꽃 무기를 든 꽃돼지', visual: 'fire' },
    { label: '수집과 성장', title: '젬 · 코인 · 상자는 달라요', text: '파란 경험치 젬은 레벨업에 필요해요. 레벨이 오르면 새 아이템이나 보유 아이템 강화를 선택하세요. 금빛 코인은 상점 재화예요. 강한 일반 개체는 15~55%, 정예는 80% 확률로 떨어뜨려요. 보스는 25~70코인을 확정으로 줘요. 필드 상자는 이번 전투의 강화 보상이에요. 전역 패시브는 나중에 얻은 무기와 조합 무기에도 적용돼요.', tip: '사망하면 죽은 스테이지의 시작 레벨·장비로 재도전해요. 모은 코인과 상점의 영구 성장은 유지돼요.', image: 'field-guide.webp', alt: '꽃돼지 주위의 파란 경험치 젬과 금빛 코인', visual: 'collect' },
    { label: '필드 상자', title: '주워서 열고, 보상을 받아요', text: '보스가 떨어뜨린 상자를 주우면 전투가 멈추고 회수 물자가 열려요. 아주 드물게 적이 🎁 보물 상자를 떨어뜨리기도 해요(엘리트와 색 고리·아이콘이 붙은 강한 개체일수록 확률이 높아요). 열기 → 보상 확인 → 받기 순서로 진행해요. 보물 상자는 코인을 주고(보스보다는 적어요), 절반 확률로 강화 1회(진화 우선), 드물게 새 보조 아이템도 줘요.', tip: '색 고리와 아이콘이 붙은 개체는 일반 청토끼보다 훨씬 강한 변이체예요. 엘리트는 특수 능력(후반에는 여러 개)을 쓰니 예고선을 꼭 확인하세요. 보스 상자는 더 많은 강화와 확률형 고급 강화재를 줘요.', image: '../items/salvage-cache.png', alt: '보스에게서 얻는 회수 물자 상자', visual: 'fieldbox' },
    { label: '상점', title: '다음 전투를 더 든든하게', text: '모은 코인으로 영구 강화와 유물을 구매하세요. STAGE 3 클리어 후에는 고급 장신구를 구매해 1개만 장착할 수 있어요. 상점의 코인 상자는 공개된 확률로 유물 1개를 줘요.', tip: '필드 상자와 상점 코인 상자는 보상이 달라요. 가격·확률·중복 보상을 확인하세요. 현금 구매는 없어요', image: 'moon-hat.webp', alt: '영냥이의 초승달 모자 강화 아이템', visual: 'shop' },
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
