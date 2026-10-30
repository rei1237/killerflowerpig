import { pinRewardRun, queueCharacterXP, save } from '../core/save.js';
import { characterProgress, characterStageXP } from '../core/character-progression.js';
import { floatText } from './effects.js';
import { resetFieldItems, updateFieldItems } from './field-items.js';
import { validateStageCheckpoint } from './stage-checkpoint.js';
import { clearFocus } from './targeting.js';
import { resetInput } from '../core/input.js';
import { updateEncirclement, clearEncirclement, constrainEncirclementPlayer } from './encirclement.js';
import { resetPets, updatePets } from './pets.js';
import { createPartner, resetPartner, updatePartner, partnerSnapshot } from './coop.js';
import { setSplitInput } from '../core/input.js';
// 게임 흐름 제어: 런 시작/스테이지 시작/스텝 업데이트/보스·클리어·사망 전환
import { G, clearWorld, configureCaps, emit } from './state.js';
import { STAGES } from '../data/stages.js';
import { STARTING_WEAPON, PASSIVES } from '../data/weapons.js';
import { TECHS, techStartingWeapons } from '../data/techs.js';
import { DIFFICULTIES, G_COOP } from '../data/difficulty.js';
import { createPlayer, updatePlayer, recomputeStats } from './player.js';
import { updateEnemies, updateEnemyShots, flushExplosions, clearPendingExplosions } from './enemies.js';
import { updateWeapons, updateShots, createWeapon, resetWeaponRuntime } from './weapons.js';
import { updateHazards } from './hazards.js';
import { updatePickups, magnetAll } from './pickups.js';
import { updateEffects, refreshGore } from './effects.js';
import { updateSpawner, resetSpawner } from './spawner.js';
import { spawnBoss } from './boss.js';
import { prepareBossSheets } from './boss-sheets.js';
import { resetBuild, snapshotBuild, restoreBuild, xpForLevel } from './progression.js';
import { invalidateStageVisuals } from './render.js';
import { audio } from '../core/audio.js';

const RUN_KEY = 'kfp.run.v1';
const DEAD_RUNS_KEY = 'kfp.dead-runs.v1';
let clearTimer = 0;
let heartbeatT = 0;
let stageSnapshot = null;
let checkpointUnsaved = false;
let runSerial = 0;
const deadRuns = new Set();
const createRunId = () => globalThis.crypto?.randomUUID?.() || `run:${Date.now()}:${++runSerial}:${Math.random().toString(36).slice(2)}`;
const runToken = snap => snap?.runId || (snap ? `legacy:${JSON.stringify(snap)}` : null);
function readDeadRuns() {
    try { const list = JSON.parse(localStorage.getItem(DEAD_RUNS_KEY) || '[]'); if (Array.isArray(list)) for (const id of list) if (typeof id === 'string') deadRuns.add(id); } catch { /* In-memory invalidation still applies. */ }
}
function isDeadRun(snap) { readDeadRuns(); return !snap || snap.dead === true || deadRuns.has(runToken(snap)); }
export function loadRun() {
    if (checkpointUnsaved && stageSnapshot) return validateStageCheckpoint(stageSnapshot);
    try { const r = localStorage.getItem(RUN_KEY); const snap = r ? JSON.parse(r) : null; return isDeadRun(snap) ? null : validateStageCheckpoint(snap); } catch { return null; }
}
function saveRun(snap) { try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); checkpointUnsaved = false; return true; } catch { checkpointUnsaved = true; emit('runSaveError'); return false; } }
export function markLoadoutExchangeSpent() {
    G.loadoutExchangesUsed = 1;
    if (stageSnapshot) { stageSnapshot.loadoutExchangesUsed = 1; saveRun(stageSnapshot); }
}
export function clearRun() { stageSnapshot = null; checkpointUnsaved = false; try { localStorage.removeItem(RUN_KEY); } catch { /* A new run overwrites this checkpoint. */ } }
function captureCheckpoint(stage = G.stage) {
    return { ...snapshotBuild(), stage, runId: G.runId, checkpointVersion: 2, coop: !!G.coop, partner: G.coop ? partnerSnapshot() : null,
        pendingLevelUps: G.pendingLevelUps, banished: [...G.banished], retry: false };
}
export function finalizeEntryCheckpoint() {
    if (!stageSnapshot?.pendingLevelUps || G.pendingLevelUps || (G.choiceSession && !G.choiceSession.closed)) return false;
    stageSnapshot = captureCheckpoint(); return saveRun(stageSnapshot);
}
// Called only once reward choices/chest settlement have finished, before the next story.
export function checkpointStageClear() {
    if (G.pendingLevelUps || (G.choiceSession && !G.choiceSession.closed)) return false;
    if (G.stage >= 10) { clearRun(); return true; }
    stageSnapshot = captureCheckpoint(G.stage + 1); return saveRun(stageSnapshot);
}
// techId 를 생략하면 기존과 동일하게 산탄총 단독으로 시작 (호환용). difficulty 생략 시 쉬움.
// coop = true 면 2P 협동(영냥이 합류, 동행 펫 비활성, WASD 1P · 방향키 2P).
export function newRun(stage = 1, techId = null, difficulty = 'easy', coop = false) {
    G.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'easy';
    setCoop(coop);
    configureCaps();
    refreshGore();
    resetBuild();
    G.runId = createRunId();
    G.gold = 0;
    G.kills = 0;
    G.damageBy = {};
    G.rerolls = 0;
    const tech = TECHS[techId] ? techId : null;
    G.tech = tech;
    createPlayer();
    const startingWeapons = tech ? techStartingWeapons(TECHS[tech]) : [STARTING_WEAPON];
    G.weapons = startingWeapons.map((id, slot) => createWeapon(id, slot));
    if (tech && PASSIVES[TECHS[tech].start.passive]) G.passives[TECHS[tech].start.passive] = 1;
    recomputeStats(true);
    // 스테이지 선택으로 중간부터 시작하면 그에 맞는 레벨 보정
    if (stage > 1) {
        const n = Math.min(40, (stage - 1) * 5);
        G.level += n;
        G.xpNext = xpForLevel(G.level);
        G.pendingLevelUps = n;
    }
    startStage(stage);
}

