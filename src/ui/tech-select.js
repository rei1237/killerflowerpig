// 출격 전 시작 테크 선택 화면. 고른 테크 id 를 onPick 으로 넘긴다.
import { TECHS, RESONANCE_STEPS, DEFAULT_TECH, IMPRINT_LEVELS, MISMATCH_DAMAGE, techStartingWeapons, techBaseLabel } from '../data/techs.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty.js';
import { WEAPONS, PASSIVES } from '../data/weapons.js';
import { mountItemArt } from './item-art.js';
import { audio } from '../core/audio.js';

const LAST_KEY = 'kfp.tech.v1';
const DIFF_KEY = 'kfp.difficulty.v1';
const COOP_KEY = 'kfp.coop.v1';
let difficulty = 'normal';
let coop = false;
function readCoop() { try { return localStorage.getItem(COOP_KEY) === '2'; } catch { return false; } }
function writeCoop(v) { try { localStorage.setItem(COOP_KEY, v ? '2' : '1'); } catch { /* 편의 기능 */ } }
export const COOP_DESC = Object.freeze({
    solo: '연이 혼자 출격합니다. 키보드는 WASD·방향키 모두 연이를 움직이고, 게임패드도 쓸 수 있어요.',
    coop: '영냥이(2P)가 함께 싸웁니다 · 키보드: WASD = 1P 연이, 방향키 = 2P 영냥이 · 게임패드 1개는 2P, 2개면 첫째 1P·둘째 2P. 영냥이는 연이의 레벨에 맞춰 사주 성광·별자리 궤도·초승달 부메랑·타로 낙하·달빛 수호부를 익히고, 쓰러지면 10초 뒤 부활해요. 2P 중에는 동행 펫 영냥이를 쓸 수 없어요. ⚠ 2P 압박: 적 2.2배 출현 · 체력 ×1.5 · 피해 ×1.25 · 엘리트 +1 · 보스 체력 ×1.4 (적 1마리당 경험치는 줄어요).',
});
function renderCoop() {
    const list = $('coop-list');
    if (!list) return;
    list.replaceChildren(...[[false, '🐷 1P 혼자'], [true, '🐷🐈 2P 협동 · 영냥이']].map(([value, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'diff-option coop-option';
        b.dataset.coop = value ? '2' : '1';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(value === coop));
        b.textContent = label;
        b.onclick = () => { if (value !== coop) audio.sfx('click'); coop = value; renderCoop(); };
        return b;
    }));
    $('coop-desc').textContent = coop ? COOP_DESC.coop : COOP_DESC.solo;
}
function readDiff() { try { const d = localStorage.getItem(DIFF_KEY); return DIFFICULTIES[d] ? d : 'normal'; } catch { return 'normal'; } }
function writeDiff(d) { try { localStorage.setItem(DIFF_KEY, d); } catch { /* 편의 기능 */ } }

function renderDifficulty() {
    const list = $('diff-list');
    list.replaceChildren(...DIFFICULTY_ORDER.map((id) => {
        const d = DIFFICULTIES[id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'diff-option';
        b.dataset.diff = id;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(id === difficulty));
        b.textContent = `${d.icon} ${d.name}`;
        b.onclick = () => { if (id !== difficulty) audio.sfx('click'); difficulty = id; renderDifficulty(); };
        return b;
    }));
    $('diff-desc').textContent = DIFFICULTIES[difficulty].desc;
}
const $ = id => document.getElementById(id);
let modal = null;
let selected = DEFAULT_TECH;
let onPick = null;

function readLast() {
    try { const id = localStorage.getItem(LAST_KEY); return TECHS[id] ? id : DEFAULT_TECH; } catch { return DEFAULT_TECH; }
}
function writeLast(id) { try { localStorage.setItem(LAST_KEY, id); } catch { /* 선택 기억은 편의 기능 */ } }

const itemName = id => WEAPONS[id]?.name || PASSIVES[id]?.name || id;

function art(id, cls) {
    const box = document.createElement('span');
    box.className = cls;
    mountItemArt(box, id, undefined, itemName(id));
    return box;
}

function renderList() {
    const list = $('tech-list');
    list.replaceChildren(...Object.entries(TECHS).map(([id, t], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tech-option';
        b.dataset.tech = id;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(id === selected));
        const arts = document.createElement('span');
        arts.className = 'tech-arts';
        arts.append(...techStartingWeapons(t).map(id => art(id, 'tech-art')), art(t.start.passive, 'tech-art small'));
        const text = document.createElement('span');
        text.className = 'tech-text';
        const name = document.createElement('strong');
        name.textContent = `${t.icon} ${t.name}`;
        const sum = document.createElement('small');
        sum.textContent = t.summary;
        text.append(name, sum);
        const key = document.createElement('span');
        key.className = 'tech-key';
        key.setAttribute('aria-hidden', 'true');
        key.textContent = String(i + 1);
        b.append(arts, text, key);
        b.onclick = () => select(id);
        b.ondblclick = () => { select(id); confirm(); };
        return b;
    }));
}

