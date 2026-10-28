import { hasRunReward } from '../core/run-rewards.js';
import { FIELD_ITEM, claimFieldItem, drawFieldItem } from './field-items.js';
import { addPartnerXP, partnerMagnet } from './coop.js';
import { PARTNER_XP } from '../data/partner-kit.js';
// 경험치 젬 + 필드 아이템(고기/자석/다이너마이트/관 상자)
import { G, rand, emit } from './state.js';
import { fx, glow } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { addXP } from './progression.js';
import { healPlayer } from './player.js';
import { flash, shake, floatText, sparks } from './effects.js';
import { earnCoins, save } from '../core/save.js';
import { hitEnemy } from './enemies.js';
import { SUPPLY_RULES } from './supply-drops.js';

export const PICKUP_ASSIST = Object.freeze({ gemMultiplier: 1.2, coinMultiplier: 1.5 });

function tierOf(v) { return v < 4 ? 0 : v < 20 ? 1 : 2; }

export function dropGem(x, y, value) {
    const pool = G.gems;
    if (pool.count >= G.caps.gems) {
        // 젬이 너무 많으면 기존 젬에 합산 (뱀서 방식) → 렌더/업데이트 비용 고정
        const g = pool.items[(Math.random() * pool.count) | 0];
        g.value += value;
        g.tier = tierOf(g.value);
        return;
    }
    const g = pool.spawn();
    g.x = x + rand(-4, 4); g.y = y + rand(-4, 4);
    g.value = value; g.tier = tierOf(value);
    g.pull = false; g.speed = 0; g.toPartner = false;
    g.phase = Math.random() * 6.28;
}

// Abandoned supplies must not permanently occupy bounded field budgets.
export function pruneFieldSupplies() {
    const p = G.player;
    if (!p) return;
    const range = Math.max(900, (G.view.w || 0) + (G.view.h || 0));
    for (let i = G.pickups.count - 1; i >= 0; i--) {
        const it = G.pickups.items[i];
        const offscreen = Math.abs(it.x-p.x) > (G.view.w || 0)/2+48 || Math.abs(it.y-p.y) > (G.view.h || 0)/2+48;
        if ((it.kind === 'meat' || it.kind === 'magnet') && ((offscreen && it.t >= SUPPLY_RULES.supplyLifetime) || Math.hypot(it.x-p.x,it.y-p.y) > range)) G.pickups.release(i);
    }
}

export function dropPickup(kind, x, y) {
    const p = G.pickups.spawn();
    p.kind = kind; p.x = x; p.y = y; p.t = 0; p.pull = false; p.speed = 0; p.boss = false; p.treasure = false; p.value = 0; p.rewardId = undefined;
    return p;
}

// Coins share the bounded pickup field; excess coins merge without losing value.
export function dropCoin(x, y, value = 1, rewardId) {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    if (rewardId) {
        if (hasRunReward(save,rewardId)) return null;
        for (let i=0;i<G.pickups.count;i++) if (G.pickups.items[i].kind === 'coin' && G.pickups.items[i].rewardId === rewardId) return G.pickups.items[i];
    }
    if (!rewardId && G.pickups.count >= 180) {
        for (let i = 0; i < G.pickups.count; i++) {
            const coin = G.pickups.items[i];
            if (coin.kind === 'coin' && !coin.rewardId) { coin.value += value; return coin; }
        }
    }
    const coin = dropPickup('coin', x, y);
    coin.value = value; coin.rewardId = rewardId;
    coin.retryAt = 0;
    return coin;
}

export function magnetAll() {
    const pool = G.gems;
    for (let i = 0; i < pool.count; i++) pool.items[i].pull = true;
    for (let i = 0; i < G.pickups.count; i++) if (G.pickups.items[i].kind === 'coin') G.pickups.items[i].pull = true;
}

// 다이너마이트: 필드의 엘리트·챔피언·보스를 제외한 모든 잡몹을 화면 밖까지 한 번에 처치한다.
export const DYNAMITE = Object.freeze({ waveSeconds: 0.7, waveRadius: 700 });
let wave = null;
export function detonate() {
    const p = G.player;
    flash(0.8, '#ffe2c4');
    shake(14);
    audio.sfx('explode');
    wave = { x: p.x, y: p.y - 14, t: 0 };
    sparks(p.x, p.y - 20, 18, '#ffb347', 320);
    floatText(p.x, p.y - 64, '💥 다이너마이트! 잡몹 전멸', '#ffb347', 1.6);
    const pool = G.enemies;
    let killed = 0;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (!e.alive || e.elite || e.champion) continue;
        hitEnemy(e, e.hp + 1, { silent: true, bomb: true, kx: Math.sign(e.x - p.x), ky: Math.sign(e.y - p.y), knock: 120 });
        killed++;
    }
    if (killed) floatText(p.x, p.y - 44, `${killed}마리 처치`, '#fff1c9', 1.4);
}

