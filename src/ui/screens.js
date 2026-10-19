// DOM UI: 타이틀/스토리/레벨업/상자/일시정지/설정/상점/결과 화면
import { G } from '../game/state.js';
import { STAGES, STAGE_COUNT } from '../data/stages.js';
import { STORIES, EPILOGUE } from '../data/story.js';
import { WEAPONS, PASSIVES } from '../data/weapons.js';
import { BOSSES } from '../data/bosses.js';
import { rollChoices, applyChoice, rollChest } from '../game/progression.js';
import { newRun, continueRun, retryStage, startStage, beginStageClear, loadRun, clearRun } from '../game/game.js';
import { refreshGore } from '../game/effects.js';
import { configureCaps } from '../game/state.js';
import { resize } from '../game/render.js';
import { settings, setSetting } from '../core/settings.js';
import { save, persist, SHOP, upgradeLevel, buyUpgrade } from '../core/save.js';
import { audio } from '../core/audio.js';
import { input, resetJoy } from '../core/input.js';

const $ = (id) => document.getElementById(id);
const SECRET = '910902';

let installPrompt = null;
let devUnlocked = false;
let modalStack = 0;

function show(id) { $(id).hidden = false; }
function hide(id) { $(id).hidden = true; }

function setPlaying(on) {
    $('btn-pause').hidden = !on;
    input.enabled = on;
    if (!on) resetJoy();
}

function openModal(id) {
    modalStack++;
    G.paused = true;
    resetJoy();
    show(id);
    const first = $(id).querySelector('button, .card');
    first?.focus({ preventScroll: true });
}

function closeModal(id) {
    hide(id);
    modalStack = Math.max(0, modalStack - 1);
    if (modalStack === 0 && (G.mode === 'play' || G.mode === 'boss' || G.mode === 'clearing' || G.mode === 'dead')) G.paused = false;
}

export function toast(msg, ms = 1800) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

function banner(main, sub) {
    const b = $('banner');
    b.innerHTML = `<span class="b-main"></span><span class="b-sub"></span>`;
    b.querySelector('.b-main').textContent = main;
    b.querySelector('.b-sub').textContent = sub || '';
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(banner.timer);
    banner.timer = setTimeout(() => { b.hidden = true; }, 2900);
}

// ─────────────────────────── 타이틀 ───────────────────────────
export function showTitle() {
    G.mode = 'idle';
    G.paused = false;
    setPlaying(false);
    for (const id of ['story', 'gameover', 'clear', 'ending', 'levelup', 'chest', 'pause']) hide(id);
    modalStack = 0;
    const run = loadRun();
    const cont = $('btn-continue');
    if (run && run.stage) {
        cont.hidden = false;
        cont.textContent = `이어하기 — STAGE ${run.stage} (LV ${run.level})`;
    } else cont.hidden = true;
    $('title-record').textContent = `최고 도달: STAGE ${save.maxStage} · 누적 처치 ${save.kills.toLocaleString()} · 골드 ${save.gold}`;
    $('btn-install').hidden = isStandalone();
    show('title');
}

function beginStageFlow(stage, start) {
    hide('title');
    const seenKey = `s${stage}`;
    playStory(`EPISODE ${stage} — ${STAGES[stage].name}`, STORIES[stage], () => {
        save.seenStory[seenKey] = true;
        persist();
        start();
    });
}

