// 2P 영냥이 UI: 전투 HUD 카드(체력·경험치·기술 칩·조합 알림)와 성장/조합 창.
// 레벨업 창은 1P 레벨업과 같은 모달 스택을 쓰며, 2P 방향키·숫자키·게임패드·터치로 고를 수 있다.
import { G } from '../game/state.js';
import { audio } from '../core/audio.js';
import { assignPads } from '../core/input.js';
import { rollPartnerChoices, applyPartnerChoice, readyCombos, comboRecipe, skillLevel, skillEvolved, charmLevel, isComplement } from '../game/coop.js';
import { PARTNER_SKILL_KIT, PARTNER_SKILL_ORDER, PARTNER_CHARMS, PARTNER_CHARM_ORDER, PARTNER_SKILL_MAX, PARTNER_COMPLEMENT_BONUS, complementFor } from '../data/partner-kit.js';

const $ = id => document.getElementById(id);
let api = null, mode = null, choices = [], lastKey = '', padState = null, padTimer = 0;

export function initPartnerUI(modal) {
    api = modal;
    $('btn-partner')?.addEventListener('click', () => { audio.sfx('click'); openPartnerPanel('combo'); });
    $('btn-partner-combo')?.addEventListener('click', () => { audio.sfx('click'); openPartnerPanel('combo'); });
    $('btn-partner-close')?.addEventListener('click', () => { audio.sfx('click'); closePanel(); });
    window.addEventListener('keydown', onKey, true);
}

const pips = (lv, max) => '●'.repeat(lv) + '○'.repeat(Math.max(0, max - lv));

// ── HUD ────────────────────────────────────────────
export function drawPartnerHUD() {
    const card = $('hud-partner');
    if (!card) return;
    const q = G.coop ? G.partner : null;
    card.hidden = !q;
    $('battle-hud')?.classList?.toggle('is-coop', !!q);
    if (!q) return;
    card.classList?.toggle('is-down', q.dead);
    $('hud-partner-level').textContent = `Lv.${q.level}`;
    $('hud-partner-hp').style.width = `${Math.max(0, Math.min(1, q.hp / q.maxHp)) * 100}%`;
    $('hud-partner-hp-text').textContent = q.dead ? `부활 ${Math.ceil(q.downT)}초` : `${Math.ceil(q.hp)} / ${q.maxHp}`;
    $('hud-partner-xp').style.width = `${Math.min(1, q.xp / q.xpNext) * 100}%`;
    const ready = readyCombos(q);
    const combo = $('btn-partner-combo');
    combo.hidden = !ready.length;
    if (ready.length) combo.textContent = `✿ 조합 가능 ${ready.length > 1 ? `×${ready.length}` : ''}`.trim();
    const key = JSON.stringify([q.skills, q.charms, q.evolved, G.tech]);
    if (key === lastKey) return;
    lastKey = key;
    const chips = [];
    for (const id of PARTNER_SKILL_ORDER) {
        const lv = skillLevel(id, q);
        if (!lv) continue;
        const k = PARTNER_SKILL_KIT[id], evo = skillEvolved(id, q);
        chips.push(chip(evo ? k.evo.icon : k.icon, evo ? '★' : lv, `${evo ? k.evo.name : k.name} Lv${lv}`, ['pk-chip', evo && 'is-evolved', isComplement(id) && 'is-complement']));
    }
    for (const id of PARTNER_CHARM_ORDER) {
        const lv = charmLevel(id, q);
        if (lv) chips.push(chip(PARTNER_CHARMS[id].icon, lv, `${PARTNER_CHARMS[id].name} Lv${lv}`, ['pk-chip', 'is-charm']));
    }
    $('hud-partner-kit').replaceChildren(...chips);
}
function chip(icon, level, label, classes) {
    const el = document.createElement('span');
    el.className = classes.filter(Boolean).join(' ');
    el.textContent = icon; el.title = label; el.setAttribute('aria-label', label);
    const s = document.createElement('small'); s.textContent = level; el.append(s);
    return el;
}

