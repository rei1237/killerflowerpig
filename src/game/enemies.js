import { coinDropValue } from './coin-drops.js';
import { rollSupplies, KILL_OPPORTUNITY } from './supply-drops.js';
import { playerBody } from './player-motion.js';
// 적 시스템: 스폰, 추적 이동 + 상호 밀어내기(그리드), 원거리 공격, 상태이상, 피격/사망 처리
import { G, rand, emit } from './state.js';
import { ENEMIES, ELITE, DEATH_CLOUD_UNLOCK_STAGE, RANGED_UNLOCK_STAGE, stageScaling } from '../data/enemies.js';
import { STAGES } from '../data/stages.js';
import { atlases } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { goreProfile } from '../core/settings.js';
import { blood, gibs, decal, damageText, sparks, smoke, shake, hitstop } from './effects.js';
import { damagePlayer } from './player.js';
import { dropGem, dropPickup, dropCoin, pruneFieldSupplies } from './pickups.js';
import { spawnHazard } from './hazards.js';
import { recordFusionHit } from './weapon-vfx.js';

let nextId = 1;
const explosionQueue = [];
const HIT_CHANNELS = 16;
let sepFrame = 0;
const roleReducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function liveEnemyCount() { return G.enemies.count; }

export function spawnEnemy(typeId, x, y, opts = {}) {
    const st = STAGES[G.stage];
    // Every route shares the population budget, including force/elite/summon/split.
    const cap = Math.min(st.enemyCap ?? Infinity, G.caps.enemies ?? Infinity);
    if (G.enemies.count >= cap) return null;
    const def = ENEMIES[typeId];
    if (!def || G.stage < (def.unlockStage || 1) || (def.ranged && G.stage < RANGED_UNLOCK_STAGE)) return null;
    const sc = stageScaling(G.stage, G.time, st.duration);
    const e = G.enemies.spawn();
    const elite = !!opts.elite;
    e.id = nextId++;
    e.type = typeId;
    e.def = def;
    e.x = x; e.y = y;
    e.kx = 0; e.ky = 0;
    e.maxHp = e.hp = def.hp * sc.hp * (elite ? ELITE.hp : 1) * (opts.hpMul || 1);
    e.speed = def.speed * sc.speed * (elite ? ELITE.speed : 1) * rand(0.92, 1.08) * (opts.speedMul || 1);
    e.dmg = def.dmg * sc.dmg * (elite ? ELITE.dmg : 1);
    e.xp = def.xp * sc.xp * (elite ? ELITE.xp : 1);
    e.scale = def.scale * (elite ? ELITE.scale : 1);
    e.radius = def.radius * (elite ? ELITE.scale : 1);
    e.mass = def.mass * (elite ? 4 : 1);
    e.elite = elite;
    e.tint = elite ? 'elite' : def.tint;
    e.atlas = atlases[def.sheet];
    e.state = 'walk';
    e.anim = (Math.random() * 6) | 0;
    e.animT = 0;
    e.flash = 0;
    e.deadT = 0;
    e.flip = x > G.player.x;
    e.slow = 0; e.slowT = 0;
    e.bleed = 0; e.bleedT = 0;
    e.shootT = def.ranged ? rand(0.5, def.ranged.cooldown) : 0;
    e.attackT = 0;
    e.rolePhase = 'approach'; e.roleT = 0; e.aimX = 0; e.aimY = 0;
    e.shotWarning = 0;
    e.lineX = opts.lineX || 0; e.lineY = opts.lineY || 0;
    e.alive = true;
    if (!e.hits) e.hits = new Float32Array(HIT_CHANNELS);
    e.hits.fill(-99);
    return e;
}

// 플레이어 주변 시야 밖 링 위치
export function edgePosition(bias = 0.6) {
    const p = G.player;
    const r = Math.hypot(G.view.w, G.view.h) / 2 + 40;
    let a;
    if (Math.random() < bias && (p.vx || p.vy)) a = Math.atan2(p.vy, p.vx) + rand(-1.1, 1.1);
    else a = Math.random() * Math.PI * 2;
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.85 };
}

