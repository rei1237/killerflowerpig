import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../src/data/weapons.js';
import { TECHS } from '../src/data/techs.js';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { createWeapon, updateWeapons, activeWeaponCores } from '../src/game/weapons.js';
import { resetBuild } from '../src/game/progression.js';
import { save } from '../src/core/save.js';
import { images, CHARACTER_SHEETS, CHARACTER_CACHE_LIMITS, characterSheetKey, requestCharacterSheet, characterCacheInfo,
    characterFlash, clearCharacterCache, loadAssets } from '../src/core/assets.js';
import { ATTACK_FAMILIES, WEAPON_POSES, ATTACK_HOLD, weaponPose, attackTier, attackFrame, markPlayerAttack,
    playerAttackPose, drawAttackAccent, idleAttackFamily } from '../src/game/attack-animation.js';
import { drawAppearance } from '../src/game/player-appearance.js';

const expected = {
    fire: ['shotgun','rifle','scatter_rail','toxic_scatter','doom_barrage'], dual: ['pistols','burst_rail','guillotine'],
    throw: ['molotov','gas','plague_fire','plague_end'], cannon: ['cannon','lotus_bloom','ember_lance','absolute_bloom'],
    blade: ['saw','venom_saw','orbit_saw','carnage_saw'], channel: ['thorns'], sword: ['sword','sword_wheel'],
};
test('all 23 weapons, every fusion core and each of five techs have an explicit semantically correct pose', () => {
    assert.equal(Object.keys(WEAPONS).length, 23);
    for (const [family, weapons] of Object.entries(expected)) for (const id of weapons) {
        assert.equal(weaponPose({id}), family, id); assert.equal(WEAPON_POSES[id], family);
        assert.equal(weaponPose({id, sourceId:'absolute_bloom'}), family, 'inherited cores retain their real attack type');
    }
    assert.equal(weaponPose({id:'gas'},{follow:true}), 'channel');
    assert.equal(weaponPose({id:'ember_lance'},{family:'throw'}), 'throw');
    assert.equal(weaponPose({id:'lotus_gun'}), 'fire');
    assert.equal(attackTier({id:'rifle',evolved:true}), 'evolved');
    assert.equal(attackTier({id:'rifle',sourceId:'scatter_rail'}), 'fusion');
    assert.equal(attackTier({id:'rifle',sourceId:'doom_barrage'}), 'absolute');
    for (const tech of Object.keys(TECHS)) assert.ok(ATTACK_FAMILIES.includes(idleAttackFamily(tech)));
});

test('every archetype releases immediately, uses seven distinct recovery poses, and preserves fixed-clock pause', () => {
    for (const family of ATTACK_FAMILIES) for (const tier of ['normal','evolved','fusion','absolute']) {
        assert.equal(attackFrame(0,family,tier),1);
        const frames = new Set(Array.from({length:401}, (_,ms)=>attackFrame(ms/1000,family,tier)));
        assert.deepEqual([...frames].sort(), [0,1,2,3,4,5,6,7]);
        assert.equal(attackFrame(.401,family,tier),0);
        assert.equal(attackFrame(-.01,family,tier),0);
        const p={flip:false}; markPlayerAttack(p,10,{id:'cannon'},-1,{family});
        const before=structuredClone(p), expected=playerAttackPose(p,10.08);
        for(let i=0;i<50;i++) assert.deepEqual(playerAttackPose(p,10.08),expected);
        assert.deepEqual(p,before);
    }
    assert.notEqual(attackFrame(.14,'fire','normal'),attackFrame(.14,'fire','absolute'),'upgrades alter peak hold, not just tint');
    assert.notEqual(attackFrame(.03,'dual'),attackFrame(.03,'cannon'),'dual and braced cannon timing differ');
});

test('simultaneous mixed attacks prefer tech and main tier; readable hold prevents late passives and rapid-facing flicker', () => {
    const p={flip:false,hp:40,x:8,y:9,radius:10,stats:{speed:135}};
    markPlayerAttack(p,1,{id:'rifle'},1,{tech:'plague'});
    markPlayerAttack(p,1,{id:'molotov'},-1,{tech:'plague'});
    assert.equal(p.attackPose.family,'throw'); assert.equal(p.attackPose.flip,true);
    assert.equal(markPlayerAttack(p,1.04,{id:'absolute_bloom'},1,{tech:'bloom'}),false,'even an unrelated powerful event respects the minimum visible hold');
    assert.equal(markPlayerAttack(p,1+ATTACK_HOLD+.001,{id:'absolute_bloom'},1,{tech:'bloom'}),true);
    markPlayerAttack(p,p.attackPose.at,{id:'thorns',sourceId:'absolute_bloom'},-1,{tech:'bloom',activation:true});
    assert.equal(p.attackPose.family,'cannon','inherited orbit cannot overwrite the actual absolute beam');
    assert.deepEqual({hp:p.hp,x:p.x,y:p.y,radius:p.radius,stats:p.stats},{hp:40,x:8,y:9,radius:10,stats:{speed:135}});
});

