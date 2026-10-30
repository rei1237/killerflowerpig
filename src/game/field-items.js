// 필드 보급품: 레벨업이 비싸진 대신(경험치 ×2.5), 구역 지도마다 장비 보급품이 3개 놓인다(1·2구역 2개, 2P는 +2). 한 번에 하나씩 나타난다.
// 직접 걸어가 주우면 장비 선택 1회(2P 영냥이가 주우면 영냥이 성장 선택 1회). 성장하려면 지도를 보고 찾아가야 한다.
// tools/run-progression-audit.mjs 기준 런당 선택 약 37회 중 보급품 28회 · 경험치 약 9회.
// 지도(미니맵)와 화면 가장자리 화살표가 위치를 알려 준다.
import { G } from './state.js';
import { dropPickup } from './pickups.js';
import { floatText, sparks } from './effects.js';
import { audio } from '../core/audio.js';
import { fx } from '../core/assets.js';

export const FIELD_ITEM = Object.freeze({ kind: 'cache', firstDelay: 10, respawn: 18, perStage: 3, coopBonus: 2, minDistance: 520, maxDistance: 1050, reach: 26 });
// 구역별 보급품 수: 짧은 1·2구역은 2개(초반 2구역 보스 상자 진화 폭주 방지), 3구역부터 3개. 2P는 +2.
export const FIELD_ITEMS_BY_STAGE = Object.freeze([0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3]);
export const fieldItemsForStage = (stage, coop = false) => (FIELD_ITEMS_BY_STAGE[stage] ?? FIELD_ITEM.perStage) + (coop ? FIELD_ITEM.coopBonus : 0);
let timer = FIELD_ITEM.firstDelay, spawned = 0;

export function resetFieldItems() { timer = FIELD_ITEM.firstDelay; spawned = 0; }
export const fieldItemsPerStage = () => fieldItemsForStage(G.stage, !!G.coop);
export const fieldItemsLeft = () => Math.max(0, fieldItemsPerStage() - spawned) + (fieldItem() ? 1 : 0);
export function fieldItem() {
    for (let i = 0; i < G.pickups.count; i++) if (G.pickups.items[i].kind === FIELD_ITEM.kind) return G.pickups.items[i];
    return null;
}

export function updateFieldItems(dt, random = Math.random) {
    if (!['play', 'boss'].includes(G.mode) || !G.player || G.player.dead || fieldItem() || spawned >= fieldItemsPerStage()) return null;
    timer -= dt;
    if (timer > 0) return null;
    timer = FIELD_ITEM.respawn;
    spawned++;
    const p = G.player, a = random() * Math.PI * 2;
    const d = FIELD_ITEM.minDistance + random() * (FIELD_ITEM.maxDistance - FIELD_ITEM.minDistance);
    const it = dropPickup(FIELD_ITEM.kind, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.75);
    floatText(p.x, p.y - 80, '📦 이 구역의 장비 보급품! 지도·화살표를 따라가세요', '#ffe28a', 1.6);
    audio.sfx('warn');
    return it;
}

// 줍기: 1P면 장비 선택, 2P면 영냥이 성장 선택
export function claimFieldItem(it, byPartner = false) {
    if (byPartner && G.partner) {
        G.partner.pendingLevelUps++;
        floatText(G.partner.x, G.partner.y - 70, '📦 보급품 · 영냥이 성장 선택 +1', '#e8dcff', 1.4);
    } else {
        G.pendingLevelUps++;
        floatText(G.player.x, G.player.y - 70, '📦 보급품 · 장비 선택 +1', '#ffe28a', 1.4);
    }
    sparks(it.x, it.y - 16, 16, '#ffe28a', 220);
    audio.sfx('chest');
    timer = FIELD_ITEM.respawn;
    return true;
}

// 보급품 그림: 금빛 빛기둥 + 회수 물자 상자 그림 + 이름표 (멀리서도 알아보게)
export function drawFieldItem(ctx, it, t, glow) {
    const bob = Math.sin(t * 3) * 2, pulse = 0.5 + Math.sin(t * 4) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = '#ffe28a';
    ctx.fillRect(it.x - 6, it.y - 140, 12, 130);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glow('#ffd76a', 48), it.x - 48, it.y - 62, 96, 96);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.5 + pulse * 0.4; ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(it.x, it.y - 2, 22 + pulse * 5, 9 + pulse * 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // 상자 그림: 기존 회수 물자 상자 이미지(asset/items/salvage-cache.png). 로드 실패 시 단순 도형으로 대신한다.
    const art = fx.supplyCache, size = 52;
    const y = art ? it.y - size + 6 + bob : it.y - 30 + bob;
    if (art) ctx.drawImage(art, it.x - size / 2, y, size, size);
    else {
        ctx.fillStyle = '#6b4a1f'; ctx.fillRect(it.x - 15, y, 30, 22);
        ctx.fillStyle = '#b07b33'; ctx.fillRect(it.x - 15, y, 30, 7);
        ctx.fillStyle = '#ffe28a'; ctx.fillRect(it.x - 2, y, 4, 22); ctx.fillRect(it.x - 15, y + 9, 30, 3);
    }
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#ffe9a8';
    ctx.strokeText('장비 보급', it.x, y - 10); ctx.fillText('장비 보급', it.x, y - 10);
    ctx.restore();
}

// 화면 밖 보급품: 화면 가장자리에 금빛 화살표 + 거리 (월드 좌표계에서 그린다)
export function drawFieldItemPointer(ctx, cam, view) {
    const it = fieldItem();
    if (!it) return;
    // 세로 화면은 위쪽 HUD·아래쪽 2P 카드가 크므로 화살표를 그 안쪽에 둔다
    const portrait = view.h > view.w;
    const hw = view.w / 2 - 34, top = view.h * (portrait ? 0.27 : 0.12), bottom = view.h * (portrait ? 0.2 : 0.1);
    const dx = it.x - cam.x, dy = it.y - 20 - cam.y;
    if (Math.abs(dx) < view.w / 2 - 14 && dy > -view.h / 2 + 10 && dy < view.h / 2 - 10) return;
    const hh = dy < 0 ? view.h / 2 - top : view.h / 2 - bottom;
    const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    const x = cam.x + dx * k, y = cam.y + dy * k, a = Math.atan2(dy, dx);
    const meters = Math.round(Math.hypot(it.x - G.player.x, it.y - G.player.y) / 20);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#ffe28a'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-a);
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#ffe9a8';
    const ty = Math.sin(a) > 0.3 ? -16 : 22;
    ctx.strokeText(`📦 ${meters}m`, 0, ty); ctx.fillText(`📦 ${meters}m`, 0, ty);
    ctx.restore();
}