// 피해 처리. 반환: 실제 피해량
export function hitEnemy(e, dmg, opts = {}) {
    if (!e.alive) return 0;
    let amount = dmg;
    let crit = false;
    const critChance = (opts.crit || 0) + G.player.stats.crit;
    if (critChance > 0 && Math.random() < critChance) { amount *= G.player.stats.critMul || 2; crit = true; }
    if (opts.execute && !e.elite && e.hp - amount < e.maxHp * opts.execute) amount = e.hp;
    e.hp -= amount;
    e.flash = 0.08;
    if (amount > 0) recordFusionHit(e, opts.weapon, G.clock, opts.slow || 0);
    if (opts.kx !== undefined) {
        const kb = (opts.knock ?? 60) / e.mass;
        e.kx += opts.kx * kb; e.ky += opts.ky * kb;
    }
    if (opts.bleed) { e.bleed = Math.max(e.bleed, opts.bleed); e.bleedT = 2.5; }
    if (opts.slow) { e.slow = Math.max(e.slow, opts.slow); e.slowT = 0.5; }
    if (opts.weapon) G.damageBy[opts.weapon] = (G.damageBy[opts.weapon] || 0) + Math.min(amount, e.hp + amount);
    if (!opts.silent) {
        damageText(e.x, e.y - e.radius * 2.2, amount, crit);
        audio.sfx('hit');
    }
    if (Math.random() < 0.35) blood(e.x, e.y - e.radius, 2, opts.kx || 0, opts.ky || 0);
    if (e.hp <= 0) killEnemy(e, opts);
    return amount;
}

function killEnemy(e, opts) {
    e.alive = false;
    e.state = 'dead';
    e.anim = 0;
    e.animT = 0;
    e.deadT = 0;
    G.kills++;
    audio.sfx('squish');
    const gore = goreProfile();
    blood(e.x, e.y - e.radius, e.elite ? 24 : 8, opts.kx || 0, opts.ky || 0);
    if (gore.decals) decal(e.x + rand(-6, 6), e.y + rand(-3, 3), e.def.tint === 'toxic' ? 'green' : 'red', e.scale * 1.4);
    else smoke(e.x, e.y - 10, 3);
    gibs(e.x, e.y - e.radius, e.elite ? 10 : 3);
    if (e.elite) { shake(6); hitstop(0.06); }

    dropGem(e.x, e.y, e.xp * KILL_OPPORTUNITY);
    const coinValue = coinDropValue(e.elite);
    if (coinValue) dropCoin(e.x, e.y, coinValue);
    // Elite enemies award only XP and coins; gear chests are boss-exclusive.
    if (!e.elite) {
        pruneFieldSupplies();
        let healingOnField=0,magnetsOnField=0;
        for(let i=0;i<G.pickups.count;i++){
            if(G.pickups.items[i].kind==='meat')healingOnField++;
            if(G.pickups.items[i].kind==='magnet')magnetsOnField++;
        }
        const result=rollSupplies(G.supplyDrought,{hpRatio:G.player.hp/G.player.maxHp,healingOnField,magnetsOnField});
        G.supplyDrought=result.state;
        for(const kind of result.kinds)dropPickup(kind,e.x,e.y);
    }

    const def = e.def;
    if (opts.detonate && def.charge) explosionQueue.push({ x: e.x, y: e.y, r: def.charge.radius, dmg: Math.min(def.charge.damageCap, def.charge.dmg * (1 + (G.stage - 1) * 0.16)), suicide: true });
    if (def.explode) explosionQueue.push({ x: e.x, y: e.y, r: def.explode.radius, dmg: def.explode.dmg * (1 + (G.stage - 1) * 0.16) });
    if (def.split) {
        for (let i = 0; i < def.split.count; i++) {
            const a = (i / def.split.count) * Math.PI * 2;
            const c = spawnEnemy(def.split.type, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 10, { force: true, hpMul: 0.6 });
            if (c) { c.kx = Math.cos(a) * 160; c.ky = Math.sin(a) * 160; }
        }
        blood(e.x, e.y - 12, 14, 0, 0, '#3d0a3a');
    }
    emit('kill', e);
}

// 팽창체 폭발 등 지연 처리 (그리드 순회 중첩 방지)
const tmp = [];
export function flushExplosions() {
    while (explosionQueue.length) {
        const ex = explosionQueue.pop();
        const p = G.player;
        const dx = p.x - ex.x, dy = p.y - ex.y;
        if (dx * dx + dy * dy < (ex.r + p.radius) ** 2) damagePlayer(ex.dmg, ex.x, ex.y);
        const list = ex.suicide ? [] : G.grid.query(ex.x, ex.y, ex.r, tmp);
        for (const o of list) {
            if (!o.alive) continue;
            const ox = o.x - ex.x, oy = o.y - ex.y;
            if (ox * ox + oy * oy < ex.r * ex.r) hitEnemy(o, ex.dmg * 2, { silent: true, kx: ox / ex.r, ky: oy / ex.r, knock: 200 });
        }
        blood(ex.x, ex.y - 10, 26, 0, 0, '#5a1a6a');
        sparks(ex.x, ex.y, 10, '#c86bff', 220);
        if (!ex.suicide && G.stage >= DEATH_CLOUD_UNLOCK_STAGE) {
            spawnHazard('acid', ex.x, ex.y, { radius: ex.r * 0.7, duration: 3.5, dmg: ex.dmg * 0.25 });
        }
        shake(4);
        audio.sfx('explode');
    }
}

