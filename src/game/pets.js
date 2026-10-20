import { petTrainingStats } from '../data/pet-upgrades.js';
import { images } from '../core/assets.js';
import { getPetSprite, loadPetSprite, petSpriteRect, petVisualLimits, PET_ANIMATION } from './pet-sprite.js';
import { G } from './state.js';
import { save } from '../core/save.js';
import { healPlayer } from './player.js';
import { hitEnemy } from './enemies.js';
import { preferredTarget } from './targeting.js';
export const PET_POWER = Object.freeze({ cooldown: 0.9, range: 180, coinRange: 180, targets: 3, damage: 14, levelDamage: 0.8, maxLevel: 30, heal: 3, healInterval: 6 });
let pet = null;
let portrait = null;
// Optional profile-faithful art can be registered by the asset loader.
export function setPetImage(image) { portrait = image; }
export function resetPets() { pet = null; }
export function updatePets(dt) {
    if (!G.player || G.player.dead || save.equippedPet !== 'pet_yeongnyang' || !save.inventory.includes('pet_yeongnyang')) { pet = null; return; }
    const p = G.player;
    const training = petTrainingStats(save);
    if (!pet) pet = { x: p.x - 32, y: p.y + 10, cd: 0.6, healCd: PET_POWER.healInterval, swipe: 0, animClock: 0, attackElapsed: 99, healElapsed: 99, moving: false, flip: p.flip };
    const tx = p.x - (p.flip ? -34 : 34), ty = p.y + 8;
    if (Math.hypot(tx - pet.x, ty - pet.y) > 300) { pet.x = tx; pet.y = ty; }
    pet.animClock += dt; pet.attackElapsed += dt; pet.healElapsed += dt;
    pet.moving = Math.hypot(tx - pet.x, ty - pet.y) > 5 || !!(p.vx || p.vy);
    pet.flip = p.flip;
    const blend = 1 - Math.exp(-7 * dt);
    pet.x += (tx - pet.x) * blend; pet.y += (ty - pet.y) * blend;
    pet.healCd -= dt;
    if (pet.healCd > 0 && pet.healCd <= PET_ANIMATION.healRelease && p.hp < p.maxHp) pet.healElapsed = PET_ANIMATION.healRelease - pet.healCd;
    if (pet.healCd <= 1e-9) { const hp = p.hp; healPlayer(training.heal); if (p.hp > hp) pet.healElapsed = PET_ANIMATION.healRelease; pet.healCd = PET_POWER.healInterval; }
    pet.cd -= dt; pet.swipe = Math.max(0, pet.swipe - dt);
    // Coin help is local and bounded; pet never auto-collects chests or dangerous pickups.
    for (let i = 0; i < G.pickups.count; i++) {
        const c = G.pickups.items[i];
        if (c.kind === 'coin' && Math.hypot(c.x - pet.x, c.y - pet.y) < training.coinRange) c.pull = true;
    }
    if (pet.cd > 1e-9) {
        if (pet.cd <= PET_ANIMATION.attackRelease) {
            if (!pet.windupChecked) {
                pet.windupChecked=true;
                for (let i=0;i<G.enemies.count;i++) { const e=G.enemies.items[i]; if(e.alive && Math.hypot(e.x-pet.x,e.y-pet.y)<PET_POWER.range){pet.winding=true;break;} }
                if (G.boss?.alive && Math.hypot(G.boss.x-pet.x,G.boss.y-pet.y)<PET_POWER.range) pet.winding=true;
            }
            if(pet.winding) pet.attackElapsed=PET_ANIMATION.attackRelease-pet.cd;
        }
        return;
    }
    pet.winding=false; pet.windupChecked=false;
    // Select at most three nearest targets; one bounded scan, no projectile swarm.
    const focused = preferredTarget(pet.x, pet.y, PET_POWER.range);
    const targets = focused ? [{ enemy: focused, distance: -1 }] : [];
    for (let i = 0; i < G.enemies.count; i++) {
        const e = G.enemies.items[i];
        if (!e.alive || e === focused) continue;
        const distance = Math.hypot(e.x - pet.x, e.y - pet.y);
        if (distance >= PET_POWER.range) continue;
        let at = targets.findIndex(t => distance < t.distance);
        if (at < 0) at = targets.length;
        if (at < PET_POWER.targets) targets.splice(at, 0, { enemy: e, distance });
        if (targets.length > PET_POWER.targets) targets.pop();
    }
    if (targets.length) {
        pet.cd = PET_POWER.cooldown; pet.swipe = 0.18; pet.attackElapsed = PET_ANIMATION.attackRelease;
        pet.targetX = targets[0].enemy.x; pet.targetY = targets[0].enemy.y - targets[0].enemy.radius;
        const damage = (training.damage + Math.min(G.level, PET_POWER.maxLevel) * PET_POWER.levelDamage) * p.stats.might;
        for (const { enemy } of targets) {
            const options = { weapon: 'pet_yeongnyang', silent: true, slow: 0.25 };
            if (enemy === G.boss) enemy.hurt(damage, options);
            else hitEnemy(enemy, damage, options);
        }
    } else pet.cd = 0.15;
}
export function drawPets(ctx, image = portrait) {
    if (!pet) return;
    loadPetSprite();
    const x = pet.x, y = pet.y + Math.sin(pet.animClock * 6) * 1;
    const limits = petVisualLimits(!!images.playerFire);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(x, y - 1, limits.width * 0.3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); if (pet.flip) ctx.scale(-1, 1);
    const sprite = getPetSprite();
    if (sprite) { const rect=petSpriteRect(sprite.meta, pet, !!images.playerFire); ctx.drawImage(sprite.sheets?.[rect.sheet] || sprite.image, ...rect.args); }
    else drawCatFallback(ctx, image, limits);
    ctx.restore();
    if (pet.swipe > 0) {
        ctx.globalAlpha = pet.swipe / 0.18; ctx.strokeStyle = '#dcb6ff'; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 3, y - limits.height * 0.5); ctx.lineTo(pet.targetX + i * 3, pet.targetY); ctx.stroke(); }
    }
    ctx.restore();
}
function drawCatFallback(ctx, image, limits) {
    // Whole fallback, including the hat, lies within x[-21,21], y[-45,0].
    const scale = Math.min(limits.width / 42, limits.height / 45);
    ctx.scale(scale, scale);
    if (image?.complete && image.naturalWidth) {
        const fit = Math.min(28/image.naturalWidth,43/image.naturalHeight);
        const w=image.naturalWidth*fit,h=image.naturalHeight*fit;
        ctx.drawImage(image,-w/2,-h,w,h); return;
    }
    ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(0, -30); ctx.lineTo(15, 0); ctx.fill();
    ctx.fillStyle = '#fff5f8'; ctx.beginPath(); ctx.ellipse(0, -16, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
    for (const dir of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dir * 5, -22); ctx.lineTo(dir * 12, -33); ctx.lineTo(dir * 14, -17); ctx.fill(); }
    ctx.fillStyle = '#ad78c8'; ctx.fillRect(-8, -18, 5, 2); ctx.fillStyle = '#d0a85e'; ctx.fillRect(3, -18, 5, 2);
    ctx.fillStyle = '#f2aec2'; ctx.fillRect(-1, -13, 3, 2);
    ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(-14, -25); ctx.lineTo(1, -45); ctx.lineTo(17, -38); ctx.lineTo(8, -36); ctx.lineTo(13, -25); ctx.fill();
    ctx.fillStyle = '#f6ce73'; ctx.font = '12px serif'; ctx.fillText('☾', -5, -30);
    ctx.fillStyle = '#b98bea'; ctx.beginPath(); ctx.arc(0, -3, 3, 0, Math.PI * 2); ctx.fill();
}
