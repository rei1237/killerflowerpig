// 개체 변이(affix): 같은 청토끼라도 방심할 수 없게 만드는 강한 개체와 엘리트 능력.
// - 챔피언: 일반 적 중 일부가 변이한다 (스테이지가 오를수록 비율 증가). 색 고리와 아이콘으로 구별된다.
// - 엘리트: 1~3개의 능력을 가진다. 능력마다 대처법이 다르다.
// 모든 무작위는 전용 시드 스트림을 쓴다. 전투·보급·코인 난수를 소비하지 않아 기존 재현성이 유지된다.
import { G } from './state.js';
import { fireEnemyShot } from './enemies.js';
import { spawnHazard } from './hazards.js';
import { floatText, sparks, shake } from './effects.js';
import { audio } from '../core/audio.js';
import { textSprite } from '../core/assets.js';
import { difficultyOf } from '../data/difficulty.js';

export function createAffixRandom(seed) {
    let state = (seed >>> 0) || 0x9e3779b9;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
const entropy = new Uint32Array(1);
if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy); else entropy[0] = Date.now() >>> 0;
export const affixRandom = { next: createAffixRandom(entropy[0]) };

// ───────────── 챔피언 (일반 적의 강한 개체) ─────────────
// 일반 청토끼와 효과가 겹치던 변이는 없앴다 (해당 개체는 일반 개체로 나온다):
//   강철(체력↑) = 변이 청토끼·사슬 도살자, 질풍(빠름) = 굶주린 청토끼, 폭발(사망 폭발) = 팽창체.
// 남은 챔피언은 일반 개체에 없는 '광폭'(큰 접촉 피해)뿐이다.
export const CHAMPIONS = Object.freeze({
    frenzied: { name: '광폭', icon: '🔥', color: '#ff5a5a', hp: 1.6, speed: 1.2, dmg: 1.7, scale: 1.12, xp: 2.4, hint: '접촉 피해가 크다' },
});
export const CHAMPION_KEYS = Object.freeze(Object.keys(CHAMPIONS));
// 1스테이지는 변이 없음. 2스테이지 3% → 10스테이지 약 15%.
export function championChance(stage) { return stage < 2 ? 0 : Math.min(0.2, 0.03 + (stage - 2) * 0.015); }

// ───────────── 엘리트 능력 ─────────────
export const ELITE_AFFIXES = Object.freeze({
    berserk: { name: '격노', icon: '😡', color: '#ff3b3b', hint: '체력 50% 이하에서 훨씬 빨라지고 강해진다' },
    summoner: { name: '소환사', icon: '🧟', color: '#b98cff', hint: '주기적으로 부하를 불러낸다' },
    barrier: { name: '방벽', icon: '🔷', color: '#5aa9ff', hint: '체력 위에 재생하는 방벽이 있다' },
    volley: { name: '난사', icon: '🔫', color: '#ff9f43', hint: '예고선 뒤 부채꼴 탄을 쏜다' },
    plague: { name: '역병', icon: '☣️', color: '#9be15d', hint: '지나간 자리에 독 웅덩이를 남긴다' },
    lunge: { name: '도약', icon: '⚡', color: '#ffe066', hint: '예고선 뒤 번개처럼 돌진한다' },
});
export const ELITE_AFFIX_KEYS = Object.freeze(Object.keys(ELITE_AFFIXES));
export function eliteAffixCount(stage) { return stage >= 9 ? 3 : stage >= 5 ? 2 : 1; }

function pickDistinct(keys, n, random) {
    const pool = [...keys], out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    return out;
}

