// Explicit, loss-disclosing full-slot exchanges. Never called by random rewards.
import { G, emit } from './state.js';
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL } from '../data/weapons.js';
import { createWeapon } from './weapons.js';
import { recomputeStats } from './player.js';

const definitions = kind => kind === 'weapon' ? WEAPONS : kind === 'passive' ? PASSIVES : null;
const owned = (kind, id) => kind === 'weapon' ? G.weapons.find(w => w.id === id) : G.passives[id];
const signature = (kind, fromId, toId) => JSON.stringify([kind, fromId, toId,
    G.stage, G.stageStartTime, G.fusionRevision || 0, G.player?.stats,
    G.weapons.map(w => [w.id, w.level, !!w.evolved, w.slot]), G.passives,
    [...G.banished].sort(), G.choiceSession?.id, G.choiceSession?.revision, G.choiceSession?.closed]);

export function listExchangeTargets(kind) {
    const defs = definitions(kind);
    if (!defs) return [];
    return Object.entries(defs).filter(([id, def]) => !def.fusionOnly && !owned(kind, id) && !G.banished.has(id))
        .map(([id, def]) => ({ id, name: def.name, icon: def.icon, desc: def.desc, level: 1 }));
}

export function previewExchange(kind, fromId, toId) {
    const defs = definitions(kind);
    if (!defs) return { ok: false, code: 'INVALID_KIND' };
    if (!Object.hasOwn(defs, fromId) || !Object.hasOwn(defs, toId)) return { ok: false, code: 'UNKNOWN_ITEM' };
    if (defs[toId].fusionOnly) return { ok: false, code: 'FUSION_ONLY' };
    const source = owned(kind, fromId);
    if (!source) return { ok: false, code: 'NOT_OWNED' };
    if (owned(kind, toId)) return { ok: false, code: 'ALREADY_OWNED' };
    if (G.banished.has(toId)) return { ok: false, code: 'BANISHED' };
    if (G.weapons.length > MAX_WEAPONS || Object.keys(G.passives).length > MAX_PASSIVES ||
        new Set(G.weapons.map(w => w.id)).size !== G.weapons.length ||
        G.weapons.some(w => !Object.hasOwn(WEAPONS, w.id) || !Number.isSafeInteger(w.level) || w.level < 1 || w.level > WEAPON_MAX_LEVEL) ||
        Object.entries(G.passives).some(([id, level]) => !Object.hasOwn(PASSIVES, id) || !Number.isSafeInteger(level) || level < 1 || level > PASSIVE_MAX_LEVEL))
        return { ok: false, code: 'INVALID_INVENTORY' };
    const count = kind === 'weapon' ? G.weapons.length : Object.keys(G.passives).length;
    if (count !== (kind === 'weapon' ? MAX_WEAPONS : MAX_PASSIVES)) return { ok: false, code: 'SLOTS_NOT_FULL' };
    if (G.choiceSession && !G.choiceSession.closed) return { ok: false, code: 'CHOICE_ACTIVE' };
    const evolved = kind === 'weapon' && !!source.evolved;
    return { ok: true, code: null, signature: signature(kind, fromId, toId),
        removed: { id: fromId, name: evolved ? defs[fromId].evolve?.name || defs[fromId].name : defs[fromId].name,
            icon: evolved ? defs[fromId].evolve?.icon || defs[fromId].icon : defs[fromId].icon,
            level: kind === 'weapon' ? source.level : source, evolved },
        replacement: { id: toId, name: defs[toId].name, icon: defs[toId].icon, level: 1 }, slotsAfter: count };
}

export function exchangeItem(kind, fromId, toId, expectedSignature) {
    if (!['play', 'boss'].includes(G.mode) || !G.player || G.player.dead) return { ok: false, code: 'NOT_PLAYING' };
    const preview = previewExchange(kind, fromId, toId);
    if (!preview.ok) return preview;
    if (typeof expectedSignature !== 'string' || expectedSignature !== preview.signature) return { ok: false, code: 'STALE_PREVIEW' };
    // Every validation precedes the single inventory assignment. Old progress is
    // discarded only by this explicit confirmed operation, never by preview.
    if (kind === 'weapon') {
        const index = G.weapons.findIndex(w => w.id === fromId);
        const next = [...G.weapons];
        next[index] = createWeapon(toId, index);
        G.weapons = next;
        G.weapons.forEach((w, i) => { w.slot = i; });
        for (const pool of [G.shots, G.hazards, G.beams]) {
            for (let i = pool.count - 1; i >= 0; i--) if (pool.items[i].weapon === fromId) { pool.items[i].alive = false; pool.release(i); }
        }
        for (let i = 0; i < G.shots.count; i++) {
            const shot = G.shots.items[i], owner = G.weapons.find(w => w.id === shot.weapon);
            if (owner) shot.slot = owner.slot;
        }
        for (let i = 0; i < G.enemies.count; i++) {
            const enemy = G.enemies.items[i];
            if (!(enemy.hits instanceof Float32Array)) enemy.hits = new Float32Array(16);
            enemy.hits.fill(-99);
        }
        if (G.boss) G.boss.hits = {};
    } else {
        const next = { ...G.passives };
        delete next[fromId]; next[toId] = 1;
        const hp = G.player.hp;
        G.passives = next;
        recomputeStats();
        // Exchanges cannot be cycled for free healing via the heart passive.
        G.player.hp = Math.min(hp, G.player.maxHp);
    }
    G.fusionRevision = (G.fusionRevision || 0) + 1;
    delete G.choiceAbsence?.[toId];
    emit('loadoutExchanged', { kind, fromId, toId });
    return { ...preview, signature: undefined, ok: true };
}
