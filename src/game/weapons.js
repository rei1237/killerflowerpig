import { firingMuzzle } from './player-motion.js';
// 무기 런타임: 쿨다운 → 발사 패턴, 플레이어 투사체/광선/궤도체 업데이트 및 충돌
import { G, rand } from './state.js';
import { WEAPONS } from '../data/weapons.js';
import { fx, glow, images } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { hitEnemy } from './enemies.js';
import { spawnHazard } from './hazards.js';
import { sparks, petals, embers, shake } from './effects.js';
import { healPlayer, triggerPlayerShot } from './player.js';

export function createWeapon(id, slot) {
    return { id, slot, level: 1, evolved: false, cd: 0.4, activeT: 0, angle: 0, burst: 0, burstT: 0, trailT: 0, follow: null };
}

// 레벨·진화·패시브를 반영한 최종 수치
export function weaponStats(w) {
    const def = WEAPONS[w.id];
    const b = def.base;
    const ps = G.player.stats;
    const acc = { dmg: 0, cd: 0, amount: 0, area: 0, duration: 0, speed: 0, pierce: 0, slow: 0 };
    for (let i = 0; i < Math.min(8, Math.max(1, w.level)) - 1; i++) {
        const l = def.levels[i];
        for (const k in acc) if (l[k]) acc[k] += l[k];
    }
    const ev = w.evolved && def.evolve ? def.evolve.mods : {};
    const result = {
        dmg: (b.dmg + acc.dmg) * (ev.dmg || 1) * ps.might,
        cd: b.cd * Math.max(0.25, 1 + acc.cd) * (ev.cd || 1) * ps.cooldown,
        amount: Math.max(1, Math.round((b.amount + acc.amount + ps.amount) * (ev.amount || 1))),
        area: (1 + acc.area) * (ev.area || 1) * ps.area,
        duration: b.duration * (1 + acc.duration) * ps.duration,
        speed: b.speed * (1 + acc.speed) * ps.projSpeed,
        pierce: (b.pierce || 0) + acc.pierce + (ev.pierce || 0),
        slow: Math.min(0.85, (b.slow || 0) + acc.slow + (ev.slow || 0)),
        crit: ev.crit || 0, execute: ev.execute || 0, bleed: ev.bleed || 0,
        lifesteal: ev.lifesteal || 0, permanent: !!ev.permanent, trail: !!ev.trail, follow: !!ev.follow,
        spread: b.spread || 0, radius: b.radius || 0, tick: b.tick || 0.3, hitCd: b.hitCd || 0.3,
        length: b.length || 0, width: b.width || 0,
    };
    if (def.fusionOnly) {
        result.dmg = Math.min(220, result.dmg); result.cd = Math.max(0.5, result.cd);
        result.amount = Math.min(w.id === 'lotus_bloom' ? 3 : w.id === 'plague_fire' ? 5 : 12, result.amount);
        result.area = Math.min(2, result.area); result.duration = Math.min(w.id === 'lotus_bloom' ? 0.7 : 6, result.duration);
        result.pierce = Math.min(12, result.pierce); result.slow = Math.min(0.65, result.slow);
    }
    return result;
}

// 가장 가까운 적 (그리드 반경 확장 탐색)
const near = [];
export function nearestEnemy(x, y, maxR = 480) {
    let best = null, bd = maxR * maxR;
    for (let r = 120; r <= maxR; r *= 2) {
        const list = G.grid.query(x, y, r, near);
        for (const e of list) {
            if (!e.alive) continue;
            const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = e; }
        }
        if (best) break;
    }
    // 보스는 사거리 안이면 우선 조준 (거리 가중치 0.5)
    if (G.boss && G.boss.alive) {
        const dx = G.boss.x - x, dy = G.boss.y - y;
        const d = dx * dx + dy * dy;
        if (d < maxR * maxR && d * 0.25 < bd) best = G.boss;
    }
    return best;
}

function aimAt(w, target) {
    const p = G.player;
    if (!target) return [p.facingX, p.facingY];
    const dx = target.x - p.x, dy = (target.y - (target.radius || 20)) - (p.y - 22);
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
}

