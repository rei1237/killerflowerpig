// Deterministic Cannon-only diagnostics. Timings are this host's Node timings,
// not a mobile performance guarantee. Enemy HP comes from real spawnEnemy().
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { G, clearWorld } from '../src/game/state.js';
import { resetBuild } from '../src/game/progression.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, weaponStats, updateWeapons } from '../src/game/weapons.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { chooseCannonVolley, cannonFocusMultiplier } from '../src/game/cannon-targeting.js';
import { WEAPONS } from '../src/data/weapons.js';
import { STAGES } from '../src/data/stages.js';
import { images } from '../src/core/assets.js';
import { save } from '../src/core/save.js';
import { runBalanceScene } from './cannon-growth-qa.mjs';

// Execute the actual published Cannon code, rather than passing old numbers
// through today's nerfed spread/cap rules. Shared world/enemy dependencies keep
// target HP and authored muzzle geometry identical in this isolated comparison.
const repo = fileURLToPath(new URL('../', import.meta.url));
const publishedSource = path => execFileSync('git',['show',`76d85937:${path}`],{cwd:repo,encoding:'utf8'});
const moduleUrl = (source, base, replacements={}) => 'data:text/javascript;base64,' + Buffer.from(source.replace(
    /from\s+(['"])(\.[^'"]+)\1/g, (_,quote,path) => `from ${quote}${replacements[path] || new URL(path,base).href}${quote}`)).toString('base64');
const publishedDataUrl = moduleUrl(publishedSource('src/data/weapons.js'),new URL('../src/data/weapons.js',import.meta.url));
const published = await import(moduleUrl(publishedSource('src/game/weapons.js'),new URL('../src/game/weapons.js',import.meta.url),{'../data/weapons.js':publishedDataUrl}));
const current = {createWeapon,weaponStats,updateWeapons};
const round = n => +n.toFixed(3);
function setup(stage, level, evolved, whet, tech = 'bloom', runtime = current) {
    resetBuild(); clearWorld(); clearFocus(); save.upgrades = {}; save.equippedCosmetics = {}; save.equippedPet = null;
    createPlayer(); Object.assign(G, { stage, time: STAGES[stage].duration * .5, clock: 1, mode: 'play', paused: false,
        tech, kills: 0, damageBy: {}, events: {}, caps: { enemies: 300, particles: 0, texts: 0, gems: 500, decalScale: 0 } });
    G.camera.x = G.camera.y = 0; G.view.w = 1000; G.view.h = 600;
    G.passives = tech ? { regen: 1, ...(evolved ? { pollen: 1 } : {}), ...(whet ? { whet } : {}) } : {};
    const w = Object.assign(runtime.createWeapon('cannon', 0), { level, evolved, cd: 0 });
    G.weapons = tech ? [w, Object.assign(createWeapon('thorns', 1), { cd: Infinity })] : [w];
    images.playerFire = { width: 3072, height: 256 }; recomputeStats(true); G.player.stats.crit = 0;
    return w;
}
function finiteVolleys(config, type, elite, old, focused=false) {
    const runtime=old?published:current;
    const w = setup(config.stage, config.level, config.evolved, config.whet, 'bloom',runtime);
    const e = spawnEnemy(type, 240, 0, { elite }); G.grid.insert(e);
    if(focused)tapFocusAt(e.x,e.y-e.radius);
    const hp = e.hp, s = runtime.weaponStats(w); let volleys = 0, firstDamage=0;
    while (e.alive && volleys < 200) {
        const before=e.hp;w.cd = 0; G.clock += s.cd; runtime.updateWeapons(.001); volleys++;
        if(volleys===1)firstDamage=before-e.hp;
    }
    return { hp: round(hp), statDamage: round(s.dmg), firstVolleyDamage:round(firstDamage), interval: round(s.cd), volleys,
        earliestSecondsAfterFirstShot: round((volleys - 1) * s.cd) };
}
function crowdProbe(level, old, hpEach=70, seconds=10) {
    const runtime=old?published:current,w=setup(1,level,false,0,null,runtime),enemies=[];
    Object.assign(G.player,{vx:-130,vy:20,facingX:-1,facingY:0});
    for(let i=0;i<16;i++){
        const a=i*Math.PI/8,e=spawnEnemy('shambler',280*Math.cos(a),280*Math.sin(a));
        e.y+=e.radius;e.hp=e.maxHp=hpEach;enemies.push(e);G.grid.insert(e);
    }
    runtime.updateWeapons(.001);
    const firstKills=G.kills,firstDamage=enemies.reduce((sum,e)=>sum+Math.min(hpEach,hpEach-e.hp),0),firstBeams=G.beams.count;
    let clearSeconds=G.kills===16?0:null,peakBeams=G.beams.count;
    for(let frame=1;frame<=seconds*60&&clearSeconds===null;frame++){
        G.clock+=1/60;G.grid.reset();
        for(let i=0;i<enemies.length;i++)if(enemies[i].alive){const a=i*Math.PI/8+frame/60*.08;
            enemies[i].x=280*Math.cos(a);enemies[i].y=280*Math.sin(a)+enemies[i].radius;G.grid.insert(enemies[i]);}
        // Constant moving stance reproduces the published movement-facing aim.
        // The target ring itself rotates; no incoming-pressure or pickup model.
        runtime.updateWeapons(1/60);peakBeams=Math.max(peakBeams,G.beams.count);
        for(let i=G.beams.count-1;i>=0;i--){G.beams.items[i].life-=1/60;if(G.beams.items[i].life<=0)G.beams.release(i);}
        if(G.kills===16)clearSeconds=round(frame/60);
    }
    return {firstKills,firstEffectiveDamage:round(firstDamage),firstBeams,killsBy10Seconds:G.kills,clearSeconds,peakBeams};
}
function focusedProbe(old,evolved=false){
    const runtime=old?published:current;setup(1,8,evolved,0,null,runtime);
    let damage=0;G.boss={id:-1,x:250,y:0,radius:28,hp:1e9,alive:true,hits:{},hurt(d){damage+=d;this.hp-=d;}};
    tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);let peak=0;
    for(let frame=0;frame<1800;frame++){G.clock+=1/60;runtime.updateWeapons(1/60);peak=Math.max(peak,G.beams.count);
        for(let i=G.beams.count-1;i>=0;i--){G.beams.items[i].life-=1/60;if(G.beams.items[i].life<=0)G.beams.release(i);}}
    return{dps:round(damage/30),damage:round(damage),peakBeams:peak};
}
export function cannonAimReport() {
    const sourceHash = path => createHash('sha256').update(fs.readFileSync(new URL(path, import.meta.url))).digest('hex');
    const sources = { cannonTargeting: sourceHash('../src/game/cannon-targeting.js'),
        weaponRuntime: sourceHash('../src/game/weapons.js'),
        fusions:sourceHash('../src/data/fusions.js'),techs:sourceHash('../src/data/techs.js'),
        allWeaponDefinitions:sourceHash('../src/data/weapons.js'),
        cannonDefinition: createHash('sha256').update(JSON.stringify(WEAPONS.cannon)).digest('hex') };
    const curve = [];
    for (let level = 1; level <= 8; level++) {
        const w = setup(1, level, false, 0, null), s = weaponStats(w);
        curve.push({ level, damage: s.dmg, interval: round(s.cd), rays: s.amount,
            width: round(s.width * s.area), range: round(s.length * Math.sqrt(s.area)),
            automaticDamage:round(s.dmg*(1-.05*(level-1))), spreadRatio:round(1-.05*(level-1)),
            focusMultiplier: cannonFocusMultiplier(s.amount), focusedDamage:round(s.focusBeamDamage*cannonFocusMultiplier(s.amount)),
            before: { damage: [28, 40, 40, 40, 40, 55, 55, 75][level - 1], interval: round(s.cd), rays: level,
                width: round(38 * (1 + (level >= 3 ? .25 : 0) + (level >= 8 ? .2 : 0))),
                range: round(520 * Math.sqrt(1 + (level >= 3 ? .25 : 0) + (level >= 8 ? .2 : 0))) } });
    }
    const stageVolleys = [];
    for (const config of [{ stage: 1, level: 1, evolved: false, whet: 0 }, { stage: 3, level: 4, evolved: false, whet: 1 },
        { stage: 6, level: 8, evolved: false, whet: 3 }, { stage: 9, level: 8, evolved: true, whet: 4 }]) {
        for (const [role, type, elite] of [['ordinary', 'shambler', false], ['strong', 'hulk', false], ['elite', 'brute', true]]) {
            stageVolleys.push({ ...config, role, type, before: finiteVolleys(config, type, elite, true),
                after: finiteVolleys(config, type, elite, false),
                focusedAfter: finiteVolleys(config,type,elite,false,true) });
        }
    }
    const hierarchy = [];
    for (const [id, level, evolved] of [['cannon', 8, false], ['cannon', 8, true], ['lotus_bloom', 1, false],
        ['lotus_bloom', 8, false], ['absolute_bloom', 1, false], ['absolute_bloom', 8, false]]) {
        const scene = runBalanceScene({ tech: 'bloom', build: [[id, level, evolved]],
            passives: { regen: 3, pollen: 3, spread: 3 }, scene: 'boss_focused', seconds: 30 });
        hierarchy.push({ id, level, evolved, focusedBossDps: scene.dps, damage: scene.damage });
    }
    const arrangedKills = [];
    for(const level of [1,4,8])for(const hpEach of [40,70]) arrangedKills.push({level,targets:16,hpEach,
        before:crowdProbe(level,true,hpEach),after:crowdProbe(level,false,hpEach)});
    const focusedComparison=[false,true].map(evolved=>({level:8,evolved,before:focusedProbe(true,evolved),after:focusedProbe(false,evolved)}));
    const targets = Array.from({ length: 64 }, (_, i) => ({ id: i, x: Math.cos(i * 2.39996) * (150 + i * 4),
        y: Math.sin(i * 2.39996) * (150 + i * 4) + 12, radius: 12, alive: true, hp: 1e6 }));
    const right = { x: 28.8, y: -23 }, left = { x: -28.8, y: -23 };
    const options = { targets, count: 999, length: 1000, width: 80, muzzleAt: dx => dx < 0 ? left : right };
    for (let i = 0; i < 100; i++) chooseCannonVolley(options);
    const times = []; let result;
    for (let i = 0; i < 500; i++) {
        const t = performance.now(); result = chooseCannonVolley(options); times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    return { method: 'Cannon-only finite volleys against real midpoint-of-stage enemy HP; neutral no-gear curve; Bloom stage fixtures include starter thorns disabled, regen1, listed whet, and pollen1 when evolved. Before executes the published76d85937 Cannon runtime and data against the same current-stage HP and authored muzzle. This is an isolated weapon comparison, not a complete old-game snapshot. No critical hits, permanent upgrades, pets, or outgoing thorns damage. Focus hierarchy uses identical legal evolution-passive budget (regen3/pollen3/spread3); final retains its distinct source attacks. Crowd probes use16 real shambler bodies on a280px ring,40 or70HP each, rotating targets and a constant moving-player stance/no focus. The10-second probe measures coverage/clearance, not incoming-pressure survival. Focused comparison is a neutral Lv8 Cannon-only30-second250px boss target, no passives or critical hits.',
        generatedAt: new Date().toISOString(), sources, allDefinitionsUnchangedDuringReport: sources.fusions===sourceHash('../src/data/fusions.js') && sources.techs===sourceHash('../src/data/techs.js') && sources.allWeaponDefinitions===sourceHash('../src/data/weapons.js'), runtimeUnchangedDuringReport: sources.weaponRuntime === sourceHash('../src/game/weapons.js'),
        curve, stageVolleys, hierarchy, arrangedKills, focusedComparison,
        performance: { targets: result.inspected, rays: result.rays.length, candidates: result.candidateCount,
            runs: times.length, medianMs: round(times[250]), p95Ms: round(times[475]), maxMs: round(times.at(-1)) } };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(cannonAimReport(), null, 2));