let nextStorageNotice = -Infinity;
function collect(item) {
    switch (item.kind) {
        case 'coin': {
            const value = Math.max(1, Math.round(item.value * G.player.stats.greed));
            if (item.retryAt > G.clock) return false;
            if (item.rewardId && hasRunReward(save,item.rewardId)) break;
            if (!earnCoins(value, item.rewardId)) {
                item.retryAt = G.clock + 2;
                if (G.clock >= nextStorageNotice) { nextStorageNotice = G.clock + 6; emit('saveError'); }
                return false;
            }
            G.gold += value;
            audio.sfx('pickup');
            floatText(G.player.x, G.player.y - 44, `+${value}`, '#ffd877');
            break;
        }
        case 'meat':
            if (G.player.dead || G.player.hp >= G.player.maxHp) return false;
            healPlayer(30); audio.sfx('heal'); break;
        case 'magnet': magnetAll(); audio.sfx('pickup'); floatText(G.player.x, G.player.y - 60, '굶주림!', '#ff8fa3'); break;
        case 'bomb': detonate(); break;
        case 'chest': audio.sfx('chest'); emit('chest', item.boss ? 'boss' : item.treasure ? 'treasure' : 'elite'); break;
        default: break;
    }
    return true;
}

export function updatePickups(dt) {
    pruneFieldSupplies();
    if (wave && (wave.t += dt) >= DYNAMITE.waveSeconds) wave = null;
    const p = G.player;
    const mr = p.stats.magnet;
    const collection = Math.max(1, Math.min(1.25, p.stats.pickupMultiplier || 1));
    const mr2 = (mr * PICKUP_ASSIST.gemMultiplier * collection) ** 2;
    const pool = G.gems;
    const py = p.y - 14;
    // 2P 협동: 영냥이도 가까운 젬을 끌어와 먹는다. 주운 쪽이 100%, 다른 쪽이 PARTNER_XP.share 만큼 받는다.
    const q = G.coop && G.partner && !G.partner.dead ? G.partner : null;
    const qr2 = q ? partnerMagnet(q) ** 2 : 0, qy = q ? q.y - 14 : 0;
    for (let i = pool.count - 1; i >= 0; i--) {
        const g = pool.items[i];
        if (q && !g.pull && (q.x - g.x) ** 2 + (qy - g.y) ** 2 < qr2) { g.pull = true; g.toPartner = true; }
        const toQ = q && g.toPartner;
        const dx = (toQ ? q.x : p.x) - g.x, dy = (toQ ? qy : py) - g.y;
        const d2 = dx * dx + dy * dy;
        if (!g.pull && d2 < mr2) { g.pull = true; g.toPartner = false; }
        if (g.pull) {
            const d = Math.sqrt(d2) || 1;
            g.speed = Math.min(900, g.speed + 1400 * dt);
            const step = Math.min(d, g.speed * dt);
            g.x += (dx / d) * step;
            g.y += (dy / d) * step;
            if (d < 14) {
                if (toQ) { addPartnerXP(g.value); addXP(g.value * PARTNER_XP.share); }
                else { addXP(g.value); if (q) addPartnerXP(g.value * PARTNER_XP.share); }
                audio.sfx('gem');
                pool.release(i);
            }
        }
    }
    const pk = G.pickups;
    for (let i = pk.count - 1; i >= 0; i--) {
        const it = pk.items[i];
        it.t += dt;
        const dx = p.x - it.x, dy = py - it.y;
        const d = Math.hypot(dx, dy) || 1;
        // 필드 보급품: 끌려오지 않는다. 1P나 2P가 직접 밟아야 한다.
        if (it.kind === FIELD_ITEM.kind) {
            const byPartner = !!q && Math.hypot(q.x - it.x, qy - it.y) < FIELD_ITEM.reach;
            if ((!p.dead && d < FIELD_ITEM.reach) || byPartner) { claimFieldItem(it, byPartner && d >= FIELD_ITEM.reach); pk.release(i); }
            continue;
        }
        if (it.kind === 'meat' && (p.dead || p.hp >= p.maxHp)) { it.pull = false; it.speed = 0; continue; }
        if (!it.pull && d < (it.kind === 'coin' ? mr * PICKUP_ASSIST.coinMultiplier * collection : Math.max(40, mr * 0.6))) it.pull = true;
        // 보스 관은 잠시 후 플레이어에게 끌려옴 (놓치지 않게)
        if (!it.pull && it.boss && it.t > 1.6) it.pull = true;
        if (it.pull) {
            it.speed = Math.min(700, it.speed + 1000 * dt);
            const step = Math.min(d, it.speed * dt);
            it.x += (dx / d) * step;
            it.y += (dy / d) * step;
        }
        if (d < 18) {
            if (collect(it)) pk.release(i);
        }
    }
}

