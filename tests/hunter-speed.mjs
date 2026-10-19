import test from 'node:test';
import assert from 'node:assert/strict';
import { Boss } from '../src/game/boss.js';
import { BOSSES } from '../src/data/bosses.js';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, fx } from '../src/core/assets.js';
import { SPRITES } from '../src/data/sprites.js';
import { updateHazards, spawnHazard } from '../src/game/hazards.js';
import { bossSpriteFrame, BOSS_FRAMES } from '../src/game/boss-appearance.js';
import { estimateWaveXP, simulatePlan } from '../tools/run-progression-audit.mjs';
import { measureBossEncounter } from '../tools/boss-damage-bench.mjs';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function reset(phase=0) {
    clearWorld(); Object.assign(G,{stage:3,mode:'boss',clock:0,time:0,events:{},damageBy:{},godMode:false,
        view:{w:600,h:1200},camera:{x:0,y:0},lowQ:false,caps:{enemies:252,particles:0,texts:0,gems:500,decalScale:0}});
    fx.splats={dark:[{width:64,height:64}],red:[{width:64,height:64}]};
    for(const [id,s] of Object.entries(SPRITES))atlases[id]={walkH:s.walkH,frameCount:()=>8,draw(){}};
    G.player={x:300,y:0,vx:0,vy:0,radius:10,hp:100,maxHp:100,iframes:0,stats:{crit:0,armor:0}};
    const b=new Boss(3);G.boss=b;b.x=0;b.y=0;b.phase=phase;b.speed=b.def.speed*(1+phase*.18);b.attackT=100;
    return b;
}
function begin(b) {b.task=b.task_hunt();return b.task;}
function advance(b,seconds,dt=1/60) {for(let t=0;t<seconds-1e-9;t+=dt){const step=Math.min(dt,seconds-t);G.clock+=step;G.player.iframes=Math.max(0,G.player.iframes-step);updateHazards(step);b.update(step);}}
const hazards=()=>G.hazards.items.slice(0,G.hazards.count);

test('Hunter speed and normalized lateral pursuit scale without changing HP, damage or collision radius',()=>{
    assert.equal(BOSSES[3].speed,118);assert.equal(BOSSES[3].hp,4930);assert.equal(BOSSES[3].dmg,18);
    for(const phase of [0,1,2]){
        const b=reset(phase),radius=b.radius;b.update(.1);
        close(Math.hypot(b.x,b.y),118*(1+phase*.18)*.1);assert.ok(Math.abs(b.y)>5);
        close(b.radius,radius);close(radius,SPRITES.boss1.walkH*.64*.32);
    }
});

test('two independent locks keep fixed directions and full .65/.50 tells at every phase',()=>{
    for(const phase of [0,1,2]){
        const b=reset(phase),s=begin(b),first={...hazards()[0]};
        close(s.speed,650*(1+phase*.08));close(s.lane.warning,.65);assert.equal(s.lane.length,300);
        G.player.y=220;advance(b,.649);close(b.x,0);close(b.y,0);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.windup);
        close(hazards()[0].angle,first.angle);advance(b,.001);assert.equal(s.phase,'dash');assert.equal(bossSpriteFrame(b),BOSS_FRAMES.attack);
        while(s.strike===0)advance(b,.01);
        close(b.x,300);close(b.y,0);assert.equal(s.phase,'warning');close(s.lane.warning,.5);close(s.lane.angle,Math.PI/2);
        G.player.x=-500;G.player.y=-500;const second={...s.lane};advance(b,.499);close(b.x,300);close(b.y,0);
        close(s.lane.angle,second.angle);advance(b,.001);assert.equal(s.phase,'dash');
        while(b.task===s)advance(b,.01);
        close(b.x,300);close(b.y,220);assert.equal(b.task.phase,'recover');assert.equal(G.enemyShots.count,0);
    }
});

test('long frames cannot tunnel through a player or execute an unseen second warning',()=>{
    const b=reset(),s=begin(b),radius=s.lane.radius;
    G.player.x=150;b.update(2);assert.equal(s.phase,'dash');close(b.x,0);assert.equal(G.player.hp,100);
    b.update(1);close(b.x,150-radius);close(G.player.hp,100-b.dmg);assert.equal(b.task.phase,'recover');
    assert.equal(s.strike,0,'contact aborts the combo instead of chaining an unavoidable second hit');
    assert.equal(hazards().length,0);const pos=[b.x,b.y],hp=G.player.hp;
    advance(b,1.249);assert.deepEqual([b.x,b.y],pos);assert.equal(G.player.hp,hp);assert.equal(b.task.phase,'recover');
    advance(b,.001);assert.equal(b.task,null);assert.ok(b.attackT>=1.35);
});

