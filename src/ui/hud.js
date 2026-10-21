import { mountItemArt } from './item-art.js';
// Read-only DOM projection of the survivor state, capped at 10 Hz.
// UI portraits are static illustrations; combat continues using animated atlases.
import { G } from '../game/state.js';
import { STAGES } from '../data/stages.js';
import { WEAPONS, PASSIVES } from '../data/weapons.js';
import { techSummary } from '../game/tech.js';
import { difficultyOf } from '../data/difficulty.js';
import { syncFusionButtons } from './fusion-button.js';

let lastUpdate = -Infinity;
let buildKey = '';
let nodes;
const $ = id => document.getElementById(id);
function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}
export function drawHUD() {
    if (!G.player || G.mode === 'idle') return;
    const now = performance.now();
    if (now - lastUpdate < 100) return;
    lastUpdate = now;
    if (!nodes) nodes = Object.fromEntries([
        'hud-hp','hud-hp-text','hud-hp-track','hud-xp','hud-xp-track',
        'hud-level','hud-stage','hud-time','hud-score','hud-build',
        'hud-boss','hud-boss-portrait','hud-boss-name','hud-boss-hp','hud-countdown','hud-stage-progress','hud-tech'
    ].map(id => [id,$(id)]));
    const hp = Math.max(0, Math.min(1,G.player.hp/G.player.maxHp));
    nodes['hud-hp'].style.width = hp * 100 + '%';
    nodes['hud-hp'].style.background = hp < .25 ? '#e37765' : '#71b9a5';
    nodes['hud-hp-text'].textContent = `${Math.max(0,Math.ceil(G.player.hp))} / ${G.player.maxHp}`;
    nodes['hud-hp-track'].setAttribute('aria-valuenow',Math.round(hp*100));
    const xp = Math.min(1,G.xp/G.xpNext);
    nodes['hud-xp'].style.width = xp * 100 + '%';
    nodes['hud-xp-track'].setAttribute('aria-valuenow',Math.round(xp*100));
    nodes['hud-level'].textContent = '선택 ' + G.level;
    const ts = techSummary();
    if (nodes['hud-tech']) {
        nodes['hud-tech'].hidden = !ts;
        if (ts) {
            const text = `${difficultyOf(G.difficulty).name} · ${ts.tech.icon} ${'◆'.repeat(ts.tier)}${'◇'.repeat(3 - ts.tier)} ${ts.count}/6`;
            if (nodes['hud-tech'].textContent !== text) {
                nodes['hud-tech'].textContent = text;
                nodes['hud-tech'].title = `${ts.tech.name} 공명 ${ts.count}/6`;
            }
        }
    }
    const stage = STAGES[G.stage];
    nodes['hud-stage'].textContent = `STAGE ${String(G.stage).padStart(2,'0')} · ${stage?.name || ''}`;
    nodes['hud-time'].textContent = G.boss?.alive ? 'BOSS' : fmtTime(G.time);
    nodes['hud-countdown'].textContent = G.boss?.alive ? '위협 개체 교전 중' : '보스 출현까지 ' + fmtTime(Math.max(0,(stage?.duration || 0)-G.time));
    nodes['hud-stage-progress'].style.width = Math.min(100,G.time/(stage?.duration || 1)*100)+'%';
    nodes['hud-score'].textContent = `처치 ${G.kills.toLocaleString()} · 골드 ${G.gold.toLocaleString()}`;
    const nextKey = JSON.stringify([G.weapons.map(w=>[w.id,w.level,w.evolved]),G.passives]);
    if (nextKey !== buildKey) {
        buildKey = nextKey;
        syncFusionButtons();
        const slots = [
            ...G.weapons.map(w => ({id:w.id,name:w.evolved?WEAPONS[w.id].evolve.name:WEAPONS[w.id].name, icon:w.evolved?WEAPONS[w.id].evolve.icon:WEAPONS[w.id].icon,level:w.level,evolved:w.evolved})),
            ...Object.entries(G.passives).map(([id,level])=>({id,name:PASSIVES[id].name,icon:PASSIVES[id].icon,level}))
        ];
        nodes['hud-build'].replaceChildren(...slots.map(item=>{
            const slot=document.createElement('span');
            slot.className='hud-slot'+(item.evolved?' evolved':'');
            slot.title=`${item.name} Lv.${item.level}`;
            slot.setAttribute('aria-label',slot.title);
            mountItemArt(slot,item.id);
            const level=document.createElement('small');
            level.textContent=item.level;
            slot.appendChild(level);
            return slot;
        }));
    }
    const b=G.boss;
    nodes['hud-boss'].hidden = !b || (!b.alive && b.deadT >= 1.2);
    if(b){
        const portrait = `asset/bosses/boss-${String(b.def.artStage ?? G.stage).padStart(2,'0')}.webp`;
        if (nodes['hud-boss-portrait'].getAttribute?.('src') !== portrait) nodes['hud-boss-portrait'].src = portrait;
        nodes['hud-boss-name'].textContent=b.def.name+(b.phase?` · PHASE ${b.phase+1}`:'');
        nodes['hud-boss-hp'].style.width=Math.max(0,b.hp/b.maxHp)*100+'%';
    }
}