function shoot(w, s, dirX, dirY, opts) {
    const p = G.player;
    const sh = G.shots.spawn();
    sh.kind = 'bullet';
    sh.weapon = w.id;
    sh.slot = w.slot;
    const muzzle = images.playerFire ? firingMuzzle(p, G.clock, dirX) : { x: p.x + dirX * 16, y: p.y - 22 + dirY * 10 };
    sh.x = muzzle.x; sh.y = muzzle.y;
    sh.vx = dirX * s.speed; sh.vy = dirY * s.speed;
    sh.angle = Math.atan2(dirY, dirX);
    sh.dmg = s.dmg; sh.pierce = s.pierce; sh.life = s.duration;
    sh.radius = (opts.radius || 5) * s.area;
    sh.img = opts.img;
    sh.crit = s.crit; sh.execute = s.execute; sh.bleed = s.bleed;
    sh.knock = opts.knock ?? 60;
    sh.bounce = false;
    sh.spin = 0;
    sh.lastHit = sh.lastHit || [];
    sh.lastHit.length = 0;
    sh.evolved = w.evolved;
    return sh;
}

function lob(w, s, tx, ty, hazardKind) {
    const p = G.player;
    const sh = G.shots.spawn();
    sh.kind = 'lob';
    sh.weapon = w.id; sh.slot = w.slot;
    sh.sx = p.x; sh.sy = p.y - 30; sh.tx = tx; sh.ty = ty;
    sh.x = sh.sx; sh.y = sh.sy;
    sh.t = 0; sh.dur = 0.55; sh.life = 1;
    sh.hazard = hazardKind;
    sh.s = s;
    sh.img = (hazardKind === 'fire' || hazardKind === 'firegas') ? fx.bomb : null;
    sh.lastHit = sh.lastHit || [];
}

function randomEnemyNear(maxR) {
    const p = G.player;
    const b = G.boss;
    if (b && b.alive && Math.random() < 0.5 && Math.hypot(b.x - p.x, b.y - p.y) < maxR * 1.3) return b;
    const list = G.grid.query(p.x, p.y, maxR, near);
    let n = 0, pick = null;
    for (const e of list) {
        if (!e.alive) continue;
        n++;
        if (Math.random() * n < 1) pick = e; // 저수지 샘플링
    }
    return pick;
}

export function orbitStats(w, s) {
    return w.id === 'lotus_bloom' ? { ...s, dmg: s.dmg * 0.28, amount: Math.min(5, 3 + Math.floor((w.level - 1) / 3)), radius: 90, duration: 2.8, permanent: false } : s;
}
const FIRE = {
    lotus_bloom(w, s) { FIRE.cannon(w, s); w.activeT = 2.8; },
    scatter_rail(w, s) { FIRE.shotgun(w, s); },
    plague_fire(w, s) {
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(340), p = G.player;
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'firegas');
        }
    },
    shotgun(w, s) {
        const t = nearestEnemy(G.player.x, G.player.y, 420);
        const [dx, dy] = aimAt(w, t);
        triggerPlayerShot(dx);
        const base = Math.atan2(dy, dx);
        const n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = base + (n > 1 ? (i / (n - 1) - 0.5) * s.spread : 0) + rand(-0.05, 0.05);
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved ? fx.bossShot : fx.pellet, radius: 4, knock: 90 });
            sh.vx *= rand(0.85, 1.1); sh.vy *= rand(0.85, 1.1);
        }
        if (!images.playerFire) sparks(G.player.x + dx * 22, G.player.y - 22 + dy * 10, 5, '#ffcf6b', 140);
        shake(1.5);
        audio.sfx('shot');
    },
    pistols(w, s) {
        w.burst = s.amount;
        w.burstT = 0;
    },
    rifle(w, s) {
        const t = nearestEnemy(G.player.x, G.player.y, 700);
        const [dx, dy] = aimAt(w, t);
        triggerPlayerShot(dx);
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < s.amount; i++) {
            const a = base + (i === 0 ? 0 : rand(-0.35, 0.35));
            shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.rail, radius: w.evolved ? 9 : 6, knock: 120 });
        }
        audio.sfx(w.evolved ? 'zap' : 'shot');
    },
    thorns(w, s) {
        w.activeT = s.duration;
    },
    molotov(w, s) {
        const p = G.player;
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(320);
            const tx = e ? e.x : p.x + rand(-200, 200);
            const ty = e ? e.y : p.y + rand(-150, 150);
            lob(w, s, tx, ty, 'fire');
        }
    },
    cannon(w, s) {
        const p = G.player;
        let base;
        const t = nearestEnemy(p.x, p.y, 520);
        if (p.vx || p.vy || !t) base = Math.atan2(p.facingY, p.facingX);
        else { const [dx, dy] = aimAt(w, t); base = Math.atan2(dy, dx); }
        const n = s.amount;
        for (let i = 0; i < n; i++) {
            const a = base + (i / n) * Math.PI * 2 + (w.evolved ? G.clock * 0.6 : 0);
            fireBeam(w, s, a);
        }
        shake(4);
        audio.sfx('zap');
    },
    gas(w, s) {
        const p = G.player;
        if (s.follow) {
            if (!w.follow || !w.follow.alive) {
                w.follow = spawnHazard('gas', p.x, p.y, { radius: s.radius * s.area, duration: 9999, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: w.id, follow: true });
            } else {
                w.follow.radius = 70 * s.area; w.follow.dmg = s.dmg; w.follow.slow = s.slow;
            }
            return;
        }
        for (let i = 0; i < s.amount; i++) {
            const e = randomEnemyNear(300);
            lob(w, s, e ? e.x : p.x + rand(-180, 180), e ? e.y : p.y + rand(-140, 140), 'gas');
        }
    },
    saw(w, s) {
        for (let i = 0; i < s.amount; i++) {
            const a = Math.random() * Math.PI * 2;
            const sh = shoot(w, s, Math.cos(a), Math.sin(a), { img: w.evolved ? fx.sawBone : fx.saw, radius: 14, knock: 40 });
            sh.kind = 'saw';
            sh.pierce = 9999;
            sh.bounce = true;
            sh.hitCd = s.hitCd;
        }
        audio.sfx('saw');
    },
};