// spawnEnemy 에서 호출: 챔피언/엘리트 변이를 확정하고 능력치를 조정한다.
export function applyVariant(e, def, opts, random = affixRandom.next) {
    e.champion = null; e.affixes = null; e.barrier = 0; e.barrierMax = 0; e.barrierIdle = 0;
    e.dmgCap = undefined; e.affixT = 0; e.affixWarn = 0; e.affixAim = 0; e.affixKind = null; e.minions = 0; e.enraged = false; e.baseSpeed = e.speed;
    if (opts.noAffix) return e;
    if (e.elite) {
        const n = opts.affixCount ?? Math.min(4, eliteAffixCount(G.stage) + (difficultyOf(G.difficulty).elite?.affixes || 0));
        e.affixes = opts.affixes || pickDistinct(ELITE_AFFIX_KEYS, n, random);
        e.affixT = 2 + random() * 2;
        if (e.affixes.includes('barrier')) { e.barrierMax = e.barrier = e.maxHp * 0.6; }
        return e;
    }
    if (opts.lineX || opts.lineY || opts.swarm || def.charge) return e; // 돌진 대열·러시·자폭체는 변이하지 않는다
    let key = opts.champion;
    if (key === undefined) {
        if (random() >= Math.min(0.4, championChance(G.stage) * (difficultyOf(G.difficulty).enemy?.champion || 1))) return e;
        key = CHAMPION_KEYS[Math.floor(random() * CHAMPION_KEYS.length)];
    }
    const c = CHAMPIONS[key];
    if (!c) return e;
    e.champion = key;
    e.maxHp = e.hp = e.maxHp * c.hp;
    e.speed *= c.speed; e.baseSpeed = e.speed;
    e.dmg *= c.dmg;
    e.scale *= c.scale; e.radius *= c.scale;
    e.mass *= 1.5;
    e.xp *= c.xp;
    return e;
}

// 사망 시 효과 (폭발 챔피언)
export function championDeathBlast(e) {
    const c = e.champion && CHAMPIONS[e.champion];
    return c?.blast ? { x: e.x, y: e.y, r: c.blast.radius, dmg: c.blast.dmg * (1 + (G.stage - 1) * 0.16) } : null;
}

// 방벽이 먼저 피해를 흡수한다. 남은 피해를 돌려준다.
export function absorbBarrier(e, amount) {
    if (!(e.barrier > 0)) return amount;
    e.barrierIdle = 0;
    const taken = Math.min(e.barrier, amount);
    e.barrier -= taken;
    if (e.barrier <= 0) { sparks(e.x, e.y - e.radius, 12, '#5aa9ff', 200); floatText(e.x, e.y - e.radius * 2.4, '방벽 파괴!', '#5aa9ff', 0.8); }
    return amount - taken;
}

// 엘리트 능력 갱신 (살아 있는 엘리트에만). 이동 보정은 e.speed 를 직접 바꾸고, 돌진은 넉백 속도로 구현한다.
export function updateAffixes(e, dt, p, dist, spawnMinion) {
    if (!e.affixes) return;
    const has = k => e.affixes.includes(k);
    // 격노: 체력 50% 이하에서 속도·피해 상승 (한 번만 선언)
    if (has('berserk')) {
        if (!e.enraged && e.hp <= e.maxHp * 0.5) {
            e.enraged = true; e.dmg = Math.min(e.dmg * 1.4, e.dmgCap ?? Infinity);
            floatText(e.x, e.y - e.radius * 2.6, '😡 격노!', '#ff3b3b', 1);
            shake(4); audio.sfx('warn');
        }
        e.speed = e.baseSpeed * (e.enraged ? 1.7 : 1);
    }
    // 방벽: 4.5초 동안 피격이 없으면 방벽이 서서히 복구된다
    if (e.barrierMax > 0 && e.barrier < e.barrierMax) {
        e.barrierIdle += dt;
        if (e.barrierIdle > 4.5) e.barrier = Math.min(e.barrierMax, e.barrier + e.barrierMax * 0.12 * dt);
    }
    // 예고 중인 행동 (난사 / 도약)
    if (e.affixWarn > 0) {
        e.affixWarn -= dt;
        if (e.affixWarn <= 0) {
            if (e.affixKind === 'volley') {
                const base = e.affixAim, n = 5 + (G.stage >= 7 ? 2 : 0); // 난사 탄 수 축소 (이전 7~9발)
                for (let i = 0; i < n; i++) {
                    const a = base + (i - (n - 1) / 2) * 0.15;
                    fireEnemyShot(e.x, e.y - e.radius, Math.cos(a), Math.sin(a), 230, e.dmg * 0.4, 'bullet', 5);
                }
                audio.sfx('zap');
            } else if (e.affixKind === 'lunge') {
                const a = e.affixAim;
                e.kx = Math.cos(a) * 2900; e.ky = Math.sin(a) * 2900;
                sparks(e.x, e.y, 8, '#ffe066', 200);
                audio.sfx('zap');
            }
            e.affixKind = null;
        }
        return;
    }
    e.affixT -= dt;
    if (e.affixT > 0) return;
    const ready = [];
    if (has('summoner') && e.minions < 6) ready.push('summoner');
    if (has('volley') && dist < 520) ready.push('volley');
    if (has('lunge') && dist < 480 && dist > 90) ready.push('lunge');
    if (has('plague')) ready.push('plague');
    if (!ready.length) { e.affixT = 1; return; }
    const kind = ready[Math.floor(affixRandom.next() * ready.length)];
    if (kind === 'summoner') {
        for (let i = 0; i < 2; i++) {
            const m = spawnMinion?.(e);
            if (m) e.minions++;
        }
        floatText(e.x, e.y - e.radius * 2.6, '🧟 부하 소환', '#b98cff', 0.9);
        audio.sfx('warn');
        e.affixT = 6;
    } else if (kind === 'plague') {
        spawnHazard('acid', e.x, e.y, { radius: 40, duration: 4.2, dmg: e.dmg * 0.2, tick: 0.4 });
        e.affixT = 1.7;
    } else {
        e.affixKind = kind;
        e.affixAim = Math.atan2(p.y - 18 - (e.y - e.radius), p.x - e.x);
        e.affixWarn = kind === 'lunge' ? 0.75 : 0.6;
        e.affixT = kind === 'lunge' ? 5.2 : 5.5; // 난사 간격 3.4 → 5.5초
    }
}