// ─────────────────────────── 스토리 (타자기) ───────────────────────────
let storyTimer = null;
function playStory(head, text, onDone) {
    G.paused = true;
    setPlaying(false);
    $('story-head').textContent = head;
    const box = $('story-text');
    box.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    const node = document.createTextNode('');
    box.append(node, cursor);
    show('story');
    let i = 0;
    let done = false;
    const finish = () => {
        clearInterval(storyTimer);
        node.data = text;
        done = true;
        $('story-next').textContent = '시작 ▶';
    };
    $('story-next').textContent = '계속 ▶';
    clearInterval(storyTimer);
    storyTimer = setInterval(() => {
        i = Math.min(text.length, i + 3);
        node.data = text.slice(0, i);
        if (i % 9 === 0) audio.sfx('click');
        box.scrollTop = box.scrollHeight;
        if (i >= text.length) finish();
    }, 22);
    const end = () => {
        clearInterval(storyTimer);
        hide('story');
        $('story-next').onclick = $('story-skip').onclick = box.onclick = null;
        onDone();
    };
    $('story-next').onclick = () => { audio.sfx('click'); if (!done) finish(); else end(); };
    box.onclick = () => { if (!done) finish(); };
    $('story-skip').onclick = () => { audio.sfx('click'); end(); };
}

function startPlaying() {
    setPlaying(true);
    G.paused = false;
    const st = STAGES[G.stage];
    banner(`STAGE ${G.stage}`, `${st.name} — ${st.subtitle}`);
}

// ─────────────────────────── 레벨업 ───────────────────────────
let currentChoices = [];
export function showLevelUp() {
    currentChoices = rollChoices(3);
    renderCards();
    $('levelup-lv').textContent = `LV ${G.level}`;
    updateReroll();
    openModal('levelup');
    audio.sfx('levelup');
}

function updateReroll() {
    const b = $('btn-reroll');
    b.textContent = `🎲 리롤 (${G.rerolls})`;
    b.disabled = G.rerolls <= 0;
}

function renderCards() {
    const wrap = $('cards');
    wrap.innerHTML = '';
    currentChoices.forEach((c, idx) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'card';
        const lvText = c.kind === 'weapon' || c.kind === 'passive'
            ? (c.isNew ? (c.kind === 'weapon' ? '신규 무기' : '신규 패시브') : `LV ${c.level - 1} → ${c.level}`)
            : '';
        el.innerHTML = `
            <div class="card-head">
                <div class="card-icon"></div>
                <div><div class="card-name"></div><div class="card-lv"></div></div>
            </div>
            <div class="card-desc"></div>`;
        el.querySelector('.card-icon').textContent = c.icon;
        el.querySelector('.card-name').textContent = c.name;
        el.querySelector('.card-lv').textContent = `${lvText}  [${idx + 1}]`;
        el.querySelector('.card-desc').textContent = c.desc;
        if (c.isNew) {
            const s = document.createElement('div');
            s.className = 'stamp';
            s.textContent = 'NEW';
            el.appendChild(s);
        }
        if (c.evoHint) {
            const h = document.createElement('div');
            h.className = 'card-evo';
            h.textContent = `🩸 진화 재료 → ${c.evoHint}`;
            el.appendChild(h);
        } else if (c.kind === 'weapon' && WEAPONS[c.id] && !c.isNew) {
            const ev = WEAPONS[c.id].evolve;
            if (c.level === 8) {
                const h = document.createElement('div');
                h.className = 'card-evo';
                h.textContent = `최대 레벨 + ${PASSIVES[ev.with].name} → 보스 관에서 진화`;
                el.appendChild(h);
            }
        }
        el.onclick = () => pickCard(idx);
        wrap.appendChild(el);
    });
}

function pickCard(idx) {
    const c = currentChoices[idx];
    if (!c) return;
    const before = G.gold;
    applyChoice(c);
    save.gold += Math.max(0, G.gold - before);
    closeModal('levelup');
}

