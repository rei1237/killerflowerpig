// 2P 협동: 영냥이(2P)가 연이(1P)와 같은 화면에서 함께 싸운다.
// 기술은 연이 아틀리에(yeoni-atelier)의 '월정석 사냥' 영냥이 키트(사주 성광·별자리 궤도·초승달 부메랑·
// 타로 낙하·달빛 수호부)를 이 게임 전투에 맞게 옮겼다. 영냥이는 1P보다 약하므로 원작보다 피해 +45~70%,
// 재사용 대기 -15~20%, 범위·개수를 상향했다.
// - 영냥이는 자기 경험치로 레벨업하고, 레벨업마다 기술·부적을 직접 고른다 (src/data/partner-kit.js).
// - 조합: 기술 Lv5 + 짝 부적 → 진화 기술 (사주 성광 + 별 방울 → 사주 월광참 등).
// - 2P가 쓰러지면 잠시 뒤 연이 곁에서 부활한다. 런 실패는 1P가 쓰러질 때만이다.
// - 2P 모드에서는 동행 펫 영냥이를 쓸 수 없다 (같은 영냥이가 직접 싸운다).
import { G, emit } from './state.js';
import { playerMove } from '../core/input.js';
import { glow } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { hitEnemy } from './enemies.js';
import { sparks, floatText, damageText } from './effects.js';
import { healPlayer } from './player.js';
import { difficultyOf } from '../data/difficulty.js';
import { PARTNER_SKILL_KIT, PARTNER_SKILL_ORDER, PARTNER_CHARMS, PARTNER_CHARM_ORDER, PARTNER_SKILL_MAX, PARTNER_CHARM_MAX,
    PARTNER_EVOLVED_POWER, PARTNER_SKILL_GROWTH, PARTNER_START, PARTNER_XP, partnerXpBase,
    PARTNER_COMPLEMENT_BONUS, PARTNER_COMPLEMENT_WEIGHT, complementFor } from '../data/partner-kit.js';
export { PARTNER_SKILL_ORDER };

export const PARTNER_ID = 'coop_yeongnyang';
export const PARTNER = Object.freeze({
    name: '영냥이', hp: 90, hpPerLevel: 4, speed: 142, radius: 10, bodyOffset: 14,
    reviveTime: 10, reviveHp: 0.5, reviveIframes: 2, hurtIframes: 0.5,
    // 영냥이 레벨·구역에 따른 기본 성장 (기술 레벨 성장은 PARTNER_SKILL_GROWTH).
    // basePower: 영냥이가 직접 성장하게 된 뒤 화력이 연이를 넘지 않도록 (거친 협동 시뮬레이션에서 전체 피해의 1구역 30~57%, 4구역 21~60% — 처치 몫이라 실제 플레이로 재조정 필요)
    basePower: 0.5, levelPower: 0.04, stagePower: 0.15,
});
// 원작(hunt-kit) 대비: 성광 36→52 피해·0.85→0.7초, 궤도 7→12 피해·별 2→3개, 부메랑 22→34·1.3→1.1초,
// 타로 38→60·2.1→1.8초, 수호부 피해 감소 12→20%·회복 1→3. counts = 기술 Lv1~5 개수.
export const PARTNER_SKILLS = Object.freeze({
    bolt: { name: '사주 성광', cd: 0.7, dmg: 52, radius: 112, halfArc: Math.PI * 0.5, crit: 0.25, critBonus: 0.6, knock: 70 },
    orbit: { name: '별자리 궤도', dmg: 12, radius: 80, spin: 3.4, hitGap: 0.45, starRadius: 13, counts: [3, 3, 4, 5, 6] },
    crescent: { name: '초승달 부메랑', cd: 1.1, dmg: 34, range: 270, speed: 430, hitGap: 0.3, hitRadius: 18, counts: [1, 1, 2, 2, 3] },
    tarot: { name: '타로 낙하', cd: 1.8, dmg: 60, radius: 64, warn: 0.4, reach: 380, counts: [2, 3, 3, 4, 5] },
    // 원거리 유도탄: 연이와 겹치지 않게 '가장 가까운 적들'을 하나씩 나눠 노린다
    starshot: { name: '별빛 탄환', cd: 0.85, dmg: 22, speed: 560, range: 430, turn: 5, life: 1.1, hitRadius: 9, counts: [1, 2, 2, 3, 3], pierce: [1, 1, 1, 1, 2] },
    aura: { name: '달빛 수호부', guard: 0.2, guardPerRank: 0.025, heal: 3, tick: 3, radius: 120 },
});
// 진화(조합) 효과
export const PARTNER_EVOLUTION = Object.freeze({
    bolt: { radius: 1.3, halfArc: Math.PI * 0.6 }, orbit: { extra: 3, radius: 1.25 }, crescent: { extra: 2, range: 1.3 },
    tarot: { extra: 3, radius: 1.25 }, aura: { heal: 2, guard: 0.1 }, starshot: { extra: 2, pierce: 2, range: 1.2 },
});

const moons = [], cards = [], stars = [];
const near = [];

