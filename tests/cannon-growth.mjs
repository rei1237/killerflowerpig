import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, activeWeaponCores } from '../src/game/weapons.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { WEAPONS, tierPower } from '../src/data/weapons.js';
import { save } from '../src/core/save.js';

const near = (actual, expected, label) => assert.ok(Math.abs(actual-expected)<1e-7, `${label || ''}: ${actual} != ${expected}`);
function setup(id='cannon',level=1,evolved=false) {
    resetBuild();clearWorld();clearFocus();createPlayer();
    Object.assign(G,{tech:null,clock:1,stage:1,mode:'play',paused:false,boss:null,damageBy:{},events:{},lowQ:false,caps:{particles:0,texts:0}});
    G.passives={};G.weapons=[Object.assign(createWeapon(id,0),{level,evolved,cd:0})];
    delete save.upgrades.lotus_gun;recomputeStats(true);G.player.stats.crit=0;
    return G.weapons[0];
}
function boss(x=70) {
    const hits=[];G.boss={x,y:0,radius:30,alive:true,hp:1e9,hits:{},hurt(dmg,options){hits.push({dmg,...options});this.hp-=dmg;}};
    return hits;
}
function enemy(id,x,y=0) {
    const e=Object.assign(G.enemies.spawn(),{id,x,y,radius:12,alive:true,hp:1e9,maxHp:1e9,mass:1,kx:0,ky:0,hits:new Float32Array(24).fill(-99)});
    G.grid.insert(e);return e;
}

test('cannon Lv1–8 gains a real extra ray and 9 percentage points of base cooldown each level',()=>{
    const w=setup();const damages=[28,40,40,40,40,55,55,75];let previous=Infinity;
    for(let level=1;level<=8;level++){
        w.level=level;const s=weaponStats(w);
        near(s.cd,2.6*(1-.09*(level-1)),`level ${level}`);assert.ok(s.cd<previous);previous=s.cd;
        assert.equal(s.amount,level);assert.equal(s.dmg,damages[level-1]);assert.equal(s.speed,1,'hitscan does not claim travel-speed progression');
    }
    assert.equal(createWeapon('cannon',0).cd,.4,'initial acquisition delay remains unchanged');
});

test('evolution preserves the full upgraded curve, doubles rays and is another 15% faster',()=>{
    const w=setup('cannon',8,false), normal=weaponStats(w);w.evolved=true;const evolved=weaponStats(w);
    near(evolved.cd,normal.cd*.85);assert.equal(evolved.amount,16);
    near(evolved.dmg,normal.dmg*1.5*1.35*tierPower(w));assert.ok(evolved.dmg/evolved.cd>normal.dmg/normal.cd*3.5);
});

test('magazine and tech overflow become damage once, with 16-ray and 300ms hard bounds',()=>{
    const w=setup('cannon',8,true), unmodified=weaponStats(w);
    G.player.stats.amountMul=.5;const magazine=weaponStats(w);
    assert.equal(magazine.amount,16);near(magazine.dmg,unmodified.dmg*1.5);
    G.player.stats.amount=1;const extra=weaponStats(w);
    near(extra.dmg,unmodified.dmg*(18*1.5/16));assert.equal(extra.amount,16);
    G.player.stats.cooldown=.01;assert.equal(weaponStats(w).cd,.3);
    w.sourceId='lotus_bloom';w.fusionLevel=8;const inherited=weaponStats(w);
    assert.equal(inherited.amount,16);assert.equal(inherited.cd,.3);
    assert.ok(inherited.dmg<=600*tierPower(w)*2,'source cap plus a separately bounded overflow remains finite');
    Object.assign(G.player.stats,{might:100,amount:100});
    near(weaponStats(w).dmg,600*tierPower(w)*2,'invalid extreme stats cannot amplify overflow beyond2');
});

test('bounded ray overflow preserves meaningful equipment might growth before the source cap',()=>{
    const w=setup('cannon',8,true);w.sourceId='lotus_bloom';w.fusionLevel=1;
    G.player.stats.amountMul=.5;G.player.stats.might=1.5;const low=weaponStats(w);
    G.player.stats.might=2.15;const high=weaponStats(w);
    near(high.dmg/low.dmg,2.15/1.5);assert.equal(high.amount,16);assert.ok(high.dmg>low.dmg*1.4);
});

test('each ordinary or evolved cannon volley hits each enemy and boss once even when many rays overlap',()=>{
    for(const evolved of [false,true]){
        const w=setup('cannon',8,evolved);G.player.stats.area=3;
        const hits=boss(),e=enemy(1,35), s=weaponStats(w);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);
        updateWeapons(.001);
        assert.equal(G.beams.count,s.amount);assert.equal(hits.length,1);near(hits[0].dmg,s.dmg);near(1e9-e.hp,s.dmg);
        const hp=e.hp,bossHp=G.boss.hp;updateShots(.1);
        assert.equal(e.hp,hp);assert.equal(G.boss.hp,bossHp,'visible lifetime is not repeating DoT');
        w.cd=0;G.clock+=.01;updateWeapons(.001);assert.equal(hits.length,2,'dedup expires with the volley, not the weapon');
    }
});

test('each inherited cannon keeps Lv8 evolution and independent target-hit ownership',()=>{
    for(const id of ['lotus_bloom','ember_lance','absolute_bloom','plague_end']){
        setup(id,1,false);const cores=activeWeaponCores();const core=cores.find(w=>w.id==='cannon');
        assert.ok(core,id);assert.equal(core.level,8);assert.equal(core.evolved,true);
        const s=weaponStats(core);assert.equal(s.amount,16);near(s.cd,2.6*.37*.85);
        const hits=boss(180);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);updateWeapons(.001);
        assert.equal(hits.filter(hit=>Math.abs(hit.dmg-s.dmg)<1e-7).length,1,`${id}: inherited core damages once`);
        assert.equal(G.beams.items.slice(0,G.beams.count).filter(b=>b.coreId==='cannon').length,16);
    }
});

test('high-count cannon volleys emit at most 24 decorative petals and expose all rays immediately',()=>{
    for(const evolved of [false,true]){
        const w=setup('cannon',8,evolved);G.caps.particles=1000;
        const s=weaponStats(w);updateWeapons(.001);
        assert.equal(G.beams.count,s.amount);assert.ok(G.particles.count<=24);
        for(const beam of G.beams.items.slice(0,G.beams.count)) near(beam.len,s.length*Math.sqrt(s.area));
    }
});

test('the primary ray respects explicit focus while moving and returns to movement aim without focus',()=>{
    const w=setup('cannon',8,true);G.player.vx=-135;G.player.facingX=-1;G.player.facingY=0;
    boss(200);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);const x=G.player.x,y=G.player.y;
    updateWeapons(.001);assert.ok(Math.cos(G.beams.items[0].angle)>0);assert.equal(G.player.x,x);assert.equal(G.player.y,y);
    clearFocus();w.evolved=false;w.cd=0;G.beams.clear();updateWeapons(.001);assert.ok(Math.cos(G.beams.items[0].angle)<0);
});