function fireBeam(w, s, angle) {
    triggerPlayerShot(Math.cos(angle));
    const p = G.player;
    const b = G.beams.spawn();
    const muzzle = images.playerFire ? firingMuzzle(p, G.clock, Math.cos(angle)) : { x: p.x, y: p.y - 22 };
    b.weapon = w.id;
    b.x = muzzle.x; b.y = muzzle.y;
    b.angle = angle;
    b.len = s.length * Math.sqrt(s.area);
    b.width = s.width * s.area;
    b.life = s.duration; b.max = s.duration;
    b.evolved = w.evolved;
    // 즉시 판정: 선분-원 거리
    const cx = Math.cos(angle), cy = Math.sin(angle);
    const hw = b.width / 2;
    const pool = G.enemies;
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (!e.alive) continue;
        const ex = e.x - b.x, ey = (e.y - e.radius) - b.y;
        const along = ex * cx + ey * cy;
        if (along < 0 || along > b.len) continue;
        const perp = Math.abs(ex * cy - ey * cx);
        if (perp < hw + e.radius) hitEnemy(e, s.dmg, { weapon: w.id, kx: cx, ky: cy, knock: 160, crit: s.crit });
    }
    const boss = G.boss;
    if (boss && boss.alive) {
        const ex = boss.x - b.x, ey = (boss.y - boss.radius) - b.y;
        const along = ex * cx + ey * cy;
        if (along > 0 && along < b.len && Math.abs(ex * cy - ey * cx) < hw + boss.radius) boss.hurt(s.dmg, { weapon: w.id });
    }
    for (let i = 0; i < 10; i++) {
        const t = Math.random() * b.len;
        petals(b.x + cx * t, b.y + cy * t, 1);
    }
}

export function updateWeapons(dt) {
    const p = G.player;
    if (p.dead) return;
    for (const w of G.weapons) {
        const s = weaponStats(w);
        w.s = s;
        // 쌍권총 연사 버스트
        if (w.burst > 0) {
            w.burstT -= dt;
            if (w.burstT <= 0) {
                w.burstT = 0.07;
                const t = nearestEnemy(p.x, p.y, 520);
                const [dx, dy] = aimAt(w, t);
                const side = (w.burst % 2 ? 1 : -1) * 0.06;
                const a = Math.atan2(dy, dx) + side;
                shoot(w, s, Math.cos(a), Math.sin(a), { img: fx.bullet, radius: 5, knock: 50 });
                triggerPlayerShot(dx);
                audio.sfx('shot');
                w.burst--;
            }
        }
        // 연꽃 가시 궤도
        if ((w.id === 'thorns' || w.id === 'lotus_bloom') && (w.activeT > 0 || s.permanent)) {
            if (!s.permanent) w.activeT -= dt;
            w.angle += WEAPONS.thorns.base.speed * dt;
            updateOrbit(w, orbitStats(w, s));
        }
        // 지옥 불꽃길
        if (s.trail) {
            w.trailT -= dt;
            if (w.trailT <= 0 && (p.vx || p.vy)) {
                w.trailT = 0.3;
                spawnHazard('fire', p.x, p.y, { radius: 30 * s.area, duration: 2, dmg: s.dmg * 0.6, tick: 0.3, weapon: w.id });
            }
        }
        w.cd -= dt;
        if (w.cd <= 0) {
            if (w.id === 'thorns' && s.permanent) { w.cd = 1; continue; }
            if (w.id === 'thorns' && w.activeT > 0) { w.cd = 0.1; continue; }
            w.cd = s.cd;
            FIRE[w.id](w, s);
        }
    }
}

