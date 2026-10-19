// DOM UI: 타이틀/스토리/레벨업/상자/일시정지/설정/상점/결과 화면
import { G } from '../game/state.js';
import { STAGES, STAGE_COUNT } from '../data/stages.js';
import { STORIES, EPILOGUE } from '../data/story.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES } from '../data/weapons.js';
import { bossRewardTier } from '../data/boss-rewards.js';
import { BOSSES } from '../data/bosses.js';
import { rollChoices, applyChoice, rollChest, rollBossChest, beginChoiceSession, consumeChoiceReroll, finishChoiceSession } from '../game/progression.js';
import { createStoryPacer } from './story-pacing.js';
import { choiceInfo, relatedFusionInfo, passiveEffectNote } from './item-choice-info.js';
import { FUSION_RECIPES, previewFusion, fuseItems } from '../game/fusion.js';
import { newRun, continueRun, retryStage, startStage, beginStageClear, loadRun, clearRun } from '../game/game.js';
import { refreshGore } from '../game/effects.js';
import { configureCaps } from '../game/state.js';
import { resize } from '../game/render.js';
import { settings, setSetting } from '../core/settings.js';
import { save, persist, SHOP, upgradeLevel, buyUpgrade, equipPet, lastSaveError, queueCoins, retryPendingCoins, pendingCoinTotal, openChest, buyRelic, buyAccessory, setAccessory } from '../core/save.js';
import { audio } from '../core/audio.js';
import { input, resetJoy, resetInput } from '../core/input.js';

import { shopAccess, highestClearedStage } from '../core/shop-access.js';
import { PET_REDEMPTION } from '../core/pet-redemption.js';
import { ACCESSORIES } from '../data/accessories.js';
import { activeAccessory } from '../core/accessories.js';
import { RELICS, RELIC_CHEST, strongestRelic, chestRates } from '../data/relics.js';
import { mountItemArt, itemArt } from './item-art.js';
import { initLoadoutExchange, openLoadoutExchange, closeLoadoutExchange, appendEvolutionInfo } from './loadout-exchange.js';
import { initFusionReveal, openFusionReveal, closeFusionReveal } from './fusion-reveal.js';
import { initPractice, openPractice, closePractice, cancelPractice, shouldOfferPractice } from './practice.js';
import { initTutorial, openTutorial, closeTutorial, shouldOfferTutorial } from './tutorial.js';

let rewardSequence = 0;
const rewardSession = Date.now().toString(36) + Math.random().toString(36).slice(2);
function creditReward(amount) {
    if (amount > 0 && !queueCoins(amount, `${rewardSession}:${++rewardSequence}`)) notifyPending();
}
function notifyPending() {
    if (pendingCoinTotal()) toast(`저장 대기 코인 ${pendingCoinTotal()} · 새로고침하면 사라질 수 있습니다`, 6000);
    else if (lastSaveError) toast('저장하지 못했습니다. 저장 공간을 확인하고 다시 시도하세요.', 5000);
}

const $ = (id) => document.getElementById(id);
const SECRET = '910902';

let installPrompt = null;
let devUnlocked = false;
const modalStack = [];
const modalFocus = new Map();
const pendingRewardScreens = [];
let modalBasePaused = false;
let chestTimer = null;
let activeChest = null;

function show(id) { $(id).hidden = false; }
function hide(id) { $(id).hidden = true; }

function setPlaying(on) {
    $('btn-pause').hidden = !on;
    $('battle-hud').hidden = !on;
    input.enabled = on;
    if (!on) resetJoy();
}

export function topModalId() { return modalStack.at(-1) || null; }

function syncModalState() {
    const top = topModalId();
    for (let i = 0; i < modalStack.length; i++) {
        const node = $(modalStack[i]);
        node.inert = modalStack[i] !== top;
        node.style.zIndex = String(100 + i);
    }
    G.paused = top ? true : modalBasePaused;
    input.enabled = !G.paused && (G.mode === 'play' || G.mode === 'boss' || G.mode === 'clearing');
}

export function openModal(id) {
    if (modalStack.includes(id)) return false;
    if (!modalStack.length) modalBasePaused = G.paused;
    modalFocus.set(id, document.activeElement);
    modalStack.push(id);
    G.paused = true;
    resetJoy();
    show(id);
    syncModalState();
    const first = $(id).querySelector('button, .card');
    first?.focus({ preventScroll: true });
    return true;
}

export function closeModal(id) {
    // An underlying or already-closed dialog must never change pause ownership.
    if (topModalId() !== id) return false;
    if (!retryPendingCoins()) notifyPending();
    hide(id);
    $(id).inert = false;
    $(id).style.zIndex = '';
    modalStack.pop();
    const previousFocus = modalFocus.get(id);
    modalFocus.delete(id);
    if (id === 'chest') { clearTimeout(chestTimer); activeChest = null; }
    syncModalState();
    if (topModalId()) $(topModalId()).querySelector('button, .card')?.focus({ preventScroll: true });
    else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    drainRewardScreens();
    return true;
}

