// 입력: 키보드(WASD/방향키) + 플로팅 가상 조이스틱(터치/마우스 드래그, 화면 어디서나)
const keys = new Set();
let gesture = null;
const initialized = new WeakSet();
export const TAP_LIMITS = Object.freeze({ duration: 250, distance: 8 });
export function isTargetTap({ duration, distance, canceled = false, multitouch = false }) {
    return !canceled && !multitouch && duration >= 0 && duration <= TAP_LIMITS.duration && distance >= 0 && distance <= TAP_LIMITS.distance;
}
export function joystickVector(dx, dy, radius = 56, dead = 6) {
    const length = Math.hypot(dx, dy);
    if (length < dead) return { x: 0, y: 0 };
    const magnitude = Math.min(1, length / radius);
    return { x: dx / length * magnitude, y: dy / length * magnitude };
}
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
    onTap: null,
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
    if (initialized.has(canvas)) return;
    initialized.add(canvas);
    window.addEventListener('keydown', (e) => {
        if (e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
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
    window.addEventListener('blur', resetInput);
    // A second finger anywhere (including UI) cancels tap selection, not movement.
    window.addEventListener('pointerdown', (e) => {
        if (gesture && e.pointerId !== input.joy.id) gesture.multitouch = true;
    }, true);

    const joy = input.joy;
    canvas.addEventListener('pointerdown', (e) => {
        if (!input.enabled || joy.active || e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
        joy.active = true;
        joy.id = e.pointerId;
        joy.ox = joy.x = e.clientX;
        joy.oy = joy.y = e.clientY;
        gesture = { x: e.clientX, y: e.clientY, started: e.timeStamp, distance: 0, dragged: false, multitouch: false };
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!joy.active || e.pointerId !== joy.id) return;
        if (gesture) {
            gesture.distance = Math.max(gesture.distance, Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y));
            gesture.dragged ||= gesture.distance > TAP_LIMITS.distance;
            if (!gesture.dragged) return;
        }
        let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
        const len = Math.hypot(dx, dy);
        // 손가락이 반경을 벗어나면 원점이 따라오게 (조작감 개선)
        if (len > joy.radius) {
            const k = (len - joy.radius) / len;
            joy.ox += dx * k; joy.oy += dy * k;
            dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
        }
        joy.x = e.clientX; joy.y = e.clientY;
        Object.assign(input.move, joystickVector(dx, dy, joy.radius));
    });
    const end = (e) => {
        if (e.pointerId !== joy.id) return;
        const tap = input.enabled && gesture && isTargetTap({ duration: e.timeStamp - gesture.started,
            distance: Math.max(gesture.distance, Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y)),
            canceled: e.type !== 'pointerup' || gesture.dragged, multitouch: gesture.multitouch });
        resetJoy();
        updateKeyboardMove();
        if (tap) input.onTap?.(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
}

export function resetJoy() {
    gesture = null;
    input.joy.active = false;
    input.joy.id = -1;
    input.move.x = 0;
    input.move.y = 0;
}

// Modal/practice boundaries must also release held keyboard state.
export function resetInput() { keys.clear(); resetJoy(); }