const orbitList = [];
function updateOrbit(w, s) {
    const p = G.player;
    const n = s.amount;
    const R = s.radius * s.area;
    const pr = 12 * s.area;
    const now = G.clock;
    for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * R, oy = p.y - 20 + Math.sin(a) * R * 0.8;
        const list = G.grid.query(ox, oy + 10, pr + 24, orbitList);
        for (const e of list) {
            if (!e.alive) continue;
            const dx = e.x - ox, dy = (e.y - e.radius) - oy;
            const rr = pr + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            if (now - e.hits[w.slot] < s.hitCd) continue;
            e.hits[w.slot] = now;
            const d = hitEnemy(e, s.dmg, { weapon: w.id, kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: 90, crit: s.crit });
            if (s.lifesteal && d) healPlayer(s.lifesteal);
        }
        const boss = G.boss;
        if (boss && boss.alive && now - (boss.hits[w.slot] || -9) > s.hitCd) {
            const dx = boss.x - ox, dy = (boss.y - boss.radius) - oy;
            if (dx * dx + dy * dy < (pr + boss.radius) ** 2) {
                boss.hits[w.slot] = now;
                boss.hurt(s.dmg, { weapon: w.id });
                if (s.lifesteal) healPlayer(s.lifesteal);
            }
        }
    }
}

const shotList = [];
export function updateShots(dt) {
    const pool = G.shots;
    const cam = G.camera;
    const hw = G.view.w / 2, hh = G.view.h / 2;
    const now = G.clock;
    for (let i = pool.count - 1; i >= 0; i--) {
        const sh = pool.items[i];
        if (sh.kind === 'lob') {
            sh.t += dt;
            const k = Math.min(1, sh.t / sh.dur);
            sh.x = sh.sx + (sh.tx - sh.sx) * k;
            sh.y = sh.sy + (sh.ty - sh.sy) * k - Math.sin(k * Math.PI) * 70;
            sh.spin = (sh.spin || 0) + dt * 12;
            if (k >= 1) {
                const s = sh.s;
                if (sh.hazard === 'fire' || sh.hazard === 'firegas') {
                    spawnHazard('fire', sh.tx, sh.ty, { radius: s.radius * s.area, duration: s.duration, dmg: s.dmg, tick: s.tick, slow: sh.hazard === 'firegas' ? s.slow : 0, weapon: sh.weapon });
                    embers(sh.tx, sh.ty, 10);
                    audio.sfx('fire');
                } else {
                    spawnHazard('gas', sh.tx, sh.ty, { radius: s.radius * s.area, duration: s.duration, dmg: s.dmg, tick: s.tick, slow: s.slow, weapon: sh.weapon });
                }
                pool.release(i);
            }
            continue;
        }
        sh.life -= dt;
        if (sh.life <= 0) { pool.release(i); continue; }
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.kind === 'saw') {
            sh.spin += dt * 14;
            if (sh.bounce) {
                if (sh.x < cam.x - hw + 10 && sh.vx < 0) sh.vx = -sh.vx;
                if (sh.x > cam.x + hw - 10 && sh.vx > 0) sh.vx = -sh.vx;
                if (sh.y < cam.y - hh + 10 && sh.vy < 0) sh.vy = -sh.vy;
                if (sh.y > cam.y + hh - 10 && sh.vy > 0) sh.vy = -sh.vy;
            }
        }
        const list = G.grid.query(sh.x, sh.y + 16, sh.radius + 28, shotList);
        let dead = false;
        for (let k = 0; k < list.length && !dead; k++) {
            const e = list[k];
            if (!e.alive) continue;
            const dx = e.x - sh.x, dy = (e.y - e.radius) - sh.y;
            const rr = sh.radius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            if (sh.kind === 'saw') {
                if (now - e.hits[sh.slot] < sh.hitCd) continue;
                e.hits[sh.slot] = now;
            } else {
                if (sh.lastHit.includes(e.id)) continue;
                sh.lastHit.push(e.id);
            }
            const sp = Math.hypot(sh.vx, sh.vy) || 1;
            hitEnemy(e, sh.dmg, { weapon: sh.weapon, kx: sh.vx / sp, ky: sh.vy / sp, knock: sh.knock, crit: sh.crit, execute: sh.execute, bleed: sh.bleed });
            if (--sh.pierce <= 0) dead = true;
        }
        const boss = G.boss;
        if (!dead && boss && boss.alive) {
            const dx = boss.x - sh.x, dy = (boss.y - boss.radius) - sh.y;
            const rr = sh.radius + boss.radius;
            if (dx * dx + dy * dy < rr * rr) {
                if (sh.kind === 'saw') {
                    if (now - (boss.hits[sh.slot] || -9) >= sh.hitCd) { boss.hits[sh.slot] = now; boss.hurt(sh.dmg, { weapon: sh.weapon, crit: sh.crit }); }
                } else if (!sh.lastHit.includes(-1)) {
                    sh.lastHit.push(-1);
                    boss.hurt(sh.dmg, { weapon: sh.weapon, crit: sh.crit });
                    sparks(sh.x, sh.y, 3, '#ff5a6a');
                    if (--sh.pierce <= 0) dead = true;
                }
            }
        }
        if (dead) pool.release(i);
    }
    const beams = G.beams;
    for (let i = beams.count - 1; i >= 0; i--) {
        const b = beams.items[i];
        b.life -= dt;
        if (b.life <= 0) beams.release(i);
    }
}

