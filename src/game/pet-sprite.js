import { FIRING_SPRITE } from './player-motion.js';
export const PET_ANIMATION = Object.freeze({ idleFrameTime: 0.3, followFrameTime: 0.12, attackDuration: 0.18, healDuration: 0.5 });
// Conservative limits measured against all player firing silhouettes (min 65.76×55.2 at .24).
// Legacy player frames are narrower, so their pet fallback has its own smaller envelope.
export function petVisualLimits(hasFiringSprite = true) {
    const ratio = FIRING_SPRITE.scale / 0.24;
    return hasFiringSprite ? { width: 36 * ratio, height: 34 * ratio } : { width: 23, height: 32 };
}
export function petAnimation(state) {
    if (state.attackElapsed >= 0 && state.attackElapsed < PET_ANIMATION.attackDuration) return { name: 'attack', phase: state.attackElapsed / PET_ANIMATION.attackDuration };
    if (state.healElapsed >= 0 && state.healElapsed < PET_ANIMATION.healDuration) return { name: 'heal', phase: state.healElapsed / PET_ANIMATION.healDuration };
    const name = state.moving ? 'follow' : 'idle';
    const time = state.moving ? PET_ANIMATION.followFrameTime : PET_ANIMATION.idleFrameTime;
    return { name, phase: ((state.animClock || 0) / (time * 2)) % 1 };
}
export function validatePetSprite(meta) {
    if (!meta || ![meta.frameWidth,meta.frameHeight,meta.columns,meta.rows].every(n=>Number.isInteger(n)&&n>0&&n<=4096)) throw Error('INVALID_PET_ATLAS');
    if (!meta.anchor || !Number.isFinite(meta.anchor.x) || !Number.isFinite(meta.anchor.y) || meta.anchor.x<0 || meta.anchor.y<0 || meta.anchor.x>meta.frameWidth || meta.anchor.y>meta.frameHeight) throw Error('INVALID_PET_ANCHOR');
    for (const name of ['idle','follow','attack','heal']) if (!Array.isArray(meta.animations?.[name]) || meta.animations[name].length!==2 || !meta.animations[name].every(n=>Number.isInteger(n)&&n>=0&&n<meta.columns*meta.rows)) throw Error('INVALID_PET_ANIMATION');
    if (meta.frames) {
        if (!Number.isInteger(meta.sheetWidth) || !Number.isInteger(meta.sheetHeight) || meta.frames.length!==meta.columns*meta.rows) throw Error('INVALID_PET_RECTS');
        for (const frame of meta.frames) {
            const r=frame.source;
            if (!Array.isArray(r) || r.length!==4 || !r.every(Number.isInteger) || r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[2]>meta.frameWidth || r[3]>meta.frameHeight || r[0]+r[2]>meta.sheetWidth || r[1]+r[3]>meta.sheetHeight) throw Error('INVALID_PET_RECTS');
        }
    }
    return meta;
}
export function petSpriteRect(meta, state, hasFiringSprite = true) {
    const animation = petAnimation(state), frames = meta.animations[animation.name];
    const frame = frames[Math.min(frames.length-1,Math.floor(animation.phase*frames.length))];
    const limits = petVisualLimits(hasFiringSprite);
    // Fit entire cells, not just body pixels: wings/hat/effects cannot escape the bound.
    const scale = Math.min(limits.width/meta.frameWidth,limits.height/meta.frameHeight);
    const source=meta.frames?.[frame]?.source || [(frame%meta.columns)*meta.frameWidth,Math.floor(frame/meta.columns)*meta.frameHeight,meta.frameWidth,meta.frameHeight];
    return { frame, animation: animation.name, args: [...source,-meta.anchor.x*scale,-meta.anchor.y*scale,source[2]*scale,source[3]*scale] };
}
let sprite = null, loading = null;
export function getPetSprite() { return sprite; }
export function installPetSprite(image, meta) {
    validatePetSprite(meta);
    if (!image || image.naturalWidth!==(meta.sheetWidth || meta.frameWidth*meta.columns) || image.naturalHeight!==(meta.sheetHeight || meta.frameHeight*meta.rows)) throw Error('PET_ATLAS_SIZE_MISMATCH');
    sprite = { image, meta }; return sprite;
}
export function loadPetSprite() {
    if (loading || sprite || typeof Image === 'undefined' || typeof fetch === 'undefined') return loading;
    loading = (async()=>{
        try {
            const response = await fetch('asset/sprites/pet-yeongnyang.json');
            if (!response.ok) return null;
            const meta = validatePetSprite(await response.json());
            // Asset path is fixed: metadata cannot trigger arbitrary remote image requests.
            const image = await new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src='asset/sprites/pet-yeongnyang.webp';});
            return installPetSprite(image,meta);
        } catch { return null; } // One attempt; tiny winged fallback remains playable.
    })();
    return loading;
}