export function continueRun(raw) {
    const snap = validateStageCheckpoint(raw);
    const latest = loadRun();
    if (latest?.runId && latest.runId === snap?.runId && latest.stage > snap.stage) return false;
    if (!snap || isDeadRun(raw)) return false;
    G.runId = snap.runId || createRunId();
    G.godMode = false;
    setCoop(snap.coop === true);
    G.partnerBuild = snap.partner || null;
    configureCaps(); refreshGore(); resetBuild(); G.damageBy = {};
    createPlayer(); restoreBuild(snap);
    G.pendingLevelUps = snap.pendingLevelUps;
    G.banished = new Set(snap.banished);
    G.rerolls = snap.rerolls;
    startStage(snap.stage, true);
    G.player.iframes = 0;
    return true;
}

export function retryStage() {
    if (G.mode === 'play' || G.mode === 'boss') return false;
    let snap = validateStageCheckpoint(stageSnapshot) || loadRun();
    if (!snap) {
        // Old sessions with no entry snapshot retain their current valid build/stage.
        // Never silently send a valid stage5/10 session back to stage1.
        snap = validateStageCheckpoint(captureCheckpoint());
        if (!snap) { emit('runSaveError'); return false; }
        snap.pendingLevelUps = 0; snap.choiceSession = null;
    }
    return continueRun({ ...snap, retry: true });
}

function setCoop(coop) {
    G.coop = !!coop;
    G_COOP.on = G.coop;
    G.partner = null;
    G.partnerBuild = null;
    setSplitInput(G.coop);
}

export function startStage(stage, restored = false) {
    if (G.player?.dead || deadRuns.has(G.runId)) return false;
    pinRewardRun(G.runId);
    G.stage = stage;
    prepareBossSheets(stage);
    clearWorld();
    clearPendingExplosions(); clearFocus(); resetInput(); resetWeaponRuntime();
    resetSpawner();
    resetFieldItems();
    invalidateStageVisuals();
    for (const w of G.weapons) { w.fusionCores = null; w.follow = null; w.cd = 0.5; w.activeT = 0; w.burst = 0; }
    const p = G.player;
    p.x = 0; p.y = 0; p.dead = false; p.iframes = 1.5;
    recomputeStats(true);
    resetPets();
    if (G.coop && !G.partner) { createPartner(G.partnerBuild); G.partnerBuild = null; }
    resetPartner();
    setSplitInput(G.coop);
    G.camera.x = 0; G.camera.y = -20;
    G.time = 0;
    G.deadT = 0; G.deathShown = false; heartbeatT = 0;
    G.mode = 'play';
    G.paused = false;
    G.stageKillsStart = G.kills;
    G.settlement = null;
    G.stageStartTime = performance.now();
    clearTimer = 0;
    stageSnapshot = captureCheckpoint();
    saveRun(stageSnapshot);
    audio.setBGMRate(1);
    audio.playBGM();
    emit('stageStart', stage, restored);
}

