// Shared fitting-room / combat renderer. Costumes are complete pose-matched
// character sheets, never inventory icons pasted over the body or hands.
import { images, atlases, characterSheetKey, characterSheetStatus, requestCharacterSheet, characterBody, characterFlash } from '../core/assets.js';
import { G } from './state.js';
import { playerAttackPose, drawAttackAccent, idleAttackFamily } from './attack-animation.js';
import { save } from '../core/save.js';
import { firingDrawRect, haloDrawRect, playerBob, reducedPlayerMotion } from './player-motion.js';
export const COSTUME_IDS = Object.freeze(['dusk_lotus_cape', 'jade_lotus_guard']);
const TECH_WARM_FAMILIES = Object.freeze({ gunline: ['fire', 'dual'], executioner: ['dual', 'fire', 'blade'],
    plague: ['throw', 'channel', 'cannon'], bloom: ['cannon', 'channel', 'blade'], butcher: ['blade', 'channel', 'fire'] });
let warmKey = null;
export function warmAppearance(appearance = save.equippedCosmetics, tech = G.tech, activeFamily = idleAttackFamily(tech), legendary = false) {
    const families = TECH_WARM_FAMILIES[tech];
    if (!families) return Promise.resolve([]);
    const outfit = COSTUME_IDS.includes(appearance?.outfit) ? appearance.outfit : null;
    const ordered = [activeFamily, ...families.filter(family => family !== activeFamily)].slice(0, 3);
    return Promise.all(ordered.map(family => requestCharacterSheet(characterSheetKey(outfit, family, family === activeFamily && legendary))));
}
export function appearanceAssets(appearance = save.equippedCosmetics, lotusGun = (save.upgrades?.lotus_gun || 0) > 0, family = 'fire', flash = false) {
    const outfit = COSTUME_IDS.includes(appearance?.outfit) ? appearance.outfit : null;
    const desired = characterSheetKey(outfit, family, family === 'fire' && lotusGun);
    const base = characterSheetKey(null, family, family === 'fire' && lotusGun);
    // Do not retry a known failed sheet every render. Loading is read-only and
    // deduplicated; the old ready stance remains until its real pose is ready.
    if (!images[desired] && characterSheetStatus(desired) === 'unloaded') void requestCharacterSheet(desired);
    // A corrupt/missing outfit pose still gets its matching uncostumed pose,
    // rather than remaining a rifle-ready fallback for the rest of the run.
    if (desired !== base && characterSheetStatus(desired) === 'failed' && !images[base] && characterSheetStatus(base) === 'unloaded') void requestCharacterSheet(base);
    const exact = characterBody(desired);
    const matchingBase = exact ? null : characterBody(base);
    const neutral = characterSheetKey(outfit, 'fire', false);
    const key = exact ? desired : matchingBase ? base : images[neutral] ? neutral : images.playerFire ? 'playerFire' : null;
    const halo = appearance?.ornament === 'dawn_petal_halo';
    const loading = characterSheetStatus(desired) === 'loading';
    const loadingBase = !exact && characterSheetStatus(base) === 'loading';
    const body = key ? characterBody(key) : null;
    const matched = key === desired || key === base;
    return { body, flash: flash && key ? characterFlash(key) : null,
        halo: halo ? images.playerHaloLayer : null,
        outfit: outfit && key?.startsWith(`costume_${outfit}_`) ? outfit : null,
        poseReady: matched, key, pending: loading ? [desired] : loadingBase ? [base] : [],
        missing: [...(!loading && !exact && outfit ? [outfit] : []), ...(!loading && lotusGun && family === 'fire' && !exact && !matchingBase ? ['lotus_gun'] : []),
            ...(!loading && family !== 'fire' && !matched ? [family] : []), ...(halo && !images.playerHaloLayer ? ['dawn_petal_halo'] : [])] };
}

// At most one extra draw primitive, attached to the complete costume. No
// emitter, pooled particles, trails, glow cache churn, or simulation writes.
function drawCostumeSignature(ctx, outfit, player, clock) {
    if (outfit === 'dusk_lotus_cape' && (player.vx || player.vy)) {
        const sway = Math.sin(clock * 7) * 1.5;
        ctx.strokeStyle = 'rgba(231,181,208,0.48)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(-18, -9);
        ctx.quadraticCurveTo(-24, -8 + sway, -29, -11 + sway);
        ctx.stroke();
    } else if (outfit === 'jade_lotus_guard') {
        const age = clock - (player.outfitGuardHitAt ?? -Infinity);
        if (age < 0 || age >= 0.22) return;
        ctx.strokeStyle = `rgba(195,246,221,${0.65 * (1 - age / 0.22)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, -25); ctx.lineTo(-8, -19);
        ctx.moveTo(-11, -22); ctx.lineTo(-5, -22);
        ctx.stroke();
    }
}

export function drawAppearance(ctx, { x=0, y=0, clock=0, player={}, appearance=save.equippedCosmetics,
    scale=1, tint='normal', lotusGun=(save.upgrades?.lotus_gun||0)>0,
    reducedMotion=reducedPlayerMotion(), tech=G.tech }={}) {
    const pose = playerAttackPose(player, clock, tech);
    const art = appearanceAssets(appearance, pose.legendary || (pose.legacy && lotusGun), pose.family, tint === 'flash'), atlas = atlases.player;
    if (!art.body && !atlas) return false;
    const frame = art.poseReady ? pose.frame : 0;
    const flip = frame ? !!pose.flip : !!player.flip;
    ctx.save();
    ctx.translate(x, y-playerBob(player,clock,reducedMotion)*scale);
    ctx.scale((flip?-1:1)*scale,scale);
    // Head/flower/ears naturally occlude the head-aligned halo behind them.
    if (art.halo) ctx.drawImage(art.halo,...haloDrawRect(frame));
    if (art.body) ctx.drawImage(tint==='flash'&&art.flash?art.flash:art.body,...firingDrawRect(frame));
    else atlas.draw(ctx,'walk',player.anim||0,0,0,.48,false,tint);
    if (art.body && !reducedMotion) {
        drawCostumeSignature(ctx,art.outfit,player,clock);
        if (art.poseReady) drawAttackAccent(ctx,pose,clock,reducedMotion);
    }
    ctx.restore();
    if (tech) {
        const nextWarmKey = `${tech}:${appearance?.outfit || ''}`;
        // Warm only after drawing: the current neutral fallback/flash may be
        // the LRU victim when the desired family's new siblings are reserved.
        if (warmKey !== nextWarmKey) { warmKey = nextWarmKey; void warmAppearance(appearance, tech, pose.family, pose.legendary); }
    }
    return true;
}