export function drawPickups(ctx, vx0, vy0, vx1, vy1) {
    const pool = G.gems;
    const imgs = fx.gems;
    const t = G.clock;
    for (let i = 0; i < pool.count; i++) {
        const g = pool.items[i];
        if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
        const img = imgs[g.tier];
        const bob = Math.sin(t * 4 + g.phase) * 1.5;
        ctx.drawImage(img, g.x - img.width / 2, g.y - img.height / 2 + bob);
    }
    const pk = G.pickups;
    for (let i = 0; i < pk.count; i++) {
        const it = pk.items[i];
        if (it.kind === 'coin') {
            if (it.x < vx0 || it.x > vx1 || it.y < vy0 || it.y > vy1) continue;
            const bob = Math.sin(t * 4 + i) * 2;
            ctx.save(); ctx.translate(it.x, it.y - 6 + bob);
            ctx.fillStyle = '#9f641d'; ctx.beginPath(); ctx.ellipse(0, 1, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.ellipse(0, -1, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff2b3'; ctx.fillRect(-1, -5, 2, 8);
            ctx.restore(); continue;
        }
        if (it.kind === FIELD_ITEM.kind) { drawFieldItem(ctx, it, t, glow); continue; }
        const bob = Math.sin(t * 3 + i) * 2;
        if (it.kind === 'bomb') { drawDynamite(ctx, it.x, it.y, t, bob); continue; }
        const img = it.kind === 'meat' ? fx.meat : it.kind === 'magnet' ? fx.magnet : fx.chest;
        if (it.kind === 'meat') {
            ctx.save(); ctx.strokeStyle = '#71ffae'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(it.x, it.y-4, 19, 9, 0, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#c3ffdf'; ctx.fillRect(it.x-2,it.y-43+bob,4,12); ctx.fillRect(it.x-6,it.y-39+bob,12,4); ctx.restore();
        }
        if (it.kind === 'chest') {
            ctx.globalCompositeOperation = 'lighter';
            const gl = glow(it.treasure ? '#ffd76a' : '#ff2244', it.treasure ? 52 : 40);
            ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
            ctx.drawImage(gl, it.x - 40, it.y - 52);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        if (img) ctx.drawImage(img, it.x - img.width / 2, it.y - img.height + bob);
    }
    if (wave) {
        const k = wave.t / DYNAMITE.waveSeconds;
        ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 10 * (1 - k) + 2;
        ctx.beginPath(); ctx.arc(wave.x, wave.y, 30 + k * DYNAMITE.waveRadius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
}

// 다이너마이트 아이콘: 붉은 막대 묶음 + 타오르는 심지, 맥박 치는 경고 고리와 이름표로 한눈에 알아보게 한다.
function drawDynamite(ctx, x, y, t, bob) {
    const pulse = 0.5 + Math.sin(t * 6) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    const gl = glow('#ff7a1a', 44);
    ctx.drawImage(gl, x - 44, y - 62);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.55 + pulse * 0.4; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 20 + pulse * 5, 9 + pulse * 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.translate(x, y - 22 + bob); ctx.rotate(Math.sin(t * 3) * 0.08);
    for (const dx of [-8, 0, 8]) { // 막대 3개
        ctx.fillStyle = '#b3201f'; ctx.fillRect(dx - 4, -13, 8, 26);
        ctx.fillStyle = '#e8453c'; ctx.fillRect(dx - 4, -13, 3, 26);
    }
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(-13, -5, 26, 5); // 묶음 띠
    ctx.strokeStyle = '#d9c9a3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(5, -21, 1, -27); ctx.stroke(); // 심지
    const fl = 3 + Math.sin(t * 25) * 1.5;
    ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(1, -28, fl, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(1, -28, fl * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#ffd9a0';
    ctx.strokeText('전멸', x, y - 52 + bob); ctx.fillText('전멸', x, y - 52 + bob); ctx.restore();
}
