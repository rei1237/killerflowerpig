import { constrainEncirclementPlayer } from './encirclement.js';
import { accessoryStats, activeAccessory, accessoryEquipHP } from '../core/accessories.js';
// 플레이어(연이): 8방향 이동, 피격/무적, 재생, 패시브·영구강화 반영 스탯
import { G, emit } from './state.js';
import { input } from '../core/input.js';
import { atlases, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { relicStats } from '../data/relics.js';
import { upgradeLevel, save } from '../core/save.js';
import { MAGAZINE_TABLE } from '../data/weapons.js';
import { applyTechPlayerBonus, resonanceTier } from './tech.js';
import { blood, flash, shake, damageText, hitstop } from './effects.js';

import { shotFrame, firingDrawRect, markPlayerShot, PLAYER_HIT_RADIUS, playerBob, advancePlayerMovement } from './player-motion.js';

const BASE = { hp: 100, speed: 135, magnet: 70, radius: PLAYER_HIT_RADIUS };

export function createPlayer() {
    G.player = {
        x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100,
        radius: BASE.radius,
        facingX: 1, facingY: 0, flip: false,
        iframes: 0, hurtT: 0,
        anim: 0, animT: 0,
        shotAt: -Infinity, shotFlip: false,
        trailT: 0,
        stats: null,
        dead: false,
    };
    recomputeStats(true);
}

// 패시브/영구강화 → 최종 배율
export function recomputeStats(fullHeal = false) {
    const p = G.player;
    const lv = (id) => G.passives[id] || 0;
    const s = {
        might: 1 + lv('whet') * 0.1 + upgradeLevel('might') * 0.05,
        area: 1 + lv('spread') * 0.1,
        cooldown: Math.max(0.4, 1 - lv('pollen') * 0.07),
        duration: 1,
        growth: 1 + lv('sap') * 0.08,
        projSpeed: 1 + lv('scope') * 0.05,
        pierce: Math.ceil(lv('scope') / 2),
        amount: MAGAZINE_TABLE[lv('magazine')] || 0,
        crit: lv('focus') * 0.07,
        regen: lv('regen') * 0.3,
        magnet: BASE.magnet * (1 + lv('nose') * 0.3 + upgradeLevel('magnet') * 0.1),
        speed: BASE.speed * (1 + lv('madness') * 0.07 + upgradeLevel('speed') * 0.04),
        armor: lv('hide'),
        maxHp: BASE.hp + lv('heart') * 20 + upgradeLevel('maxHp') * 10,
        greed: 1 + upgradeLevel('greed') * 0.1,
        critMul: 2,
    };
    applyTechPlayerBonus(s);
    p.techTier = resonanceTier();
    Object.assign(s, relicStats(s, save));
    Object.assign(s, accessoryStats(s, save));
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
    const s = p.stats;
    // 테크 공명 단계가 바뀌면(무기 획득·융합 포함) 캐릭터 보너스를 다시 계산
    if (G.tech && resonanceTier() !== p.techTier) recomputeStats();
    advancePlayerMovement(p, input.move, dt);
    constrainEncirclementPlayer();

    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (s.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + s.regen * dt);
}

export function damagePlayer(amount, srcX, srcY) {
    const p = G.player;
    if (p.dead || p.iframes > 0) return false;
    const dmg = Math.max(1, amount - p.stats.armor);
    p.iframes = 0.5;
    p.hurtT = 0.25;
    if (G.godMode) return true;
    p.hp -= dmg;
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

export function drawPlayer(ctx) {
    const p = G.player;
    const atlas = atlases.player;
    if (!atlas && !images.playerFire) return;
    const blink = p.iframes > 0 && Math.floor(G.clock * 20) % 2 === 0;
    const tint = p.hurtT > 0 ? 'flash' : 'normal';
    if (blink && p.hurtT <= 0) ctx.globalAlpha = 0.55;
    const bob = playerBob(p,G.clock);
    if (images.playerFire) {
        const frame = shotFrame(G.clock - p.shotAt);
        const flip = frame ? p.shotFlip : p.flip;
        ctx.save();
        ctx.translate(p.x, p.y - bob);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(tint === 'flash' ? images.playerFireFlash : images.playerFire, ...firingDrawRect(frame));
        ctx.restore();
    } else {
        atlas.draw(ctx, 'walk', p.anim, p.x, p.y - bob, 0.48, p.flip, tint);
    }
    ctx.globalAlpha = 1;
}