export function coopActive() { return !!(G.coop && G.partner); }
export const skillLevel = (id, q = G.partner) => q?.skills?.[id] || 0;
export const skillEvolved = (id, q = G.partner) => !!q?.evolved?.[id];
export const charmLevel = (id, q = G.partner) => q?.charms?.[id] || 0;
export const skillUnlocked = (id, q = G.partner) => skillLevel(id, q) > 0;
const count = (id, q = G.partner) => PARTNER_SKILLS[id].counts[Math.max(0, skillLevel(id, q) - 1)] + (skillEvolved(id, q) ? PARTNER_EVOLUTION[id].extra || 0 : 0);
// 상호 보완: 연이 테크의 약점을 메우는 기술인가
export const isComplement = (id, tech = G.tech) => !!complementFor(tech)?.skills.includes(id);
// 기술 하나의 피해 배율: 기술 레벨 성장 × 진화 × 상호 보완
export const skillPower = (id, q = G.partner) => (1 + PARTNER_SKILL_GROWTH * Math.max(0, skillLevel(id, q) - 1))
    * (skillEvolved(id, q) ? PARTNER_EVOLVED_POWER : 1) * (isComplement(id) ? 1 + PARTNER_COMPLEMENT_BONUS : 1);
const area = (q = G.partner) => 1 + PARTNER_CHARMS.hat.per * charmLevel('hat', q);
const cooldown = (q = G.partner) => 1 - PARTNER_CHARMS.bell.per * charmLevel('bell', q);
export function partnerPower(q = G.partner, stage = G.stage) {
    const might = G.player?.stats?.might || 1;
    return PARTNER.basePower * might * (1 + PARTNER.levelPower * Math.max(0, (q?.level || 1) - 1)) * (1 + PARTNER.stagePower * Math.max(0, (stage || 1) - 1));
}
export function partnerMaxHp(q = G.partner) {
    return Math.round(PARTNER.hp + PARTNER.hpPerLevel * Math.max(0, (q?.level || 1) - 1) + PARTNER_CHARMS.fish_stock.per * charmLevel('fish_stock', q));
}
export function partnerGuard(q = G.partner) {
    const lv = skillLevel('aura', q);
    if (!lv) return 0;
    const a = PARTNER_SKILLS.aura;
    return Math.min(0.45, a.guard + a.guardPerRank * (lv - 1) + (skillEvolved('aura', q) ? PARTNER_EVOLUTION.aura.guard : 0));
}
export const partnerSpeed = (q = G.partner) => PARTNER.speed * (1 + PARTNER_CHARMS.paw.per * charmLevel('paw', q));
export const partnerMagnet = (q = G.partner) => PARTNER_XP.magnet * (1 + PARTNER_CHARMS.whisker.per * charmLevel('whisker', q));

