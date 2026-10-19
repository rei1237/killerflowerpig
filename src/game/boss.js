import { drawBossArtwork, drawBossSpriteSheet, initBossMotion, setBossMotion, hitBossMotion, recoverBossMotion, updateBossMotion } from './boss-appearance.js';
import { prepareBossSheets, getBossSheet } from './boss-sheets.js';
// 보스: 3페이즈, 예고(텔레그래프) 기반 패턴, 페이즈 전환 연출, 처치 시 관 상자
import { G, rand, emit, pickWeighted } from './state.js';
import { BOSSES, PHASE_THRESHOLDS } from '../data/bosses.js';
import { STAGES } from '../data/stages.js';
import { currentWeights } from './spawner.js';
import { atlases, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { fireEnemyShot, spawnEnemy, edgePosition } from './enemies.js';
import { spawnHazard } from './hazards.js';
import { damagePlayer } from './player.js';
import { dropGem, dropPickup } from './pickups.js';
import { blood, gibs, decal, damageText, shake, flash, hitstop, sparks, floatText, smoke } from './effects.js';

const SHOT_SPEED = 190;

export class Boss {
    constructor(stage) {
        const def = BOSSES[stage];
        this.def = def;
        this.stage = stage;
        this.atlas = atlases[def.sheet];
        this.scale = def.scale;
        this.tint = def.tint;
        this.radius = this.atlas.walkH * def.scale * 0.32;
        this.maxHp = this.hp = def.hp;
        this.speed = def.speed;
        this.dmg = def.dmg * (1 + (stage - 1) * 0.05);
        const pos = edgePosition(0.9);
        this.x = pos.x; this.y = pos.y;
        this.alive = true;
        initBossMotion(this);
        prepareBossSheets(stage);
        this.phase = 0;
        this.state = 'walk';
        this.anim = 0; this.animT = 0;
        this.flash = 0;
        this.flip = false;
        this.attackT = def.pacing?.opening ?? 2.2;
        this.task = null;      // 진행 중인 패턴
        this.lastPattern = null;
        this.invuln = 0;
        this.deadT = 0;
        this.hits = {};
        this.alpha = 1;
        this.vx = 0; this.vy = 0;
    }

    get phaseMul() { return 1 + this.phase * 0.25; }

    hurt(dmg, opts = {}) {
        if (!this.alive || this.invuln > 0) return 0;
        let amount = dmg;
        let crit = false;
        const cc = (opts.crit || 0) + G.player.stats.crit;
        if (cc && Math.random() < cc) { amount *= 2; crit = true; }
        this.hp -= amount;
        this.flash = 0.06;
        hitBossMotion(this);
        if (opts.weapon) G.damageBy[opts.weapon] = (G.damageBy[opts.weapon] || 0) + amount;
        if (!opts.silent) damageText(this.x + rand(-20, 20), this.y - this.radius * 2.5, amount, crit);
        if (Math.random() < 0.3) blood(this.x, this.y - this.radius, 3);
        const ratio = this.hp / this.maxHp;
        if (this.hp > 0 && this.phase < PHASE_THRESHOLDS.length && ratio <= PHASE_THRESHOLDS[this.phase]) this.enterPhase(this.phase + 1);
        if (this.hp <= 0) this.die();
        return amount;
    }

    enterPhase(n) {
        this.phase = n;
        this.invuln = 1.0;
        this.task = null;
        this.attackT = this.def.pacing?.phaseRest ?? 1.4;
        this.state = 'attack'; this.anim = 0;
        audio.sfx('boss');
        shake(12);
        flash(0.5, '#ff0022');
        hitstop(0.12);
        blood(this.x, this.y - this.radius, 40);
        gibs(this.x, this.y - this.radius, 12);
        floatText(this.x, this.y - this.radius * 3, n === 1 ? '변이가 가속된다!' : '★ 광폭화 ★', '#ff2244', 1.6);
        if (this.def.hallucinate) G.hallucinate = 1;
        this.patternSummon(6 + n * 3);
        this.speed = this.def.speed * (1 + n * 0.18);
        emit('bossPhase', n);
    }

    die() {
        this.alive = false;
        this.state = 'dead';
        setBossMotion(this, 'dead');
        this.anim = 0; this.animT = 0; this.deadT = 0;
        this.task = null;
        G.hallucinate = 0;
        audio.sfx('explode');
        audio.sfx('boss');
        shake(18);
        flash(0.9, '#ffffff');
        hitstop(0.3);
        blood(this.x, this.y - this.radius, 80);
        gibs(this.x, this.y - this.radius, 30);
        for (let i = 0; i < 6; i++) decal(this.x + rand(-60, 60), this.y + rand(-30, 30), 'dark', 2);
        for (let i = 0; i < 24; i++) dropGem(this.x + rand(-80, 80), this.y + rand(-50, 50), 5 + G.stage * 2);
        const c = dropPickup('chest', this.x, this.y);
        c.boss = true;
        // 남은 적 탄 제거
        G.enemyShots.clear();
        emit('bossDefeated');
    }

    update(dt) {
        updateBossMotion(this, dt);
        this.animT += dt;
        if (!this.alive) {
            this.deadT += dt;
            const n = this.atlas.frameCount('dead');
            if (this.animT > 0.14 && this.anim < n - 1) { this.anim++; this.animT = 0; }
            return;
        }
        if (this.flash > 0) this.flash -= dt;
        if (this.invuln > 0) this.invuln -= dt;
        const p = G.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (this.task) {
            this.task.t += dt;
            this.task.step(dt, this.task);
        } else {
            // 추적
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
            if (Math.abs(dx) > 4) this.flip = dx < 0;
            this.attackT -= dt;
            if (this.attackT <= 0 && this.invuln <= 0) this.startPattern();
        }
        // 화면 밖으로 너무 멀어지면 빠르게 복귀
        if (dist > Math.max(G.view.w, G.view.h) * 0.9) {
            this.x += (dx / dist) * 300 * dt;
            this.y += (dy / dist) * 300 * dt;
        }

        // 은신(헌터): 추적 중엔 반투명
        if (this.task && this.task.lockAlpha) { /* 순간이동 중: 패턴이 투명도 제어 */ }
        else if (this.def.stealth && !this.task) this.alpha += ((dist < 160 ? 1 : 0.18) - this.alpha) * Math.min(1, dt * 4);
        else this.alpha += (1 - this.alpha) * Math.min(1, dt * 6);

        if (dist < this.radius + p.radius + 6) damagePlayer(this.dmg, this.x, this.y);

        const fd = this.state === 'attack' ? 0.09 : 0.13;
        if (this.animT > fd) {
            this.animT = 0;
            this.anim++;
            if (this.state === 'attack' && this.anim >= this.atlas.frameCount('attack')) { this.state = 'walk'; this.anim = 0; }
        }
    }

    startPattern() {
        const list = this.def.phases[this.phase];
        const weights = {};
        for (const k of list) weights[k] = k === this.lastPattern ? 0.3 : 1;
        const name = pickWeighted(weights);
        this.lastPattern = name;
        this.state = 'attack'; this.anim = 0;
        this.task = this[`task_${name}`]();
        this.task.t = 0;
    }

    endTask(rest = 1.6) {
        this.task = null;
        recoverBossMotion(this);
        this.attackT = rest / this.phaseMul * rand(0.85, 1.15) * (this.def.pacing?.recovery ?? 1);
    }

    bodyY() { return this.y - this.radius; }

    radial(n, offset = 0, speed = SHOT_SPEED, size = 9) {
        setBossMotion(this, 'attack', .16);
        for (let i = 0; i < n; i++) {
            const a = offset + (i / n) * Math.PI * 2;
            fireEnemyShot(this.x, this.bodyY(), Math.cos(a), Math.sin(a), speed * this.phaseMul ** 0.5, this.dmg * 0.6, 'boss', size);
        }
    }

    // ---- 패턴 ----
    task_charge() {
        setBossMotion(this, 'windup');
        const p = G.player;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const len = 420;
        const warning = (this.def.pacing?.chargeWarning ?? 0.75) / Math.sqrt(this.phaseMul);
        spawnHazard('tline', this.x, this.y, { angle: a, len, width: this.radius * 2, delay: warning });
        audio.sfx('warn');
        return {
            phase: 0, a, len, dash: 0,
            step: (dt, s) => {
                if (s.phase === 0 && s.t > warning) { s.phase = 1; s.dash = 0; setBossMotion(this, 'attack'); shake(4); }
                if (s.phase === 1) {
                    const sp = this.def.pacing?.chargeSpeed ?? 620;
                    this.x += Math.cos(s.a) * sp * dt;
                    this.y += Math.sin(s.a) * sp * dt;
                    this.flip = Math.cos(s.a) < 0;
                    s.dash += sp * dt;
                    if (Math.random() < 0.6) smoke(this.x, this.y, 1, 'rgba(60,20,20,0.5)');
                    if (s.dash >= s.len) {
                        if (this.phase >= 1) this.radial(10 + this.phase * 4, Math.random());
                        this.endTask(1.4);
                    }
                }
            },
        };
    }

    task_ring() {
        setBossMotion(this, 'windup');
        return {
            n: 0,
            step: (dt, s) => {
                if (s.t > 0.35 * s.n + 0.3) {
                    this.radial(14 + this.phase * 5, s.n * 0.22);
                    s.n++;
                    if (s.n >= 2 + this.phase) this.endTask(1.8);
                }
            },
        };
    }

    task_spiral() {
        setBossMotion(this, 'windup');
        return {
            fireT: 0, ang: Math.random() * 6.28,
            step: (dt, s) => {
                s.fireT -= dt;
                if (s.fireT <= 0) {
                    s.fireT = 0.09;
                    setBossMotion(this, 'attack', .13);
                    const arms = 2 + this.phase;
                    for (let i = 0; i < arms; i++) {
                        const a = s.ang + (i / arms) * Math.PI * 2;
                        fireEnemyShot(this.x, this.bodyY(), Math.cos(a), Math.sin(a), 150, this.dmg * 0.5, 'boss', 8);
                    }
                    s.ang += 0.23;
                }
                if (s.t > 2.6) this.endTask(2);
            },
        };
    }

    task_aimed() {
        setBossMotion(this, 'windup');
        return {
            n: 0,
            step: (dt, s) => {
                if (s.t > 0.28 * s.n + 0.35) {
                    const p = G.player;
                    const base = Math.atan2(p.y - 18 - this.bodyY(), p.x - this.x);
                    setBossMotion(this, 'attack', .13);
                    this.flip = Math.cos(base) < 0;
                    const fan = 5 + this.phase * 2;
                    for (let i = 0; i < fan; i++) {
                        const a = base + (i / (fan - 1) - 0.5) * 0.9;
                        fireEnemyShot(this.x, this.bodyY(), Math.cos(a), Math.sin(a), 240, this.dmg * 0.6, 'boss', 8);
                    }
                    s.n++;
                    if (s.n >= 3) this.endTask(1.5);
                }
            },
        };
    }

    patternSummon(count) {
        setBossMotion(this, 'attack', .22);
        count = Math.ceil(count * (this.def.pacing?.summons ?? 1));
        const st = STAGES[G.stage];
        const table = currentWeights(st, st.duration);
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const e = spawnEnemy(pickWeighted(table), this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 60, { force: true, hpMul: 0.7 });
            if (e) { e.kx = Math.cos(a) * 200; e.ky = Math.sin(a) * 200; }
        }
        blood(this.x, this.y - this.radius, 20, 0, 0, '#3d0a3a');
    }

    task_summon() {
        setBossMotion(this, 'windup');
        return {
            step: (dt, s) => {
                if (s.t > 0.6) { this.patternSummon(6 + this.phase * 3); this.endTask(1.6); }
            },
        };
    }

    task_pools() {
        setBossMotion(this, 'windup');
        const p = G.player;
        const n = 4 + this.phase * 2;
        for (let i = 0; i < n; i++) {
            const x = p.x + (i === 0 ? 0 : rand(-170, 170));
            const y = p.y + (i === 0 ? 0 : rand(-120, 120));
            spawnHazard('tcircle', x, y, {
                radius: 48, delay: 1.0 + i * 0.08, color: '#7dff4a',
                onFire: (h) => {
                    setBossMotion(this, 'attack', .16);
                    const pl = G.player;
                    const dx = pl.x - h.x, dy = pl.y - h.y;
                    if (dx * dx + (dy * dy) / 0.49 < h.radius * h.radius) damagePlayer(this.dmg * 0.8, h.x, h.y);
                    spawnHazard('acid', h.x, h.y, { radius: h.radius, duration: 4, dmg: this.dmg * 0.25, tick: 0.4 });
                    blood(h.x, h.y, 8, 0, 0, '#3f8a1a');
                },
            });
        }
        audio.sfx('warn');
        return { step: (dt, s) => { if (s.t > 1.4) this.endTask(1.6); } };
    }

    task_slam() {
        setBossMotion(this, 'windup');
        const R = 150 + this.phase * 20;
        spawnHazard('tcircle', this.x, this.y, {
            radius: R, delay: 1.0, color: '#ff1a3a',
            onFire: (h) => {
                const pl = G.player;
                const dx = pl.x - h.x, dy = pl.y - h.y;
                if (dx * dx + (dy * dy) / 0.49 < R * R) damagePlayer(this.dmg * 1.3, h.x, h.y);
                shake(12);
                audio.sfx('explode');
                sparks(h.x, h.y, 20, '#ff6a3a', 300);
                for (let i = 0; i < 5; i++) decal(h.x + rand(-R / 2, R / 2), h.y + rand(-R / 3, R / 3), 'dark', 1.3);
                this.radial(16 + this.phase * 4, 0, 230, 8);
            },
        });
        audio.sfx('warn');
        return { step: (dt, s) => { if (s.t > 1.3) this.endTask(1.8); } };
    }

    task_snipe() {
        setBossMotion(this, 'windup');
        const h = spawnHazard('tline', this.x, this.bodyY(), { angle: 0, len: 900, width: 10, delay: 1.1, color: '#ff2a2a' });
        audio.sfx('warn');
        return {
            line: h, fired: false,
            step: (dt, s) => {
                const p = G.player;
                if (s.t < 0.75) {
                    s.line.x = this.x; s.line.y = this.bodyY();
                    s.line.angle = Math.atan2(p.y - 18 - this.bodyY(), p.x - this.x);
                }
                if (!s.fired && s.t >= 1.1) {
                    s.fired = true;
                    setBossMotion(this, 'attack', .2);
                    const a = s.line.angle;
                    this.flip = Math.cos(a) < 0;
                    for (let i = 0; i < 3; i++) {
                        const sh = fireEnemyShot(this.x, this.bodyY(), Math.cos(a), Math.sin(a), 720 + i * 40, this.dmg * 0.9, 'boss', 10);
                        sh.life = 2;
                    }
                    shake(5);
                    audio.sfx('zap');
                }
                if (s.t > 1.5) this.endTask(1.2);
            },
        };
    }

    task_blink() {
        setBossMotion(this, 'windup');
        const p = G.player;
        const a = Math.random() * Math.PI * 2;
        const tx = p.x + Math.cos(a) * 140, ty = p.y + Math.sin(a) * 100;
        spawnHazard('tcircle', tx, ty, { radius: this.radius * 1.6, delay: 0.7, color: '#c040ff' });
        return {
            tx, ty, moved: false, lockAlpha: true,
            step: (dt, s) => {
                this.alpha = Math.max(0.05, 1 - s.t * 3);
                if (!s.moved && s.t >= 0.7) {
                    s.moved = true;
                    smoke(this.x, this.y, 10, 'rgba(80,0,90,0.5)');
                    this.x = s.tx; this.y = s.ty;
                    this.alpha = 1;
                    const pl = G.player;
                    this.flip = pl.x < this.x;
                    if (Math.hypot(pl.x - this.x, pl.y - this.y) < this.radius * 1.6) damagePlayer(this.dmg, this.x, this.y);
                    this.radial(8 + this.phase * 4, Math.random(), 210);
                    blood(this.x, this.y - this.radius, 14);
                }
                if (s.t > 1.0) this.endTask(1.3);
            },
        };
    }

    draw(ctx) {
        const tint = this.flash > 0 ? 'flash' : this.tint;
        let anim = this.alive ? (this.state === 'attack' ? 'attack' : 'walk') : 'dead';
        if (this.alpha < 1) ctx.globalAlpha = this.alpha;
        if (!this.alive && this.deadT > 2.5) ctx.globalAlpha = Math.max(0, 1 - (this.deadT - 2.5));
        if (this.invuln > 0 && this.alive) ctx.globalAlpha = 0.6 + Math.sin(G.clock * 40) * 0.3;
        if (!drawBossSpriteSheet(ctx, this, getBossSheet(this.stage))) {
            if (!drawBossArtwork(ctx, this, G.clock, images[`bossArt${this.stage}`])) {
                // Keep the encounter playable if both art requests fail.
                this.atlas.draw(ctx, anim, this.anim, this.x, this.y, this.scale, this.flip, tint);
            }
        }
        ctx.globalAlpha = 1;
    }
}

export function spawnBoss() {
    const b = new Boss(G.stage);
    G.boss = b;
    audio.sfx('boss');
    shake(10);
    flash(0.4, '#550000');
    emit('bossSpawn', b);
    return b;
}