// ─────────────────────────── 관 상자 ───────────────────────────
export function showChest(kind) {
    const boss = kind === 'boss';
    const count = boss ? (G.stage >= 6 ? 5 : G.stage >= 3 ? 3 : 1) : 1;
    $('chest-title').textContent = boss ? `${BOSSES[G.stage].name}의 관` : '피 묻은 관';
    const coffin = $('coffin');
    coffin.className = 'coffin';
    $('rewards').innerHTML = '';
    const btn = $('btn-chest');
    btn.textContent = '열기';
    btn.disabled = false;
    openModal('chest');
    let opened = false;
    btn.onclick = () => {
        if (!opened) {
            opened = true;
            btn.disabled = true;
            coffin.classList.add('shaking');
            audio.sfx('heartbeat');
            setTimeout(() => {
                coffin.classList.remove('shaking');
                coffin.classList.add('open');
                audio.sfx('chest');
                const before = G.gold;
                const rewards = rollChest(count);
                save.gold += Math.max(0, G.gold - before);
                rewards.forEach((r, i) => {
                    const el = document.createElement('div');
                    el.className = 'reward' + (r.kind === 'evolve' ? ' evolve' : '');
                    el.style.animationDelay = `${i * 0.12}s`;
                    el.innerHTML = '<div class="r-icon"></div><div><div class="r-name"></div><div class="r-desc"></div></div>';
                    el.querySelector('.r-icon').textContent = r.icon;
                    el.querySelector('.r-name').textContent = r.kind === 'evolve' ? `진화! ${r.name}` : r.name;
                    el.querySelector('.r-desc').textContent = r.desc;
                    $('rewards').appendChild(el);
                });
                btn.textContent = '받기';
                btn.disabled = false;
            }, 900);
            return;
        }
        closeModal('chest');
        if (boss) beginStageClear();
    };
}

// ─────────────────────────── 일시정지 ───────────────────────────
export function togglePause() {
    if (!$('pause').hidden) { closeModal('pause'); return; }
    if (G.mode !== 'play' && G.mode !== 'boss') return;
    if (modalStack > 0) return;
    const wrap = $('pause-build');
    wrap.innerHTML = '';
    for (const w of G.weapons) {
        const d = WEAPONS[w.id];
        const s = document.createElement('span');
        s.textContent = `${w.evolved ? d.evolve.icon : d.icon} ${w.evolved ? d.evolve.name : d.name} Lv${w.level}`;
        wrap.appendChild(s);
    }
    for (const id in G.passives) {
        const s = document.createElement('span');
        s.textContent = `${PASSIVES[id].icon} ${PASSIVES[id].name} Lv${G.passives[id]}`;
        wrap.appendChild(s);
    }
    openModal('pause');
}

// ─────────────────────────── 설정 ───────────────────────────
function syncSettingsUI() {
    for (const seg of document.querySelectorAll('#settings .seg')) {
        const key = seg.dataset.key;
        for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === settings[key]);
    }
    for (const inp of document.querySelectorAll('#settings input[data-key]')) {
        if (inp.type === 'checkbox') inp.checked = !!settings[inp.dataset.key];
        else inp.value = settings[inp.dataset.key];
    }
}

function bindSettings() {
    for (const seg of document.querySelectorAll('#settings .seg')) {
        seg.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            setSetting(seg.dataset.key, b.dataset.v);
            if (seg.dataset.key === 'gore') refreshGore();
            if (seg.dataset.key === 'quality') { configureCaps(); resize(); }
            audio.sfx('click');
            syncSettingsUI();
        });
    }
    for (const inp of document.querySelectorAll('#settings input[data-key]')) {
        inp.addEventListener(inp.type === 'range' ? 'input' : 'change', () => {
            setSetting(inp.dataset.key, inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value));
        });
    }
    $('btn-settings-close').onclick = () => { audio.sfx('click'); closeModal('settings'); };
}

function openSettings() { syncSettingsUI(); openModal('settings'); }