// ── 성장: 경험치 · 레벨업 선택 · 조합 ─────────────────────────────
// 2P 곡선: 1P 난이도 배율의 70% × 레벨업 추가 난이도 6 (영냥이도 보급품을 주워 성장한다)
export const PARTNER_LEVEL_COST = 6;
export const partnerXpNext = level => Math.max(4, Math.round(partnerXpBase(level) * difficultyOf(G.difficulty).xpMul * 0.7 * PARTNER_LEVEL_COST));
export function addPartnerXP(v) {
    const q = G.partner;
    if (!q || !G.coop || !(v > 0)) return;
    q.xp += v;
    while (q.xp >= q.xpNext) {
        q.xp -= q.xpNext;
        q.level++;
        q.xpNext = partnerXpNext(q.level);
        q.pendingLevelUps++;
    }
}
// 기술 Lv5 + 짝 부적이 모이면 조합할 수 있다
export function readyCombos(q = G.partner) {
    if (!q) return [];
    return PARTNER_SKILL_ORDER.filter(id => skillLevel(id, q) >= PARTNER_SKILL_MAX && !skillEvolved(id, q) && charmLevel(PARTNER_SKILL_KIT[id].pair, q) > 0);
}
export function comboRecipe(id) {
    const k = PARTNER_SKILL_KIT[id], c = PARTNER_CHARMS[k.pair];
    return { id, skill: k, charm: c, charmId: k.pair, result: k.evo };
}
function describe(kind, id, q) {
    if (kind === 'combo') {
        const r = comboRecipe(id);
        return { kind, id, icon: r.result.icon, name: r.result.name, levelText: '조합 · 진화', desc: r.result.desc,
            recipe: `${r.skill.icon} ${r.skill.name} Lv${PARTNER_SKILL_MAX} + ${r.charm.icon} ${r.charm.name} → ${r.result.icon} ${r.result.name}` };
    }
    if (kind === 'skill') {
        const k = PARTNER_SKILL_KIT[id], lv = skillLevel(id, q), pairOwned = charmLevel(k.pair, q) > 0;
        const hint = lv + 1 >= PARTNER_SKILL_MAX
            ? (pairOwned ? `✿ Lv${PARTNER_SKILL_MAX} 달성 시 바로 조합 가능 → ${k.evo.name}` : `✿ ${PARTNER_CHARMS[k.pair].icon} ${PARTNER_CHARMS[k.pair].name}을(를) 얻으면 ${k.evo.name}(으)로 조합`)
            : `✿ 조합: Lv${PARTNER_SKILL_MAX} + ${PARTNER_CHARMS[k.pair].icon} ${PARTNER_CHARMS[k.pair].name} → ${k.evo.name}`;
        const comp = isComplement(id);
        return { kind, id, icon: k.icon, name: k.name, isNew: !lv, levelText: lv ? `Lv${lv} → Lv${lv + 1}` : 'NEW · Lv1', desc: lv ? k.per : k.desc, hint,
            complement: comp ? `🤝 연이 보완 · 피해 +${Math.round(PARTNER_COMPLEMENT_BONUS * 100)}% · ${complementFor(G.tech).why}` : '' };
    }
    if (kind === 'charm') {
        const c = PARTNER_CHARMS[id], lv = charmLevel(id, q);
        const skill = PARTNER_SKILL_ORDER.find(s => PARTNER_SKILL_KIT[s].pair === id);
        const hint = skill ? `✿ 조합 재료: ${PARTNER_SKILL_KIT[skill].name} Lv${PARTNER_SKILL_MAX} + ${c.name} → ${PARTNER_SKILL_KIT[skill].evo.name}` : '';
        return { kind, id, icon: c.icon, name: c.name, isNew: !lv, levelText: lv ? `Lv${lv} → Lv${lv + 1}` : 'NEW · Lv1', desc: c.desc, hint };
    }
    return { kind: 'heal', id: 'heal', icon: '🍙', name: '별빛 주먹밥', levelText: '회복', desc: '영냥이 HP를 모두 회복하고 연이 HP +20' };
}
export function rollPartnerChoices(n = 3, random = Math.random, q = G.partner) {
    const out = readyCombos(q).map(id => describe('combo', id, q)).slice(0, n);
    const pool = [];
    for (const id of PARTNER_SKILL_ORDER) if (skillLevel(id, q) < PARTNER_SKILL_MAX) pool.push(['skill', id, (skillLevel(id, q) ? 1.3 : 1) * (isComplement(id) ? PARTNER_COMPLEMENT_WEIGHT : 1)]);
    for (const id of PARTNER_CHARM_ORDER) if (charmLevel(id, q) < PARTNER_CHARM_MAX) {
        // 짝 기술을 가진 부적은 조합으로 이어지므로 더 자주 나온다
        const pairSkill = PARTNER_SKILL_ORDER.find(s => PARTNER_SKILL_KIT[s].pair === id);
        pool.push(['charm', id, pairSkill && skillLevel(pairSkill, q) && !charmLevel(id, q) ? 1.2 : 0.7]);
    }
    while (out.length < n && pool.length) {
        let total = 0; for (const c of pool) total += c[2];
        let r = random() * total, i = 0;
        while (i < pool.length - 1 && (r -= pool[i][2]) > 0) i++;
        const [kind, id] = pool.splice(i, 1)[0];
        out.push(describe(kind, id, q));
    }
    if (!out.length) out.push(describe('heal', 'heal', q));
    return out;
}
export function applyPartnerChoice(c, q = G.partner) {
    if (!q || !c) return false;
    if (c.kind === 'combo') {
        if (!readyCombos(q).includes(c.id)) return false;
        q.evolved[c.id] = true;
        floatText(q.x, q.y - 70, `✿ 조합! ${PARTNER_SKILL_KIT[c.id].evo.name}`, '#ffe9a8', 1.6);
        sparks(q.x, q.y - 24, 24, '#ffe9a8', 240);
        audio.sfx('levelup');
    } else if (c.kind === 'skill') {
        if (skillLevel(c.id, q) >= PARTNER_SKILL_MAX) return false;
        q.skills[c.id] = skillLevel(c.id, q) + 1;
    } else if (c.kind === 'charm') {
        if (charmLevel(c.id, q) >= PARTNER_CHARM_MAX) return false;
        q.charms[c.id] = charmLevel(c.id, q) + 1;
    } else {
        q.hp = partnerMaxHp(q);
        healPlayer(20);
    }
    const maxHp = partnerMaxHp(q);
    if (maxHp > q.maxHp) q.hp += maxHp - q.maxHp;
    q.maxHp = maxHp; q.hp = Math.min(q.hp, q.maxHp);
    emit('partnerBuild');
    return true;
}
// 체크포인트용 빌드 (스테이지 입장 시점)
export function partnerSnapshot(q = G.partner) {
    if (!q) return null;
    return { level: q.level, xp: q.xp, skills: { ...q.skills }, charms: { ...q.charms }, evolved: { ...q.evolved } };
}
export function sanitizePartnerBuild(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
    const skills = {}, charms = {}, evolved = {};
    for (const id of PARTNER_SKILL_ORDER) if (int(raw.skills?.[id], 1, PARTNER_SKILL_MAX)) skills[id] = raw.skills[id];
    for (const id of PARTNER_CHARM_ORDER) if (int(raw.charms?.[id], 1, PARTNER_CHARM_MAX)) charms[id] = raw.charms[id];
    for (const id of PARTNER_SKILL_ORDER) if (raw.evolved?.[id] === true && skills[id] === PARTNER_SKILL_MAX && charms[PARTNER_SKILL_KIT[id].pair]) evolved[id] = true;
    if (!Object.keys(skills).length) return null;
    return { level: int(raw.level, 1, 999) ? raw.level : 1, xp: Number.isFinite(raw.xp) && raw.xp >= 0 ? raw.xp : 0, skills, charms, evolved };
}