test('dash warning encloses the swept contact capsule and outside side/end edges stay safe',()=>{
    for(const outside of ['side','end']){
        const b=reset(),s=begin(b),h=hazards()[0],radius=s.lane.radius;
        close(h.x,-radius);close(h.len,s.lane.length+radius*2);close(h.width,radius*2);
        if(outside==='side'){G.player.x=150;G.player.y=radius+.01;}else G.player.x=s.lane.length+radius+.01;
        b.update(.65);b.update(1);assert.equal(G.player.hp,100);assert.equal(s.strike,1);
        close(b.x,300);close(b.y,0);
    }
    const far=reset();G.player.x=3000;const s=begin(far);assert.equal(s.lane.length,350);
    far.update(.65);close(far.x,0,'no offscreen-return boost during a locked warning');
});

test('missed combo and interrupted phase both expose at least 1.25 seconds of stationary recovery',()=>{
    for(const interruption of ['combo','phase']){
        const b=reset(2),s=begin(b);
        if(interruption==='combo'){
            G.player.y=200;b.update(.65);b.update(1);G.player.x=-500;G.player.y=-500;b.update(.5);b.update(1);
        }else b.enterPhase(2);
        assert.equal(b.task.phase,'recover');const pos=[b.x,b.y];
        G.player.x=b.x;G.player.y=b.y;const hp=G.player.hp;advance(b,1.249);
        assert.deepEqual([b.x,b.y],pos);assert.equal(G.player.hp,hp);assert.equal(bossSpriteFrame(b),BOSS_FRAMES.recover);
        advance(b,.001);assert.equal(b.task,null);assert.ok(b.attackT>=1.35);
    }
});

test('death, phase, new stage and replaced player cannot release a queued second strike',()=>{
    for(const interruption of ['death','phase','stage','player']){
        const b=reset(),s=begin(b);G.player.y=200;b.update(.65);b.update(1);assert.equal(s.strike,1);
        const warning=hazards()[0],callback=warning.onFire;
        const friendly=spawnHazard('gas',1000,1000,{duration:10});
        if(interruption==='death')b.die();
        else if(interruption==='phase')b.enterPhase(1);
        else if(interruption==='stage'){G.stage=4;b.update(.01);}
        else {G.player={...G.player,x:-400,y:400};b.update(.01);}
        const pos=[b.x,b.y],hp=G.player.hp;
        callback(warning);updateHazards(1);
        assert.deepEqual([b.x,b.y],pos);assert.equal(G.player.hp,hp);assert.ok(hazards().includes(friendly));
        assert.ok(hazards().every(h=>h.onFire?.bossOwner!==b));assert.notEqual(b.task,s);
    }
});

test('360px portrait scale and 200ms scripted reaction leave a real sidestep at 30/60fps in every phase',()=>{
    // Renderer uses the SHORT side / 600 world units; width360 means scale .6.
    // This is geometric simulation, not device/browser visual or input-lag QA.
    for(const phase of [0,1,2])for(const fps of [30,60]){
        const b=reset(phase),s=begin(b);assert.ok(hazards()[0].width*.6>46);
        G.player.y=200;b.update(.65);b.update(1);assert.equal(s.strike,1);close(s.lane.warning,.5);
        const warningStart=[G.player.x,G.player.y],angle=s.lane.angle,dt=1/fps;
        for(let f=0;f<Math.round(.5*fps);f++){
            if(f>=Math.round(.2*fps)){G.player.x-=Math.sin(angle)*135*dt;G.player.y+=Math.cos(angle)*135*dt;}
            G.clock+=dt;updateHazards(dt);b.update(dt);
        }
        assert.ok(Math.hypot(G.player.x-warningStart[0],G.player.y-warningStart[1])>s.lane.radius);
        while(b.task===s)advance(b,dt,dt);
        assert.equal(G.player.hp,100,`phase${phase}/${fps}fps: the locked dash is avoidable`);
    }
});

test('actual stage3 weak/mid progression builds finish bounded live Hunter encounters across distances/seeds',()=>{
    const summaries=[];
    for(const [name,residency,collection,mode]of[['weak',24,.7,'scattered'],['mid',16,.85,'planned']]){
        const snapshot=simulatePlan({rows:estimateWaveXP({residency}),collection,mode,seed:1}).stages[2].beforeBoss;
        const scenario={name,stage:3,weapons:snapshot.weapons.map(w=>[w.id,w.level,w.evolved]),stats:snapshot.stats};
        const deaths=[];
        for(const distance of [100,300,500])for(let seed=1;seed<=12;seed++){
            const r=measureBossEncounter(scenario,{distance,seed,maxSeconds:90});
            assert.ok(r.death!==null&&r.death<90,`${name}/${distance}/${seed}`);assert.ok(r.starts.length>0);
            deaths.push(r.death);
        }
        deaths.sort((a,b)=>a-b);summaries.push({name,level:snapshot.level,min:deaths[0],median:deaths[18],max:deaths.at(-1)});
    }
    console.log('Hunter live AI, standing high-HP player, no survival guarantee:',JSON.stringify(summaries));
});
