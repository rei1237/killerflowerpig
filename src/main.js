import { triggerPlayerShot } from './game/player.js';
// 부트스트랩: 에셋 로딩 → UI/입력 연결 → 고정 타임스텝 루프
import { G, configureCaps } from './game/state.js';
import { initRender, render, resize, observeRenderCost } from './game/render.js';
import { step, onPlayerDeath } from './game/game.js';
import { loadAssets } from './core/assets.js';
import { initInput, input } from './core/input.js';
import { audio } from './core/audio.js';
import { createLoadingScreen } from './ui/loading.js';
import {
    initUI, showTitle, showLevelUp, showChest, showGameOver, showStageClear, togglePause, onBossSpawn, toast,
} from './ui/screens.js';

const STEP = 1 / 60;
const MAX_STEPS = 3; // 느린 기기에서 '따라잡기' 연쇄 지연 방지 (대신 잠깐 느려짐)

const canvas = document.getElementById('game');

async function boot() {
    const loading = createLoadingScreen();
    // Core assets have bounded request lifetimes. Retry creates a clean attempt;
    // game/input listeners are initialized only after a successful preparation.
    await loading.start((progress, signal) => loadAssets(progress, { signal }), () => {
        configureCaps();
        initRender(canvas);
        initInput(canvas);
        initUI();

        G.events.levelUp = showLevelUp;
        G.events.chest = showChest;
        G.events.death = onPlayerDeath;
        G.events.gameOver = showGameOver;
        G.events.stageClear = showStageClear;
        G.events.bossSpawn = onBossSpawn;
        G.events.saveError = () => toast('코인을 저장하지 못했습니다. 코인은 바닥에 유지됩니다. 저장 공간을 확인하세요.', 5000);
        input.onPause = togglePause;

        // Typography has local fallbacks; optional web fonts never hold game entry.
        showTitle();
        last = performance.now();
        acc = 0;
        requestAnimationFrame(frame);
    });
}

let last = performance.now();
let acc = 0;
// 성능 계측 (?debug 로 표시)
const perf = { fps: 0, frames: 0, t: 0, stepMs: 0, renderMs: 0 };
const debug = new URLSearchParams(location.search).has('debug');
window.__kfp = { G, perf };

function frame(now) {
    if (document.hidden) {
        last = now;
        acc = 0;
        requestAnimationFrame(frame);
        return;
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // 탭 복귀 시 순간이동 방지
    acc += dt;
    const t0 = performance.now();
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) {
        step(STEP);
        acc -= STEP;
        n++;
    }
    if (n === MAX_STEPS) acc = 0; // 처리 지연 시 따라잡기 포기 (나선형 지연 방지)
    const t1 = performance.now();
    render(G.paused ? 0 : dt);
    const t2 = performance.now();
    observeRenderCost(t2 - t1, now);

    perf.frames++;
    perf.t += dt;
    perf.stepMs += t1 - t0;
    perf.renderMs += t2 - t1;
    if (perf.t >= 1) {
        perf.fps = perf.frames / perf.t;
        perf.avgStep = perf.stepMs / perf.frames;
        perf.avgRender = perf.renderMs / perf.frames;
        perf.frames = 0; perf.t = 0; perf.stepMs = 0; perf.renderMs = 0;
    }
    if (debug) drawDebug();
    requestAnimationFrame(frame);
}

function drawDebug() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height - 40, 360, 40);
    ctx.fillStyle = '#7dff4a';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS ${perf.fps.toFixed(0)} step ${(perf.avgStep || 0).toFixed(2)}ms render ${(perf.avgRender || 0).toFixed(2)}ms`, 8, canvas.height - 24);
    ctx.fillText(`enemies ${G.enemies.count} shots ${G.shots.count} parts ${G.particles.count} gems ${G.gems.count}`, 8, canvas.height - 8);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

// 백그라운드로 가면 자동 일시정지
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if ((G.mode === 'play' || G.mode === 'boss') && !G.paused) togglePause();
        audio.pauseBGM();
    } else if (G.mode !== 'idle' || audio.unlocked) {
        audio.playBGM();
    }
});

// 안드로이드 뒤로가기 → 일시정지
history.pushState({ game: 1 }, '');
window.addEventListener('popstate', () => {
    history.pushState({ game: 1 }, '');
    if (G.mode === 'play' || G.mode === 'boss') togglePause();
    else toast('홈 버튼으로 종료할 수 있습니다');
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}

boot();
