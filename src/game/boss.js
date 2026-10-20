import { drawBossArtwork, drawBossSpriteSheet, initBossMotion, setBossMotion, hitBossMotion, recoverBossMotion, updateBossMotion } from './boss-appearance.js';
import { prepareBossSheets, getBossSheet } from './boss-sheets.js';
import { recordFusionHit } from './weapon-vfx.js';
// 보스: 3페이즈, 예고(텔레그래프) 기반 패턴, 페이즈 전환 연출, 처치 시 관 상자
import { G, rand, emit, pickWeighted } from './state.js';
import { BOSSES, PHASE_THRESHOLDS, HUNTER_TUNING, bossMaxHp } from '../data/bosses.js';
import { STAGES } from '../data/stages.js';
import { currentWeights } from './spawner.js';
import { atlases, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { fireEnemyShot, spawnEnemy, edgePosition } from './enemies.js';
import { spawnHazard } from './hazards.js';
import { damagePlayer } from './player.js';
import { dropGem, dropPickup } from './pickups.js';
import { BOSS_XP_GEMS, bossGemValue } from '../data/boss-rewards.js';
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
        this.maxHp = this.hp = bossMaxHp(stage);
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
        this.patternEpoch = 0;
        this.signatureCount = 0;
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
        if (cc && Math.random() < cc) { amount *= (G.player.stats.critMul || 3) + (opts.critBonus || 0); crit = true; }
        this.hp -= amount;
        this.flash = 0.06;
        if (amount > 0) recordFusionHit(this, opts.weapon, G.clock);
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
        this.cancelPatternWarnings();
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
        if (this.def.phaseSummons) this.patternSummon(6 + n * 3);
        else setBossMotion(this, 'recover', .35);
        this.speed = this.def.speed * (1 + n * 0.18);
        if (this.def.signature === 'hunt') this.task = this.hunterRecoveryTask();
        emit('bossPhase', n);
    }

    die() {
        this.cancelPatternWarnings();
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
        for (let i = 0; i < BOSS_XP_GEMS; i++) dropGem(this.x + rand(-80, 80), this.y + rand(-50, 50), bossGemValue(G.stage));
        const c = dropPickup('chest', this.x, this.y);
        c.boss = true;
        // 남은 적 탄 제거
        G.enemyShots.clear();
        emit('bossDefeated');
    }

    update(dt) {
        // A discarded Hunter must not release its second lock into a new stage
        // or a replacement player. Other boss lifecycles are unchanged.
        if (this.def.signature === 'hunt' && (G.stage !== this.stage || this.task?.target && this.task.target !== G.player)) {
            this.cancelPatternWarnings(); this.task = null; return;
        }
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
            if (this.def.signature === 'hunt') {
                const side = this.signatureCount % 2 ? 1 : -1;
                const forward = dist < 160 ? .35 : 1, lateral = .6 * side;
                const norm = Math.hypot(forward, lateral);
                this.x += (dx * forward - dy * lateral) / dist / norm * this.speed * dt;
                this.y += (dy * forward + dx * lateral) / dist / norm * this.speed * dt;
            } else {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
            if (Math.abs(dx) > 4) this.flip = dx < 0;
            this.attackT -= dt;
            if (this.attackT <= 0 && this.invuln <= 0) this.startPattern();
        }
        // 화면 밖으로 너무 멀어지면 빠르게 복귀
        if (this.def.signature !== 'hunt' && dist > Math.max(G.view.w, G.view.h) * 0.9) {
            this.x += (dx / dist) * 300 * dt;
            this.y += (dy / dist) * 300 * dt;
        }

        // 은신(헌터): 추적 중엔 반투명
        if (this.task && this.task.lockAlpha) { /* 순간이동 중: 패턴이 투명도 제어 */ }
        else if (this.def.stealth && !this.task) this.alpha += ((dist < 160 ? 1 : 0.18) - this.alpha) * Math.min(1, dt * 4);
        else this.alpha += (1 - this.alpha) * Math.min(1, dt * 6);

        if (this.def.signature === 'hunt') {
            // Active dashes use their swept collision below. Windups and the
            // guaranteed stationary recovery are safe to punish at close range.
            if (!this.task && Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius + 6) damagePlayer(this.dmg, this.x, this.y);
        } else if (dist < this.radius + p.radius + 6) damagePlayer(this.dmg, this.x, this.y);

        const fd = this.state === 'attack' ? 0.09 : 0.13;
        if (this.animT > fd) {
            this.animT = 0;
            this.anim++;
            if (this.state === 'attack' && this.anim >= this.atlas.frameCount('attack')) { this.state = 'walk'; this.anim = 0; }
        }
    }

    startPattern() {
        this.cancelPatternWarnings();
        const list = this.def.phases[this.phase];
        const weights = {};
        for (const k of list) weights[k] = k === this.lastPattern ? 0.3 : 1;
        // Every encounter opens with its defining move. Secondary moves never
        // replace the signature twice in a row, even after a phase transition.
        const name = this.lastPattern !== this.def.signature ? this.def.signature : pickWeighted(weights);
        this.lastPattern = name;
        this.state = 'attack'; this.anim = 0;
        this.signatureCount++;
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

    // ---- 고유 패턴 공통 안전 장치 ----
    cancelPatternWarnings() {
        this.patternEpoch++;
        // Own the callback, not the pooled hazard object: reused acid/friendly
        // hazards cannot accidentally inherit ownership from an old warning.
        for (let i = G.hazards.count - 1; i >= 0; i--) {
            const h = G.hazards.items[i];
            if (h.onFire?.bossOwner === this) { h.alive = false; G.hazards.release(i); }
        }
    }

    warn(kind, x, y, options, release) {
        const epoch = this.patternEpoch;
        const onFire = h => {
            if (!this.alive || this.patternEpoch !== epoch) return;
            setBossMotion(this, 'attack', .2);
            release?.(h);
        };
        onFire.bossOwner = this;
        return spawnHazard(kind, x, y, { ...options, onFire });
    }

    signatureTask(duration, rest = 2, minimumRest = 1.25) {
        return { t: 0, step: (dt, s) => {
            if (s.t >= duration) {
                this.endTask(rest);
                this.attackT = Math.max(minimumRest, this.attackT);
            }
        } };
    }

    fan(x, y, angle, count, spread, speed, kind = 'boss', size = 8) {
        setBossMotion(this, 'attack', .2);
        this.flip = Math.cos(angle) < 0;
        for (let i = 0; i < count; i++) {
            const a = angle + (count === 1 ? 0 : (i / (count - 1) - .5) * spread);
            fireEnemyShot(x, y, Math.cos(a), Math.sin(a), speed, this.dmg * .6, kind, size);
        }
    }

    circleHit(h, multiplier = .85) {
        const dx = G.player.x - h.x, dy = G.player.y - h.y;
        if (dx * dx + dy * dy / .49 < h.radius * h.radius) damagePlayer(this.dmg * multiplier, h.x, h.y);
        sparks(h.x, h.y, 12, h.color, 160);
    }

    lineHit(h, multiplier = .85) {
        const dx = G.player.x - h.x, dy = G.player.y - h.y;
        const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
        const across = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
        // Footpoint checks match the drawn rectangle exactly; no invisible
        // expansion outside the telegraph, and no new collision body radius.
        if (along >= 0 && along <= h.len && Math.abs(across) <= h.width / 2) damagePlayer(this.dmg * multiplier, h.x, h.y);
        for (let i = 0; i < 5; i++) sparks(h.x + Math.cos(h.angle) * h.len * i / 4, h.y + Math.sin(h.angle) * h.len * i / 4, 3, h.color, 110);
    }

    // 2: stationary, locked firing cone. Sidestepping the first sight line
    // defeats the entire burst; the long reload is a guaranteed opening.
    task_barrage() {
        setBossMotion(this, 'windup');
        const x = this.x, y = this.bodyY();
        const a = Math.atan2(G.player.y - 18 - y, G.player.x - x);
        // 변이: 각 사격이 3갈래 부채꼴. 광폭화: 양옆 측면 사격선이 반 박자 늦게 교차한다.
        const shots = 3 + this.phase, fanCount = this.phase ? 3 : 1, fanSpread = .28;
        let last = 1.15 + (shots - 1) * .24;
        for (let i = 0; i < shots; i++) {
            this.warn('tline', x, y, { angle: a, len: 760, width: 20, delay: 1.15 + i * .24, color: '#ffc35b' }, () => {
                for (const speed of [270, 315, 360]) this.fan(x, y, a, fanCount, fanSpread, speed, 'boss', 7);
                audio.sfx('shot');
            });
        }
        if (this.phase === 2) {
            for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
                const delay = 1.27 + .12 * (side + 1) + i * .48, flank = a + side * .55;
                last = Math.max(last, delay);
                this.warn('tline', x, y, { angle: flank, len: 760, width: 18, delay, color: '#ff9b4a' }, () => {
                    for (const speed of [290, 340]) this.fan(x, y, flank, 1, 0, speed, 'boss', 7);
                });
            }
        }
        audio.sfx('warn');
        return this.signatureTask(last + .32, 2.5, 1.8);
    }

    hunterRecoveryTask() {
        setBossMotion(this, 'recover');
        this.alpha = 1;
        return { t: 0, phase: 'recover', target: G.player, step: (dt, s) => {
            if (s.t < HUNTER_TUNING.recovery) return;
            this.endTask(1.8); this.attackT = Math.max(1.35, this.attackT);
            setBossMotion(this, 'walk');
        } };
    }

    // 3: fast lateral pursuit, then independently locked, visible dashes
    // (2 → 3 in mutation → 3 off-beat in frenzy).
    // Each tell gets a rendered state of its own, even after a long frame.
    task_hunt() {
        const task = { t: 0, elapsed: 0, phase: 'warning', strike: 0, dash: 0,
            target: G.player, speed: HUNTER_TUNING.dashSpeed * (1 + this.phase * HUNTER_TUNING.phaseSpeedStep), lane: null,
            warnings: HUNTER_TUNING.phaseWarnings[Math.min(this.phase, HUNTER_TUNING.phaseWarnings.length - 1)] };
        const lock = s => {
            const p = G.player, a = Math.atan2(p.y - this.y, p.x - this.x);
            const length = Math.min(HUNTER_TUNING.dashRange, Math.max(160, Math.hypot(p.x - this.x, p.y - this.y)));
            const radius = this.radius + p.radius + 6, warning = s.warnings[s.strike];
            // The rectangle conservatively encloses the entire swept capsule,
            // including contact radius at both ends. No invisible wider hit.
            s.lane = { angle: a, length, radius, warning };
            s.elapsed = 0; s.dash = 0; s.phase = 'warning';
            const onFire = () => {}; onFire.bossOwner = this;
            spawnHazard('tline', this.x - Math.cos(a) * radius, this.y - Math.sin(a) * radius,
                { angle: a, len: length + radius * 2, width: radius * 2, delay: warning, color: '#caa9ec', onFire });
            setBossMotion(this, 'windup'); this.alpha = 1;
            audio.sfx('warn');
        };
        const recover = () => { this.cancelPatternWarnings(); this.task = this.hunterRecoveryTask(); };
        task.step = (dt, s) => {
            if (G.stage !== this.stage || G.player !== s.target || !this.alive) { this.cancelPatternWarnings(); this.task = null; return; }
            if (s.phase === 'warning') {
                s.elapsed += dt;
                if (s.elapsed + 1e-9 >= s.lane.warning) {
                    this.cancelPatternWarnings(); s.phase = 'dash'; setBossMotion(this, 'attack');
                }
                return;
            }
            const { angle, length, radius } = s.lane;
            const d = Math.min(s.speed * dt, length - s.dash), ux = Math.cos(angle), uy = Math.sin(angle);
            const ox = this.x - G.player.x, oy = this.y - G.player.y;
            const projection = ox * ux + oy * uy, c = ox * ox + oy * oy - radius * radius;
            const discriminant = projection * projection - c;
            const contact = c <= 0 ? 0 : discriminant >= 0 ? -projection - Math.sqrt(discriminant) : Infinity;
            const hit = contact >= 0 && contact <= d;
            const move = hit ? contact : d;
            this.x += ux * move; this.y += uy * move; s.dash += move;
            this.flip = ux < 0;
            if (hit) { damagePlayer(this.dmg, this.x, this.y); recover(); return; }
            if (s.dash + 1e-9 < length) return;
            if (s.strike + 1 < s.warnings.length) { s.strike++; lock(s); }
            else recover();
        };
        lock(task);
        return task;
    }

    // 4: two separately acquired locks. Each follows briefly then stays
    // completely fixed for .55s, rewarding a direction change after lock-on.
    task_lockshot() {
        setBossMotion(this, 'windup');
        // 강화: 기본 저격 3회·3갈래 / 변이 4회 / 광폭화 5회·5갈래, 저격 간격 단축
        const lockCount = [3, 4, 5][this.phase] || 3, fanCount = this.phase === 2 ? 5 : 3, gap = 1.05, end = (lockCount - 1) * gap + 1.5;
        const task = { t: 0, locks: [], next: 0, step: (dt, s) => {
            while (s.next < lockCount && s.t >= s.next * gap) {
                const start = s.next * gap;
                const h = this.warn('tline', this.x, this.bodyY(), { angle: 0, len: 1000, width: 20, delay: 1.15, color: '#f58a98' }, line => {
                    this.fan(line.x, line.y, line.angle, fanCount, .28, 720, 'boss', 8);
                    audio.sfx('zap');
                });
                s.locks.push({ h, start }); s.next++;
                audio.sfx('warn');
            }
            for (const lock of s.locks) {
                if (s.t - lock.start <= .6) lock.h.angle = Math.atan2(G.player.y - 18 - lock.h.y, G.player.x - lock.h.x);
            }
            if (s.t > end) { this.endTask(2.1); this.attackT = Math.max(1.35, this.attackT); }
        } };
        task.step(0, task);
        return task;
    }

    // 5: a ground battery walks forward through three marked impact circles.
    // The flank/back stays open. Later phases add an offset return impact.
    task_artillery() {
        setBossMotion(this, 'windup');
        // 강화: 전진 포격 4발 + 기본부터 측면 귀환 포격 (변이: 양 측면, 광폭화: 양 측면 2열)
        const a = Math.atan2(G.player.y - this.y, G.player.x - this.x);
        const shots = [[110, 0], [215, 0], [320, 0], [425, 0], [270, 105]];
        if (this.phase >= 1) shots.push([270, -105]);
        if (this.phase === 2) shots.push([370, 150], [370, -150]);
        const count = shots.length;
        for (let i = 0; i < count; i++) {
            const [distance, side] = shots[i];
            const x = this.x + Math.cos(a) * distance - Math.sin(a) * side;
            const y = this.y + Math.sin(a) * distance + Math.cos(a) * side;
            this.warn('tcircle', x, y, { radius: 70, delay: 1.1 + i * .24, color: '#efae67' }, h => {
                this.circleHit(h); shake(5); audio.sfx('explode');
            });
        }
        audio.sfx('warn');
        return this.signatureTask(1.1 + (count - 1) * .24 + .35, 2.2, 1.3);
    }

    // 6: a horseshoe of acid, not random pools. Two missing sectors create
    // a wide permanent exit; phase changes rotate that opening, not its size.
    task_toxicTide() {
        setBossMotion(this, 'windup');
        const x = G.player.x, y = G.player.y, gap = Math.atan2(y - this.y, x - this.x) + this.phase * .35;
        // 강화: 기본부터 출구가 반대쪽인 두 번째 파도, 광폭화는 출구가 120도씩 도는 세 번째 파도. 웅덩이가 더 오래 남는다.
        const waves = this.phase === 2 ? 3 : 2, acid = [3.4, 4.0, 4.6][this.phase] || 3.4, turn = waves === 3 ? Math.PI * 2 / 3 : Math.PI;
        for (let w = 0; w < waves; w++) for (let i = 2; i <= 6; i++) {
            const a = gap + w * turn + i * Math.PI / 4;
            this.warn('tcircle', x + Math.cos(a) * 132, y + Math.sin(a) * 92.4, { radius: 48, delay: 1.2 + w * .85, color: '#b5df56' }, h => {
                this.circleHit(h, .55);
                spawnHazard('acid', h.x, h.y, { radius: h.radius, duration: acid, dmg: this.dmg * .23, tick: .4 });
            });
        }
        audio.sfx('warn');
        return this.signatureTask(1.55 + (waves - 1) * .85, 2.3, 1.4);
    }

    // 7: locked crossing slashes, then pursuit slashes re-aimed at the
    // player's current position. Every cut ends with a shadow-dagger fan from
    // the queen's landing point, so standing still in a safe quadrant fails.
    task_crosscut() {
        setBossMotion(this, 'windup');
        const x = G.player.x, y = G.player.y, angle = this.signatureCount % 2 ? Math.PI / 4 : -Math.PI / 4;
        // 기본: 교차 2줄 + 추격 1회 / 변이: 3줄 + 추격 1회 / 광폭화: 4줄(간격 단축) + 추격 2회
        const cuts = [2, 3, 4][this.phase] || 2, gapT = this.phase === 2 ? .55 : .8;
        const pursuits = this.phase === 2 ? 2 : 1, daggers = [3, 3, 5][this.phase] || 3;
        const len = 480, width = 50, pursuitWarn = .6;
        const strike = h => {
            this.x = h.x; this.y = h.y; this.alpha = 1; this.flip = Math.cos(h.angle) < 0;
            this.lineHit(h); audio.sfx('zap');
            // 그림자 단검: 착지 지점에서 연이를 향한 부채꼴
            const tx = G.player.x - h.x, ty = G.player.y - 18 - h.y, aim = Math.atan2(ty, tx);
            for (let k = 0; k < daggers; k++) {
                const a = aim + (daggers > 1 ? (k / (daggers - 1) - .5) * .5 : 0);
                fireEnemyShot(h.x, h.y, Math.cos(a), Math.sin(a), 230, this.dmg * .45, 'boss', 6);
            }
        };
        const pursue = left => {
            // 추격 베기: 현재 연이 위치를 지나가는 새 칼날 (예고 0.6초)
            const a = (this.signatureCount + left) % 2 ? Math.PI / 4 : -Math.PI / 4;
            const px = G.player.x, py = G.player.y;
            this.warn('tline', px - Math.cos(a) * len / 2, py - Math.sin(a) * len / 2, { angle: a, len, width, delay: pursuitWarn, color: '#ff6fd0' }, h => {
                strike(h);
                if (left > 1) pursue(left - 1);
            });
        };
        for (let i = 0; i < cuts; i++) {
            const a = angle + i * Math.PI / 2 + (i >= 2 ? Math.PI / 4 : 0);
            const sx = x - Math.cos(a) * len / 2, sy = y - Math.sin(a) * len / 2;
            this.warn('tline', sx, sy, { angle: a, len, width, delay: 1.05 + i * gapT, color: '#c68cff' }, h => {
                strike(h);
                if (i === cuts - 1) pursue(pursuits);
            });
        }
        audio.sfx('warn');
        return this.signatureTask(1.05 + (cuts - 1) * gapT + pursuits * pursuitWarn + .4, 2.0, 1.3);
    }

    // 8: two spatially separate echoes, each with a broad missing wedge.
    // The second is delayed and has a different escape bearing.
    task_echo() {
        setBossMotion(this, 'windup');
        const targetX = G.player.x, targetY = G.player.y;
        // 강화: 기본 메아리 3개 / 변이 4개 / 광폭화 4개·더 빠른 탄, 간격 단축·탄 수 증가
        const echoes = this.phase ? 4 : 3, gapT = this.phase === 2 ? .6 : .8, speed = this.phase === 2 ? 195 : 170;
        const spots = [[-115, -45, -.4], [115, 45, 1.2], [0, -120, 2.6], [0, 120, 4.0]];
        for (let i = 0; i < echoes; i++) {
            const x = this.x + spots[i][0], y = this.bodyY() + spots[i][1];
            const gap = Math.atan2(targetY - 18 - y, targetX - x) + spots[i][2];
            this.warn('tcircle', x, y, { radius: 32, delay: 1.2 + i * gapT, color: '#ba9af2' }, h => {
                // A 90-degree empty wedge remains even in the final phase.
                const n = 20 + this.phase * 3;
                for (let j = 0; j < n; j++) {
                    const a = gap + Math.PI / 4 + (j / (n - 1)) * Math.PI * 1.5;
                    fireEnemyShot(h.x, h.y, Math.cos(a), Math.sin(a), speed, this.dmg * .55, 'boss', 7);
                }
                sparks(h.x, h.y, 10, '#ba9af2', 90);
            });
        }
        audio.sfx('warn');
        return this.signatureTask(1.55 + (echoes - 1) * gapT, 2.1, 1.35);
    }

    // 9: outer fault lines hit first; the center is safe, then the delayed
    // hammer splits that center. The warning footprints are the damage test.
    task_faultline() {
        setBossMotion(this, 'windup');
        const x = G.player.x, y = G.player.y, a = Math.atan2(y - this.y, x - this.x);
        for (const offset of [-86, 86, 0]) {
            const sx = x - Math.cos(a) * 240 - Math.sin(a) * offset;
            const sy = y - Math.sin(a) * 240 + Math.cos(a) * offset;
            this.warn('tline', sx, sy, { angle: a, len: 480, width: 58, delay: offset === 0 ? 2.0 : 1.05, color: offset === 0 ? '#ffd08b' : '#ee825e' }, h => {
                this.lineHit(h, 1); shake(7); audio.sfx('explode');
            });
        }
        // 강화: 기본부터 중앙 강타 뒤 직각 균열(십자). 변이·광폭화는 대각선 X 균열이 이어진다.
        const crossDelay = 2.0 + (this.phase === 2 ? .55 : .75);
        const b = a + Math.PI / 2;
        this.warn('tline', x - Math.cos(b) * 240, y - Math.sin(b) * 240, { angle: b, len: 480, width: 58, delay: crossDelay, color: '#ffd08b' }, h => {
            this.lineHit(h, 1); shake(7); audio.sfx('explode');
        });
        let last = crossDelay;
        if (this.phase) {
            const xDelay = crossDelay + (this.phase === 2 ? .55 : .75);
            for (const d of [Math.PI / 4, -Math.PI / 4]) {
                const c = a + d;
                this.warn('tline', x - Math.cos(c) * 240, y - Math.sin(c) * 240, { angle: c, len: 480, width: 50, delay: xDelay, color: '#ffb36b' }, h => {
                    this.lineHit(h, 1); shake(6); audio.sfx('explode');
                });
            }
            last = xDelay;
        }
        audio.sfx('warn');
        return this.signatureTask(last + .4, 2.3, 1.4);
    }

    // 10: a contract snapshots your position. Coin interest is paid first;
    // the hourglass settles only after a full 2-second, nontracking countdown.
    task_contract() {
        setBossMotion(this, 'windup');
        const x = G.player.x, y = G.player.y;
        const angle = Math.atan2(y - 18 - this.bodyY(), x - this.x);
        // 강화: 금화 사격선 7/9/11줄·탄속 증가, 계약 원 2/2/3개, 결산 금화 확산
        const lines = 7 + this.phase * 2, spread = .6 + this.phase * .12, coinSpeed = 240 + this.phase * 25;
        for (let i = 0; i < lines; i++) {
            const a = angle + (i / (lines - 1) - .5) * spread;
            this.warn('tline', this.x, this.bodyY(), { angle: a, len: 860, width: 16, delay: 1.05, color: '#f2d383' }, h => {
                this.fan(h.x, h.y, h.angle, 1, 0, coinSpeed, 'coin', 8);
            });
        }
        const marks = this.phase === 2 ? 3 : 2;
        for (let i = 0; i < marks; i++) {
            const side = i === 0 ? 0 : i === 1 ? 1 : -1;
            const mx = x + Math.cos(angle + Math.PI / 2) * 135 * side;
            const my = y + Math.sin(angle + Math.PI / 2) * 135 * side;
            this.warn('tcircle', mx, my, { radius: 64, delay: 2.0 + i * .65, color: '#f2d383', symbol: 'hourglass' }, h => {
                this.circleHit(h, 1);
                // Settlement coins travel outward: leaving the contract early
                // is safer than returning to the old position after the volley.
                this.fan(h.x, h.y, angle + Math.PI, 11, Math.PI * 1.5, 150, 'coin', 7);
                audio.sfx('pickup');
            });
        }
        floatText(this.x, this.y - this.radius * 3, '계약 · 2초 후 결산', '#f2d383', 1.4);
        audio.sfx('warn');
        return this.signatureTask(2.35 + (marks - 1) * .65, 2.4, 1.5);
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
        count = Math.max(1, Math.round(Math.ceil(count * (this.def.pacing?.summons ?? 1)) * .60));
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
            this.warn('tcircle', x, y, {
                radius: 48, delay: 1.0 + i * 0.08, color: '#7dff4a',
            }, (h) => {
                    setBossMotion(this, 'attack', .16);
                    const pl = G.player;
                    const dx = pl.x - h.x, dy = pl.y - h.y;
                    if (dx * dx + (dy * dy) / 0.49 < h.radius * h.radius) damagePlayer(this.dmg * 0.8, h.x, h.y);
                    spawnHazard('acid', h.x, h.y, { radius: h.radius, duration: 4, dmg: this.dmg * 0.25, tick: 0.4 });
                    blood(h.x, h.y, 8, 0, 0, '#3f8a1a');
            });
        }
        audio.sfx('warn');
        return { step: (dt, s) => { if (s.t > 1.4) this.endTask(1.6); } };
    }

    task_slam() {
        setBossMotion(this, 'windup');
        const R = 150 + this.phase * 20;
        this.warn('tcircle', this.x, this.y, {
            radius: R, delay: 1.0, color: '#ff1a3a',
        }, (h) => {
                const pl = G.player;
                const dx = pl.x - h.x, dy = pl.y - h.y;
                if (dx * dx + (dy * dy) / 0.49 < R * R) damagePlayer(this.dmg * 1.3, h.x, h.y);
                shake(12);
                audio.sfx('explode');
                sparks(h.x, h.y, 20, '#ff6a3a', 300);
                for (let i = 0; i < 5; i++) decal(h.x + rand(-R / 2, R / 2), h.y + rand(-R / 3, R / 3), 'dark', 1.3);
                this.radial(16 + this.phase * 4, 0, 230, 8);
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
