import { G, emit } from './state.js';
import { hitEnemy } from './enemies.js';
import { petals, floatText } from './effects.js';
import { save } from '../core/save.js';
import { characterProgress, petalStats } from '../core/character-progression.js';
import { createPetalCharge, chargePetal, spendPetal, PETAL_MAX_CHARGE } from './petal-charge.js';

let charge = createPetalCharge();
let firing = false;
let wave = null;
const active = () => (G.mode === 'play' || G.mode === 'boss') && !G.paused && !!G.player && !G.player.dead && G.player.hp > 0;
export function resetPetalCannon() { charge = createPetalCharge(); charge.lastKill = G.kills; firing = false; wave = null; }
export function creditPetalKill(enemy) {
    return chargePetal(charge, { killCount: G.kills, elite: !!enemy?.elite, active: active(), cannonKill: firing });
}
export function getPetalStatus() {
    const growth = characterProgress(save.characterXP);
    return { ...growth, ...petalStats(growth.level), charge: charge.charge, maxCharge: PETAL_MAX_CHARGE,
        normalized: charge.charge / PETAL_MAX_CHARGE, ready: charge.charge >= PETAL_MAX_CHARGE,
        canFire: active() && !firing && charge.charge >= PETAL_MAX_CHARGE };
}
export function firePetalCannon() {
    if (firing || !spendPetal(charge, { active: active() })) return false;
    // Debit before any damage/events: repeated click, key-repeat and reentrant kills
    // cannot spend again or recharge from this cannon's own kills.
    firing = true;
    const p = G.player, stats = getPetalStatus();
    wave = { x: p.x, y: p.y, radius: stats.radius, born: G.clock };
    try {
        const targets = G.enemies.items.slice(0, G.enemies.count).filter(e => e.alive && Math.hypot(e.x - p.x, e.y - p.y) <= stats.radius + e.radius);
        for (const e of targets) {
            const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
            hitEnemy(e, stats.damage, { weapon: 'petalCannon', kx: (e.x - p.x) / d, ky: (e.y - p.y) / d, knock: 150 });
        }
        const b = G.boss;
        if (b?.alive && Math.hypot(b.x - p.x, b.y - p.y) <= stats.radius + b.radius) b.hurt(stats.damage, { weapon: 'petalCannon' });
        petals(p.x, p.y, G.lowQ ? 18 : 36);
        floatText(p.x, p.y - 55, '꽃잎포!', '#ffb4df', 0.8);
        emit('petalFired', stats);
    } finally { firing = false; }
    return true;
}
// Draw in world coordinates after characters. No external image assets required.
export function drawPetalCannon(ctx) {
    if (!wave) return;
    const t = (G.clock - wave.born) / 0.65;
    if (t >= 1 || t < 0) { wave = null; return; }
    const r = wave.radius * Math.min(1, t * 2.5), alpha = (1 - t) * 0.8;
    ctx.save(); ctx.translate(wave.x, wave.y); ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffd1e8'; ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < (G.lowQ ? 16 : 28); i++) {
        const a = i * Math.PI * 2 / (G.lowQ ? 16 : 28) + t * 0.6;
        ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a + Math.PI / 4);
        ctx.fillStyle = i % 2 ? '#ff75bd' : '#ffe0ef'; ctx.beginPath(); ctx.ellipse(0, 0, 5 + 5 * (1 - t), 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
}
