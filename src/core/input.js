// 입력: 키보드(WASD/방향키) + 플로팅 가상 조이스틱(터치/마우스 드래그, 화면 어디서나) + 게임패드
// 2P 협동(split)일 때: WASD = 1P, 방향키 = 2P. 게임패드는 1개면 2P(추가 컨트롤러), 2개 이상이면 첫째 1P · 둘째 2P.
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
const P1_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const MOVE_KEYS = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
};

export const input = {
    move: { x: 0, y: 0 },
    move2: { x: 0, y: 0 },
    split: false,
    // 게임패드 이동 (polled). 0이 아니면 키보드보다 우선한다.
    pad: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    joy: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, radius: 56 },
    onPause: null,
    onConfirm: null,
    onTap: null,
    enabled: false,
};

function normalize(out, x, y) {
    const len = Math.hypot(x, y);
    out.x = len ? x / len : 0;
    out.y = len ? y / len : 0;
}
function updateKeyboardMove() {
    let x = 0, y = 0, x2 = 0, y2 = 0;
    for (const k of keys) {
        const v = MOVE_KEYS[k];
        if (!v) continue;
        if (input.split && !P1_KEYS.has(k)) { x2 += v[0]; y2 += v[1]; }
        else { x += v[0]; y += v[1]; }
    }
    normalize(input.move2, x2, y2);
    if (!input.joy.active) normalize(input.move, x, y);
}
export function setSplitInput(split) {
    input.split = !!split;
    updateKeyboardMove();
}

// 게임패드: 왼쪽 스틱 또는 방향 패드. 시작(9)·선택(8) 버튼은 일시정지.
export const PAD_DEAD_ZONE = 0.22;
export function padVector(pad) {
    if (!pad) return { x: 0, y: 0 };
    let x = pad.axes?.[0] || 0, y = pad.axes?.[1] || 0;
    const b = i => !!pad.buttons?.[i]?.pressed;
    if (b(12)) y -= 1; if (b(13)) y += 1; if (b(14)) x -= 1; if (b(15)) x += 1;
    const len = Math.hypot(x, y);
    if (len < PAD_DEAD_ZONE) return { x: 0, y: 0 };
    const mag = Math.min(1, (len - PAD_DEAD_ZONE) / (1 - PAD_DEAD_ZONE));
    return { x: x / len * mag, y: y / len * mag };
}
// 연결 순서대로 [1P 패드, 2P 패드]. split(2P)일 때 패드 1개는 2P 전용 추가 컨트롤러.
export function assignPads(pads, split) {
    const list = (pads || []).filter(p => p && p.connected !== false);
    if (!split) return [list[0] || null, null];
    return list.length >= 2 ? [list[0], list[1]] : [null, list[0] || null];
}
const pausePressed = [false, false];
export function pollGamepads() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const [a, b] = assignPads(pads, input.split);
    [a, b].forEach((pad, i) => {
        Object.assign(input.pad[i], input.enabled ? padVector(pad) : { x: 0, y: 0 });
        const pause = !!(pad?.buttons?.[9]?.pressed || pad?.buttons?.[8]?.pressed);
        if (pause && !pausePressed[i]) input.onPause?.();
        pausePressed[i] = pause;
    });
}
const padActive = v => v.x !== 0 || v.y !== 0;
export function playerMove(index) {
    if (padActive(input.pad[index])) return input.pad[index];
    return index === 0 ? input.move : input.move2;
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
        if (MOVE_KEYS[e.code] && input.enabled) {
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
    input.move2.x = 0;
    input.move2.y = 0;
}

// Modal/practice boundaries must also release held keyboard state.
export function resetInput() { keys.clear(); resetJoy(); }
