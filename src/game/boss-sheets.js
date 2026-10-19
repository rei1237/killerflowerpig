import { BOSS_SHEETS } from './boss-appearance.js';

// At most the current encounter and the next encounter stay decoded (~4 MiB).
// No sheets are requested at module/startup time, and no per-frame tint copies.
function requestImage(src) {
    if (typeof Image === 'undefined') return { promise: Promise.resolve(null), cancel() {} };
    const image = new Image();
    image.decoding = 'async';
    let finish, timer;
    const promise = new Promise(resolve => {
        finish = value => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            resolve(value);
        };
        image.onload = () => finish(image);
        image.onerror = () => finish(null);
        timer = setTimeout(() => { finish(null); image.src = ''; }, 15000);
        image.src = src;
    });
    return { promise, cancel() { finish(null); image.src = ''; } };
}

export class BossSheetCache {
    constructor(request = requestImage) {
        this.request = request;
        this.entries = new Map();
    }

    prepare(stage) {
        const wanted = new Set([stage, stage + 1].filter(n => BOSS_SHEETS[n]));
        for (const [n, entry] of this.entries) {
            if (wanted.has(n)) continue;
            this.entries.delete(n);
            entry.image = null;
            entry.request.cancel?.();
        }
        const jobs = [];
        for (const n of wanted) {
            let entry = this.entries.get(n);
            if (!entry) {
                const meta = BOSS_SHEETS[n];
                const request = this.request(meta.src);
                entry = { request, image: null, promise: null };
                this.entries.set(n, entry);
                entry.promise = Promise.resolve(request.promise).then(image => {
                    if (this.entries.get(n) !== entry) return null;
                    // A portrait or broken export must never be sliced as an atlas.
                    entry.image = image?.width === meta.width && image?.height === meta.height ? image : null;
                    return entry.image;
                }, () => null);
            }
            jobs.push(entry.promise);
        }
        return Promise.all(jobs);
    }

    get(stage) { return this.entries.get(stage)?.image || null; }
}

const cache = new BossSheetCache();
export const prepareBossSheets = stage => cache.prepare(stage);
export const getBossSheet = stage => cache.get(stage);