test('high-ROF actual bullets update legacy timestamps but do not trap body on immediate release frame', () => {
    const p={flip:false}; const w={id:'pistols'};
    markPlayerAttack(p,1,w,1);
    for (const clock of [1.045,1.09]) markPlayerAttack(p,clock,w,-1);
    assert.equal(p.shotAt,1.09); assert.equal(p.attackPose.at,1);
    assert.equal(playerAttackPose(p,1.09).flip,false);
    assert.ok(playerAttackPose(p,1.09).frame>=3);
    markPlayerAttack(p,1.135,w,-1); assert.equal(p.attackPose.at,1.135); assert.equal(p.attackPose.flip,true);
    assert.equal(playerAttackPose(p,2,'executioner').family,'dual');
    markPlayerAttack(p,2,{id:'lotus_gun'},1);
    assert.equal(playerAttackPose(p,2.02,'plague').legendary,true);
    assert.equal(playerAttackPose(p,2.5,'plague').family,'throw');
});

function setup(id, evolved=false) {
    clearWorld(); resetBuild(); createPlayer();
    G.tech=null; G.clock=1; G.stage=1; G.mode='play'; G.caps={particles:0,texts:0}; G.passives={};
    G.weapons=[Object.assign(createWeapon(id,0),{cd:0,evolved,level:evolved?8:1})]; recomputeStats(true);
    delete save.upgrades.lotus_gun;
    G.player.facingX=1; G.player.facingY=0;
    return G.weapons[0];
}
test('real runtime attack emissions select correct body families without delaying damage-producing objects', () => {
    const old=save.upgrades.lotus_gun;
    try {
        for (const [family, ids] of Object.entries(expected)) for (const id of ids) {
            const w=setup(id); if(family==='sword'){const e=G.enemies.spawn();Object.assign(e,{id:777,x:60,y:0,radius:10,hp:100000,maxHp:100000,alive:true,elite:true,mass:1,kx:0,ky:0,def:{}});} updateWeapons(.016);
            if (family==='dual') { if (!WEAPONS[id].fusionOnly) assert.equal(G.shots.count,0,'burst scheduling remains unchanged'); G.clock+=.016;updateWeapons(.016); }
            assert.equal(G.player.attackPose.family,family,id); assert.equal(G.player.attackPose.weapon,id);
            assert.equal(G.player.attackPose.at,G.clock,id);
            if (family==='cannon') assert.ok(G.beams.count>0,id);
            else if(family==='channel') assert.ok(w.activeT>0,id);
            else if(family==='sword') assert.ok(G.player.swordSwing,id);
            else assert.ok(G.shots.count>0,id);
            assert.equal(G.player.x,0); assert.equal(G.player.y,0); assert.equal(G.player.radius,10);
        }
    } finally { if(old===undefined) delete save.upgrades.lotus_gun; else save.upgrades.lotus_gun=old; }
});

test('permanent orbit and following gas activate once; damage ticks, trail drops and cooldown maintenance never replay poses', () => {
    setup('thorns',true); updateWeapons(.016);
    assert.equal(G.player.attackPose.family,'channel'); const orbitAt=G.player.attackPose.at;
    for(let i=0;i<100;i++){G.clock+=.05;updateWeapons(.05);}
    assert.equal(G.player.attackPose.at,orbitAt); assert.equal(G.player.shotAt,orbitAt);
    const gas=setup('gas',true);updateWeapons(.016);
    assert.ok(gas.follow?.alive); assert.equal(G.player.attackPose.family,'channel');const gasAt=G.player.attackPose.at;
    for(let i=0;i<100;i++){G.clock+=.1;updateWeapons(.1);}
    assert.equal(G.player.attackPose.at,gasAt);
    setup('molotov',true);updateWeapons(.016); const throwAt=G.player.attackPose.at;
    G.weapons[0].cd=10; G.player.vx=135;
    for(let i=0;i<10;i++){G.clock+=.1;updateWeapons(.1);}
    assert.equal(G.player.attackPose.at,throwAt,'ground trail is not an arm throw');
});

test('arbitration suppresses only cosmetic pose requests, never a lower-priority weapon emission', () => {
    setup('shotgun'); G.player.attackPose={at:G.clock-.02,priority:99,family:'channel',weapon:'thorns',core:'thorns',tier:'absolute',flip:false};
    const stats=structuredClone(G.player.stats); updateWeapons(.016);
    assert.equal(G.player.attackPose.family,'channel'); assert.equal(G.shots.count,WEAPONS.shotgun.base.amount);
    assert.equal(G.weapons[0].cd,G.weapons[0].s.cd); assert.deepEqual(G.player.stats,stats);
});

