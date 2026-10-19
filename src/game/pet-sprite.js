import { FIRING_SPRITE } from './player-motion.js';
export const PET_ANIMATION = Object.freeze({ idleFrameTime: 0.3, followFrameTime: 0.12, attackDuration: 0.9, healDuration: 1.2, attackRelease: 0.45, healRelease: 0.6 });
// Conservative limits measured against all player firing silhouettes (min 65.76×55.2 at .24).
// Legacy player frames are narrower, so their pet fallback has its own smaller envelope.
export function petVisualLimits(hasFiringSprite = true) {
    const ratio = FIRING_SPRITE.scale / 0.24;
    return hasFiringSprite ? { width: 36 * ratio, height: 34 * ratio } : { width: 23, height: 32 };
}
export function petAnimation(state) {
    if (state.healElapsed >= 0 && state.healElapsed < PET_ANIMATION.healDuration) return { name: 'heal', phase: state.healElapsed / PET_ANIMATION.healDuration };
    if (state.attackElapsed >= 0 && state.attackElapsed < PET_ANIMATION.attackDuration) return { name: 'attack', phase: state.attackElapsed / PET_ANIMATION.attackDuration };
    const name = state.moving ? 'follow' : 'idle';
    const time = state.moving ? PET_ANIMATION.followFrameTime : PET_ANIMATION.idleFrameTime;
    return { name, phase: ((state.animClock || 0) / (time * 2)) % 1 };
}
export function validatePetSprite(meta) {
    if (!meta || ![meta.frameWidth,meta.frameHeight,meta.columns,meta.rows].every(n=>Number.isInteger(n)&&n>0&&n<=4096)) throw Error('INVALID_PET_ATLAS');
    if (!meta.anchor || !Number.isFinite(meta.anchor.x) || !Number.isFinite(meta.anchor.y) || meta.anchor.x<0 || meta.anchor.y<0 || meta.anchor.x>meta.frameWidth || meta.anchor.y>meta.frameHeight) throw Error('INVALID_PET_ANCHOR');
    for (const name of ['idle','follow','attack','heal']) if (!Array.isArray(meta.animations?.[name]) || meta.animations[name].length<2 || meta.animations[name].length>10 || !meta.animations[name].every(n=>Number.isInteger(n)&&n>=0&&n<meta.columns*meta.rows)) throw Error('INVALID_PET_ANIMATION');
    if (meta.sheets) for(const [key,sheet] of Object.entries(meta.sheets)) {
        if(!['base','attack','heal'].includes(key) || ![sheet.sheetWidth,sheet.sheetHeight,sheet.frameWidth,sheet.frameHeight].every(n=>Number.isInteger(n)&&n>0&&n<=8192) || !sheet.anchor || !Number.isFinite(sheet.anchor.x) || !Number.isFinite(sheet.anchor.y) || sheet.anchor.x<0 || sheet.anchor.y<0 || sheet.anchor.x>sheet.frameWidth || sheet.anchor.y>sheet.frameHeight) throw Error('INVALID_PET_SHEET');
    }
    if (meta.frames) {
        if (!Number.isInteger(meta.sheetWidth) || !Number.isInteger(meta.sheetHeight) || meta.frames.length!==meta.columns*meta.rows) throw Error('INVALID_PET_RECTS');
        for (const frame of meta.frames) {
            const r=frame.source;
            const bounds=meta.sheets?.[frame.sheet] || meta;
            if(meta.sheets&&!meta.sheets[frame.sheet])throw Error('INVALID_PET_SHEET');
            if (!Array.isArray(r) || r.length!==4 || !r.every(Number.isInteger) || r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[2]>bounds.frameWidth || r[3]>bounds.frameHeight || r[0]+r[2]>bounds.sheetWidth || r[1]+r[3]>bounds.sheetHeight) throw Error('INVALID_PET_RECTS');
            if(meta.wingless){const b=frame.alphaBBox;if(!Array.isArray(b)||b.length!==4||!b.every(Number.isInteger)||b[0]<0||b[1]<0||b[2]<=b[0]||b[3]<=b[1]||b[2]>r[2]||b[3]>r[3]||!Number.isFinite(bounds.bodyHeight)||bounds.bodyHeight<=0)throw Error('INVALID_PET_BOUNDS');}
        }
    }
    return meta;
}
export function petSpriteRect(meta, state, hasFiringSprite = true) {
    const animation = petAnimation(state), frames = meta.animations[animation.name];
    const frame = frames[Math.min(frames.length-1,Math.floor(animation.phase*frames.length+1e-9))];
    const limits = petVisualLimits(hasFiringSprite);
    // Fit entire cells, not just body pixels: wings/hat/effects cannot escape the bound.
    const layout=meta.sheets?.[meta.frames?.[frame]?.sheet] || meta;
    const scale = Math.min(limits.width/layout.frameWidth,limits.height/layout.frameHeight);
    const source=meta.frames?.[frame]?.source || [(frame%meta.columns)*meta.frameWidth,Math.floor(frame/meta.columns)*meta.frameHeight,meta.frameWidth,meta.frameHeight];
    const bounds=meta.frames?.[frame]?.alphaBBox;
    if (meta.wingless && bounds && layout.bodyHeight) {
        // Trim only transparent cell padding at draw time; preserve measured visible artwork.
        // Common visible body height and per-frame feet avoid scale/baseline jumps.
        const [x0,y0,x1,y1]=bounds;
        const visibleScale=Math.min(limits.height*.72/layout.bodyHeight,limits.width/(x1-x0),limits.height/(y1-y0));
        return {sheet:meta.frames[frame].sheet,frame,animation:animation.name,args:[source[0]+x0,source[1]+y0,x1-x0,y1-y0,(x0-source[2]/2)*visibleScale,(y0-y1)*visibleScale,(x1-x0)*visibleScale,(y1-y0)*visibleScale]};
    }
    return { sheet: meta.frames?.[frame]?.sheet, frame, animation: animation.name, args: [...source,-layout.anchor.x*scale,-layout.anchor.y*scale,source[2]*scale,source[3]*scale] };
}
let sprite = null, loading = null;
export function getPetSprite() { return sprite; }
export function installPetSprite(image, meta, sheets = {}) {
    validatePetSprite(meta);
    if (!image || image.naturalWidth!==(meta.sheetWidth || meta.frameWidth*meta.columns) || image.naturalHeight!==(meta.sheetHeight || meta.frameHeight*meta.rows)) throw Error('PET_ATLAS_SIZE_MISMATCH');
    sprite = { image, meta, sheets }; return sprite;
}
export function loadPetSprite() {
    if (loading || sprite || typeof Image === 'undefined' || typeof fetch === 'undefined') return loading;
    loading = (async()=>{
        try {
            const response = await fetch('asset/sprites/pet-yeongnyang.json');
            if (!response.ok) return null;
            const meta = validatePetSprite(await response.json());
            // Fixed allowlist prevents metadata-triggered remote requests.
            const paths={base:'asset/sprites/pet-yeongnyang.webp',attack:'asset/sprites/pet-yeongnyang-attack.webp',heal:'asset/sprites/pet-yeongnyang-heal.webp'};
            const read=src=>new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
            const image=await read(paths.base),sheets={};
            for(const key of Object.keys(meta.sheets||{})){
                if(!paths[key])throw Error('INVALID_PET_SHEET');
                const img=key==='base'?image:await read(paths[key]),bounds=meta.sheets[key];
                if(img.naturalWidth!==bounds.sheetWidth||img.naturalHeight!==bounds.sheetHeight)throw Error('PET_ATLAS_SIZE_MISMATCH');
                sheets[key]=img;
            }
            return installPetSprite(image,meta,sheets);
        } catch { return null; } // One attempt; tiny winged fallback remains playable.
    })();
    return loading;
}
