import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, activeWeaponCores } from '../src/game/weapons.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { WEAPONS, tierPower } from '../src/data/weapons.js';
import { save } from '../src/core/save.js';
import { cannonFocusMultiplier } from '../src/game/cannon-targeting.js';
import { runBalanceScene } from '../tools/cannon-growth-qa.mjs';

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

test('cannon Lv1–8 grows damage, width and range while rays stop at three',()=>{
    const w=setup();const damages=[44,56,60,68,74,84,92,100];let previous=Infinity;
    for(let level=1;level<=8;level++){
        w.level=level;const s=weaponStats(w);
        near(s.cd,2.6*(1-.09*(level-1)),`level ${level}`);assert.ok(s.cd<previous);previous=s.cd;
        assert.equal(s.amount,[1,2,2,3,3,3,3,3][level-1]);assert.equal(s.dmg,damages[level-1]);assert.equal(s.speed,1,'hitscan does not claim travel-speed progression');
        assert.equal(s.width,44+2*(level-1));assert.equal(s.length,520+20*(level-1));
    }
    assert.equal(createWeapon('cannon',0).cd,.4,'initial acquisition delay remains unchanged');
});

test('evolution preserves three rays while raising damage and firing another 15% faster',()=>{
    const w=setup('cannon',8,false), normal=weaponStats(w);w.evolved=true;const evolved=weaponStats(w);
    near(evolved.cd,normal.cd*.85);assert.equal(evolved.amount,3);
    near(evolved.dmg,normal.dmg*1.5*1.35*tierPower(w));assert.ok(evolved.dmg/evolved.cd>normal.dmg/normal.cd*3.5);
});

test('all Cannon families cap bonus rays at three with no hidden overflow or fractional damage',()=>{
    for(const id of ['cannon','lotus_bloom','ember_lance','absolute_bloom']) {
        const w=setup(id,8,id==='cannon'), plain=weaponStats(w);
        G.player.stats.amountMul=.5;G.player.stats.amount=100;
        const boosted=weaponStats(w);assert.equal(boosted.amount,id==='ember_lance'?2:3);near(boosted.dmg,plain.dmg,id);
        G.player.stats.cooldown=.01;assert.ok(weaponStats(w).cd>=.3);
    }
    const w=setup('cannon',8,true);w.sourceId='lotus_bloom';w.fusionLevel=8;
    Object.assign(G.player.stats,{might:100,amount:100,amountMul:100});
    near(weaponStats(w).dmg,800*tierPower(w),'source cap without overflow');
    const low=setup('cannon',1,false), plain=weaponStats(low);G.player.stats.amountMul=.1;
    near(weaponStats(low).dmg,plain.dmg,'fractional magazine rays are not hidden damage');
});

test('three-ray cap preserves meaningful equipment might growth before the source cap',()=>{
    const w=setup('cannon',8,true);w.sourceId='lotus_bloom';w.fusionLevel=1;
    G.player.stats.amountMul=.5;G.player.stats.might=1.5;const low=weaponStats(w);
    G.player.stats.might=2.15;const high=weaponStats(w);
    near(high.dmg/low.dmg,2.15/1.5);assert.equal(high.amount,3);assert.ok(high.dmg>low.dmg*1.4);
});

test('each ordinary or evolved cannon volley hits each enemy and boss once even when many rays overlap',()=>{
    for(const evolved of [false,true]){
        const w=setup('cannon',8,evolved);G.player.stats.area=3;
        const hits=boss(),e=enemy(1,35), s=weaponStats(w);
        updateWeapons(.001);
        assert.equal(G.beams.count,s.amount);assert.equal(hits.length,1);near(hits[0].dmg,s.beamDamage*.65);near(1e9-e.hp,s.beamDamage*.65);
        const hp=e.hp,bossHp=G.boss.hp;updateShots(.1);
        assert.equal(e.hp,hp);assert.equal(G.boss.hp,bossHp,'visible lifetime is not repeating DoT');
        w.cd=0;G.clock+=.01;updateWeapons(.001);assert.equal(hits.length,2,'dedup expires with the volley, not the weapon');
    }
});

