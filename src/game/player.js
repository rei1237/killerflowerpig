import { drawAppearance } from './player-appearance.js';
import { constrainEncirclementPlayer } from './encirclement.js';
import { accessoryStats, activeAccessory, accessoryEquipHP } from '../core/accessories.js';
// 플레이어(연이): 8방향 이동, 피격/무적, 재생, 패시브·영구강화 반영 스탯
import { G, emit } from './state.js';
import { playerMove } from '../core/input.js';
import { atlases, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { relicStats } from '../data/relics.js';
import { upgradeLevel, save, onCosmeticsChanged } from '../core/save.js';
import { characterProgress, characterStatBonus } from '../core/character-progression.js';
import { MAGAZINE_BONUS, PASSIVE_TUNING } from '../data/weapons.js';
import { applyTechPlayerBonus, resonanceTier } from './tech.js';
import { blood, flash, shake, damageText, hitstop, sparks, floatText } from './effects.js';
import { activeOutfit, outfitStats, incomingOutfitDamage } from './cosmetic-effects.js';
import { thornGuardReduction } from './thorn-charges.js';
// 꽃가루 장막 재충전 시간 (패시브 Lv 0~5)
export const POLLEN_BARRIER_CD = Object.freeze([0, 12, 10, 8.5, 7, 6]);
const POLLEN_PUSH_RADIUS = 120;

import { markPlayerShot, PLAYER_HIT_RADIUS, advancePlayerMovement } from './player-motion.js';

const BASE = { hp: 100, speed: 135, magnet: 70, radius: PLAYER_HIT_RADIUS };

function refreshEquippedOutfit() {
    const p = G.player;
    if (p?.stats && !p.dead && (activeOutfit(save)?.id || null) !== (p.outfitId || null)) recomputeStats();
}

onCosmeticsChanged(() => {
    // Paused live runs need the new values immediately, before their next frame.
    if (['play', 'boss', 'clearing'].includes(G.mode)) refreshEquippedOutfit();
});

export function createPlayer() {
    G.player = {
        x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100,
        radius: BASE.radius,
        facingX: 1, facingY: 0, flip: false,
        iframes: 0, hurtT: 0,
        anim: 0, animT: 0,
        shotAt: -Infinity, shotFlip: false, attackPose: null,
        outfitId: null, outfitGuardHitAt: -Infinity,
        trailT: 0,
        stats: null,
        dead: false,
    };
    recomputeStats(true);
}

// 패시브/영구강화 → 최종 배율
// 기본 치명타 피해 배율 (3배)
export const BASE_CRIT_MUL = 3;

export function recomputeStats(fullHeal = false) {
    const p = G.player;
    const lv = (id) => G.passives[id] || 0;
    const ch = characterStatBonus(characterProgress(save.characterXP).level); // 영구 캐릭터 레벨 기본 능력치
    const s = {
        might: 1 + lv('whet') * 0.1 + upgradeLevel('might') * 0.05 + ch.might,
        area: 1 + lv('spread') * PASSIVE_TUNING.spread,
        cooldown: 1 - lv('nose') * PASSIVE_TUNING.coilCooldown,
        // 꽃가루 장막: 피격 1회 차단 보호막 재충전 시간 (0이면 없음)
        barrierCd: POLLEN_BARRIER_CD[lv('pollen')] || 0,
        duration: 1,
        growth: 1 + lv('sap') * 0.08,
        projSpeed: 1 + lv('scope') * 0.05,
        pierce: Math.ceil(lv('scope') / 2),
        amount: 0, // 다른 출처의 고정 투사체 보너스
        amountMul: MAGAZINE_BONUS[lv('magazine')] || 0, // 탄창 확장: 투사체 비례 보너스
        crit: lv('focus') * PASSIVE_TUNING.focus,
        regen: lv('regen') * 0.3,
        magnet: BASE.magnet * (1 + lv('nose') * PASSIVE_TUNING.coilMagnet + upgradeLevel('magnet') * 0.1),
        speed: BASE.speed * (1 + lv('madness') * 0.07 + upgradeLevel('speed') * 0.04 + ch.speed),
        armor: lv('hide') * PASSIVE_TUNING.hide,
        damageReduction: lv('hide') * PASSIVE_TUNING.hideReduction,
        maxHp: BASE.hp + lv('heart') * 20 + upgradeLevel('maxHp') * 10 + ch.maxHp,
        greed: 1 + upgradeLevel('greed') * 0.1,
        critMul: BASE_CRIT_MUL,
    };
    applyTechPlayerBonus(s);
    p.techTier = resonanceTier();
    Object.assign(s, relicStats(s, save));
    Object.assign(s, accessoryStats(s, save));
    Object.assign(s, outfitStats(s, save));
    const outfitId = activeOutfit(save)?.id || null;
    if (outfitId !== (p.outfitId || null)) p.outfitGuardHitAt = -Infinity;
    p.outfitId = outfitId;
    const accessoryId = activeAccessory(save)?.id || null;
    const accessoryChanged = accessoryId !== (p.accessoryId || null);
    p.accessoryId = accessoryId;
    const oldMax = p.maxHp;
    p.stats = s;
    p.maxHp = s.maxHp;
    if (fullHeal) p.hp = p.maxHp;
    else if (accessoryChanged) p.hp = accessoryEquipHP(p.hp, p.maxHp);
    else if (p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
    p.hp = Math.min(p.hp, p.maxHp);
}

export function updatePlayer(dt) {
    const p = G.player;
    if (p.dead) return;
    refreshEquippedOutfit();
    // 테크 공명 단계가 바뀌면(무기 획득·융합 포함) 캐릭터 보너스를 다시 계산
    if (G.tech && resonanceTier() !== p.techTier) recomputeStats();
    const s = p.stats;
    advancePlayerMovement(p, playerMove(0), dt);
    constrainEncirclementPlayer();

    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (s.barrierCd > 0 && !p.barrier) {
        p.barrierT = Math.min(p.barrierT ?? s.barrierCd, s.barrierCd) - dt;
        if (p.barrierT <= 0) { p.barrier = true; p.barrierT = s.barrierCd; }
    }
    if (s.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + s.regen * dt);
}

export function damagePlayer(amount, srcX, srcY) {
    const p = G.player;
    if (p.dead || p.iframes > 0) return false;
    if (p.barrier) {
        // 꽃가루 장막이 피해를 대신 받고 주변 적을 밀쳐낸다
        p.barrier = false;
        p.barrierT = p.stats.barrierCd;
        p.iframes = 0.6;
        pollenBurst(p);
        return true;
    }
    // 연꽃 가시 '만개 수호': 준비된 꽃잎 수만큼 받는 피해 감소
    const dmg = incomingOutfitDamage(amount, p.stats.armor, p.stats.outfitDamageMultiplier) * (1 - thornGuardReduction()) * (1 - Math.min(.5, p.stats.damageReduction || 0));
    p.iframes = 0.5;
    p.hurtT = 0.25;
    if (G.godMode) return true;
    p.hp -= dmg;
    if (p.outfitId === 'jade_lotus_guard') p.outfitGuardHitAt = G.clock;
    audio.sfx('hurt');
    flash(0.35, '#ff0022');
    shake(5);
    blood(p.x, p.y - 18, 6, (p.x - srcX) / 100 || 0, (p.y - srcY) / 100 || 0, '#c2185b');
    damageText(p.x, p.y - 40, dmg, false, '#ff5577');
    if (p.hp <= 0) {
        p.hp = 0;
        p.dead = true;
        hitstop(0.25);
        shake(14);
        blood(p.x, p.y - 20, 30, 0, 0, '#c2185b');
        emit('death');
    }
    return true;
}

export function healPlayer(amount) {
    const p = G.player;
    if (p.dead) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (p.hp > before) damageText(p.x, p.y - 44, p.hp - before, false, '#5dff7a');
}

export function triggerPlayerShot(dx) {
    markPlayerShot(G.player, G.clock, dx);
}

function pollenBurst(p) {
    audio.sfx('heal');
    sparks(p.x, p.y - 22, 14, '#ffe27a', 220);
    floatText(p.x, p.y - 58, '🌼 꽃가루 장막!', '#ffe27a', 0.9);
    for (let i = 0; i < G.enemies.count; i++) {
        const e = G.enemies.items[i];
        if (!e.alive) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > POLLEN_PUSH_RADIUS) continue;
        const kb = 320 / (e.mass || 1);
        e.kx += dx / d * kb; e.ky += dy / d * kb;
    }
}

export function drawPlayer(ctx) {
    const p = G.player;
    if (p.barrier) {
        // 장막 준비 완료: 은은한 금빛 고리
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(G.clock * 4) * 0.1;
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 24, 26, 30, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    const atlas = atlases.player;
    if (!atlas && !images.playerFire && !images.playerLotusFire) return;
    const blink = p.iframes > 0 && Math.floor(G.clock * 20) % 2 === 0;
    const tint = p.hurtT > 0 ? 'flash' : 'normal';
    if (blink && p.hurtT <= 0) ctx.globalAlpha = 0.55;
    drawAppearance(ctx, { x: p.x, y: p.y, clock: G.clock, player: p, appearance: save.equippedCosmetics, tint });
    ctx.globalAlpha = 1;
}