// 시작 기술: 사주 성광 + 연이 테크를 보완하는 공격 기술 하나 (테크가 없으면 별자리 궤도)
export function startingSkills(tech = G.tech) {
    const second = complementFor(tech)?.skills.find(id => id !== 'bolt' && id !== 'aura') || 'orbit';
    return { bolt: 1, [second]: 1 };
}
export function createPartner(build = null) {
    if (!G.coop) { G.partner = null; return null; }
    const b = sanitizePartnerBuild(build) || { level: 1, xp: 0, skills: startingSkills(), charms: { ...PARTNER_START.charms }, evolved: {} };
    const q = G.partner = {
        x: -40, y: 10, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: PARTNER.radius,
        facing: 'down', walk: 0, iframes: 0, hurtT: 0, dead: false, downT: 0,
        boltCd: 0.5, moonCd: 0.8, tarotCd: 1.2, auraT: PARTNER_SKILLS.aura.tick,
        orbitAngle: 0, swing: null, attackAt: -9, bossOrbitAt: -9, bossMoonAt: -9, isPartner: true,
        level: b.level, xp: b.xp, xpNext: partnerXpNext(b.level), pendingLevelUps: 0, skills: b.skills, charms: b.charms, evolved: b.evolved,
    };
    q.maxHp = q.hp = partnerMaxHp(q);
    q.starCd = 0.6;
    moons.length = 0; cards.length = 0; stars.length = 0;
    return q;
}
// 스테이지 시작: 1P 곁에서 다시 시작한다 (쓰러져 있었다면 부활).
export function resetPartner() {
    const q = G.partner;
    if (!q) return;
    const p = G.player;
    q.x = p.x - 40; q.y = p.y + 10; q.vx = q.vy = 0;
    q.maxHp = partnerMaxHp(); q.hp = q.maxHp; q.dead = false; q.downT = 0; q.iframes = 1.5; q.hurtT = 0;
    q.swing = null; moons.length = 0; cards.length = 0; stars.length = 0;
}

// 적은 더 가까운 쪽 플레이어를 쫓는다. 쓰러진 2P는 표적이 아니다.
export function chaseTarget(e, p1 = G.player) {
    const q = G.partner;
    if (!q || q.dead || !G.coop) return p1;
    if (p1.dead) return q;
    return (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < (p1.x - e.x) ** 2 + (p1.y - e.y) ** 2 ? q : p1;
}
export const partnerBody = q => ({ x: q.x, y: q.y - PARTNER.bodyOffset, radius: q.radius });

export function damagePartner(amount, srcX, srcY) {
    const q = G.partner;
    if (!q || q.dead || q.iframes > 0) return false;
    const armor = (G.player?.stats?.armor || 0) * 0.5;
    const dmg = Math.max(1, amount - armor) * (1 - partnerGuard());
    q.iframes = PARTNER.hurtIframes; q.hurtT = 0.25;
    if (G.godMode) return true;
    q.hp -= dmg;
    audio.sfx('hurt');
    damageText(q.x, q.y - 40, dmg, false, '#c9a7ff');
    sparks(q.x, q.y - 18, 5, '#c9a7ff', 120);
    if (q.hp <= 0) {
        q.hp = 0; q.dead = true; q.downT = PARTNER.reviveTime; q.swing = null;
        floatText(q.x, q.y - 60, `영냥이 쓰러짐… ${PARTNER.reviveTime}초 뒤 부활`, '#c9a7ff', 1.4);
    }
    return true;
}
// 플레이어 판정을 쓰는 모든 적 공격의 공용 진입점
export function hurtTarget(target, amount, srcX, srcY, damagePlayer) {
    return target === G.partner ? damagePartner(amount, srcX, srcY) : damagePlayer(amount, srcX, srcY);
}

function revive(q, p) {
    q.dead = false; q.maxHp = partnerMaxHp(); q.hp = Math.ceil(q.maxHp * PARTNER.reviveHp);
    q.x = p.x - 36; q.y = p.y + 8; q.iframes = PARTNER.reviveIframes;
    sparks(q.x, q.y - 20, 16, '#ffe9a8', 200);
    floatText(q.x, q.y - 60, '✨ 영냥이 부활!', '#ffe9a8', 1.1);
    audio.sfx('heal');
}

function faceToward(q, dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 0.8) q.facing = dx < 0 ? 'left' : 'right';
    else if (dx || dy) q.facing = dy < 0 ? 'up' : 'down';
}

function nearestFoe(q, range) {
    let best = null, bd = range * range;
    const list = G.grid.query(q.x, q.y, range, near);
    for (const e of list) {
        if (!e.alive) continue;
        const d = (e.x - q.x) ** 2 + (e.y - q.y) ** 2;
        if (d < bd) { bd = d; best = e; }
    }
    const b = G.boss;
    if (b?.alive && (b.x - q.x) ** 2 + (b.y - q.y) ** 2 < bd) best = b;
    return best;
}

function strike(target, dmg, opts) {
    const o = { weapon: PARTNER_ID, ...opts };
    if (target === G.boss) return target.hurt(dmg, o);
    return hitEnemy(target, dmg, o);
}

