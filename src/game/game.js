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
import { resetBuild, snapshotBuild, restoreBuild, xpForLevel } from './progression.js';
import { invalidateStageVisuals } from './render.js';
import { audio } from '../core/audio.js';
import { upgradeLevel } from '../core/save.js';

const RUN_KEY = 'kfp.run.v1';
let clearTimer = 0;
let heartbeatT = 0;
let stageSnapshot = null;

export function loadRun() {
    try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveRun(snap) { try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch { /* ignore */ } }
export function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ } }

export function newRun(stage = 1) {
    configureCaps();
    refreshGore();
    resetBuild();
    G.gold = 0;
    G.kills = 0;
    G.damageBy = {};
    G.rerolls = 2 + upgradeLevel('reroll');
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
    configureCaps();
    refreshGore();
    G.damageBy = {};
    createPlayer();
    restoreBuild(snap);
    startStage(snap.stage, true);
}

export function retryStage() {
    if (!stageSnapshot) return newRun(1);
    continueRun(stageSnapshot);
}

export function startStage(stage, restored = false) {
    G.stage = stage;
    clearWorld();
    resetSpawner();
    invalidateStageVisuals();
    for (const w of G.weapons) { w.follow = null; w.cd = 0.5; w.activeT = 0; w.burst = 0; }
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
    stageSnapshot = snapshotBuild();
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
        emit('levelUp');
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
    G.mode = 'dead';
    G.deadT = 0;
    G.deathShown = false;
    audio.setBGMRate(0.8);
}