export function updateEnemies(dt) {
    const p = G.player;
    const pool = G.enemies;
    const grid = G.grid;
    grid.clear();
    for (let i = 0; i < pool.count; i++) {
        const e = pool.items[i];
        if (e.alive) grid.insert(e);
    }
    const recycleR = Math.hypot(G.view.w, G.view.h) * 0.75 + 120;
    sepFrame ^= 1;
    const gore = goreProfile();

    for (let i = pool.count - 1; i >= 0; i--) {
        const e = pool.items[i];
        if (!e.alive) {
            e.deadT += dt;
            e.animT += dt;
            const frames = e.atlas.frameCount('dead');
            if (gore.deathAnim) {
                if (e.animT > 0.075 && e.anim < frames - 1) { e.anim++; e.animT = 0; }
                if (e.deadT > frames * 0.075 + 0.35) pool.release(i);
            } else if (e.deadT > 0.15) pool.release(i);
            continue;
        }
        if (e.flash > 0) e.flash -= dt;

        // 상태이상
        let slowMul = 1;
        if (e.slowT > 0) { e.slowT -= dt; slowMul = 1 - e.slow; } else e.slow = 0;
        if (e.bleedT > 0) {
            e.bleedT -= dt;
            e.hp -= e.bleed * dt * 4;
            if (Math.random() < dt * 6) blood(e.x, e.y - e.radius, 1);
            if (e.hp <= 0) { killEnemy(e, {}); continue; }
        }

        // 이동
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        let mvx, mvy;
        let movementDt = dt;
        const charge = e.def?.charge;
        let justLocked = false;
        if (charge && e.rolePhase === 'approach' && dist < charge.range) {
            e.rolePhase = 'warning'; e.roleT = charge.warning;
            e.aimX = dx / dist; e.aimY = dy / dist;
            justLocked = true;
        }
        if (charge && e.rolePhase !== 'approach') {
            mvx = 0; mvy = 0;
            e.state = 'attack'; e.attackT = 0.4;
            // Each phase begins on its own frame. A stalled frame cannot spend
            // the next warning/fuse or turn one dash into unbounded movement.
            if (e.rolePhase === 'warning') {
                if (!justLocked) e.roleT = Math.max(0, e.roleT - dt);
                if (e.roleT <= 0) { e.rolePhase = 'dash'; e.roleT = charge.duration; }
            } else if (e.rolePhase === 'dash') {
                if (e.roleT <= 0 || dist < e.radius + p.radius + 12) {
                    e.rolePhase = 'fuse'; e.roleT = charge.fuse;
                } else {
                    movementDt = Math.min(Math.max(0, dt), e.roleT);
                    // Swept approach check stops at the player rather than
                    // tunneling past them when a long frame spends the dash.
                    const stopRadius = e.radius + p.radius + 12;
                    const along = dx * e.aimX + dy * e.aimY;
                    const across2 = Math.max(0, dx * dx + dy * dy - along * along);
                    const travel = charge.speed * slowMul * movementDt;
                    if (along > 0 && across2 < stopRadius * stopRadius) {
                        const untilContact = Math.max(0, along - Math.sqrt(stopRadius * stopRadius - across2));
                        if (untilContact < travel) {
                            movementDt = untilContact / Math.max(1e-9, charge.speed * slowMul);
                            e.roleT = 0;
                        }
                    }
                    e.roleT = Math.max(0, e.roleT - movementDt);
                    mvx = e.aimX * charge.speed / e.speed; mvy = e.aimY * charge.speed / e.speed;
                }
            } else if (e.rolePhase === 'fuse') {
                e.roleT = Math.max(0, e.roleT - dt);
                if (e.roleT <= 0) { killEnemy(e, { detonate: true }); continue; }
            }
        } else if (e.lineX || e.lineY) {
            mvx = e.lineX; mvy = e.lineY;
            if (dist > recycleR * 1.3) { pool.release(i); continue; }
        } else {
            mvx = dx / dist; mvy = dy / dist;
            const rg = e.def.ranged;
            if (rg && G.stage >= RANGED_UNLOCK_STAGE) {
                if (dist < rg.range * 0.55) { mvx = -mvx; mvy = -mvy; }
                else if (dist < rg.range) { mvx *= 0.1; mvy *= 0.1; }
                if (e.shotWarning > 0) {
                    mvx = 0; mvy = 0;
                    e.shotWarning -= dt;
                    e.state = 'attack'; e.attackT = 0.4;
                    if (e.shotWarning <= 0) fireEnemyShot(e.x, e.y - e.radius, e.aimX, e.aimY, rg.speed, rg.dmg * (1 + (G.stage - 1) * 0.16), rg.kind || 'acid', rg.radius || 7);
                } else {
                    e.shootT -= dt;
                    if (e.shootT <= 0 && dist < rg.range * 1.15) {
                        e.shootT = rg.cooldown * rand(0.85, 1.2);
                        if (rg.warning) {
                            const body = playerBody(p), aimDist = Math.hypot(body.x - e.x, body.y - (e.y - e.radius)) || 1;
                            e.aimX = (body.x - e.x) / aimDist; e.aimY = (body.y - (e.y - e.radius)) / aimDist;
                            e.shotWarning = rg.warning;
                        } else fireEnemyShot(e.x, e.y - e.radius, dx / dist, dy / dist, rg.speed, rg.dmg * (1 + (G.stage - 1) * 0.16), 'acid');
                        e.state = 'attack'; e.attackT = 0.4; e.anim = 0;
                    }
                }
            }
            // 시야 밖 너무 멀어지면 진행 방향 앞쪽으로 재배치 (뱀서 방식)
            if (dist > recycleR && !e.elite) {
                const pos = edgePosition(0.8);
                e.x = pos.x; e.y = pos.y;
                continue;
            }
        }
        const sp = e.speed * slowMul;
        e.x += (mvx * sp + e.kx) * movementDt;
        e.y += (mvy * sp + e.ky) * movementDt;
        const damp = Math.exp(-8 * dt);
        e.kx *= damp; e.ky *= damp;
        if (Math.abs(mvx) > 0.1) e.flip = mvx < 0;

        // 접촉 피해
        if (!charge && dist < e.radius + p.radius) {
            if (damagePlayer(e.dmg, e.x, e.y)) { e.state = 'attack'; e.attackT = 0.4; e.anim = 0; }
        }

        // 밀어내기 (군집이 겹치지 않고 '밀려오는' 느낌). 비용 절감: 스텝마다 절반씩 번갈아 처리
        if ((e.id + sepFrame) & 1) { animate(e, dt); continue; }
        const near = grid.query(e.x, e.y, e.radius * 2);
        for (let k = 0; k < near.length; k++) {
            const o = near[k];
            if (o === e || !o.alive) continue;
            const ox = e.x - o.x, oy = e.y - o.y;
            const rr = e.radius + o.radius;
            const d2 = ox * ox + oy * oy;
            if (d2 < rr * rr && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                const push = (rr - d) * 0.9 * (o.mass / (e.mass + o.mass));
                e.x += (ox / d) * push;
                e.y += (oy / d) * push;
            }
        }

        animate(e, dt);
    }
}