// ── 성장·조합 창 ────────────────────────────────────
export function presentPartnerLevelUp() {
    if (!G.coop || !G.partner) return false;
    return openPartnerPanel('levelup');
}

export function openPartnerPanel(next) {
    const q = G.partner;
    if (!api || !q) return false;
    // 레벨업 선택 중에는 조합표로 바꾸지 않는다 (선택을 건너뛰지 못하게)
    if (next === 'combo' && mode === 'levelup' && !$('partner-levelup').hidden) return false;
    mode = next;
    choices = next === 'levelup' ? rollPartnerChoices(3) : readyCombos(q).map(id => ({ kind: 'combo', id, ...comboCard(id) }));
    render();
    api.open('partner-levelup');
    if (next === 'levelup') audio.sfx('levelup');
    $('partner-cards').querySelector('button')?.focus({ preventScroll: true });
    startPad();
    return true;
}
function comboCard(id) {
    const r = comboRecipe(id);
    return { icon: r.result.icon, name: r.result.name, levelText: '조합 · 진화', desc: r.result.desc,
        recipe: `${r.skill.icon} ${r.skill.name} Lv${PARTNER_SKILL_MAX} + ${r.charm.icon} ${r.charm.name} → ${r.result.icon} ${r.result.name}` };
}

function render() {
    const q = G.partner;
    const levelup = mode === 'levelup';
    $('partner-title').firstChild.textContent = levelup ? '영냥이 성장 ' : '영냥이 조합표 ';
    $('partner-lv').textContent = `Lv.${q.level}`;
    const comp = complementFor(G.tech);
    $('partner-complement').textContent = comp ? `🤝 연이와 상호 보완 · ${comp.why} · 보완 기술 피해 +${Math.round(PARTNER_COMPLEMENT_BONUS * 100)}%` : '';
    $('partner-kit-board').replaceChildren(...PARTNER_SKILL_ORDER.map(id => boardRow(id, q)));
    $('partner-caption').textContent = levelup
        ? '하나를 골라 영냥이를 키우세요. 기술 Lv5 + 짝 부적을 모으면 진화 기술로 조합할 수 있어요. 전투는 잠시 멈춥니다.'
        : choices.length ? '조합할 수 있는 기술이에요. 고르면 바로 진화합니다.' : '아직 조합할 수 있는 기술이 없어요. 위 조합표에서 필요한 재료를 확인하세요.';
    $('btn-partner-close').hidden = levelup;
    const wrap = $('partner-cards');
    wrap.replaceChildren(...choices.map((c, i) => card(c, i)));
}

function boardRow(id, q) {
    const k = PARTNER_SKILL_KIT[id], lv = skillLevel(id, q), charm = PARTNER_CHARMS[k.pair], cl = charmLevel(k.pair, q), evo = skillEvolved(id, q);
    const ready = lv >= PARTNER_SKILL_MAX && cl > 0 && !evo;
    const row = document.createElement('div');
    row.className = ['pb-row', ready && 'is-ready', evo && 'is-evolved', isComplement(id) && 'is-complement'].filter(Boolean).join(' ');
    const ico = (text, on, title) => { const s = document.createElement('span'); s.className = 'pb-ico' + (on ? ' on' : ''); s.textContent = text; s.title = title; return s; };
    const plus = text => { const s = document.createElement('span'); s.className = 'pb-plus'; s.textContent = text; return s; };
    const out = document.createElement('span');
    out.className = 'pb-out';
    const b = document.createElement('b'); b.textContent = evo ? `${k.evo.icon} ${k.evo.name}` : ready ? `✿ ${k.evo.name} 조합 가능` : k.evo.name;
    const p = document.createElement('span'); p.className = 'pips';
    p.textContent = `${k.name} ${lv ? pips(lv, PARTNER_SKILL_MAX) : '미습득'} · ${charm.name} ${cl ? `Lv${cl}` : '없음'}${isComplement(id) ? ' · 🤝 보완' : ''}`;
    out.append(b, p);
    row.append(ico(k.icon, lv > 0, k.name), plus('+'), ico(charm.icon, cl > 0, charm.name), out);
    row.setAttribute('aria-label', `${k.name} Lv${lv} + ${charm.name} → ${k.evo.name}${ready ? ' 조합 가능' : ''}`);
    return row;
}

