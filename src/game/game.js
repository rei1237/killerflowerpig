import { resetPets, updatePets } from './pets.js';
// 게임 흐름 제어: 런 시작/스테이지 시작/스텝 업데이트/보스·클리어·사망 전환
import { G, clearWorld, configureCaps, emit } from './state.js';
import { STAGES } from '../data/stages.js';
import { STARTING_WEAPON } from '../data/weapons.js';
import { createPlayer, updatePlayer, recomputeStats } from './player.js';
import { updateEnemies, updateEnemyShots, flushExplosions } from './enemies.js';
import { updateWeapons, updateShots, createWeapon } from './weapons.js';
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
let runSerial = 0;
const deadRuns = new Set();
const runToken = snap => snap?.runId || (snap ? `legacy:${JSON.stringify(snap)}` : null);
function readDeadRuns() {
    try { const list = JSON.parse(localStorage.getItem(DEAD_RUNS_KEY) || '[]'); if (Array.isArray(list)) for (const id of list) if (typeof id === 'string') deadRuns.add(id); } catch { /* In-memory invalidation still applies. */ }
}
function isDeadRun(snap) { readDeadRuns(); return !snap || snap.dead === true || deadRuns.has(runToken(snap)); }
export function loadRun() {
    try { const r = localStorage.getItem(RUN_KEY); const snap = r ? JSON.parse(r) : null; return isDeadRun(snap) ? null : snap; } catch { return null; }
}
function saveRun(snap) { try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch { emit('runSaveError'); } }
export function markLoadoutExchangeSpent() {
    G.loadoutExchangesUsed = 1;
    if (stageSnapshot) { stageSnapshot.loadoutExchangesUsed = 1; saveRun(stageSnapshot); }
}
export function clearRun() { stageSnapshot = null; try { localStorage.removeItem(RUN_KEY); } catch { /* A new run overwrites this checkpoint. */ } }
function invalidateDeadRun() {
    const token = G.runId || runToken(stageSnapshot);
    readDeadRuns(); if (token) deadRuns.add(token);
    // Keep a tombstone independent of checkpoint removal. Either successful
    // write is enough to reject the stale checkpoint on the next page load.
    let failed = false;
    try { localStorage.setItem(DEAD_RUNS_KEY, JSON.stringify([...deadRuns])); } catch { failed = true; }
    try { localStorage.removeItem(RUN_KEY); } catch {
        failed = true;
        try { localStorage.setItem(RUN_KEY, JSON.stringify({ dead: true, runId: token })); } catch { /* Warn below; current session remains invalidated. */ }
    }
    stageSnapshot = null;
    if (failed) emit('runSaveError');
}

export function newRun(stage = 1) {
    configureCaps();
    refreshGore();
    resetBuild();
    G.runId = globalThis.crypto?.randomUUID?.() || `run:${Date.now()}:${++runSerial}:${Math.random().toString(36).slice(2)}`;
    G.gold = 0;
    G.kills = 0;
    G.damageBy = {};
    G.rerolls = 0;
    createPlayer();
    G.weapons.push(createWeapon(STARTING_WEAPON, 0));
    // 스테이지 선택으로 중간부터 시작하면 그에 맞는 레벨 보정
    if (stage > 1) {
        const n = Math.min(40, (stage - 1) * 5);
        G.level += n;
        G.xpNext = xpForLevel(G.level);
        G.pendingLevelUps = n;
    }
    startStage(stage);
}

export function continueRun(snap) {
    if (isDeadRun(snap)) return false;
    G.runId = snap.runId || runToken(snap);
    configureCaps();
    refreshGore();
    G.damageBy = {};
    createPlayer();
    restoreBuild(snap);
    startStage(snap.stage, true);
    return true;
}

export function retryStage() {
    // Death ends the build; this compatibility name now starts a new run.
    return newRun(1);
}

export function startStage(stage, restored = false) {
    if (G.player?.dead || deadRuns.has(G.runId)) return false;
    G.stage = stage;
    prepareBossSheets(stage);
    clearWorld();
    resetSpawner();
    invalidateStageVisuals();
    for (const w of G.weapons) { w.fusionCores = null; w.follow = null; w.cd = 0.5; w.activeT = 0; w.burst = 0; }
    const p = G.player;
    p.x = 0; p.y = 0; p.dead = false; p.iframes = 1.5;
    recomputeStats(true);
    resetPets();
    G.camera.x = 0; G.camera.y = -20;
    G.time = 0;
    G.mode = 'play';
    G.paused = false;
    G.stageKillsStart = G.kills;
    G.settlement = null;
    G.stageStartTime = performance.now();
    clearTimer = 0;
    stageSnapshot = { ...snapshotBuild(), runId: G.runId };
    saveRun(stageSnapshot);
    audio.setBGMRate(1);
    audio.playBGM();
    emit('stageStart', stage, restored);
}

export function step(dt) {
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

    updatePlayer(dt);
    if (G.mode !== 'dead') updatePets(dt);
    if (G.mode === 'play' || G.mode === 'boss') updateSpawner(dt);
    updateEnemies(dt);
    flushExplosions();
    if (G.mode !== 'dead') updateWeapons(dt);
    updateShots(dt);
    updateEnemyShots(dt);
    updateHazards(dt);
    if (G.mode !== 'dead') updatePickups(dt);
    if (G.boss) G.boss.update(dt);
    updateEffects(dt);

    // 레벨업 대기열 → UI
    if (G.pendingLevelUps > 0 && G.mode !== 'dead') {
        G.pendingLevelUps--;
        emit('levelUp', { choiceSessionId: `choice:${++G.choiceEventSerial}` });
        return;
    }

    if (G.mode === 'play' && G.time >= STAGES[G.stage].duration) {
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
    G.mode = 'clearing';
    clearTimer = 0;
    magnetAll();
    // 남은 적은 무너져 내림
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (e.alive) { e.alive = false; e.state = 'dead'; e.anim = 0; e.animT = 0; e.deadT = 0; }
    }
}

export function onPlayerDeath() {
    if (G.mode === 'dead') return;
    invalidateDeadRun();
    G.mode = 'dead';
    G.deadT = 0;
    G.deathShown = false;
    audio.setBGMRate(0.8);
}
