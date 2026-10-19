// A truthful boot screen: only real loader events change progress. No timer
// animates a percentage and an errored attempt never enters the game.
export function createLoadingScreen(root = document) {
    const get = id => root.getElementById(id);
    const screen = get('loading');
    const track = get('loading-progress');
    const fill = get('loading-fill');
    const percent = get('loading-text');
    const status = get('loading-status');
    const title = get('loading-title');
    const count = get('loading-count');
    const error = get('loading-error');
    const retry = get('loading-retry');
    const art = get('loading-art');
    const fallback = get('loading-art-fallback');
    let active = false;
    let finished = false;
    let attempt = 0;
    let controller;
    let lastProgress = 0;
    let task;
    let onReady;
    let needsReload = false;

    const artFailed = () => { art.hidden = true; fallback.hidden = false; };
    art.addEventListener('error', artFailed);
    if (art.complete && !art.naturalWidth) artFailed();

    function progress(key, ratio, detail = {}) {
        if (!Number.isFinite(ratio)) return;
        const bounded = Math.max(lastProgress, Math.min(1, Math.max(0, ratio)));
        lastProgress = bounded;
        const value = Math.floor(bounded * 100);
        fill.style.width = `${value}%`;
        percent.textContent = `${value}%`;
        track.setAttribute('aria-valuenow', String(value));
        track.setAttribute('aria-valuetext', `${value}% 준비됨`);
        if (Number.isInteger(detail.done) && Number.isInteger(detail.total)) count.textContent = `${detail.done} / ${detail.total} 준비 항목 확인`;
        if (detail.phase === 'prepare') status.textContent = '전투 효과와 작전 장면을 준비하고 있어요.';
        else if (detail.phase === 'ready') status.textContent = '준비 완료. 작전을 시작합니다.';
    }

    async function run() {
        if (active || finished || !task) return false;
        if (needsReload) { (root.defaultView || globalThis).location.reload(); return false; }
        active = true;
        let enteringGame = false;
        const current = ++attempt;
        controller?.abort();
        controller = new AbortController();
        screen.hidden = false;
        screen.dataset.state = 'loading';
        screen.setAttribute('aria-busy', 'true');
        title.textContent = '다음 새벽을 향해';
        status.textContent = '꽃돼지의 장비와 감염 구역을 불러오고 있어요.';
        count.textContent = '준비 항목 확인 중';
        error.hidden = true;
        retry.hidden = true;
        retry.disabled = true;
        lastProgress = 0;
        progress(null, 0);
        try {
            const result = await task((...args) => { if (current === attempt && active) progress(...args); }, controller.signal);
            if (current !== attempt) return false;
            // Completion is controlled by the successful real operation, never
            // by an arbitrary amount of elapsed time or an animated percentage.
            screen.setAttribute('aria-busy', 'false');
            enteringGame = true;
            await onReady?.(result);
            finished = true;
            screen.hidden = true;
            if (root.activeElement === retry) get('btn-new')?.focus({ preventScroll: true });
            return true;
        } catch (failure) {
            if (current !== attempt) return false;
            controller.abort();
            needsReload = enteringGame;
            screen.dataset.state = 'error';
            screen.setAttribute('aria-busy', 'false');
            title.textContent = '작전 준비가 멈췄어요';
            status.textContent = enteringGame ? '게임 화면을 준비하지 못했어요.' : '필수 장비 데이터를 불러오지 못했어요.';
            error.textContent = enteringGame ? '화면을 새로고침한 뒤 다시 시도해 주세요. 저장된 진행 상황은 그대로 유지됩니다.' : '연결 상태를 확인한 뒤 다시 시도해 주세요. 저장된 진행 상황은 그대로 유지됩니다.';
            error.hidden = false;
            retry.disabled = false;
            retry.hidden = false;
            retry.textContent = enteringGame ? '새로고침' : '다시 시도';
            retry.focus();
            return false;
        } finally {
            if (current === attempt) active = false;
        }
    }

    retry.addEventListener('click', () => { void run(); });
    return {
        start(load, ready) { if (task) return Promise.resolve(false); task = load; onReady = ready; return run(); },
        retry: run,
    };
}
