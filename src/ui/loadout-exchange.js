import { G } from '../game/state.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES, WEAPON_MAX_LEVEL } from '../data/weapons.js';
import { listExchangeTargets, previewExchange, exchangeItem } from '../game/loadout-exchange.js';
import { mountItemArt } from './item-art.js';
let root, content, status, hooks = {}, opened = false, returnFocus, isolated = [];
let kind = 'weapon', sourceId = null, targetId = null, preview = null, busy = false;
const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
const button = (cls, text, action) => { const n = el('button', cls, text); n.type = 'button'; n.addEventListener('click', action); return n; };
const failures = { CHOICE_ACTIVE: '레벨업 선택을 먼저 완료해 주세요. 다시 뽑기 횟수는 그대로 유지됩니다.', SLOTS_NOT_FULL: '빈 슬롯이 있어요. 레벨업에서 새 아이템을 획득할 수 있습니다.', STALE_PREVIEW: '장비 상태가 바뀌었습니다. 교체할 아이템을 다시 선택해 주세요.', NOT_PLAYING: '살아 있는 전투 중에만 교체할 수 있습니다.' };

export function appendEvolutionInfo(container, id) {
    const def = WEAPONS[id];
    if (!def) return false;
    const w = G.weapons.find(item => item.id === id), box = el('div', 'loadout-evolution-info');
    if (!def.evolve) { box.append(el('p', '', '조합 전용 무기 · Lv.8까지 강화 · 별도 진화 없음')); container.append(box); return true; }
    const evo = def.evolve, passive = PASSIVES[evo.with], level = G.passives[evo.with] || 0;
    box.append(el('p', 'loadout-evolution-requirement', `진화 조건: 무기 Lv.${WEAPON_MAX_LEVEL} (현재 ${w?.level || 0}) + ${passive.name} Lv.1 이상 (현재 ${level})`));
    const ready = w && w.level >= WEAPON_MAX_LEVEL && level > 0;
    box.append(el('p', 'loadout-evolution-state', w?.evolved ? `진화 완료: ${evo.name}` : ready ? `준비 완료 · 다음 상자에서 ${evo.name} 진화 우선` : `조건 달성 후 상자에서 ${evo.name} 진화`), el('p', 'loadout-evolution-effect', evo.desc));
    container.append(box); return true;
}