function updateBolt(q, dt, power) {
    const s = PARTNER_SKILLS.bolt;
    q.boltCd -= dt;
    if (q.swing) { q.swing.t += dt; if (q.swing.t > 0.24) q.swing = null; }
    if (q.boltCd > 0) return;
    const t = nearestFoe(q, s.radius * 1.5);
    if (!t) { q.boltCd = 0.12; return; }
    q.boltCd = s.cd * cooldown(q);
    const evo = skillEvolved('bolt', q) ? PARTNER_EVOLUTION.bolt : null;
    const angle = Math.atan2(t.y - q.y, t.x - q.x), r = s.radius * (1 + 0.05 * (skillLevel('bolt', q) - 1)) * area(q) * (evo?.radius || 1);
    const halfArc = evo?.halfArc || s.halfArc, crit = s.crit + PARTNER_CHARMS.luck.per * charmLevel('luck', q);
    q.swing = { angle, t: 0, r, halfArc, evolved: !!evo };
    q.attackAt = G.clock; faceToward(q, t.x - q.x, t.y - q.y);
    const dmg = s.dmg * power * skillPower('bolt', q);
    const list = G.grid.query(q.x, q.y, r + 30, near);
    for (const e of list) {
        if (!e.alive) continue;
        const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy);
        if (d > r + e.radius) continue;
        let da = Math.abs(Math.atan2(dy, dx) - angle); if (da > Math.PI) da = Math.PI * 2 - da;
        if (d > e.radius + 18 && da > halfArc) continue;
        strike(e, dmg, { crit, critBonus: s.critBonus, kx: dx / (d || 1), ky: dy / (d || 1), knock: s.knock });
    }
    const b = G.boss;
    if (b?.alive && Math.hypot(b.x - q.x, b.y - q.y) < r + b.radius) strike(b, dmg, { crit, critBonus: s.critBonus });
    audio.sfx('hit');
}

const orbitRadius = q => PARTNER_SKILLS.orbit.radius * area(q) * (skillEvolved('orbit', q) ? PARTNER_EVOLUTION.orbit.radius : 1);
function updateOrbit(q, dt, power) {
    if (!skillUnlocked('orbit', q)) return;
    const s = PARTNER_SKILLS.orbit, n = count('orbit', q), now = G.clock, R = orbitRadius(q);
    q.orbitAngle += s.spin * dt;
    const dmg = s.dmg * power * skillPower('orbit', q);
    for (let i = 0; i < n; i++) {
        const a = q.orbitAngle + i / n * Math.PI * 2;
        const ox = q.x + Math.cos(a) * R, oy = q.y - 16 + Math.sin(a) * R * 0.75;
        const list = G.grid.query(ox, oy + 10, s.starRadius + 24, near);
        for (const e of list) {
            if (!e.alive || now - (e.coopOrbitAt ?? -9) < s.hitGap) continue;
            const dx = e.x - ox, dy = (e.y - e.radius) - oy, rr = s.starRadius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            e.coopOrbitAt = now;
            strike(e, dmg, { silent: Math.random() < 0.5, kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: 40 });
        }
        const b = G.boss;
        if (b?.alive && now - q.bossOrbitAt > s.hitGap && Math.hypot(b.x - ox, b.y - b.radius - oy) < s.starRadius + b.radius) { q.bossOrbitAt = now; strike(b, dmg, { silent: true }); }
    }
}