function animate(e, dt) {
    e.animT += dt;
    if (e.state === 'attack') {
        e.attackT -= dt;
        if (e.animT > 0.07) { e.animT = 0; e.anim++; }
        if (e.attackT <= 0) { e.state = 'walk'; e.anim = 0; }
    } else if (e.animT > 0.11) { e.animT = 0; e.anim++; }
}

export function fireEnemyShot(x, y, dx, dy, speed, dmg, kind = 'acid', radius = 7) {
    const s = G.enemyShots.spawn();
    s.x = x; s.y = y; s.vx = dx * speed; s.vy = dy * speed;
    s.accel = 0; // pooled boss projectiles must not accelerate ordinary bullets
    s.dmg = dmg; s.kind = kind; s.radius = radius; s.life = 5;
    return s;
}

export function updateEnemyShots(dt) {
    const p = G.player;
    const pool = G.enemyShots;
    for (let i = pool.count - 1; i >= 0; i--) {
        const s = pool.items[i];
        s.life -= dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.accel) { s.vx *= 1 + s.accel * dt; s.vy *= 1 + s.accel * dt; }
        if (s.life <= 0) { pool.release(i); continue; }
        const body = playerBody(p);
        const dx = body.x - s.x, dy = body.y - s.y;
        const r = s.radius + p.radius;
        if (dx * dx + dy * dy < r * r) {
            damagePlayer(s.dmg, s.x, s.y);
            if (s.kind === 'acid') blood(s.x, s.y, 4, 0, 0, '#3f8a1a');
            pool.release(i);
        }
    }
}

