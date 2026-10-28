// 사용자 설정 (localStorage 저장). 고어 수위 기본값은 'normal'.
const KEY = 'kfp.settings.v1';

export const GORE = { OFF: 'off', NORMAL: 'normal', MAX: 'max' };

const DEFAULTS = {
    gore: GORE.NORMAL,
    shake: true,
    flash: true,          // false = 플래시 감소
    damageNumbers: true,
    bgm: 0.5,
    sfx: 0.6,
    quality: 'auto',      // auto | high | low
    minimap: true,        // 전투 지도 (탭 한 번 / M 키로 켜고 끔)
};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* 저장소 접근 불가 시 기본값 */ }
    return { ...DEFAULTS };
}

export const settings = load();

const listeners = new Set();
export function onSettingsChange(fn) { listeners.add(fn); }

export function setSetting(key, value) {
    settings[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    for (const fn of listeners) fn(key, value);
}

// 고어 수위별 연출 한도
export function goreProfile() {
    switch (settings.gore) {
        case GORE.OFF: return { decals: 0, blood: 0, gibs: false, deathAnim: false, bloodColor: '#3a3a44', screenBlood: false };
        case GORE.MAX: return { decals: 320, blood: 1.6, gibs: true, deathAnim: true, bloodColor: '#7a0010', screenBlood: true };
        default: return { decals: 120, blood: 1, gibs: false, deathAnim: true, bloodColor: '#6b0a12', screenBlood: false };
    }
}

export function isLowQuality() {
    if (settings.quality === 'low') return true;
    if (settings.quality === 'high') return false;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse || (navigator.hardwareConcurrency || 8) <= 4;
}
