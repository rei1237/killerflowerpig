// One renderer for the live player and the shop fitting room. Equipment is
// appearance-only: never mutate a run, stats, HP, collisions or firing anchors.
import { images, atlases } from '../core/assets.js';
import { save } from '../core/save.js';
import { FIRING_SPRITE, shotFrame, firingDrawRect, playerBob } from './player-motion.js';

export const APPEARANCE_LAYOUT = Object.freeze({
    dusk_lotus_cape: { layer: 'back', rect: [45, 128, 180, 107] },
    jade_lotus_guard: { layer: 'front', rect: [140, 174, 108, 61] },
    dawn_petal_halo: { layer: 'back', rect: [90, -2, 190, 145] },
});
// Small vector silhouettes retain a visible selection if optional art fails.
// These paths are only the network-error fallback; shipped art is hand-directed.
function fallback(ctx, id, [x,y,w,h]) {
    ctx.save(); ctx.translate(x,y); ctx.scale(w/100,h/100);
    ctx.lineWidth=3; ctx.strokeStyle='#f6d78c';
    if(id==='dawn_petal_halo') {
        ctx.strokeStyle='#ffd98d';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(50,50,46,46,0,0,Math.PI*2);ctx.stroke();
        for(let n=0;n<8;n++){ctx.save();ctx.translate(50,50);ctx.rotate(n*Math.PI/4);ctx.fillStyle='#ef91c1';ctx.beginPath();ctx.ellipse(0,-44,5,10,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    } else {
        ctx.fillStyle=id==='dusk_lotus_cape'?'#51306e':'#71d6c5';
        ctx.beginPath();ctx.moveTo(35,4);ctx.lineTo(73,8);ctx.lineTo(97,91);ctx.quadraticCurveTo(49,80,4,98);ctx.lineTo(18,34);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#ffe4a3';ctx.beginPath();ctx.ellipse(50,53,9,17,.3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
}
function equipmentLayer(ctx,appearance,layer){
    for(const slot of ['ornament','outfit']) {
        const id=appearance?.[slot], layout=APPEARANCE_LAYOUT[id];
        if(!layout||layout.layer!==layer)continue;
        // Prevent an arbitrary ID in the wrong slot from rendering.
        if((id==='dawn_petal_halo')!==(slot==='ornament'))continue;
        ctx.save();ctx.scale(FIRING_SPRITE.scale,FIRING_SPRITE.scale);ctx.translate(-FIRING_SPRITE.anchorX,-FIRING_SPRITE.anchorY);
        const img=images[`cosmetic_${id}`];
        if(img)ctx.drawImage(img,...layout.rect);else fallback(ctx,id,layout.rect);
        ctx.restore();
    }
}
export function drawAppearance(ctx,{x=0,y=0,clock=0,player={},appearance=save.equippedCosmetics,scale=1,tint='normal'}={}) {
    const atlas=atlases.player;
    if(!images.playerFire&&!atlas)return false;
    const frame=shotFrame(clock-(player.shotAt??-Infinity));
    const flip=frame?!!player.shotFlip:!!player.flip;
    const bob=playerBob(player,clock);
    ctx.save();ctx.translate(x,y-bob*scale);ctx.scale((flip?-1:1)*scale,scale);
    equipmentLayer(ctx,appearance,'back');
    if(images.playerFire)ctx.drawImage(tint==='flash'&&images.playerFireFlash?images.playerFireFlash:images.playerFire,...firingDrawRect(frame));
    else atlas.draw(ctx,'walk',player.anim||0,0,0,.48,false,tint);
    equipmentLayer(ctx,appearance,'front');ctx.restore();
    return true;
}