function updateCrescent(q, dt, power) {
    const s = PARTNER_SKILLS.crescent, now = G.clock;
    if (skillUnlocked('crescent', q)) {
        q.moonCd -= dt;
        if (q.moonCd <= 0) {
            q.moonCd = s.cd * cooldown(q);
            const t = nearestFoe(q, s.range * 1.2);
            const base = t ? Math.atan2(t.y - q.y, t.x - q.x) : { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[q.facing];
            const n = count('crescent', q), range = s.range * (1 + 0.06 * (skillLevel('crescent', q) - 1)) * area(q) * (skillEvolved('crescent', q) ? PARTNER_EVOLUTION.crescent.range : 1);
            for (let i = 0; i < n; i++) {
                const a = base + (n > 1 ? (i / (n - 1) - 0.5) * 0.7 : 0);
                moons.push({ a, t: 0, dur: 2 * range / s.speed, range, x: q.x, y: q.y - 16, spin: 0 });
            }
            q.attackAt = now;
        }
    }
    const dmg = s.dmg * power * skillPower('crescent', q);
    for (let i = moons.length - 1; i >= 0; i--) {
        const m = moons[i];
        m.t += dt; m.spin += dt * 14;
        if (m.t >= m.dur) { moons.splice(i, 1); continue; }
        const k = Math.sin(Math.PI * m.t / m.dur);
        m.x = q.x + Math.cos(m.a) * m.range * k; m.y = q.y - 16 + Math.sin(m.a) * m.range * k * 0.8;
        const list = G.grid.query(m.x, m.y + 10, s.hitRadius + 24, near);
        for (const e of list) {
            if (!e.alive || now - (e.coopMoonAt ?? -9) < s.hitGap) continue;
            const dx = e.x - m.x, dy = (e.y - e.radius) - m.y, rr = s.hitRadius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            e.coopMoonAt = now;
            strike(e, dmg, { kx: Math.cos(m.a), ky: Math.sin(m.a), knock: 50 });
        }
        const b = G.boss;
        if (b?.alive && now - q.bossMoonAt > s.hitGap && Math.hypot(b.x - m.x, b.y - b.radius - m.y) < s.hitRadius + b.radius) { q.bossMoonAt = now; strike(b, dmg, {}); }
    }
}

function updateStarshot(q, dt, power) {
    const s = PARTNER_SKILLS.starshot, evo = skillEvolved('starshot', q) ? PARTNER_EVOLUTION.starshot : null;
    const range = s.range * area(q) * (evo?.range || 1);
    if (skillUnlocked('starshot', q)) {
        q.starCd -= dt;
        if (q.starCd <= 0) {
            const list = G.grid.query(q.x, q.y, range, near).filter(e => e.alive);
            if (G.boss?.alive && Math.hypot(G.boss.x - q.x, G.boss.y - q.y) < range) list.push(G.boss);
            if (!list.length) q.starCd = 0.15;
            else {
                q.starCd = s.cd * cooldown(q);
                list.sort((a, b) => (a.x - q.x) ** 2 + (a.y - q.y) ** 2 - ((b.x - q.x) ** 2 + (b.y - q.y) ** 2));
                const n = count('starshot', q), lv = skillLevel('starshot', q);
                const pierce = s.pierce[lv - 1] + (evo?.pierce || 0);
                for (let i = 0; i < n; i++) {
                    const t = list[i % list.length], a = Math.atan2(t.y - t.radius - (q.y - 22), t.x - q.x) + (i - (n - 1) / 2) * 0.18;
                    stars.push({ x: q.x, y: q.y - 22, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, t: 0, target: t, pierce, hits: [], evolved: !!evo });
                }
                q.attackAt = G.clock;
                faceToward(q, list[0].x - q.x, list[0].y - q.y);
            }
        }
    }
    const dmg = s.dmg * power * skillPower('starshot', q);
    for (let i = stars.length - 1; i >= 0; i--) {
        const m = stars[i];
        m.t += dt;
        if (m.t > s.life) { stars.splice(i, 1); continue; }
        // 표적이 살아 있으면 부드럽게 휘어 쫓는다
        const t = m.target;
        if (t?.alive) {
            const want = Math.atan2(t.y - t.radius - m.y, t.x - m.x), cur = Math.atan2(m.vy, m.vx);
            let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
            const a = cur + Math.max(-s.turn * dt, Math.min(s.turn * dt, d));
            m.vx = Math.cos(a) * s.speed; m.vy = Math.sin(a) * s.speed;
        }
        m.x += m.vx * dt; m.y += m.vy * dt;
        const list = G.grid.query(m.x, m.y + 10, s.hitRadius + 24, near);
        let spent = false;
        for (const e of list) {
            if (!e.alive || m.hits.includes(e)) continue;
            const dx = e.x - m.x, dy = (e.y - e.radius) - m.y, rr = s.hitRadius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            m.hits.push(e);
            strike(e, dmg, { kx: m.vx / s.speed, ky: m.vy / s.speed, knock: 30 });
            if (--m.pierce < 0) { spent = true; break; }
        }
        const b = G.boss;
        if (!spent && b?.alive && !m.hits.includes(b) && Math.hypot(b.x - m.x, b.y - b.radius - m.y) < s.hitRadius + b.radius) {
            m.hits.push(b); strike(b, dmg, {}); if (--m.pierce < 0) spent = true;
        }
        if (spent) { sparks(m.x, m.y, 4, '#bfe6ff', 120); stars.splice(i, 1); }
    }
}

function updateTarot(q, dt, power) {
    const s = PARTNER_SKILLS.tarot;
    if (skillUnlocked('tarot', q)) {
        q.tarotCd -= dt;
        if (q.tarotCd <= 0) {
            q.tarotCd = s.cd * cooldown(q);
            const list = G.grid.query(q.x, q.y, s.reach, near).filter(e => e.alive);
            const n = count('tarot', q), r = s.radius * (1 + 0.06 * (skillLevel('tarot', q) - 1)) * area(q) * (skillEvolved('tarot', q) ? PARTNER_EVOLUTION.tarot.radius : 1);
            if (G.boss?.alive && Math.hypot(G.boss.x - q.x, G.boss.y - q.y) < s.reach) cards.push({ x: G.boss.x, y: G.boss.y, t: 0, r, hit: false });
            for (let i = 0; i < n && list.length; i++) {
                const e = list.splice(Math.floor(Math.random() * list.length), 1)[0];
                cards.push({ x: e.x, y: e.y, t: 0, r, hit: false });
            }
        }
    }
    const dmg = s.dmg * power * skillPower('tarot', q);
    for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        c.t += dt;
        if (!c.hit && c.t >= s.warn) {
            c.hit = true;
            const list = G.grid.query(c.x, c.y, c.r + 20, near);
            for (const e of list) {
                if (!e.alive) continue;
                const dx = e.x - c.x, dy = e.y - c.y;
                if (dx * dx + dy * dy / 0.49 > (c.r + e.radius) ** 2) continue;
                strike(e, dmg, { kx: dx / (c.r || 1), ky: dy / (c.r || 1), knock: 90 });
            }
            const b = G.boss;
            if (b?.alive && Math.hypot(b.x - c.x, b.y - c.y) < c.r + b.radius) strike(b, dmg, {});
            sparks(c.x, c.y - 6, 8, '#d9b8ff', 170);
        }
        if (c.t > s.warn + 0.35) cards.splice(i, 1);
    }
}