function renderDetail() {
    const t = TECHS[selected];
    const box = $('tech-detail');
    box.dataset.tech = selected;
    const head = document.createElement('div');
    head.className = 'tech-detail-head';
    const combo = document.createElement('p');
    combo.className = 'tech-combo';
    const startingWeapons = techStartingWeapons(t);
    const startingItems = [...startingWeapons, t.start.passive];
    const startingResonance = startingWeapons.filter(id => t.family.weapons.includes(id)).length + Number(t.family.passives.includes(t.start.passive));
    combo.textContent = `시작 조합 · ${startingItems.map(id => `${itemName(id)} Lv1`).join(' + ')} (무기 ${startingWeapons.length}/6칸 · 공명 ${startingResonance}/6 · I단계 즉시 활성)`;
    const role = document.createElement('p');
    role.className = 'tech-combo';
    role.textContent = `강점 · ${t.strength} / 약점 · ${t.weakness}`;
    const base = document.createElement('p');
    base.className = 'tech-combo';
    base.textContent = `초기 능력치 · ${techBaseLabel(t)}`;
    head.append(combo, role, base);

    const tiers = document.createElement('ol');
    tiers.className = 'tech-tiers';
    t.tiers.forEach((tier, i) => {
        const li = document.createElement('li');
        const step = document.createElement('b');
        step.textContent = `공명 ${RESONANCE_STEPS[i]}`;
        const label = document.createElement('span');
        label.textContent = tier.label;
        li.append(step, label);
        tiers.append(li);
    });

    const imprints = document.createElement('ol');
    imprints.className = 'tech-tiers tech-imprints';
    for (const lv of IMPRINT_LEVELS) {
        const im = t.imprints?.[lv];
        if (!im) continue;
        const li = document.createElement('li');
        const step = document.createElement('b');
        step.textContent = `무기 Lv${lv}`;
        const label = document.createElement('span');
        label.textContent = im.label;
        li.append(step, label);
        imprints.append(li);
    }
    const rule = document.createElement('li');
    const rb = document.createElement('b');
    rb.textContent = '부조화';
    const rl = document.createElement('span');
    rl.textContent = `테크와 맞지 않는 무기 피해 -${Math.round((1 - MISMATCH_DAMAGE) * 100)}% (꽃잎포 계열 광선은 -5%)`;
    rule.append(rb, rl);
    imprints.append(rule);

    const fam = document.createElement('div');
    fam.className = 'tech-family';
    const famTitle = document.createElement('p');
    famTitle.className = 'tech-sub';
    famTitle.textContent = '공명 계열 장비';
    const famItems = document.createElement('div');
    famItems.className = 'tech-family-items';
    for (const id of [...t.family.weapons, ...t.family.passives]) {
        const chip = document.createElement('span');
        chip.className = 'tech-chip';
        chip.append(art(id, 'tech-art tiny'));
        const n = document.createElement('span');
        n.textContent = itemName(id);
        chip.append(n);
        famItems.append(chip);
    }
    fam.append(famTitle, famItems);

    const route = document.createElement('div');
    route.className = 'tech-route';
    const routeTitle = document.createElement('p');
    routeTitle.className = 'tech-sub';
    routeTitle.textContent = '추천 진화 루트';
    const ul = document.createElement('ul');
    for (const r of t.route) { const li = document.createElement('li'); li.textContent = r; ul.append(li); }
    route.append(routeTitle, ul);

    box.replaceChildren(head, tiers, imprints, fam, route);
}

function select(id) {
    if (!TECHS[id]) return;
    if (id !== selected) audio.sfx('click');
    selected = id;
    for (const b of $('tech-list').querySelectorAll('.tech-option')) b.setAttribute('aria-checked', String(b.dataset.tech === id));
    renderDetail();
}

function confirm() {
    if (!onPick) return;
    const pick = onPick;
    onPick = null;
    writeLast(selected);
    writeDiff(difficulty);
    writeCoop(coop);
    modal.close();
    pick(selected, difficulty, coop);
}

export function initTechSelect(api) {
    modal = api;
    $('btn-tech-go').addEventListener('click', () => { audio.sfx('click'); confirm(); });
    $('btn-tech-back').addEventListener('click', () => { audio.sfx('click'); onPick = null; modal.close(); });
    window.addEventListener('keydown', (e) => {
        if ($('tech-select').hidden) return;
        const ids = Object.keys(TECHS);
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= ids.length) { select(ids[n - 1]); e.preventDefault(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select(ids[(ids.indexOf(selected) + 1) % ids.length]); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select(ids[(ids.indexOf(selected) + ids.length - 1) % ids.length]); e.preventDefault(); }
        else if (e.key === 'Enter' && !e.target?.closest?.('button')) { confirm(); e.preventDefault(); }
    });
}

export function openTechSelect(pick) {
    onPick = pick;
    selected = readLast();
    difficulty = readDiff();
    coop = readCoop();
    renderDifficulty();
    renderCoop();
    renderList();
    renderDetail();
    modal.open();
    $('tech-list').querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
}