// ─────────────────────────── 상점 ───────────────────────────
function renderShop() {
    $('shop-gold').textContent = `● ${save.gold}`;
    const list = $('shop-list');
    list.innerHTML = '';
    for (const item of SHOP) {
        const lv = upgradeLevel(item.id);
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = '<div class="s-name"></div><div class="s-desc"></div><div class="s-pips"></div>';
        el.querySelector('.s-name').textContent = item.name;
        el.querySelector('.s-desc').textContent = item.desc;
        el.querySelector('.s-pips').textContent = '●'.repeat(lv) + '○'.repeat(item.max - lv);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-small';
        if (lv >= item.max) { b.textContent = '최대'; b.disabled = true; }
        else {
            const cost = item.cost[lv];
            b.textContent = `구매 ● ${cost}`;
            b.disabled = save.gold < cost;
            b.onclick = () => {
                if (buyUpgrade(item.id)) { audio.sfx('levelup'); renderShop(); }
                else audio.sfx('deny');
            };
        }
        el.appendChild(b);
        list.appendChild(el);
    }
}

// ─────────────────────────── 결과 화면 ───────────────────────────
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }

function statsHTML(extra = []) {
    const items = [
        ['레벨', G.level],
        ['처치', G.kills.toLocaleString()],
        ['생존', fmtTime(G.time)],
        ['골드', save.gold],
        ...extra,
    ];
    let html = items.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    const dmg = Object.entries(G.damageBy).sort((a, b) => b[1] - a[1]);
    if (dmg.length) {
        const max = dmg[0][1] || 1;
        html += '<div class="stat dmg-table"><span>무기별 피해</span>' + dmg.map(([id, v]) => {
            const d = WEAPONS[id];
            const w = G.weapons.find(x => x.id === id);
            const name = w && w.evolved ? d.evolve.name : d.name;
            return `<div class="dmg-row"><span>${w && w.evolved ? d.evolve.icon : d.icon}</span><div><div>${name}</div><div class="dmg-bar" style="width:${Math.max(4, (v / max) * 100)}%"></div></div><b style="font-size:10px">${Math.round(v).toLocaleString()}</b></div>`;
        }).join('') + '</div>';
    }
    return html;
}

const LORE = [
    [0, '세상은 푸른 어둠에 잠겼습니다. 하지만 연이의 분홍빛 투지는 아직 지지 않았습니다.'],
    [3, '수많은 청토끼를 물리쳤으나, 역병의 근원은 여전히 날뜁니다. 다시 일어나세요, 마지막 꽃돼지여!'],
    [6, '당신의 분홍빛 희망은 어둠 속에서도 찬란했습니다. 세상은 당신의 총성을 기억할 것입니다.'],
    [9, '전설적인 좀비 킬러. 당신의 투혼은 청토끼들에게 영원한 공포로 각인될 것입니다.'],
];

export function showGameOver() {
    setPlaying(false);
    const stageKills = G.kills - (G.stageKillsStart || 0);
    const earned = Math.round(stageKills * 0.1 * G.player.stats.greed);
    save.gold += earned;
    save.kills += stageKills;
    persist();
    let lore = LORE[0][1];
    for (const [s, t] of LORE) if (G.stage >= s) lore = t;
    $('gameover-lore').textContent = lore;
    $('gameover-stats').innerHTML = statsHTML([['스테이지', G.stage], ['획득 골드', `+${earned}`]]);
    show('gameover');
}

export function showStageClear() {
    setPlaying(false);
    const stageKills = G.kills - (G.stageKillsStart || 0);
    const earned = Math.round((stageKills * 0.2 + 40 * G.stage) * G.player.stats.greed);
    G.gold += earned;
    save.gold += earned;
    save.kills += stageKills;
    save.maxStage = Math.max(save.maxStage, Math.min(STAGE_COUNT, G.stage + 1));
    persist();
    if (G.stage >= STAGE_COUNT) {
        clearRun();
        playEnding();
        return;
    }
    $('clear-title').textContent = `STAGE ${G.stage} CLEAR`;
    $('clear-stats').innerHTML = statsHTML([['획득 골드', `+${earned}`]]);
    show('clear');
}

function playEnding() {
    audio.playEpilogue();
    playStory('새벽의 연꽃 — EPILOGUE', EPILOGUE, () => {
        $('ending-stats').innerHTML = statsHTML();
        show('ending');
    });
}

function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