function updateAura(q, dt) {
    const s = PARTNER_SKILLS.aura;
    if (!skillUnlocked('aura', q)) return;
    q.auraT -= dt;
    if (q.auraT > 0) return;
    q.auraT = s.tick;
    const heal = s.heal * (1 + 0.25 * (skillLevel('aura', q) - 1)) * (skillEvolved('aura', q) ? PARTNER_EVOLUTION.aura.heal : 1);
    const before = q.hp;
    q.hp = Math.min(q.maxHp, q.hp + heal);
    if (q.hp > before) damageText(q.x, q.y - 44, q.hp - before, false, '#5dff7a');
    // 곁에 있는 연이도 조금 회복시킨다 (협동 보상)
    const p = G.player;
    if (!p.dead && Math.hypot(p.x - q.x, p.y - q.y) < s.radius) healPlayer(heal * 0.5);
}

// 1P와 함께 한 화면에 보이도록 2P를 1P 기준 상자 안에 묶어 둔다 (카메라는 두 사람의 중간을 따라간다).
export function leashBox() { return { x: Math.max(120, G.view.w - 140), y: Math.max(100, G.view.h - 150) }; }

export function updatePartner(dt) {
    const q = G.partner;
    if (!q || !G.coop) return;
    const p = G.player;
    if (q.dead) {
        if (!p.dead) { q.downT -= dt; if (q.downT <= 0) revive(q, p); }
        return;
    }
    const mv = playerMove(1);
    const speed = partnerSpeed(q);
    q.vx = mv.x * speed; q.vy = mv.y * speed;
    q.x += q.vx * dt; q.y += q.vy * dt;
    const box = leashBox();
    q.x = Math.max(p.x - box.x, Math.min(p.x + box.x, q.x));
    q.y = Math.max(p.y - box.y, Math.min(p.y + box.y, q.y));
    if (mv.x || mv.y) { q.walk += Math.hypot(q.vx, q.vy) * dt / 22; if (G.clock - q.attackAt > 0.36) faceToward(q, mv.x, mv.y); }
    if (q.iframes > 0) q.iframes -= dt;
    if (q.hurtT > 0) q.hurtT -= dt;
    const target = partnerMaxHp();
    if (target > q.maxHp) { q.hp += target - q.maxHp; q.maxHp = target; }
    if (p.dead || G.mode === 'clearing') return;
    const power = partnerPower();
    updateBolt(q, dt, power);
    updateOrbit(q, dt, power);
    updateCrescent(q, dt, power);
    updateStarshot(q, dt, power);
    updateTarot(q, dt, power);
    updateAura(q, dt);
}

// 카메라 초점: 2P가 서 있으면 두 사람의 중간, 아니면 1P
export function cameraFocus(p) {
    const q = G.partner;
    if (!q || q.dead || !G.coop) return { x: p.x, y: p.y };
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

// ── 그리기 ──────────────────────────────────────────────
// 연이 아틀리에 영냥이 시트: 걷기 4×4(128px, 행 = 아래·왼쪽·오른쪽·위), 공격 4×4(192×160).
export const PARTNER_SHEETS = Object.freeze({
    walk: { src: 'asset/sprites/coop-yeongnyang-walk.webp', w: 128, h: 128, ax: 64, ay: 122, size: 64 },
    attack: { src: 'asset/sprites/coop-yeongnyang-attack.webp', w: 192, h: 160, ax: 96, ay: 154, size: 80 },
});
const ROWS = { down: 0, left: 1, right: 2, up: 3 };
const sheetImages = {};
function sheet(key) {
    if (typeof Image === 'undefined') return null;
    let img = sheetImages[key];
    if (!img) { img = sheetImages[key] = new Image(); img.decoding = 'async'; img.src = PARTNER_SHEETS[key].src; }
    return img.complete && img.naturalWidth ? img : null;
}
export function partnerFrame(q, clock = G.clock) {
    const attacking = clock - q.attackAt < 0.36;
    const key = attacking ? 'attack' : 'walk';
    const moving = !!(q.vx || q.vy);
    const col = attacking ? Math.min(3, Math.floor((clock - q.attackAt) / 0.09)) : moving ? Math.floor(q.walk) % 4 : 0;
    return { key, row: ROWS[q.facing] ?? 0, col };
}

export function drawPartnerShadow(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.moveTo(q.x + 13, q.y);
    ctx.ellipse(q.x, q.y, 13, 4.5, 0, 0, Math.PI * 2);
}

export function drawPartner(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.save();
    const aura = skillUnlocked('aura', q) && !q.dead;
    if (aura) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 + Math.sin(G.clock * 3) * 0.04;
        const g = glow('#b9a3ff', 64), r = PARTNER_SKILLS.aura.radius;
        ctx.drawImage(g, q.x - r, q.y - r * 0.7, r * 2, r * 1.4);
        ctx.globalCompositeOperation = 'source-over';
    }
    const f = partnerFrame(q), def = PARTNER_SHEETS[f.key], img = sheet(f.key);
    const blink = q.iframes > 0 && !q.dead && Math.floor(G.clock * 20) % 2 === 0;
    ctx.globalAlpha = q.dead ? 0.45 : blink ? 0.55 : 1;
    if (img) {
        const s = def.size / def.h;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, f.col * def.w, f.row * def.h, def.w, def.h, q.x - def.ax * s, q.y - def.ay * s, def.w * s, def.h * s);
    } else {
        ctx.fillStyle = '#fff5f8'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 16, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#20264e'; ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 24); ctx.lineTo(q.x + 2, q.y - 46); ctx.lineTo(q.x + 15, q.y - 24); ctx.fill();
    }
    if (q.hurtT > 0 && img) {
        ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glow('#ff6b8a', 32), q.x - 22, q.y - 44, 44, 44);
        ctx.globalCompositeOperation = 'source-over';
    }
    // 머리 위 2P 표시 + 체력
    ctx.globalAlpha = 1;
    const w = 34, y = q.y - 62;
    ctx.fillStyle = '#0b0f1acc'; ctx.fillRect(q.x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = q.dead ? '#6b6478' : '#b98bea'; ctx.fillRect(q.x - w / 2, y, w * Math.max(0, q.hp / q.maxHp), 3);
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8dcff';
    ctx.fillText(q.dead ? `부활 ${Math.ceil(q.downT)}` : '2P', q.x, y - 3);
    ctx.restore();
}