function card(c, i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = ['pc-card', c.kind === 'combo' && 'is-combo', c.complement && 'is-complement'].filter(Boolean).join(' ');
    const top = document.createElement('div'); top.className = 'pc-top';
    const icon = document.createElement('span'); icon.className = 'pc-icon'; icon.textContent = c.icon;
    const names = document.createElement('div');
    const name = document.createElement('div'); name.className = 'pc-name'; name.textContent = c.name;
    const lv = document.createElement('div'); lv.className = 'pc-lv'; lv.textContent = c.levelText;
    names.append(name, lv);
    const key = document.createElement('span'); key.className = 'pc-key'; key.textContent = String(i + 1); key.setAttribute('aria-hidden', 'true');
    top.append(icon, names, key);
    b.append(top);
    const add = (cls, text) => { if (!text) return; const d = document.createElement('div'); d.className = cls; d.textContent = text; b.append(d); };
    add('pc-desc', c.desc);
    add('pc-hint', c.recipe || c.hint);
    add('pc-comp', c.complement);
    if (c.isNew) add('pc-new', 'NEW');
    b.setAttribute('aria-label', [c.name, c.levelText, c.desc, c.recipe || c.hint, c.complement].filter(Boolean).join(', '));
    b.onclick = () => pick(i);
    return b;
}

function pick(i) {
    const c = choices[i];
    if (!c || !G.partner) return;
    if (!applyPartnerChoice(c)) return;
    audio.sfx('click');
    lastKey = '';
    if (mode === 'combo' && readyCombos(G.partner).length) { openPartnerPanel('combo'); return; }
    closePanel();
}
function closePanel() {
    stopPad();
    mode = null;
    api?.close('partner-levelup');
}
export const partnerPanelMode = () => ($('partner-levelup')?.hidden ? null : mode);

// 2P 방향키·숫자키: 카드 사이를 옮기고 고른다 (창이 열려 있을 때만)
function onKey(e) {
    if (!mode || $('partner-levelup')?.hidden) return;
    const buttons = [...$('partner-cards').querySelectorAll('button')];
    const at = buttons.indexOf(document.activeElement);
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= buttons.length) { pick(n - 1); e.preventDefault(); e.stopPropagation(); return; }
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step && buttons.length) {
        buttons[(Math.max(0, at) + step + buttons.length) % buttons.length].focus({ preventScroll: true });
        e.preventDefault(); e.stopPropagation();
    }
}
// 2P 게임패드: 십자키·스틱으로 이동, A(0)로 선택, B(1)로 닫기(조합표)
function startPad() {
    stopPad();
    if (typeof navigator === 'undefined' || !navigator.getGamepads || typeof requestAnimationFrame === 'undefined') return;
    padState = { move: 0, a: true, b: true };
    const loop = () => {
        if (!mode) return;
        const pad = assignPads(Array.from(navigator.getGamepads()), true)[1];
        if (pad) {
            const x = (pad.axes?.[0] || 0) + (pad.buttons?.[15]?.pressed ? 1 : 0) - (pad.buttons?.[14]?.pressed ? 1 : 0)
                + (pad.buttons?.[13]?.pressed ? 1 : 0) - (pad.buttons?.[12]?.pressed ? 1 : 0);
            const dir = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;
            if (dir && dir !== padState.move) onKey({ key: dir > 0 ? 'ArrowRight' : 'ArrowLeft', preventDefault() {}, stopPropagation() {} });
            padState.move = dir;
            const a = !!pad.buttons?.[0]?.pressed, b = !!pad.buttons?.[1]?.pressed;
            if (a && !padState.a) document.activeElement?.closest?.('#partner-cards button')?.click();
            if (b && !padState.b && mode === 'combo') closePanel();
            padState.a = a; padState.b = b;
        }
        padTimer = requestAnimationFrame(loop);
    };
    padTimer = requestAnimationFrame(loop);
}
function stopPad() { if (padTimer && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(padTimer); padTimer = 0; padState = null; }
