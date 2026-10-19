// 오디오: BGM은 <audio>, 효과음은 WebAudio 합성. 같은 효과음은 최소 간격으로 스로틀링해
// 적이 수백 마리 죽어도 오실레이터가 폭증하지 않게 한다.
import { settings, onSettingsChange } from './settings.js';

const THROTTLE = {
    shot: 55, hit: 35, squish: 45, gem: 28, explode: 90, hurt: 120, fire: 120, saw: 90, zap: 80,
};

export const audio = {
    ctx: null,
    master: null,
    noise: null,
    bgm: null,
    epilogue: null,
    last: Object.create(null),
    unlocked: false,

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = settings.sfx;
        this.master.connect(this.ctx.destination);
        // 1초 화이트 노이즈 버퍼 (폭발/살점 소리 재사용)
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        this.bgm = new Audio('asset/audio/bgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = settings.bgm;
        this.bgm.preload = 'auto';

        onSettingsChange((k, v) => {
            if (k === 'sfx' && this.master) this.master.gain.value = v;
            if (k === 'bgm') {
                if (this.bgm) this.bgm.volume = v;
                if (this.epilogue) this.epilogue.volume = v;
            }
        });
    },

    unlock() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this.unlocked = true;
    },

    playBGM() {
        if (!this.bgm) return;
        if (this.epilogue) this.epilogue.pause();
        this.bgm.play().catch(() => {});
    },
    pauseBGM() { if (this.bgm) this.bgm.pause(); },
    setBGMRate(rate) { if (this.bgm) this.bgm.playbackRate = rate; },

    playEpilogue() {
        if (this.bgm) this.bgm.pause();
        if (!this.epilogue) {
            this.epilogue = new Audio('asset/audio/epilogue.mp3');
            this.epilogue.loop = true;
            this.epilogue.volume = settings.bgm;
        }
        this.epilogue.currentTime = 0;
        this.epilogue.play().catch(() => {});
    },
    stopEpilogue() { if (this.epilogue) this.epilogue.pause(); },

    tone(type, f0, f1, dur, vol, t = 0) {
        const c = this.ctx, now = c.currentTime + t;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, now);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.connect(g); g.connect(this.master);
        o.start(now); o.stop(now + dur + 0.02);
    },

    burst(dur, vol, freq, q = 1, t = 0) {
        const c = this.ctx, now = c.currentTime + t;
        const src = c.createBufferSource();
        src.buffer = this.noise;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(freq, now);
        f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), now + dur);
        f.Q.value = q;
        const g = c.createGain();
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(now, Math.random() * 0.5, dur + 0.05);
    },

    sfx(name) {
        if (!this.ctx || !this.unlocked || settings.sfx <= 0) return;
        const nowMs = performance.now();
        const gap = THROTTLE[name];
        if (gap && nowMs - (this.last[name] || 0) < gap) return;
        this.last[name] = nowMs;
        switch (name) {
            case 'shot': this.burst(0.08, 0.25, 2400); this.tone('square', 180, 60, 0.07, 0.06); break;
            case 'hit': this.tone('triangle', 260, 120, 0.05, 0.08); break;
            case 'squish': this.burst(0.14, 0.22, 900, 4); this.tone('sawtooth', 90, 40, 0.12, 0.05); break;
            case 'gem': this.tone('sine', 880 + Math.random() * 220, 1500, 0.06, 0.05); break;
            case 'explode': this.burst(0.45, 0.45, 700); this.tone('sawtooth', 80, 30, 0.35, 0.12); break;
            case 'hurt': this.tone('sawtooth', 160, 70, 0.18, 0.18); this.burst(0.1, 0.2, 500); break;
            case 'levelup':
                [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.12, 0.08, i * 0.07));
                break;
            case 'chest':
                [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.1, i * 0.09));
                break;
            case 'boss':
                this.tone('sawtooth', 55, 40, 1.4, 0.25); this.tone('square', 82, 60, 1.4, 0.12); this.burst(1.2, 0.2, 300);
                break;
            case 'heal': this.tone('sine', 440, 880, 0.2, 0.12); break;
            case 'pickup': this.tone('square', 600, 1200, 0.1, 0.07); break;
            case 'fire': this.burst(0.3, 0.12, 1800, 0.5); break;
            case 'saw': this.tone('sawtooth', 700, 500, 0.08, 0.04); break;
            case 'zap': this.tone('square', 1200, 200, 0.15, 0.07); this.burst(0.12, 0.12, 4000); break;
            case 'click': this.tone('square', 600, 1200, 0.05, 0.08); break;
            case 'deny': this.tone('square', 200, 150, 0.12, 0.08); break;
            case 'heartbeat':
                this.tone('sine', 70, 45, 0.12, 0.35); this.tone('sine', 65, 40, 0.12, 0.28, 0.16);
                break;
            case 'warn': this.tone('square', 440, 440, 0.12, 0.06); this.tone('square', 440, 440, 0.12, 0.06, 0.2); break;
            default: break;
        }
    },
};