function showInstall() {
    if (installPrompt) {
        installPrompt.prompt();
        installPrompt.userChoice.finally(() => { installPrompt = null; });
        return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    $('install-body').innerHTML = ios
        ? '<p>🍎 Safari 하단의 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>를 누르세요.</p>'
        : '<ol><li>브라우저 메뉴(⋮)를 엽니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택합니다.</li></ol>';
    openModal('install');
}

// ─────────────────────────── 바인딩 ───────────────────────────
export function initUI() {
    const click = (id, fn) => $(id).addEventListener('click', () => { audio.unlock(); audio.sfx('click'); fn(); });

    click('btn-new', () => {
        clearRun();
        beginStageFlow(1, () => { G.godMode = false; newRun(1); startPlaying(); });
    });
    click('btn-continue', () => {
        const run = loadRun();
        if (!run) return showTitle();
        hide('title');
        G.godMode = false;
        continueRun(run);
        startPlaying();
    });
    click('btn-shop', () => { renderShop(); openModal('shop'); });
    click('btn-shop-close', () => closeModal('shop'));
    click('btn-settings', openSettings);
    click('btn-pause-settings', openSettings);
    click('btn-install', showInstall);
    click('btn-install-close', () => closeModal('install'));
    click('btn-pause', togglePause);
    click('btn-resume', () => closeModal('pause'));
    click('btn-quit', () => { closeModal('pause'); audio.pauseBGM(); showTitle(); audio.playBGM(); });
    click('btn-reroll', () => {
        if (G.rerolls <= 0) return;
        G.rerolls--;
        currentChoices = rollChoices(3);
        renderCards();
        updateReroll();
    });
    click('btn-skip', () => {
        const g = 10 * G.stage;
        G.gold += g;
        save.gold += g;
        closeModal('levelup');
    });
    click('btn-retry', () => { hide('gameover'); retryStage(); startPlaying(); });
    click('btn-gameover-title', showTitle);
    click('btn-next', () => {
        hide('clear');
        const next = G.stage + 1;
        playStory(`EPISODE ${next} — ${STAGES[next].name}`, STORIES[next], () => { startStage(next); startPlaying(); });
    });
    click('btn-ending-title', () => { audio.stopEpilogue(); audio.playBGM(); showTitle(); });

    // 비밀 코드 → 스테이지 선택 + 무적
    const submit = () => {
        if ($('secret-input').value.trim() === SECRET) {
            devUnlocked = true;
            $('secret-error').hidden = true;
            $('dev-panel').hidden = false;
            $('secret-input').value = '';
            audio.sfx('levelup');
        } else {
            $('secret-error').hidden = false;
            audio.sfx('deny');
        }
    };
    $('secret-submit').addEventListener('click', () => { audio.unlock(); submit(); });
    $('secret-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const grid = $('stage-grid');
    for (let s = 1; s <= STAGE_COUNT; s++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-small';
        b.textContent = s;
        b.onclick = () => {
            if (!devUnlocked) return;
            audio.unlock();
            clearRun();
            beginStageFlow(s, () => { newRun(s); G.godMode = $('dev-god').checked; startPlaying(); });
        };
        grid.appendChild(b);
    }

    bindSettings();

    // 레벨업 카드 숫자키 선택
    window.addEventListener('keydown', (e) => {
        if (!$('levelup').hidden) {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= currentChoices.length) pickCard(n - 1);
            if (e.key === 'r' || e.key === 'R') $('btn-reroll').click();
        } else if (!$('chest').hidden && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            $('btn-chest').click();
        }
    });

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installPrompt = e;
        $('btn-install').hidden = isStandalone();
    });

    // 첫 상호작용 시 오디오 잠금 해제 + 타이틀 BGM
    const unlock = () => { audio.unlock(); if (G.mode === 'idle') audio.playBGM(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
}

export function onBossSpawn(b) {
    banner(b.def.name, b.def.title);
}

export function isAnyModalOpen() { return modalStack > 0; }
