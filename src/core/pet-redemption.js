// Disabled until an approved public character/event answer and authenticated service exist.
// Never embed a real birthdate, its hash, or answer comparison in browser code.
export const PET_REDEMPTION = Object.freeze({ enabled: false, reason: '이벤트 정답과 계정 서버 준비 후 이용할 수 있습니다.' });
export function createPetRedemptionAdapter({ enabled = false, endpoint = '/api/kfp/pet-redemptions', fetchImpl = globalThis.fetch } = {}) {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('SAME_ORIGIN_API_REQUIRED');
    return {
        async redeem({ answer, requestId } = {}) {
            if (enabled !== true) return { ok: false, code: 'REDEMPTION_DISABLED' };
            if (typeof answer !== 'string' || answer.length < 1 || answer.length > 64 || typeof requestId !== 'string' || !requestId.length || requestId.length > 160) return { ok: false, code: 'INVALID_REQUEST' };
            const response = await fetchImpl(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer, requestId, rewardId: 'pet_yeongnyang' }) });
            if (response.status === 429) return { ok: false, code: 'RATE_LIMITED' };
            if (!response.ok) return { ok: false, code: 'REDEMPTION_REJECTED' };
            const data = await response.json();
            // The caller must separately refresh authoritative account progression.
            if (data?.rewardId !== 'pet_yeongnyang' || data?.granted !== true) return { ok: false, code: 'INVALID_RESPONSE' };
            return { ok: true, refreshProgress: true };
        },
    };
}