export function drawShots(ctx) {
    const pool = G.shots;
    for (let i = 0; i < pool.count; i++) {
        const sh = pool.items[i];
        if (sh.kind === 'lob') {
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate(sh.spin);
            if (sh.hazard === 'fire' || sh.hazard === 'firegas') ctx.drawImage(fx.bomb, -11, -11, 22, 22);
            else { ctx.fillStyle = '#3b6b1a'; ctx.fillRect(-6, -8, 12, 16); ctx.fillStyle = '#7dff4a'; ctx.fillRect(-3, -11, 6, 4); }
            ctx.restore();
            continue;
        }
        const img = sh.img;
        if (sh.kind === 'saw') {
            const s = sh.radius * 2.4;
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate(sh.spin);
            ctx.drawImage(img, -s / 2, -s / 2, s, s);
            ctx.restore();
        } else {
            const w = img.width * (sh.radius / 5), h = img.height * (sh.radius / 5);
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate(sh.angle);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        }
    }
    // 연꽃 가시
    for (const w of G.weapons) {
        if ((w.id !== 'thorns' && w.id !== 'lotus_bloom') || !w.s || !(w.activeT > 0 || w.s.permanent)) continue;
        const s = orbitStats(w, w.s), p = G.player;
        const n = s.amount, R = s.radius * s.area, size = 26 * s.area;
        const img = w.evolved ? fx.petalBlood : fx.petal;
        for (let i = 0; i < n; i++) {
            const a = w.angle + (i / n) * Math.PI * 2;
            const ox = p.x + Math.cos(a) * R, oy = p.y - 20 + Math.sin(a) * R * 0.8;
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(a * 2);
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
    }
    // 꽃잎 광선
    const beams = G.beams;
    if (beams.count) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < beams.count; i++) {
            const b = beams.items[i];
            const k = b.life / b.max;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.angle);
            ctx.globalAlpha = k;
            const w = b.width * (0.6 + 0.4 * k);
            ctx.fillStyle = b.evolved ? '#ff2a6a' : '#ff69b4';
            ctx.fillRect(0, -w / 2, b.len, w);
            ctx.fillStyle = '#ffe0f0';
            ctx.fillRect(0, -w / 6, b.len, w / 3);
            const g = glow('#ff69b4', 40);
            ctx.drawImage(g, -40, -40);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}