function drainRewardScreens() {
    if (modalStack.length || !pendingRewardScreens.length || G.mode === 'idle' || G.mode === 'dead') return;
    const next = pendingRewardScreens.shift();
    if (next.type === 'chest') presentChest(next.kind);
    else presentLevelUp(next.choiceSessionId);
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
    b.classList.remove('boss-intro');
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
    cancelStory();
    cancelPractice();
    closeLoadoutExchange();
    closeFusionReveal();
    if (!retryPendingCoins()) notifyPending();
    G.mode = 'idle';
    G.paused = false;
    setPlaying(false);
    for (const id of ['story', 'gameover', 'clear', 'ending', 'levelup', 'chest', 'pause']) hide(id);
    clearTimeout(chestTimer);
    activeChest = null;
    pendingRewardScreens.length = 0;
    queuedChoiceIds.clear();
    for (const id of modalStack) {
        hide(id);
        $(id).inert = false;
        $(id).style.zIndex = '';
    }
    modalStack.length = 0;
    modalFocus.clear();
    modalBasePaused = false;
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
        if (!persist()) notifyPending();
        start();
    }, stage);
}

// ─────────────────────────── 스토리 (타자기) ───────────────────────────
let storyTimer = null;
let storyPacer = null;
function cancelStory(){clearInterval(storyTimer);storyTimer=null;storyPacer?.cancel();storyPacer=null;}
export function playStory(head, text, onDone, stage = STAGE_COUNT) {
    cancelStory();
    const art = $('story-art');
    art.src = `asset/story/stage-${String(stage).padStart(2, '0')}.webp`;
    $('story-visual-backdrop').style.backgroundImage = `url("${art.src}")`;
    // The complete chapter illustration is contained by CSS, without focal-point cropping.
    art.style.objectPosition = 'center';
    art.alt = STAGES[stage]?.subtitle || '작전 기록';
    $('story-location').textContent = `SECTOR ${String(stage).padStart(2, '0')} / ${STAGES[stage]?.subtitle || '새벽'}`;
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
    const pacer=storyPacer=createStoryPacer(text,performance.now());
    const present=()=>{
        const state=pacer.snapshot();node.data=state.text;
        $('story-next').textContent=state.done?'읽기 완료 · 시작 ▶':'문장 전체 보기';
        cursor.hidden=state.done;
        if(state.done){clearInterval(storyTimer);storyTimer=null;}
    };
    present();
    storyTimer=setInterval(()=>{
        if(storyPacer!==pacer)return;
        pacer.tick(performance.now());present();
        box.scrollTop=box.scrollHeight;
    },32);
    let ended=false;
    const end=()=>{
        if(ended||storyPacer!==pacer)return;
        ended=true;cancelStory();hide('story');
        $('story-next').onclick=$('story-skip').onclick=box.onclick=null;
        onDone();
    };
    const next=()=>{const action=pacer.tap(performance.now());if(action==='reveal')present();else if(action==='advance')end();};
    $('story-next').onclick=next;box.onclick=next;
    $('story-skip').onclick=()=>{if(pacer.skip()==='advance')end();};
}

function startPlaying() {
    setPlaying(true);
    G.paused = false;
    const st = STAGES[G.stage];
    banner(`STAGE ${G.stage}`, `${st.name} — ${st.subtitle}`);
    if(G.choiceSession && !G.choiceSession.closed)presentLevelUp(G.choiceSession.id);
}

// ─────────────────────────── 레벨업 ───────────────────────────
let currentChoices = [];
let choiceRenderRevision=0, displayedChoiceSession=null, lastRerollAt=-Infinity;
const queuedChoiceIds=new Set();
export function showLevelUp(event={}) {
    const id=event?.choiceSessionId;
    if(!id && (modalStack.includes('levelup') || pendingRewardScreens.some(r=>r.type==='levelup')))return;
    if(id && (queuedChoiceIds.has(id) || G.choiceSession?.id===id))return;
    if(id)queuedChoiceIds.add(id);
    pendingRewardScreens.push({ type: 'levelup', choiceSessionId:id });
    drainRewardScreens();
}

function presentLevelUp(id) {
    displayedChoiceSession=beginChoiceSession(id);
    if(!displayedChoiceSession || displayedChoiceSession.closed){drainRewardScreens();return;}
    lastRerollAt=-Infinity;
    currentChoices = G.choiceSession?.choices?.length ? G.choiceSession.choices.map(c=>({...c})) : rollChoices(3);
    renderCards();
    $('levelup-lv').textContent = `선택 ${G.level}`;
    updateReroll();
    openModal('levelup');
    audio.sfx('levelup');
}