function canvasContext() {
    const calls=[];return new Proxy({calls,globalAlpha:1,createRadialGradient:()=>({addColorStop(){}})},
        {get:(target,key)=>target[key]??((...args)=>calls.push([key,...args]))});
}
test('advanced accents are one bounded stroke, shape-distinct, absent for reduced motion and expire', () => {
    for(const tier of ['normal','evolved','fusion','absolute']){
        const ctx=canvasContext(),pose={active:true,at:0,tier,color:'#fff'};
        drawAttackAccent(ctx,pose,.05,false);
        assert.equal(ctx.calls.filter(c=>c[0]==='stroke').length,tier==='normal'?0:1);
        assert.equal(ctx.calls.filter(c=>c[0]==='lineTo').length,{normal:0,evolved:2,fusion:3,absolute:4}[tier]);
        for(const [clock,reduced] of [[.05,true],[.22,false]]){const c=canvasContext();drawAttackAccent(c,pose,clock,reduced);assert.equal(c.calls.length,0);}
    }
});

test('all new family/outfit keys use full fixed-size sheets, with only 4 bodies and 2 flashes resident', async () => {
    clearCharacterCache(); const seen=[];
    globalThis.Image=class{constructor(){this.width=3072;this.height=256;}set src(value){seen.push(value);queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
    globalThis.document={createElement:()=>({getContext:()=>canvasContext()})};
    assert.equal(Object.keys(CHARACTER_SHEETS).length,39);
    for(const outfit of [null,'dusk_lotus_cape','jade_lotus_guard']) for(const family of ATTACK_FAMILIES){
        const key=characterSheetKey(outfit,family);
        const [a,b]=await Promise.all([requestCharacterSheet(key),requestCharacterSheet(key)]);
        assert.equal(a,b); assert.ok(a); const flash=characterFlash(key);assert.equal(characterFlash(key),flash);
        const cache=characterCacheInfo();assert.ok(cache.bodies.length<=4);assert.ok(cache.flashes.length<=2);assert.ok(cache.decodedBytes<=18*1024*1024);
    }
    clearCharacterCache();
    await Promise.all(Object.keys(CHARACTER_SHEETS).map(key=>requestCharacterSheet(key)));
    assert.ok(characterCacheInfo().bodies.length<=4,'in-flight reservations count against the cap');
    assert.equal(characterCacheInfo().pending,0); assert.equal(characterCacheInfo().flashes.length,0);
    clearCharacterCache(); delete globalThis.Image; delete globalThis.document;
});

test('throw never selects a legendary gun sheet; unavailable families show only neutral ready and shared draw is read-only', () => {
    images.playerFire={id:'fallback'}; images.playerLotusFire={id:'legendary'}; images.player_throw={id:'throw'};
    const p={flip:false,x:0,y:0,vx:0,vy:0};markPlayerAttack(p,1,{id:'molotov'},-1);
    const before=structuredClone(p), ctx=canvasContext();
    drawAppearance(ctx,{player:p,clock:1.02,lotusGun:true,appearance:{},tech:null,reducedMotion:true});
    let draw=ctx.calls.find(c=>c[0]==='drawImage');assert.equal(draw[1].id,'throw');assert.equal(draw[2],384);
    assert.deepEqual(p,before);
    delete images.player_throw; const fallback=canvasContext();
    drawAppearance(fallback,{player:p,clock:1.02,lotusGun:true,appearance:{},tech:null,reducedMotion:true});
    draw=fallback.calls.find(c=>c[0]==='drawImage');assert.equal(draw,undefined,'missing non-gun art never substitutes a held rifle');assert.ok(fallback.calls.some(c=>c[0]==='ellipse'),'failure fallback remains a visible neutral pig');
});

test('off-tech active sheets survive renderer warmup and all cache resources remain bounded', async () => {
    clearCharacterCache();
    globalThis.Image=class{constructor(){this.width=3072;this.height=256;this.released=false;}set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}removeAttribute(){this.released=true;}};
    globalThis.document={createElement:()=>({getContext:()=>canvasContext()})};
    await requestCharacterSheet('playerFire');
    const key=characterSheetKey('jade_lotus_guard','dual');
    const body=await requestCharacterSheet(key);
    const p={flip:false};markPlayerAttack(p,1,{id:'pistols'},1,{tech:'plague'});
    const ctx=canvasContext();drawAppearance(ctx,{player:p,clock:1.02,appearance:{outfit:'jade_lotus_guard'},tech:'plague'});
    assert.equal(ctx.calls.find(c=>c[0]==='drawImage')[1],body);
    await Promise.resolve();await Promise.resolve();
    assert.equal(body.released,false);assert.equal(images[key],body);
    assert.ok(characterCacheInfo().bodies.length<=4);
    assert.equal(characterCacheInfo().flashes.length,0,'normal draws do not create flash canvases');
    clearCharacterCache();delete globalThis.Image;delete globalThis.document;
});

test('absolute peak remains readable through ordinary intervening fire while stronger same-tick events still win', () => {
    const p={flip:false};markPlayerAttack(p,1,{id:'absolute_bloom'},1,{tech:'bloom'});
    for(const time of [1.05,1.11,1.15,1.179]) assert.equal(markPlayerAttack(p,time,{id:'pistols'},-1,{tech:'executioner'}),false);
    assert.equal(p.attackPose.family,'cannon');assert.equal(p.attackPose.at,1);
    assert.equal(markPlayerAttack(p,1.181,{id:'pistols'},-1,{tech:'executioner'}),true);
    markPlayerAttack(p,1.181,{id:'doom_barrage'},1,{tech:'gunline'});
    assert.equal(p.attackPose.weapon,'doom_barrage');
});

test('an evolved cannon faces its first actual rotated beam without changing that beam angle or emission time', () => {
    setup('cannon',true);G.clock=5.5;updateWeapons(.016);
    assert.ok(G.beams.count>0);assert.equal(G.beams.items[0].angle,5.5*.6);
    assert.equal(G.player.attackPose.flip,Math.cos(G.beams.items[0].angle)<0);
    assert.equal(G.player.attackPose.at,5.5);
});

test('first-time family warmup cannot clear the fallback image or shrink its flash before drawImage', async () => {
    clearCharacterCache();
    globalThis.Image=class{constructor(){this.width=3072;this.height=256;this.released=false;}set src(value){queueMicrotask(()=>this.onload?.());}removeAttribute(){this.released=true;}};
    globalThis.document={createElement:()=>({getContext:()=>canvasContext()})};
    await requestCharacterSheet('playerFire');await requestCharacterSheet('costume_jade_lotus_guard_normal');
    const p={flip:false};markPlayerAttack(p,1,{id:'cannon'},1,{tech:'bloom'});
    const ctx=canvasContext();
    ctx.drawImage=image=>{assert.notEqual(image.released,true);assert.equal(image.width,3072,'flash remains full-sized until drawn');};
    drawAppearance(ctx,{player:p,clock:1.02,appearance:{outfit:'jade_lotus_guard'},tech:'bloom',tint:'flash'});
    await Promise.resolve();await Promise.resolve();
    assert.ok(characterCacheInfo().bodies.length<=4);clearCharacterCache();delete globalThis.Image;delete globalThis.document;
});

test('a failed outfit family requests and renders its uncostumed matching pose rather than a perpetual wrong-prop ready frame', async () => {
    clearCharacterCache();const seen=[];
    globalThis.Image=class{constructor(){this.width=3072;this.height=256;}set src(value){seen.push(value);queueMicrotask(()=>value.includes('jade-throw')?this.onerror?.():this.onload?.());}removeAttribute(){}};
    globalThis.document={createElement:()=>({getContext:()=>canvasContext()})};
    await requestCharacterSheet('playerFire');await requestCharacterSheet('costume_jade_lotus_guard_throw');
    const p={flip:false};markPlayerAttack(p,1,{id:'molotov'},1);
    drawAppearance(canvasContext(),{player:p,clock:1.02,appearance:{outfit:'jade_lotus_guard'},tech:null});
    await requestCharacterSheet('player_throw');
    const ctx=canvasContext();drawAppearance(ctx,{player:p,clock:1.02,appearance:{outfit:'jade_lotus_guard'},tech:null});
    const draw=ctx.calls.find(c=>c[0]==='drawImage');assert.equal(draw[1],images.player_throw);assert.equal(draw[2],384);
    assert.equal(seen.filter(src=>src.includes('jade-throw')).length,1,'failed outfit is not repeatedly fetched');
    clearCharacterCache();delete globalThis.Image;delete globalThis.document;
});
test('failed optional pose stays failed across LRU eviction instead of fetching every attack',async()=>{
 clearCharacterCache();const requests=[];
 globalThis.Image=class{constructor(){this.width=3072;this.height=256;}set src(value){requests.push(value);queueMicrotask(()=>value.includes('jade-throw')?this.onerror?.():this.onload?.());}removeAttribute(){}};
 const failed=characterSheetKey('jade_lotus_guard','throw');assert.equal(await requestCharacterSheet(failed),null);
 for(const family of ['dual','cannon','blade','channel'])await requestCharacterSheet(characterSheetKey(null,family));
 assert.equal(await requestCharacterSheet(failed),null);assert.equal(requests.filter(x=>x.includes('jade-throw')).length,1);
 clearCharacterCache();delete globalThis.Image;
});
