// Shared fitting-room / combat renderer. Costumes are complete pose-matched
// character sheets, never inventory icons pasted over the body or hands.
import { images, atlases } from '../core/assets.js';
import { save } from '../core/save.js';
import { shotFrame, firingDrawRect, playerBob } from './player-motion.js';
export const COSTUME_IDS = Object.freeze(['dusk_lotus_cape', 'jade_lotus_guard']);
export function appearanceAssets(appearance = save.equippedCosmetics, lotusGun = (save.upgrades?.lotus_gun || 0) > 0) {
    const outfit = COSTUME_IDS.includes(appearance?.outfit) ? appearance.outfit : null;
    const variant = lotusGun ? 'lotus' : 'normal';
    const costumeKey = outfit ? `costume_${outfit}_${variant}` : null;
    const baseKey = lotusGun && images.playerLotusFire ? 'playerLotusFire' : 'playerFire';
    const key = costumeKey && images[costumeKey] ? costumeKey : baseKey;
    const halo = appearance?.ornament === 'dawn_petal_halo';
    return { body: images[key], flash: images[`${key}Flash`], halo: halo ? images.playerHaloLayer : null,
        missing: [...(lotusGun && !images.playerLotusFire && !(costumeKey && images[costumeKey]) ? ['lotus_gun'] : []), ...(outfit && !images[costumeKey] ? [outfit] : []), ...(halo && !images.playerHaloLayer ? ['dawn_petal_halo'] : [])] };
}
export function drawAppearance(ctx, { x=0, y=0, clock=0, player={}, appearance=save.equippedCosmetics,
    scale=1, tint='normal', lotusGun=(save.upgrades?.lotus_gun||0)>0 }={}) {
    const art = appearanceAssets(appearance, lotusGun), atlas = atlases.player;
    if (!art.body && !atlas) return false;
    const frame = shotFrame(clock-(player.shotAt??-Infinity));
    const flip = frame ? !!player.shotFlip : !!player.flip;
    ctx.save();
    ctx.translate(x, y-playerBob(player,clock)*scale);
    ctx.scale((flip?-1:1)*scale,scale);
    // Head/flower/ears naturally occlude the head-aligned halo behind them.
    if (art.halo) ctx.drawImage(art.halo,...firingDrawRect(frame));
    if (art.body) ctx.drawImage(tint==='flash'&&art.flash?art.flash:art.body,...firingDrawRect(frame));
    else atlas.draw(ctx,'walk',player.anim||0,0,0,.48,false,tint);
    ctx.restore();
    return true;
}