function updateReroll() {
    const b = $('btn-reroll');
    b.textContent = `다시 뽑기 · 이번 선택 ${G.rerolls}/${displayedChoiceSession?.budget || 1}회`;
    const captured={...displayedChoiceSession};
    b.onclick=()=>{
        if(topModalId()!=='levelup'||performance.now()-lastRerollAt<250)return;
        const result=consumeChoiceReroll(captured.id,captured.revision);
        if(!result.ok)return;
        lastRerollAt=performance.now();displayedChoiceSession=result.session;
        currentChoices=rollChoices(3);renderCards();updateReroll();
    };
    b.disabled = G.rerolls <= 0;
}

function renderCards() {
    const renderRevision=++choiceRenderRevision;
    const passiveCount=Object.keys(G.passives).length;
    $('choice-capacity').textContent=`무기 ${G.weapons.length}/${MAX_WEAPONS} · 보조 ${passiveCount}/${MAX_PASSIVES} · 만렙 장비는 선택에서 제외됩니다.${G.weapons.length>=MAX_WEAPONS||passiveCount>=MAX_PASSIVES?' 슬롯이 가득 찼습니다. 선택을 마친 뒤 일시정지 → 장비 교체에서 새 재료를 확보할 수 있습니다.':''}`;
    if(G.choiceSession && !G.choiceSession.closed)G.choiceSession.choices=currentChoices.map(c=>({...c}));
    const wrap = $('cards');
    wrap.innerHTML = '';
    currentChoices.forEach((c, idx) => {
        const shell = document.createElement('article');shell.className='card choice-card';
        const el = document.createElement('button');
        el.type = 'button';el.className='choice-select';
        const info=choiceInfo(c);
        const lvText=info.levelText;
        el.innerHTML = `
            <div class="card-head">
                <div class="card-icon"></div>
                <div class="card-name"></div>
                <span class="card-key" aria-hidden="true"></span>
            </div>
            <div class="card-lv"></div>
            <div class="card-desc"></div>`;
        mountItemArt(el.querySelector('.card-icon'), c.id, c.kind);
        el.querySelector('.card-name').textContent = c.name;
        el.querySelector('.card-lv').textContent = lvText;
        el.querySelector('.card-key').textContent=String(idx+1);
        el.setAttribute('aria-label',`${c.name}, ${lvText}, ${c.desc}`);
        el.querySelector('.card-desc').textContent = c.desc;
        const sharedNote=c.kind==='passive'?passiveEffectNote(c.id):'';
        if(sharedNote){const note=document.createElement('p');note.className='card-shared-note';note.textContent=sharedNote;el.appendChild(note);}
        if (c.isNew) {
            const s = document.createElement('div');
            s.className = 'stamp';
            s.textContent = 'NEW';
            el.appendChild(s);
        }
        if (c.evoHint) {
            const h = document.createElement('div');
            h.className = 'card-evo';
            h.textContent = `✿ 진화 재료 → ${c.evoHint}`;
            el.appendChild(h);
        } else if (c.kind === 'weapon' && WEAPONS[c.id] && !c.isNew) {
            const ev = WEAPONS[c.id].evolve;
            if (ev && c.level === 8) {
                const h = document.createElement('div');
                h.className = 'card-evo';
                h.textContent = `최대 레벨 + ${PASSIVES[ev.with].name} → 보스 보상에서 진화`;
                el.appendChild(h);
            }
        }
        el.onclick = () => pickCard(idx,renderRevision);
        shell.appendChild(el);
        appendChoiceRecipes(shell,c.id);
        if(c.kind === 'weapon') appendEvolutionInfo(shell,c.id);
        wrap.appendChild(shell);
    });
}

function appendChoiceRecipes(container,id) {
    const recipes=relatedFusionInfo(id);
    if(!recipes.length)return;
    const details=document.createElement('details');details.className='choice-recipes';
    const summary=document.createElement('summary');summary.textContent=`연결 조합 ${recipes.length}개 · 재료와 효과 보기`;details.appendChild(summary);
    details.addEventListener('click',e=>e.stopPropagation());
    details.addEventListener('keydown',e=>e.stopPropagation());
    for(const preview of recipes){
        const row=document.createElement('div');row.className='choice-recipe-detail';
        const title=document.createElement('strong');title.textContent=`${preview.ok?'✓ 조합 가능':'◇ 재료 성장 필요'} · ${preview.output.name}`;
        const ingredients=document.createElement('p');ingredients.textContent=preview.ingredients.map(i=>`${i.name}: ${i.level?`보유 Lv.${i.level}`:'미보유'} / 필요 Lv.${i.requiredLevel}`).join(' + ');
        const effect=document.createElement('p');effect.textContent=preview.output.desc;
        const stats=document.createElement('small');stats.textContent=fusionStatText(preview.output.stats);
        row.append(title,ingredients,effect,stats);details.appendChild(row);
    }
    container.appendChild(details);
}

