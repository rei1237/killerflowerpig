// Earned in-game coins only. No money, trading, cash-out, or transferable value.
export const RELIC_CHEST = Object.freeze({ cost: 100, unlockStage: 4, pityAt: 10, rates: Object.freeze([0.60, 0.30, 0.10]) });
export const RELICS = Object.freeze([
    { id: 'wind_feather', unlockStage: 0, tier: 'common', name: '산들바람 깃털', icon: '🪶', rate: 0.60, price: 120, duplicateCoins: 20, speed: 0.06, might: 0, hp: 0, desc: '이동 속도 +6%' },
    { id: 'moon_wings', unlockStage: 2, tier: 'rare', name: '달빛 날개', icon: '🌙', rate: 0.30, price: 400, duplicateCoins: 45, speed: 0.12, might: 0.08, hp: 0, desc: '이동 속도 +12% · 피해 +8%' },
    { id: 'star_wings', unlockStage: 4, tier: 'epic', name: '영냥이 별빛 날개', icon: '✨', rate: 0.10, price: 1000, duplicateCoins: 90, speed: 0.18, might: 0.15, hp: 20, desc: '이동 속도 +18% · 피해 +15% · 최대 HP +20' },
]);
export const MAX_MOVE_SPEED = 243; // Base 135 × 1.8, including every passive/permanent source.
export function strongestRelic(state) { return [...RELICS].reverse().find(r => state.relics?.includes(r.id)) || null; }
export function relicStats(stats, state) {
    const relic = strongestRelic(state);
    return { ...stats, speed: Math.min(MAX_MOVE_SPEED, stats.speed + 135 * (relic?.speed || 0)),
        might: stats.might + (relic?.might || 0), maxHp: stats.maxHp + (relic?.hp || 0) };
}
export function chestRates(state) { return state.chestPity >= RELIC_CHEST.pityAt - 1 ? [0, 0, 1] : [...RELIC_CHEST.rates]; }
export function rollRelic(roll, pity = 0) {
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('INVALID_ROLL');
    if (pity >= RELIC_CHEST.pityAt - 1) return RELICS[2];
    // Integer percentage boundaries avoid 0.6 + 0.3 floating-point ambiguity.
    return roll < 0.60 ? RELICS[0] : roll < 0.90 ? RELICS[1] : RELICS[2];
}
