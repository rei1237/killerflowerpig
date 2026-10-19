export const PETAL_MAX_CHARGE = 100;
export const PETAL_KILL_CHARGE = 5;
export const PETAL_ELITE_CHARGE = 10;
export function createPetalCharge() { return { charge: 0, lastKill: 0 }; }
// A monotonic real-kill counter prevents the same event from charging twice.
export function chargePetal(state, { killCount, elite = false, active = true, cannonKill = false }) {
    if (!active || !Number.isSafeInteger(killCount) || killCount <= state.lastKill) return false;
    state.lastKill = killCount;
    if (cannonKill) return false;
    state.charge = Math.min(PETAL_MAX_CHARGE, state.charge + (elite ? PETAL_ELITE_CHARGE : PETAL_KILL_CHARGE));
    return true;
}
export function spendPetal(state, { active = true } = {}) {
    if (!active || state.charge < PETAL_MAX_CHARGE) return false;
    state.charge = 0;
    return true;
}
