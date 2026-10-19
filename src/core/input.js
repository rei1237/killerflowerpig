// 입력: 키보드(WASD/방향키) + 플로팅 가상 조이스틱(터치/마우스 드래그, 화면 어디서나)
const keys = new Set();
const MOVE_KEYS = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
};

export const input = {
    move: { x: 0, y: 0 },
    joy: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, radius: 56 },
    onPause: null,
    onConfirm: null,
    onSpecial: null,
    enabled: false,
};

function updateKeyboardMove() {
    if (input.joy.active) return;
    let x = 0, y = 0;
    for (const k of keys) {
        const v = MOVE_KEYS[k];
        if (v) { x += v[0]; y += v[1]; }
    }
    const len = Math.hypot(x, y);
    input.move.x = len ? x / len : 0;
    input.move.y = len ? y / len : 0;
}

export function initInput(canvas) {
    window.addEventListener('keydown', (e) => {
        if (e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
        if (e.code === 'Space' && input.enabled) {
            e.preventDefault();
            if (!e.repeat) input.onSpecial?.();
            return;
        }
        if (e.code === 'Escape' || e.code === 'KeyP') {
            if (e.repeat) return;
            if (input.onPause) { input.onPause(); e.preventDefault(); }
            return;
        }
        if (MOVE_KEYS[e.code]) {
            keys.add(e.code);
            updateKeyboardMove();
            if (input.enabled) e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        keys.delete(e.code);
        updateKeyboardMove();
    });
    window.addEventListener('blur', () => { keys.clear(); resetJoy(); updateKeyboardMove(); });

    const joy = input.joy;
    canvas.addEventListener('pointerdown', (e) => {
        if (!input.enabled || joy.active) return;
        joy.active = true;
        joy.id = e.pointerId;
        joy.ox = joy.x = e.clientX;
        joy.oy = joy.y = e.clientY;
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!joy.active || e.pointerId !== joy.id) return;
        let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
        const len = Math.hypot(dx, dy);
        // 손가락이 반경을 벗어나면 원점이 따라오게 (조작감 개선)
        if (len > joy.radius) {
            const k = (len - joy.radius) / len;
            joy.ox += dx * k; joy.oy += dy * k;
            dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
        }
        joy.x = e.clientX; joy.y = e.clientY;
        const l = Math.hypot(dx, dy);
        const dead = 6;
        if (l < dead) { input.move.x = 0; input.move.y = 0; return; }
        const mag = Math.min(1, l / joy.radius);
        input.move.x = dx / l * mag;
        input.move.y = dy / l * mag;
    });
    const end = (e) => {
        if (e.pointerId !== joy.id) return;
        resetJoy();
        updateKeyboardMove();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
}

export function resetJoy() {
    input.joy.active = false;
    input.joy.id = -1;
    input.move.x = 0;
    input.move.y = 0;
}
