// 조합 버튼 표시: 조합 가능한 레시피가 있으면 HUD·레벨업·일시정지의 조합 버튼을 '조합 가능'으로 강조한다.
// 버튼은 항상 눌러 레시피를 볼 수 있다. 가능 여부는 fusion.js 의 readyFusions() 와 같은 조건이다.
import { readyFusions } from '../game/fusion.js';
const BUTTONS = ['btn-fusion', 'btn-levelup-fusion', 'btn-pause-fusion'];
let lastKey = '';
export function syncFusionButtons(force = false) {
    const ready = readyFusions().length;
    const key = String(ready);
    if (!force && key === lastKey) return ready;
    lastKey = key;
    for (const id of BUTTONS) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.classList?.toggle('fusion-available', ready > 0);
        if (button.dataset) button.dataset.ready = String(ready);
        button.textContent = ready > 0 ? `⚗️ 조합 가능 (${ready})` : '아이템 조합';
        if (id === 'btn-fusion' && button.appendChild && document.createElement) {
            const hint = document.createElement('span');
            hint.textContent = ready > 0 ? '눌러서 조합하기' : '레시피 확인';
            button.appendChild(hint);
        }
        button.setAttribute?.('aria-label', ready > 0 ? `아이템 조합 가능 ${ready}개` : '아이템 조합 레시피 확인');
    }
    return ready;
}
export function resetFusionButtons() { lastKey = ''; }