function artButton(item, selected, action, prefix) {
    const b = button('loadout-item', '', action), art = el('span', 'loadout-item-art');
    b.dataset.item = item.id; b.dataset.role = prefix; b.setAttribute('aria-pressed', String(selected));
    b.setAttribute('aria-label', `${prefix === 'source' ? '내보낼' : '받을'} 아이템 ${item.name}, Lv.${item.level}`);
    mountItemArt(art, item.id, kind, '');
    b.append(art, el('span', 'loadout-item-name', item.name), el('span', 'loadout-item-level', `Lv.${item.level}${item.evolved ? ' · 진화' : ''}`));
    return b;
}
function render() {
    content.replaceChildren();
    const evolution = el('section', 'loadout-evolutions'); evolution.append(el('h3', '', '내 무기 진화 안내'));
    for (const w of G.weapons) {
        const row = el('article', 'loadout-evolution-row'), art = el('div', 'loadout-item-art');
        mountItemArt(art, w.id, 'weapon', ''); row.append(art, el('h4', '', `${WEAPONS[w.id].name} · Lv.${w.level}`)); appendEvolutionInfo(row, w.id); evolution.append(row);
    }
    content.append(evolution);
    const exchange = el('section', 'loadout-exchange-controls'); exchange.append(el('h3', '', '가득 찬 슬롯 교체'), el('p', '', '무기 6칸 · 보조 아이템 6칸. 선택한 기존 아이템을 내보내고 미보유 일반 아이템을 Lv.1로 받습니다.'));
    const tabs = el('div', 'loadout-kind-buttons');
    for (const [value, label] of [['weapon', '무기 교체'], ['passive', '보조 아이템 교체']]) {
        const b = button('loadout-kind', label, () => { kind = value; sourceId = targetId = preview = null; render(); content.querySelector(`.loadout-kind-${value}`).focus(); });
        b.className += ` loadout-kind-${value}`; b.setAttribute('aria-pressed',String(kind === value)); tabs.append(b);
    }
    exchange.append(tabs);
    const defs = kind === 'weapon' ? WEAPONS : PASSIVES;
    const owned = kind === 'weapon' ? G.weapons.map(w => ({...w, name:w.evolved ? defs[w.id].evolve?.name || defs[w.id].name : defs[w.id].name})) : Object.entries(G.passives).map(([id, level]) => ({id, level, name:defs[id].name}));
    const capacity = kind === 'weapon' ? MAX_WEAPONS : MAX_PASSIVES;
    const blocked = G.choiceSession && !G.choiceSession.closed ? failures.CHOICE_ACTIVE : owned.length !== capacity ? failures.SLOTS_NOT_FULL : null;
    if (blocked) exchange.append(el('p','loadout-exchange-notice',blocked));
    else {
        exchange.append(el('h4','','1. 내보낼 아이템 선택'));
        const sources = el('div','loadout-item-grid');
        for (const item of owned) sources.append(artButton(item,sourceId === item.id,()=>{sourceId=item.id;targetId=preview=null;render();content.querySelector('.loadout-target-heading').focus();},'source'));
        exchange.append(sources);
        const targetHeading = el('h4','loadout-target-heading','2. Lv.1로 받을 아이템 선택'); targetHeading.tabIndex=-1; exchange.append(targetHeading);
        const targets = el('div','loadout-item-grid');
        for (const item of listExchangeTargets(kind)) {
            const b=artButton(item,targetId===item.id,()=>{targetId=item.id;preview=previewExchange(kind,sourceId,targetId);render();content.querySelector('.loadout-exchange-confirm')?.focus();},'target');
            b.disabled=!sourceId; targets.append(b);
        }
        if (!targets.children.length) targets.append(el('p','','교체 가능한 미보유 아이템이 없습니다.')); exchange.append(targets);
        if (preview?.ok) {
            const loss=el('div','loadout-exchange-loss');
            loss.append(el('h4','','교체 전 확인'),el('p','',`${preview.removed.name} Lv.${preview.removed.level}${preview.removed.evolved ? ' (진화 완료)' : ''}을 내보냅니다. 기존 강화 레벨과 진화는 사라지고, ${preview.replacement.name} Lv.1을 받습니다.`),el('p','','다른 아이템은 유지됩니다. 이 교체는 되돌릴 수 없습니다.'));
            const shownPreview=preview;
            const confirm=button('loadout-exchange-confirm','기존 강화 포기하고 Lv.1로 교체',()=>{
                if(!opened || busy || !preview?.ok || preview!==shownPreview) return; busy=true; confirm.disabled=true;
                const result=exchangeItem(kind,sourceId,targetId,preview.signature);
                sourceId=targetId=preview=null; busy=false;
                status.textContent=result.ok ? `${result.replacement.name} Lv.1로 교체했습니다.` : failures[result.code] || '교체할 수 없습니다. 장비를 다시 확인해 주세요.';
                render(); status.focus();
            });
            loss.append(confirm,button('loadout-exchange-cancel','교체 취소',()=>{sourceId=targetId=preview=null;render();root.querySelector('.loadout-exchange-close').focus();})); exchange.append(loss);
        } else if (preview) exchange.append(el('p','loadout-exchange-notice',failures[preview.code] || '선택한 아이템을 교체할 수 없습니다. 다시 선택해 주세요.'));
    }
    content.append(exchange);
}
export function initLoadoutExchange(options = {}) {
    hooks=options; if(root) return;
    root=el('section','loadout-exchange');root.id='loadout-exchange';root.hidden=true;
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','loadout-exchange-heading');
    const panel=el('div','loadout-exchange-panel'), heading=el('h2','','장비 교체와 진화');heading.id='loadout-exchange-heading';
    status=el('p','loadout-exchange-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
    content=el('div','loadout-exchange-content');panel.append(heading,button('loadout-exchange-close','닫기',closeLoadoutExchange),status,content);root.append(panel);document.body.append(root);
    window.addEventListener('keydown',e=>{
        if(!opened)return;e.stopImmediatePropagation();
        if(e.code==='Escape'){e.preventDefault();closeLoadoutExchange();}
        if(e.code==='Tab'){
            const buttons=Array.from(root.querySelectorAll('button')).filter(n=>!n.disabled&&!n.hidden);
            const index=buttons.indexOf(document.activeElement), next=(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length;
            e.preventDefault();buttons[next]?.focus();
        }
    },true);
}
export function openLoadoutExchange() {
    if(opened || !['play','boss'].includes(G.mode) || !G.player || G.player.dead)return false;
    if(!root)initLoadoutExchange(hooks);
    kind='weapon';sourceId=targetId=preview=null;busy=false;status.textContent='';render();
    returnFocus=document.activeElement;isolated=Array.from(document.body.children).filter(n=>n!==root).map(n=>[n,n.inert]);isolated.forEach(([n])=>{n.inert=true;});
    opened=true;root.hidden=false;hooks.onOpen?.();root.querySelector('.loadout-exchange-close').focus();return true;
}
export function closeLoadoutExchange() {
    if(!opened)return false;opened=false;root.hidden=true;sourceId=targetId=preview=null;
    isolated.forEach(([n,inert])=>{n.inert=inert;});isolated=[];
    hooks.onClose?.();if(returnFocus?.isConnected)returnFocus.focus();return true;
}