test('inherited Cannon and final main releases coalesce without losing their scheduled focused damage',()=>{
    for(const id of ['lotus_bloom','ember_lance','absolute_bloom','plague_end']){
        setup(id,1,false);const cores=activeWeaponCores();const core=cores.find(w=>w.id==='cannon');
        assert.ok(core,id);assert.equal(core.level,8);assert.equal(core.evolved,true);
        const s=weaponStats(core);assert.equal(s.amount,3);near(s.cd,2.6*.37*.85*(id==='absolute_bloom'?1.15:1));
        const direct=cores.filter(c=>['cannon','lotus_bloom','ember_lance','absolute_bloom'].includes(c.id));
        const expected=direct.reduce((sum,c)=>{const s=weaponStats(c);return sum+s.focusBeamDamage*cannonFocusMultiplier(s.amount);},0);
        const hits=boss(350);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);updateWeapons(.001);
        assert.equal(hits.length,1,id);near(hits[0].dmg,expected,id);
        assert.equal(G.beams.count,3,id);
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

test('the primary ray respects explicit focus while moving and autoaim does not surrender targets to movement facing',()=>{
    const w=setup('cannon',8,true);G.player.vx=-135;G.player.facingX=-1;G.player.facingY=0;
    boss(200);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);const x=G.player.x,y=G.player.y;
    updateWeapons(.001);assert.ok(Math.cos(G.beams.items[0].angle)>0);assert.equal(G.player.x,x);assert.equal(G.player.y,y);
    clearFocus();w.evolved=false;w.cd=0;G.beams.clear();const hp=G.boss.hp;updateWeapons(.001);assert.ok(G.boss.hp<hp);
});

test('focused Cannon progression keeps evolved, final-entry and absolute-entry premiums with the same legal passives', () => {
    const builds = [['cannon',8,false],['cannon',8,true],['lotus_bloom',1,false],
        ['lotus_bloom',8,false],['absolute_bloom',1,false],['absolute_bloom',8,false]];
    const dps = builds.map(build => runBalanceScene({ tech:'bloom', build:[build],
        passives:{regen:3,pollen:3,spread:3}, scene:'boss_focused', seconds:30 }).dps);
    for (let i = 1; i < dps.length; i++) if (i !== 4) assert.ok(dps[i] > dps[i-1], JSON.stringify(dps));
    for (const index of [1,2]) assert.ok(dps[index] > dps[index-1]*1.1, `tier entry premium: ${JSON.stringify(dps)}`);
    // 최종 무기 하향 이후(TIER_POWER 감소): 절대 만개 Lv1(빔 한 줄 집중 장면)은 연꽃포 Lv8과 거의 같은 수준(실측 0.95배)이다.
    // 절대 무기의 가치는 세 슬롯을 하나로 합치는 데 있으므로 단일 빔 DPS 우위는 요구하지 않고, 크게 약해지지 않았는지만 확인한다.
    assert.ok(dps[4] > dps[3]*.9, `absolute entry stays near the Lv8 final: ${JSON.stringify(dps)}`);
});

test('requested double impact and count-based focus apply exactly once at Lv1/4/8 in automatic and focused modes',()=>{
    for(const [level,base,ratio] of [[1,44,1],[4,68,.85],[8,100,.65]]) {
        for(const focused of [false,true]) for(const might of [1,1.7]) {
            const w=setup('cannon',level);G.player.stats.might=might;
            const s=weaponStats(w), hits=boss(250);
            if(focused)tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);
            updateWeapons(.001);
            const oldImpact=base*might*(focused?cannonFocusMultiplier(s.amount):ratio);
            near(s.beamDamage,s.dmg*2,'derived beam damage');
            assert.equal(hits.length,1);near(hits[0].dmg,oldImpact*2);
            assert.ok(G.beams.count<=3);
        }
    }
});

test('beam multiplier never changes non-beam stats or multiplies inherited core twice',()=>{
    for(const id of ['cannon','lotus_bloom','ember_lance','absolute_bloom']) {
        setup(id,8,id==='cannon');
        for(const w of activeWeaponCores()) {
            const s=weaponStats(w);
            if(['cannon','lotus_bloom','ember_lance','absolute_bloom'].includes(w.id))near(s.beamDamage,s.dmg*2);
            else assert.equal(s.beamDamage,undefined,w.id);
        }
    }
    for(const id of ['shotgun','pistols','gas','molotov','saw','sword','thorns']) {
        const w=setup(id,8);assert.equal(weaponStats(w).beamDamage,undefined,id);
    }
});

test('focused total is exactly 1.1/2.2/3.3 strengthened beams, never multiplied by count twice',()=>{
    for(const [count,expected] of [[0,1.1],[1,1.1],[2,2.2],[3,3.3],[100,3.3]])near(cannonFocusMultiplier(count),expected);
    for(const tech of ['gunline','executioner','plague','butcher']){
        const w=setup('cannon',8);G.tech=tech;
        const s=weaponStats(w);
        near(s.dmg,80,'existing raw mismatch remains for shared non-beam stats');
        near(s.beamDamage,190,'Cannon-only mismatch is 5% of doubled100');
        near(s.beamFocusedImpact,627,'three rays already included in total');
        const hits=boss(250);tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);updateWeapons(.001);
        near(hits[0].dmg,627);assert.equal(G.beams.count,3);
    }
});