function pickCard(idx,revision=choiceRenderRevision) {
    if (topModalId() !== 'levelup' || revision!==choiceRenderRevision) return;
    const c = currentChoices[idx];
    if (!c) return;
    const before = G.gold;
    if(applyChoice(c)===false){currentChoices=rollChoices(3);renderCards();return;}
    creditReward(Math.max(0, G.gold - before));
    finishChoiceSession(displayedChoiceSession?.id);
    closeModal('levelup');
}

// ─────────────────────────── 관 상자 ───────────────────────────
export function showChest(kind) {
    toast(kind==='boss'?'보스 회수 물자 확보 · 열어서 강화 보상을 확인하세요.':'엘리트 보급 상자 확보 · 열면 보유 장비가 강화됩니다.',3500);
    pendingRewardScreens.push({ type: 'chest', kind });
    drainRewardScreens();
}

function presentChest(kind) {
    const session = activeChest = {};
    const boss = kind === 'boss';
    const tier=bossRewardTier(G.stage);
    const count=boss?tier.guaranteedCount:1;
    const receiptId=`${rewardSession}:boss:${G.stage}:${G.stageStartTime}`;
    $('chest-description').textContent=boss?`기본 강화 ${count}개 확정 · 연꽃 정밀 강화재 ${Math.round(tier.premiumChance*100)}%\n고급 강화재: 보유 무기 최대 +2레벨(최대8). 강화 가능한 무기가 없으면 ${tier.premiumFallbackCoins}코인. 상점 전용 상품은 나오지 않습니다.`:'보유 장비 1회 강화 · 진화 조건을 갖추면 진화 우선. 모두 만렙이면 '+(30+G.stage*10)+'코인을 받습니다.';
    $('chest-title').textContent = boss ? `${BOSSES[G.stage].name}의 회수 물자` : '회수 물자';
    const coffin = $('coffin');
    coffin.className = 'coffin';
    $('rewards').innerHTML = '';
    const btn = $('btn-chest');
    btn.textContent = '열기';
    btn.disabled = false;
    openModal('chest');
    let opened = false;
    btn.onclick = () => {
        if (activeChest !== session || topModalId() !== 'chest' || btn.disabled) return;
        if (!opened) {
            opened = true;
            btn.disabled = true;
            coffin.classList.add('shaking');
            audio.sfx('heartbeat');
            chestTimer = setTimeout(() => {
                if (activeChest !== session || !modalStack.includes('chest')) return;
                coffin.classList.remove('shaking');
                coffin.classList.add('open');
                audio.sfx('chest');
                const before = G.gold;
                const rewards = boss ? rollBossChest(receiptId).rewards : rollChest(count);
                creditReward(Math.max(0, G.gold - before));
                rewards.forEach((r, i) => {
                    const el = document.createElement('div');
                    el.className = 'reward' + (r.kind === 'evolve' ? ' evolve' : '') + (r.premium?' premium-reward':'');
                    el.style.animationDelay = `${i * 0.12}s`;
                    el.innerHTML = '<div class="r-icon"></div><div><div class="r-name"></div><div class="r-desc"></div></div>';
                    mountItemArt(el.querySelector('.r-icon'),r.rewardIconId || r.id,r.kind);
                    el.querySelector('.r-name').textContent = r.premium?(r.rewardName || r.name):r.kind === 'evolve' ? `진화! ${r.name}` : r.name;
                    el.querySelector('.r-desc').textContent = r.desc;
                    if(r.kind==='weapon'||r.kind==='passive'){const level=document.createElement('div');level.className='reward-level';level.textContent=r.isNew?'신규 획득 · Lv.1':`Lv.${r.fromLevel??r.level-1} → Lv.${r.level}${r.level===(r.kind==='weapon'?8:5)?' · MAX':''}`;el.appendChild(level);}
                    appendChoiceRecipes(el,r.id);
                    $('rewards').appendChild(el);
                });
                btn.textContent = '받기';
                btn.disabled = false;
            }, 900);
            return;
        }
        if (boss) beginStageClear();
        closeModal('chest');
    };
}

// ─────────────────────────── 일시정지 ───────────────────────────
export function togglePause() {
    const top = topModalId();
    if (top) {
        if (top === 'tutorial') closeTutorial();
        else if (top === 'practice') closePractice();
        else if (top === 'loadout-exchange') closeLoadoutExchange();
        else if (top === 'fusion-reveal') closeFusionReveal();
        else if (['pause', 'settings', 'shop', 'install', 'intel', 'fusion'].includes(top)) closeModal(top);
        return;
    }
    if (G.mode !== 'play' && G.mode !== 'boss') return;
    renderPauseBuild();
    openModal('pause');
}