export function drawPartnerEffects(ctx) {
    const q = G.partner;
    if (!q || !G.coop) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const star = glow('#ffe9a8', 32), moon = glow('#c9b6ff', 32), card = glow('#d9b8ff', 64);
    if (!q.dead && skillUnlocked('orbit', q)) {
        const n = count('orbit', q), R = orbitRadius(q), big = skillEvolved('orbit', q) ? 1.3 : 1;
        for (let i = 0; i < n; i++) {
            const a = q.orbitAngle + i / n * Math.PI * 2;
            const ox = q.x + Math.cos(a) * R, oy = q.y - 16 + Math.sin(a) * R * 0.75;
            ctx.globalAlpha = 0.85; ctx.drawImage(star, ox - 13 * big, oy - 13 * big, 26 * big, 26 * big);
            ctx.globalAlpha = 1; ctx.fillStyle = '#fff7da';
            ctx.fillRect(ox - 4, oy - 0.8, 8, 1.6); ctx.fillRect(ox - 0.8, oy - 4, 1.6, 8);
        }
    }
    if (q.swing) {
        const k = q.swing.t / 0.24, arc = q.swing.halfArc;
        ctx.globalAlpha = Math.max(0, 1 - k);
        // 진화(사주 월광참): 더 굵은 은빛 초승달 참격
        ctx.strokeStyle = q.swing.evolved ? '#f4f0ff' : '#ffe2a0'; ctx.lineWidth = (q.swing.evolved ? 9 : 6) * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 14, q.swing.r * (0.7 + 0.3 * k), q.swing.r * 0.7 * (0.7 + 0.3 * k), 0, q.swing.angle - arc, q.swing.angle + arc); ctx.stroke();
        ctx.strokeStyle = '#b98bea'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 14, q.swing.r * 0.55, q.swing.r * 0.4, 0, q.swing.angle - arc * 0.8, q.swing.angle + arc * 0.8); ctx.stroke();
    }
    const shot = glow('#9fd8ff', 32);
    for (const m of stars) {
        // 꼬리 2개 + 밝은 심 (진화 유성우는 금빛)
        const k = 1 / (Math.hypot(m.vx, m.vy) || 1), tx = -m.vx * k, ty = -m.vy * k, z = m.evolved ? 1.4 : 1;
        for (let n = 2; n >= 1; n--) { ctx.globalAlpha = 0.25 * (3 - n); ctx.drawImage(shot, m.x + tx * 12 * n - 9 * z, m.y + ty * 12 * n - 9 * z, 18 * z, 18 * z); }
        ctx.globalAlpha = 1; ctx.drawImage(m.evolved ? star : shot, m.x - 11 * z, m.y - 11 * z, 22 * z, 22 * z);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }
    for (const m of moons) {
        ctx.globalAlpha = 0.7; ctx.drawImage(moon, m.x - 20, m.y - 20, 40, 40);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#f6ce73'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(m.x, m.y, 9, m.spin, m.spin + Math.PI * 1.25); ctx.stroke();
    }
    const warn = PARTNER_SKILLS.tarot.warn;
    for (const c of cards) {
        if (!c.hit) {
            const k = Math.min(1, c.t / warn), fall = (1 - k) * 160;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.25 + 0.35 * k; ctx.strokeStyle = '#d9b8ff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * k, c.r * 0.7 * k, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.95; ctx.fillStyle = '#2a1f4a'; ctx.fillRect(c.x - 9, c.y - 40 - fall, 18, 26);
            ctx.strokeStyle = '#f6ce73'; ctx.lineWidth = 1.5; ctx.strokeRect(c.x - 9, c.y - 40 - fall, 18, 26);
            ctx.fillStyle = '#f6ce73'; ctx.fillRect(c.x - 1, c.y - 31 - fall, 2, 8);
            ctx.globalCompositeOperation = 'lighter';
        } else {
            const k = Math.min(1, (c.t - warn) / 0.35);
            ctx.globalAlpha = 0.7 * (1 - k); ctx.drawImage(card, c.x - c.r * 1.2, c.y - c.r * 0.85, c.r * 2.4, c.r * 1.7);
        }
    }
    ctx.restore();
}