export function step(dt) {
    if (G.mode !== 'play' || G.player?.dead) clearEncirclement();
    if (G.mode === 'idle' || G.paused) return;
    if (G.hitstop > 0) {
        G.hitstop -= dt;
        updateEffects(dt * 0.15);
        return;
    }
    // 사망 시 슬로모션 후 결과 화면
    if (G.mode === 'dead') {
        dt *= 0.3;
        G.deadT += dt;
        if (G.deadT > 0.6 && !G.deathShown) { G.deathShown = true; emit('gameOver'); }
    }
    G.clock += dt;
    if (G.mode === 'play') G.time += dt;

    updateEncirclement(dt);
    updatePlayer(dt);
    if (G.mode !== 'dead') updatePets(dt);
    if (G.mode !== 'dead') updatePartner(dt);
    if (G.mode === 'play' || G.mode === 'boss') { updateSpawner(dt); updateFieldItems(dt); }
    updateEnemies(dt);
    flushExplosions();
    if (G.mode !== 'dead') updateWeapons(dt);
    updateShots(dt);
    updateEnemyShots(dt);
    updateHazards(dt);
    if (G.mode !== 'dead') updatePickups(dt);
    if (G.boss) G.boss.update(dt);
    constrainEncirclementPlayer();
    updateEffects(dt);

    // 레벨업 대기열 → UI
    if (G.pendingLevelUps > 0 && G.mode !== 'dead') {
        G.pendingLevelUps--;
        emit('levelUp', { choiceSessionId: `choice:${++G.choiceEventSerial}` });
        return;
    }
    // 2P 영냥이 레벨업: 1P 선택이 끝난 뒤 영냥이 성장 선택 창을 띄운다
    const partner = G.coop ? G.partner : null;
    if (partner?.pendingLevelUps > 0 && G.mode !== 'dead') {
        partner.pendingLevelUps--;
        emit('partnerLevelUp');
        return;
    }

    if (G.mode === 'play' && G.time >= STAGES[G.stage].duration) {
        clearEncirclement();
        G.mode = 'boss';
        spawnBoss();
        audio.setBGMRate(1.08);
    }

    if (G.mode === 'clearing') {
        clearTimer += dt;
        if (clearTimer > 2.2) {
            G.mode = 'idle';
            emit('stageClear');
        }
    }

    // 저체력 심장 박동
    const p = G.player;
    if (!p.dead && p.hp / p.maxHp < 0.3) {
        heartbeatT -= dt;
        if (heartbeatT <= 0) { heartbeatT = 0.5 + (p.hp / p.maxHp) * 2; audio.sfx('heartbeat'); }
    }
}

// 보스 상자를 열고 난 뒤 호출 → 남은 젬 흡수 후 클리어
export function beginStageClear() {
    if (G.player?.dead || deadRuns.has(G.runId)) return false;
    clearEncirclement();
    G.mode = 'clearing';
    clearTimer = 0;
    awardStageCharacterXP();
    magnetAll();
    // 남은 적은 무너져 내림
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (e.alive) { e.alive = false; e.state = 'dead'; e.anim = 0; e.animT = 0; e.deadT = 0; }
    }
}

// 구역 클리어 → 영구 캐릭터 경험치 (런·구역별 요청 id로 한 번만). 레벨이 오르면 기본 능력치를 바로 반영한다.
export function awardStageCharacterXP() {
    if (!G.runId) return false;
    const before = characterProgress(save.characterXP).level;
    const amount = characterStageXP(G.stage);
    if (!queueCharacterXP(amount, `character:${G.runId}:${G.stage}`)) return false;
    const after = characterProgress(save.characterXP).level;
    const p = G.player;
    if (p) floatText(p.x, p.y - 96, after > before ? `캐릭터 Lv.${after}! 기본 능력치 상승` : `캐릭터 경험치 +${amount}`, after > before ? '#ffd76a' : '#e8dcff', 1.6);
    if (after > before && p) recomputeStats();
    return true;
}

export function onPlayerDeath() {
    if (G.mode === 'dead') return;
    clearEncirclement();
    // Keep the immutable stage-entry build; discard only the failed attempt's world.
    if (!stageSnapshot || stageSnapshot.stage !== G.stage) stageSnapshot = validateStageCheckpoint(captureCheckpoint());
    if (stageSnapshot) { stageSnapshot.retry = true; saveRun(stageSnapshot); }
    else emit('runSaveError');
    G.player.dead = true;
    G.mode = 'dead';
    G.deadT = 0;
    G.deathShown = false;
    audio.setBGMRate(0.8);
}