function renderPauseBuild() {
    const wrap = $('pause-build');
    wrap.innerHTML = '';
    for (const w of G.weapons) {
        const d = WEAPONS[w.id];
        const s = document.createElement('span');
        mountItemArt(s,w.id);
        const name = document.createElement('b'); name.textContent = `${w.evolved ? d.evolve.name : d.name} Lv${w.level}`; s.appendChild(name);
        wrap.appendChild(s);
    }
    for (const id in G.passives) {
        const s = document.createElement('span');
        mountItemArt(s,id);
        const name = document.createElement('b'); name.textContent = `${PASSIVES[id].name} Lv${G.passives[id]}`; s.appendChild(name);
        wrap.appendChild(s);
    }
}

// Explicit item fusion: displaying a recipe never consumes its ingredients.
function fusionStatText(stats) {
    const area=stats?.area || 1;
    const shown={...stats,radius:stats?.radius*area,length:stats?.length*Math.sqrt(area),width:stats?.width*area};
    const parts=[];
    for (const [key,label] of [['dmg','피해'],['amount','발수'],['pierce','관통'],['radius','범위'],['length','사거리'],['orbitDamage','꽃잎 피해'],['orbitAmount','꽃잎 수'],['orbitRadius','꽃잎 범위'],['fieldDamage','화염 틱 피해'],['fieldAmount','화염 지대'],['fieldRadius','화염 범위'],['fieldDuration','화염 지속(초)'],['orbitDuration','꽃잎 지속(초)']]) {
        if (Number.isFinite(shown[key])) parts.push(`${label} ${Math.round(shown[key]*10)/10}`);
    }
    if (Number.isFinite(stats?.cd)) parts.push(`주기 ${Math.round(stats.cd*100)/100}초`);
    if (Number.isFinite(stats?.duration)) parts.push(`지속 ${Math.round(stats.duration*100)/100}초`);
    if (Number.isFinite(stats?.slow)) parts.push(`감속 ${Math.round(stats.slow*100)}%`);
    return parts.join(' · ');
}
export function showFusion() {
    if (!['play','boss'].includes(G.mode) || G.player?.dead) return;
    $('fusion-status').textContent='';
    renderFusion();
    openModal('fusion');
}
function renderFusion() {
    const wrap=$('fusion-recipes');wrap.replaceChildren();
    const recipes=FUSION_RECIPES.map(recipe=>({recipe,preview:previewFusion(recipe.id)}));
    const ready=recipes.filter(row=>row.preview.ok).length;
    $('fusion-summary').textContent=`전체 ${recipes.length}개 레시피 · 조합 가능 ${ready}개 · 재료는 각각 Lv.5 이상`;
    for (const {recipe,preview} of recipes) {
        const card=document.createElement('article');card.className=preview.ok?'fusion-recipe fusion-ready':'fusion-recipe';card.dataset.recipe=recipe.id;
        const ingredients=document.createElement('div');ingredients.className='fusion-ingredients';
        for(const item of preview.ingredients){
            const cell=document.createElement('div');const art=document.createElement('div');art.className='fusion-art';mountItemArt(art,item.id);
            const name=document.createElement('strong');name.textContent=item.name;
            const level=document.createElement('small');level.textContent=`현재 Lv.${item.level} / 필요 Lv.${item.requiredLevel}`;
            cell.append(art,name,level);ingredients.appendChild(cell);
        }
        const output=document.createElement('div');output.className='fusion-output';
        const art=document.createElement('div');art.className='fusion-art';mountItemArt(art,preview.output.id);
        const copy=document.createElement('div');const name=document.createElement('h3');name.textContent=`${preview.output.name} · Lv.1`;
        const desc=document.createElement('p');desc.textContent=preview.output.desc;
        const stats=document.createElement('small');stats.textContent=fusionStatText(preview.output.stats);
        copy.append(name,desc,stats);output.append(art,copy);
        const button=document.createElement('button');button.type='button';button.className='btn btn-blood';button.disabled=!preview.ok;
        button.textContent=preview.ok?'재료 2개를 소모하고 조합':'재료 아이템과 레벨을 모으세요';
        button.addEventListener('click',()=>{
            if(topModalId()!=='fusion'||button.disabled)return;
            button.disabled=true;
            const result=fuseItems(recipe.id,preview.signature);
            if(!result.ok){$('fusion-status').textContent='장비 상태가 바뀌었습니다. 현재 재료와 레벨을 확인하세요.';renderFusion();return;}
            $('fusion-status').textContent=`${preview.output.name} Lv.1 조합 완료. 재료 2개가 새 아이템으로 바뀌었습니다.`;
            if(modalStack.includes('levelup')){currentChoices=rollChoices(3);renderCards();}
            if(modalStack.includes('pause'))renderPauseBuild();
            renderFusion();
            openFusionReveal({ ingredients: preview.ingredients, output: preview.output, statText: fusionStatText(preview.output.stats), onDone: () => closeModal('fusion') });
        });
        card.append(ingredients,output,button);wrap.appendChild(card);
    }
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
let chestResultOpen = false;
function renderShop() {
    retryPendingCoins();
    const pending = pendingCoinTotal();
    $('shop-status').textContent = pending ? `저장 대기 ${pending} 코인 · 새로고침 전에 다시 시도하세요.` : '청토끼 처치 후 코인을 회수하세요. 구매한 장비는 다음 작전부터 적용됩니다.';
    $('shop-character').textContent = `최고 클리어 STAGE ${highestClearedStage(save)} · 전투에서는 아이템을 획득·강화하고, 상점에서는 다음 작전을 준비하세요.`;
    $('pet-redemption-note').textContent = PET_REDEMPTION.reason;
    $('shop-gold').textContent = `● ${save.gold}`;
    const list = $('shop-list');
    list.innerHTML = '';
    for (const item of SHOP) {
        const lv = upgradeLevel(item.id);
        const access = shopAccess(save,item);
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = '<div class="s-art"></div><div class="s-name"></div><div class="s-desc"></div><div class="s-pips"></div>';
        mountItemArt(el.querySelector('.s-art'), item.id, 'shop');
        el.querySelector('.s-name').textContent = item.name;
        el.querySelector('.s-desc').textContent = item.desc;
        el.querySelector('.s-pips').textContent = '●'.repeat(lv) + '○'.repeat(item.max - lv);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-small';
        if (item.kind === 'pet' && lv > 0) {
            const equipped = save.equippedPet === item.id;
            b.textContent = equipped ? '동행 해제' : '동행하기';
            b.onclick = () => { if (!equipPet(equipped ? null : item.id)) notifyPending(); renderShop(); };
        } else if (lv >= item.max) { b.textContent = '최대'; b.disabled = true; }
        else if (!access.unlocked) { b.textContent = access.message; b.disabled = true; el.classList.add('locked'); }
        else {
            const cost = item.cost[lv];
            b.textContent = `구매 ● ${cost}`;
            b.disabled = save.gold < cost;
            b.onclick = () => {
                if (buyUpgrade(item.id, lv)) { audio.sfx('levelup'); renderShop(); }
                else { audio.sfx('deny'); notifyPending(); }
            };
        }
        el.appendChild(b);
        list.appendChild(el);
    }
    renderRelicShop();
    renderAccessoryShop();
}

function renderAccessoryShop(){
    const list=$('accessory-list');list.replaceChildren();
    const equipped=activeAccessory(save);
    $('accessory-equipped').textContent=equipped?`현재 장착 · ${equipped.name} — ${equipped.desc}`:'현재 장착 없음 · 고급 장신구 1개를 선택하세요.';
    for(const item of ACCESSORIES){
        const owned=save.accessoryInventory?.includes(item.id),active=save.equippedAccessory===item.id,access=shopAccess(save,item),revision=save.revision;
        const card=document.createElement('article');card.className='accessory-card'+(active?' equipped':'');card.dataset.item=item.id;
        const art=document.createElement('img');art.src=item.image;art.alt='';art.loading='lazy';
        const copy=document.createElement('div');copy.className='accessory-copy';
        const tier=document.createElement('small');tier.textContent=`STAGE ${item.unlockStage} 클리어 · ${active?'장착 중':owned?'보유':'미보유'}`;
        const name=document.createElement('h4');name.textContent=item.name;
        const desc=document.createElement('p');desc.textContent=item.desc;
        const price=document.createElement('strong');price.textContent=owned?'구매 완료 · 다시 결제 없음':`${item.price.toLocaleString()} 코인 · 확정 구매`;
        const action=document.createElement('button');action.type='button';action.className='btn btn-small';
        action.textContent=owned?(active?'장착 해제':'이 장신구 장착'):!access.unlocked?access.message:save.gold<item.price?`${(item.price-save.gold).toLocaleString()} 코인 부족`:'구매하고 장착';
        action.disabled=!owned&&(!access.unlocked||save.gold<item.price);
        action.onclick=()=>{
            if(action.disabled||topModalId()!=='shop')return;
            action.disabled=true;
            const result=owned?setAccessory(active?null:item.id,revision):buyAccessory(item.id,revision);
            renderShop();
            if(!result.ok){$('shop-status').textContent=result.code==='REVISION_CONFLICT'?'보유 정보가 갱신되었습니다. 금액을 확인하고 다시 선택하세요.':'구매를 저장하지 못했습니다. 잔액과 연결 상태를 확인한 뒤 다시 시도하세요.';}
            else{$('shop-status').textContent=`${item.name} · ${owned&&active?'장착 해제':'장착 완료'}. 다음 작전부터 적용됩니다.`;audio.sfx('levelup');}
        };
        copy.append(tier,name,desc,price,action);card.append(art,copy);list.appendChild(card);
    }
}

function renderRelicShop() {
    const active = strongestRelic(save);
    const list = $('relic-list'); list.replaceChildren();
    for (const relic of RELICS) {
        const owned = save.relics.includes(relic.id);
        const access = shopAccess(save,relic);
        const card = document.createElement('article'); card.className = `relic-card ${relic.tier}`;
        const art = document.createElement('img'); art.src = itemArt(relic.id); art.alt = '';
        const rarity = document.createElement('span'); rarity.className = 'rarity'; rarity.textContent = relic.tier.toUpperCase();
        const name = document.createElement('h4'); name.textContent = relic.name;
        const desc = document.createElement('p'); desc.textContent = relic.desc;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-small';
        button.textContent = owned ? (active?.id === relic.id ? '적용 중 · 다음 작전' : '보유 중') : `확정 구매 · ${relic.price} 코인`;
        if (!owned && !access.unlocked) button.textContent = access.message;
        button.disabled = owned || !access.unlocked || save.gold < relic.price;
        button.onclick = () => { if (!buyRelic(relic.id)) notifyPending(); else audio.sfx('levelup'); renderShop(); };
        card.append(art,rarity,name,desc,button); list.appendChild(card);
    }
    const rates = chestRates(save);
    $('cache-rates').textContent = RELICS.map((r,i) => `${r.name} ${Math.round(rates[i]*100)}% · 중복 시 ${r.duplicateCoins} 코인`).join('\n');
    $('cache-pity').textContent = `기본 확률 일반 60% / 희귀 30% / 영웅 10%. 영웅 미획득 ${save.chestPity}회 · ${RELIC_CHEST.pityAt}번째에는 영웅 확정. 확정 구매는 이 횟수를 바꾸지 않습니다.`;
    const button = $('btn-coin-cache');
    button.textContent = `상자 1개 열기 · ${RELIC_CHEST.cost} 코인`;
    const access = shopAccess(save,RELIC_CHEST);
    if (!access.unlocked) button.textContent = access.message;
    button.disabled = !access.unlocked || chestResultOpen || save.gold < RELIC_CHEST.cost;
    const expectedCount = save.chestCount;
    button.onclick = () => {
        if (chestResultOpen) return;
        button.disabled = true;
        const result = openChest(expectedCount);
        if (!result.ok) { notifyPending(); renderShop(); return; }
        chestResultOpen = true; renderShop();
        const relic = RELICS.find(r=>r.id===result.reward.itemId);
        const panel = $('cache-result'); panel.replaceChildren(); panel.hidden = false;
        const art = document.createElement('img'); art.src = itemArt(relic.id); art.alt = '';
        const body = document.createElement('div'), title = document.createElement('strong'), text = document.createElement('p');
        title.textContent = `${relic.tier.toUpperCase()} · ${relic.name}`;
        text.textContent = result.reward.duplicate ? `이미 보유한 유물입니다. ${result.reward.compensation} 코인을 돌려받았어요.` : `${relic.desc}. 가장 높은 등급의 효과가 다음 작전에 적용됩니다.`;
        const done = document.createElement('button'); done.type = 'button'; done.className = 'btn btn-small'; done.textContent = '결과 확인';
        done.onclick = () => { chestResultOpen = false; panel.hidden = true; renderShop(); $('btn-coin-cache').focus(); };
        body.append(title,text,done); panel.append(art,body); done.focus();
    };
}

function renderBossArchive() {
    const list = $('boss-archive');
    list.replaceChildren();
    for (const [stage, boss] of Object.entries(BOSSES)) {
        const card = document.createElement('article');
        const img = document.createElement('img');
        img.src = `asset/bosses/boss-${String(stage).padStart(2,'0')}.webp`;
        img.alt = boss.name; img.loading = 'lazy';
        const label = document.createElement('span'); label.textContent = `SECTOR ${String(stage).padStart(2,'0')}`;
        const name = document.createElement('h3'); name.textContent = boss.name;
        const desc = document.createElement('p'); desc.textContent = `${boss.title} · ${boss.signatureHint || ''}`;
        card.append(img,label,name,desc); list.appendChild(card);
    }
}

// ─────────────────────────── 결과 화면 ───────────────────────────
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }

function statsHTML(extra = []) {
    const items = [
        ['아이템 선택 단계', G.level],
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
            const d = WEAPONS[id] || { name: id === 'petalCannon' ? '꽃잎포' : '동행 펫 · 영냥이', icon: '', evolve: {} };
            const w = G.weapons.find(x => x.id === id);
            const name = w && w.evolved ? d.evolve.name : d.name;
            return `<div class="dmg-row"><span><img class="inventory-art" src="${itemArt(id)}" alt=""></span><div><div>${name}</div><div class="dmg-bar" style="width:${Math.max(4, (v / max) * 100)}%"></div></div><b style="font-size:10px">${Math.round(v).toLocaleString()}</b></div>`;
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

function settleStage(outcome) {
    if (G.settlement) return G.settlement.earned;
    const stageKills = G.kills - (G.stageKillsStart || 0);
    const earned = Math.round((outcome === 'clear' ? stageKills * 0.2 + 40 * G.stage : stageKills * 0.1) * G.player.stats.greed);
    const eventId = `${rewardSession}:settlement:${++rewardSequence}`;
    G.settlement = { outcome, earned, eventId };
    if (outcome === 'clear') G.gold += earned;
    creditReward(earned);
    save.kills += stageKills;
    if (outcome === 'clear') {
        save.maxStage = Math.max(save.maxStage, Math.min(STAGE_COUNT, G.stage + 1));
        save.maxClearedStage = Math.max(save.maxClearedStage || 0,G.stage);
    }
    if (!persist()) notifyPending();
    return earned;
}

export function showGameOver() {
    setPlaying(false);
    const earned = settleStage('death');
    let lore = LORE[0][1];
    for (const [s, t] of LORE) if (G.stage >= s) lore = t;
    $('gameover-lore').textContent = lore;
    $('gameover-stats').innerHTML = statsHTML([['스테이지', G.stage], ['획득 골드', `+${earned}`]]);
    show('gameover');
}

export function showStageClear() {
    setPlaying(false);
    const earned = settleStage('clear');
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
    initTutorial({ onOpen: () => { resetInput(); openModal('tutorial'); }, onClose: () => { closeModal('tutorial'); resetInput(); } });
    initLoadoutExchange({ onOpen: () => { resetInput(); openModal('loadout-exchange'); }, onClose: () => { closeModal('loadout-exchange'); resetInput(); } });
    initFusionReveal({ onOpen: () => { resetInput(); openModal('fusion-reveal'); }, onClose: () => { closeModal('fusion-reveal'); resetInput(); } });
    initPractice({ onOpen: () => { resetInput(); openModal('practice'); }, onClose: () => { closeModal('practice'); resetInput(); } });
    click('btn-practice', () => openPractice());
    click('btn-pause-practice', () => openPractice());
    for (const id of ['btn-fusion','btn-pause-fusion','btn-levelup-fusion']) click(id,showFusion);
    click('btn-fusion-close',()=>closeModal('fusion'));
    click('btn-tutorial', () => openTutorial());
    click('btn-pause-tutorial', () => openTutorial());

    click('btn-new', () => {
        const begin = () => {
            clearRun();
            beginStageFlow(1, () => { G.godMode = false; newRun(1); startPlaying(); });
        };
        const practiceThenBegin = () => shouldOfferPractice() ? openPractice({ onDone: begin }) : begin();
        if (shouldOfferTutorial()) openTutorial({ onDone: practiceThenBegin });
        else practiceThenBegin();
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
    click('btn-intel', () => { renderBossArchive(); openModal('intel'); });
    click('btn-intel-close', () => closeModal('intel'));
    click('btn-pause-settings', openSettings);
    click('btn-install', showInstall);
    click('btn-install-close', () => closeModal('install'));
    click('btn-pause', togglePause);
    click('btn-pause-loadout', () => openLoadoutExchange());
    click('btn-resume', () => closeModal('pause'));
    click('btn-quit', () => { closeModal('pause'); audio.pauseBGM(); showTitle(); audio.playBGM(); });
    click('btn-skip', () => {
        if(topModalId()!=='levelup'||!finishChoiceSession(displayedChoiceSession?.id))return;
        const g = 10 * G.stage;
        G.gold += g;
        creditReward(g);
        closeModal('levelup');
    });
    click('btn-retry', () => { hide('gameover'); retryStage(); startPlaying(); });
    click('btn-gameover-title', showTitle);
    click('btn-next', () => {
        hide('clear');
        const next = G.stage + 1;
        playStory(`EPISODE ${next} — ${STAGES[next].name}`, STORIES[next], () => { startStage(next); startPlaying(); }, next);
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
        if (e.repeat || e.target.closest?.('input, textarea, [contenteditable]')) return;
        if (topModalId() === 'levelup') {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= currentChoices.length) pickCard(n - 1);
            if (e.key === 'r' || e.key === 'R') $('btn-reroll').click();
        } else if (topModalId() === 'chest' && (e.key === 'Enter' || e.key === ' ')) {
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
    banner(b.def.name, b.def.signatureHint || b.def.title);
    const portrait = document.createElement('img');
    portrait.src = `asset/bosses/boss-${String(b.stage || G.stage).padStart(2,'0')}.webp`;
    portrait.alt = '';
    $('banner').appendChild(portrait);
    $('banner').classList.add('boss-intro');
}

export function isAnyModalOpen() { return modalStack.length > 0; }