export function drawEnemy(ctx, e) {
    const atlas = e.atlas;
    let anim = 'walk';
    if (!e.alive) anim = 'dead';
    else if (e.state === 'attack') anim = 'attack';
    let tint = e.flash > 0 ? 'flash' : e.tint;
    if (G.hallucinate > 0 && e.alive && (e.id % 3 === 0)) tint = 'hallu';
    if (!e.alive) {
        const frames = atlas.frameCount('dead');
        const gp = goreProfile();
        if (!gp.deathAnim) { ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.15); anim = 'walk'; }
        else if (e.deadT > frames * 0.075) ctx.globalAlpha = Math.max(0, 1 - (e.deadT - frames * 0.075) / 0.35);
    }
    if (e.alive) drawRoleWarning(ctx, e);
    const roleArt = atlases[`enemyRole_${e.type}`];
    if (roleArt) {
        // New roles use dedicated art with restrained walk/attack/death poses.
        const reduced = roleReducedMotion?.matches;
        const bob = e.alive && e.state === 'walk' && !reduced ? Math.sin(e.anim * 1.4) * 1.5 : 0;
        ctx.save(); ctx.translate(e.x, e.y + bob);
        if (!e.alive) { ctx.globalAlpha *= Math.max(0, 1 - e.deadT / 0.4); ctx.rotate(e.flip ? -0.25 : 0.25); }
        else if (e.rolePhase === 'dash' || e.shotWarning > 0) ctx.rotate(e.flip ? -0.1 : 0.1);
        roleArt.draw(ctx, 'walk', 0, 0, 0, e.scale, e.flip, e.flash > 0 ? 'flash' : e.elite ? 'elite' : tint === 'hallu' ? 'hallu' : 'normal');
        ctx.restore();
    } else atlas.draw(ctx, anim, e.anim, e.x, e.y, e.scale, e.flip, tint);
    ctx.globalAlpha = 1;
    if (e.elite && e.alive) {
        const w = 40, h = 4, x = e.x - w / 2, y = e.y - atlas.walkH * e.scale - 10;
        ctx.fillStyle = '#1a0004';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = '#d4102c';
        ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
    }
}

function drawRoleWarning(ctx, e) {
    const charge = e.def?.charge;
    if (!(charge && e.rolePhase !== 'approach') && !(e.shotWarning > 0)) return;
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd17a'; ctx.fillStyle = 'rgba(255,95,40,0.12)';
    if (charge) {
        // The drawn blast circle exactly matches the collision circle.
        ctx.beginPath(); ctx.arc(e.x, e.y, charge.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (e.rolePhase === 'warning') {
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.aimX * charge.speed * charge.duration, e.y + e.aimY * charge.speed * charge.duration); ctx.stroke();
        }
        const progress = e.rolePhase === 'fuse' ? 1 - Math.max(0, e.roleT) / charge.fuse : 0;
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, charge.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    } else {
        ctx.beginPath(); ctx.moveTo(e.x, e.y - e.radius); ctx.lineTo(e.x + e.aimX * e.def.ranged.range, e.y - e.radius + e.aimY * e.def.ranged.range); ctx.stroke();
    }
    ctx.restore();
}

export function drawEnemyShots(ctx, fxImgs) {
    const pool = G.enemyShots;
    for (let i = 0; i < pool.count; i++) {
        const s = pool.items[i];
        if (s.kind === 'bullet') {
            ctx.save(); ctx.fillStyle = '#fff0bc'; ctx.strokeStyle = '#ff944a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); continue;
        }
        if(s.kind === 'coin'){
            ctx.save();ctx.translate(s.x,s.y);ctx.fillStyle='#e5bd64';ctx.strokeStyle='#fff0b0';ctx.lineWidth=1.5;
            ctx.beginPath();ctx.arc(0,0,s.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.strokeStyle='#725222';ctx.beginPath();ctx.moveTo(0,-s.radius*.55);ctx.lineTo(0,s.radius*.55);ctx.stroke();ctx.restore();continue;
        }
        const img = s.kind === 'boss' ? fxImgs.bossShot : fxImgs.enemyShot;
        const r = s.radius * 1.6;
        ctx.drawImage(img, s.x - r, s.y - r, r * 2, r * 2);
    }
}
