import { G } from './state.js';
import { save } from '../core/save.js';
import { healPlayer } from './player.js';
import { hitEnemy } from './enemies.js';
export const PET_POWER = Object.freeze({ cooldown: 0.9, range: 180, coinRange: 180, targets: 3, damage: 14, levelDamage: 0.8, maxLevel: 30, heal: 3, healInterval: 6 });
let pet = null;
let portrait = null;
// Optional profile-faithful art can be registered by the asset loader.
export function setPetImage(image) { portrait = image; }
export function resetPets() { pet = null; }
export function updatePets(dt) {
    if (!G.player || G.player.dead || save.equippedPet !== 'pet_yeongnyang' || !save.inventory.includes('pet_yeongnyang')) { pet = null; return; }
    const p = G.player;
    if (!pet) pet = { x: p.x - 32, y: p.y + 10, cd: 0.6, healCd: PET_POWER.healInterval, swipe: 0 };
    const tx = p.x - (p.flip ? -34 : 34), ty = p.y + 8;
    if (Math.hypot(tx - pet.x, ty - pet.y) > 300) { pet.x = tx; pet.y = ty; }
    const blend = 1 - Math.exp(-7 * dt);
    pet.x += (tx - pet.x) * blend; pet.y += (ty - pet.y) * blend;
    pet.healCd -= dt;
    if (pet.healCd <= 0) { healPlayer(PET_POWER.heal); pet.healCd = PET_POWER.healInterval; }
    pet.cd -= dt; pet.swipe = Math.max(0, pet.swipe - dt);
    // Coin help is local and bounded; pet never auto-collects chests or dangerous pickups.
    for (let i = 0; i < G.pickups.count; i++) {
        const c = G.pickups.items[i];
        if (c.kind === 'coin' && Math.hypot(c.x - pet.x, c.y - pet.y) < PET_POWER.coinRange) c.pull = true;
    }
    if (pet.cd > 0) return;
    // Select at most three nearest targets; one bounded scan, no projectile swarm.
    const targets = [];
    for (let i = 0; i < G.enemies.count; i++) {
        const e = G.enemies.items[i];
        if (!e.alive) continue;
        const distance = Math.hypot(e.x - pet.x, e.y - pet.y);
        if (distance >= PET_POWER.range) continue;
        let at = targets.findIndex(t => distance < t.distance);
        if (at < 0) at = targets.length;
        if (at < PET_POWER.targets) targets.splice(at, 0, { enemy: e, distance });
        if (targets.length > PET_POWER.targets) targets.pop();
    }
    if (targets.length) {
        pet.cd = PET_POWER.cooldown; pet.swipe = 0.18;
        pet.targetX = targets[0].enemy.x; pet.targetY = targets[0].enemy.y - targets[0].enemy.radius;
        const damage = (PET_POWER.damage + Math.min(G.level, PET_POWER.maxLevel) * PET_POWER.levelDamage) * p.stats.might;
        for (const { enemy } of targets) hitEnemy(enemy, damage, { weapon: 'pet_yeongnyang', silent: true, slow: 0.25 });
    } else pet.cd = 0.15;
}
export function drawPets(ctx, image = portrait) {
    if (!pet) return;
    const x = pet.x, y = pet.y + Math.sin(G.clock * 6) * 1.5;
    ctx.save();
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(x, y + 2, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (image?.complete && image.naturalWidth) {
        const scale = Math.min(52 / image.naturalWidth, 66 / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, x - w / 2, y - h, w, h);
    } else {
        // Tiny profile-based fallback: white fluffy cat, navy crescent hat, violet orb.
        ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x, y - 30); ctx.lineTo(x + 15, y); ctx.fill();
        ctx.fillStyle = '#fff5f8'; ctx.beginPath(); ctx.ellipse(x, y - 16, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        for (const dir of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + dir * 5, y - 22); ctx.lineTo(x + dir * 12, y - 33); ctx.lineTo(x + dir * 14, y - 17); ctx.fill(); }
        ctx.fillStyle = '#ad78c8'; ctx.fillRect(x - 8, y - 18, 5, 2); ctx.fillStyle = '#d0a85e'; ctx.fillRect(x + 3, y - 18, 5, 2);
        ctx.fillStyle = '#f2aec2'; ctx.fillRect(x - 1, y - 13, 3, 2);
        ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(x - 14, y - 25); ctx.lineTo(x + 1, y - 45); ctx.lineTo(x + 17, y - 38); ctx.lineTo(x + 8, y - 36); ctx.lineTo(x + 13, y - 25); ctx.fill();
        ctx.fillStyle = '#f6ce73'; ctx.font = '12px serif'; ctx.fillText('☾', x - 5, y - 30);
        ctx.fillStyle = '#b98bea'; ctx.beginPath(); ctx.arc(x, y - 3, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (pet.swipe > 0) {
        ctx.globalAlpha = pet.swipe / 0.18; ctx.strokeStyle = '#dcb6ff'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 4, y - 15); ctx.lineTo(pet.targetX + i * 4, pet.targetY); ctx.stroke(); }
    }
    ctx.restore();
}
