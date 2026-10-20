// 칭호 진행 기록 (순수 함수). 스테이지 정산 때 한 번 기록하고, 새로 달성한 칭호를 돌려준다.
import { TITLES, TITLE_IDS, TECH_IDS, isTitleEarned } from '../data/titles.js';

const MAX = 1_000_000_000;
const integer = (v, max = MAX) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, max) : 0;
const FEATS = ['deaths', 'bossKills', 'evolved', 'fused', 'absolute'];

export function defaultTitleProgress() {
    return { titles: [], equippedTitle: null, techStats: {}, feats: {} };
}

// 저장 데이터 검증: 알 수 없는 칭호·테크·키는 버린다.
export function normalizeTitleProgress(raw = {}) {
    const out = defaultTitleProgress();
    if (Array.isArray(raw.titles)) out.titles = [...new Set(raw.titles.filter(id => TITLE_IDS.has(id)))];
    out.equippedTitle = out.titles.includes(raw.equippedTitle) ? raw.equippedTitle : null;
    const ts = raw.techStats && typeof raw.techStats === 'object' ? raw.techStats : {};
    for (const id of TECH_IDS) {
        const t = ts[id];
        if (!t || typeof t !== 'object') continue;
        out.techStats[id] = {
            runs: integer(t.runs), best: integer(t.best, 10), clears: integer(t.clears), kills: integer(t.kills),
            lastRun: typeof t.lastRun === 'string' && t.lastRun.length <= 160 ? t.lastRun : null,
        };
    }
    const fs = raw.feats && typeof raw.feats === 'object' ? raw.feats : {};
    for (const key of FEATS) if (fs[key]) out.feats[key] = integer(fs[key]);
    return out;
}

// rec: { runId, tech, stage, outcome: 'clear'|'death', kills, evolved, fused, absolute }
export function recordSettlement(state, rec) {
    const next = { ...state, techStats: { ...state.techStats }, feats: { ...state.feats }, titles: [...state.titles] };
    if (rec.tech && TECH_IDS.includes(rec.tech)) {
        const prev = next.techStats[rec.tech] || { runs: 0, best: 0, clears: 0, kills: 0, lastRun: null };
        const t = { ...prev };
        if (rec.runId && t.lastRun !== rec.runId) { t.runs++; t.lastRun = rec.runId; }
        t.kills += integer(rec.kills);
        if (rec.outcome === 'clear') { t.clears++; t.best = Math.max(t.best, Math.min(10, integer(rec.stage))); }
        next.techStats[rec.tech] = t;
    }
    const bump = (key, n = 1) => { next.feats[key] = (next.feats[key] || 0) + n; };
    if (rec.outcome === 'death') bump('deaths');
    if (rec.outcome === 'clear') bump('bossKills');
    if (rec.evolved) bump('evolved');
    if (rec.fused) bump('fused');
    if (rec.absolute) bump('absolute');
    const earned = TITLES.filter(t => !next.titles.includes(t.id) && isTitleEarned(t, next)).map(t => t.id);
    next.titles.push(...earned);
    // 처음 얻은 칭호는 자동 장착
    if (!next.equippedTitle && earned.length) next.equippedTitle = earned[earned.length - 1];
    return { state: next, earned };
}