// 변이 표식 + 엘리트 예고선 (월드 좌표)
// 변이 고리는 바닥 표식이라 캐릭터보다 먼저, 색별로 한 번에 그린다 (개체마다 경로·stroke 를 만들지 않는다).
const ringGroups = new Map();
export function drawAffixRings(ctx, list) {
    for (const group of ringGroups.values()) group.length = 0;
    for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !(e.champion || e.affixes)) continue;
        const key = e.champion ? CHAMPIONS[e.champion].color + '|2' : ELITE_AFFIXES[e.affixes[0]].color + '|3';
        let group = ringGroups.get(key);
        if (!group) ringGroups.set(key, group = []);
        group.push(e);
    }
    const championAlpha = 0.55 + Math.sin(G.clock * 6) * 0.2, eliteAlpha = 0.6 + Math.sin(G.clock * 5) * 0.2;
    for (const [key, group] of ringGroups) {
        if (!group.length) continue;
        const [color, width] = key.split('|'), elite = width === '3';
        ctx.globalAlpha = elite ? eliteAlpha : championAlpha;
        ctx.strokeStyle = color; ctx.lineWidth = +width;
        ctx.beginPath();
        for (const e of group) {
            const rx = e.radius * (elite ? 1.3 : 1.25), ry = e.radius * (elite ? 0.52 : 0.5);
            ctx.moveTo(e.x + rx, e.y); ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// 변이 아이콘 + 엘리트 예고선 (월드 좌표). 고리는 drawAffixRings 가 그린다.
export function drawAffixMarks(ctx, e) {
    if (e.champion) {
        const s = textSprite(CHAMPIONS[e.champion].icon, '11px sans-serif', '#ffffff');
        ctx.drawImage(s.canvas, e.x - s.w / 2, e.y - e.atlas.walkH * e.scale - 4 - s.h * 0.7, s.w, s.h);
        return;
    }
    if (!e.affixes || !(e.affixWarn > 0)) return;
    ctx.save();
    {
        const y0 = e.y - e.radius, len = e.affixKind === 'lunge' ? 330 : 520;
        ctx.strokeStyle = e.affixKind === 'lunge' ? '#ffe066' : '#ff9f43';
        ctx.lineWidth = e.affixKind === 'lunge' ? 14 : 2; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(e.x, y0); ctx.lineTo(e.x + Math.cos(e.affixAim) * len, y0 + Math.sin(e.affixAim) * len); ctx.stroke();
    }
    ctx.restore();
}
