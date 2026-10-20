// Deterministic real-runtime balance probe. No game source edits or browser APIs.
// node tools/cannon-growth-qa.mjs --seconds=30 --baseline=tests/fixtures/tech-role-baseline.json
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { G, clearWorld } from '../src/game/state.js';
import { createPlayer, recomputeStats, POLLEN_BARRIER_CD } from '../src/game/player.js';
import { resetBuild } from '../src/game/progression.js';
import { createWeapon, weaponStats, updateWeapons, updateShots, activeWeaponCores } from '../src/game/weapons.js';
import { updateHazards } from '../src/game/hazards.js';
import { clearFocus, tapFocusAt } from '../src/game/targeting.js';
import { TECHS, techStartingWeapons } from '../src/data/techs.js';
import { WEAPONS } from '../src/data/weapons.js';
import { save } from '../src/core/save.js';
import { images } from '../src/core/assets.js';
import { simulateWeapon, TIER_SCENES } from '../tests/helpers/tier-power.mjs';

const ROUTES={gunline:{weapons:['shotgun','rifle'],fusion:'scatter_rail'},bloom:{weapons:['thorns','cannon'],fusion:'lotus_bloom'},
    plague:{weapons:['molotov','gas'],fusion:'plague_fire'},executioner:{weapons:['pistols','rifle'],fusion:'burst_rail',passives:['focus','scope','madness']},butcher:{weapons:['sword','saw'],fusion:'sword_wheel'}};
const LEGACY_BUTCHER_ROUTE={weapons:['saw','thorns'],fusion:'orbit_saw',passives:['whet','regen','heart']};
export const BALANCE_SCENES=['boss_focused','boss_moving_unfocused','swarm_stationary','dispersed_moving'];
const round=n=>+n.toFixed(3);
export function balanceConfiguration(tech,phase,{legacy=false}={}){
    const route=tech==='butcher'&&legacy?LEGACY_BUTCHER_ROUTE:ROUTES[tech],definition=TECHS[tech];
    // Same passive investment, with every actual evolution prerequisite kept.
    // Executioner needs off-family scope for rifle; all-family whet was an
    // impossible evolved fixture and overstated its damage by omitting that cost.
    const passives=route.passives||definition.family.passives;
    if(phase==='actual_starter')return{build:techStartingWeapons(definition).map(id=>[id,1,false]),passives:{[definition.start.passive]:1},investment:techStartingWeapons(definition).length+1};
    if(phase==='equal_starter')return{build:route.weapons.map(id=>[id,1,false]),passives:{[definition.start.passive]:1},investment:3};
    if(phase==='mid')return{build:route.weapons.map(id=>[id,4,false]),passives:Object.fromEntries(passives.map(id=>[id,2])),investment:14};
    if(phase==='evolved')return{build:route.weapons.map(id=>[id,8,true]),passives:Object.fromEntries(passives.map(id=>[id,5])),investment:31,evolutions:2};
    return{build:[[route.fusion,8,false]],passives:Object.fromEntries(passives.map(id=>[id,5])),investment:38,evolutions:2,fusions:1};
}

export function runBalanceScene({tech=null,build=[['cannon',1,false]],passives={},scene='boss_focused',seconds=30,bossDistance=250}){
    resetBuild();clearWorld();clearFocus();createPlayer();
    Object.assign(G,{tech,mode:'play',stage:1,clock:0,gold:0,events:{},damageBy:{},boss:null,caps:{particles:0,texts:0},lowQ:true,paused:false});
    save.upgrades={};save.equippedCosmetics={outfit:null,ornament:null};save.equippedPet=null;
    G.camera.x=0;G.camera.y=0;
    G.passives={...passives};G.weapons=build.map(([id,level,evolved],slot)=>Object.assign(createWeapon(id,slot),{level,evolved}));recomputeStats(true);
    images.playerFire={width:3072,height:256};G.player.hp=50;
    const targets=[],HP=1e8;let totalDamage=0,hitEvents=0,peakBeams=0,peakShots=0,maxBeamsInTick=0;const hitIds=new Set();
    const addHealth=(target,id)=>{let hp=HP;Object.defineProperty(target,'hp',{configurable:true,enumerable:true,get:()=>hp,set(value){if(value<hp){totalDamage+=hp-value;hitEvents++;hitIds.add(id);}hp=value;}});};
    if(scene.startsWith('boss')){
        const boss=G.boss={id:-1,x:bossDistance,y:0,radius:28,alive:true,maxHp:HP,hits:{},hurt(dmg,opts={}){
            const chance=(opts.crit||0)+G.player.stats.crit;
            const damage=chance&&Math.random()<chance?dmg*((G.player.stats.critMul||3)+(opts.critBonus||0)):dmg;
            this.hp-=damage;if(opts.weapon)G.damageBy[opts.weapon]=(G.damageBy[opts.weapon]||0)+damage;
        }};addHealth(boss,-1);targets.push(boss);
        if(scene==='boss_focused')tapFocusAt(boss.x,boss.y-boss.radius);
    }else for(let i=0;i<18;i++){
        const angle=i*Math.PI*2/18,radius=scene==='swarm_stationary'?40+(i%3)*18:130+(i%3)*80;
        const e=Object.assign(G.enemies.spawn(),{id:i+1,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,motionVX:0,motionVY:0,radius:12,alive:true,elite:true,maxHp:HP,mass:1,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(24).fill(-99),initialAngle:angle,initialRadius:radius});
        addHealth(e,i+1);targets.push(e);G.grid.insert(e);
    }
    let seed=1234567;const original=Math.random;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const frames=Math.round(seconds*60),dt=1/60,moving=scene.includes('moving');
    try{for(let frame=0;frame<frames;frame++){
        G.clock+=dt;
        if(moving){const rate=G.player.stats.speed/110,a=G.clock*rate;
            Object.assign(G.player,{x:70*Math.sin(a),y:50*(Math.cos(a)-1),vx:70*rate*Math.cos(a),vy:-50*rate*Math.sin(a)});
            const length=Math.hypot(G.player.vx,G.player.vy)||1;G.player.facingX=G.player.vx/length;G.player.facingY=G.player.vy/length;
            G.camera.x=G.player.x;G.camera.y=G.player.y;
        }
        if(scene==='dispersed_moving'){
            G.grid.reset();for(const e of targets){const a=e.initialAngle+G.clock*.08;e.x=Math.cos(a)*e.initialRadius;e.y=Math.sin(a)*e.initialRadius;e.motionVX=-Math.sin(a)*e.initialRadius*.08;e.motionVY=Math.cos(a)*e.initialRadius*.08;G.grid.insert(e);}
        }
        const before=G.beams.count;updateWeapons(dt);maxBeamsInTick=Math.max(maxBeamsInTick,G.beams.count-before);
        peakBeams=Math.max(peakBeams,G.beams.count);peakShots=Math.max(peakShots,G.shots.count);
        updateShots(dt);updateHazards(dt);
        for(const e of targets)if(e.bleedT>0){e.bleedT-=dt;e.hp-=e.bleed/15;}
    }}finally{Math.random=original;clearFocus();}
    const stats=G.player.stats;
    return{damage:round(totalDamage),dps:round(totalDamage/seconds),hitEvents,targetsHit:hitIds.size,targetCount:targets.length,
        peakBeams,peakShots,maxBeamsInTick,damageBy:Object.fromEntries(Object.entries(G.damageBy).map(([id,dmg])=>[id,round(dmg)])),
        survival:{maxHp:stats.maxHp,armor:stats.armor,regenPerSecond:stats.regen,speed:round(stats.speed),pollenRecharge:passives.pollen?POLLEN_BARRIER_CD[passives.pollen]:null},
        cores:activeWeaponCores(false).map(w=>{const s=weaponStats(w);return{id:w.id,source:w.sourceId||null,level:w.level,evolved:w.evolved,cd:round(s.cd),amount:s.amount,damage:round(s.dmg)};})};
}

// Isolate one real Lv8 final-field release to measure its fixed footprint.
// This is a field-uptime diagnostic, not whole-build DPS or enemy survival.
export function measurePlagueFieldUptime({moving=true,seconds=3}={}){
    resetBuild();clearWorld();clearFocus();createPlayer();
    Object.assign(G,{tech:'plague',mode:'play',stage:1,clock:0,events:{},damageBy:{},boss:null,caps:{particles:0,texts:0},lowQ:true});
    save.upgrades={};save.equippedCosmetics={};save.equippedPet=null;
    G.passives={spread:5,sap:5,hide:5};
    const weapon=Object.assign(createWeapon('plague_fire',0),{level:8,cd:0});G.weapons=[weapon];recomputeStats(true);
    const hp=1e6,baseSpeed=moving?360:0;
    const target=Object.assign(G.enemies.spawn(),{id:1,x:180,y:0,motionVX:0,motionVY:baseSpeed,radius:12,alive:true,elite:true,
        hp,maxHp:hp,mass:1,kx:0,ky:0,slow:0,slowT:0,bleed:0,bleedT:0,hits:new Float32Array(24).fill(-99),def:{}});
    G.grid.reset();G.grid.insert(target);
    updateWeapons(.001);
    const index=G.shots.items.slice(0,G.shots.count).findIndex(shot=>shot.kind==='lob'&&shot.weapon==='plague_fire'&&!shot.coreId);
    if(index<0)throw new Error('Final Plague main release did not create a real bottle');
    // Keep pooled identities unique while isolating one main-field bottle from
    // inherited cores and the other simultaneous throws.
    [G.shots.items[0],G.shots.items[index]]=[G.shots.items[index],G.shots.items[0]];G.shots.count=1;G.hazards.clear();
    const landing={x:G.shots.items[0].tx,y:G.shots.items[0].ty};
    let field=null,coveredSeconds=0,firstHitTime=null,lastHitTime=null,slowPeak=0;
    const original=Math.random;Math.random=()=>.5;
    try{for(let frame=0;frame<Math.round(seconds*60);frame++){
        const dt=1/60;G.clock+=dt;
        const slow=target.slowT>0?target.slow:0;target.slowT=Math.max(0,target.slowT-dt);
        target.motionVY=baseSpeed*(1-slow);target.y+=target.motionVY*dt;
        G.grid.reset();G.grid.insert(target);updateShots(dt);
        field=G.hazards.items.find((h,i)=>i<G.hazards.count&&h.kind==='fire')||field;
        if(field&&field.alive&&(target.x-field.x)**2+(target.y-field.y)**2/.49<=field.radius**2)coveredSeconds+=dt;
        const before=target.hp;updateHazards(dt);
        if(target.hp<before){if(firstHitTime===null)firstHitTime=G.clock;lastHitTime=G.clock;}
        slowPeak=Math.max(slowPeak,target.slow);
    }}finally{Math.random=original;}
    return{moving,baseSpeed,seconds,coveredSeconds:round(coveredSeconds),damage:round(hp-target.hp),firstHitTime:round(firstHitTime??0),
        lastHitTime:round(lastHitTime??0),slowPeak,fieldRadius:field?.radius,fieldDuration:field?.duration,fieldAliveAtEnd:!!field?.alive,
        landing,finalCenter:field?{x:field.x,y:field.y}:null};
}

export function balanceReport({seconds=30,baselinePath=null}={}){
    const report={seconds,seed:1234567,simulation:'Real weapon/shot/hazard updates at60Hz against immortal targets; movement changes aim and coverage. Enemy DPS dummies are elite to exclude instant-execution damage; finite normal-enemy kill speed requires a separate encounter probe. Survival columns are stats, not simulated time-to-death. No pets, permanent upgrades or outfits.',
        budgets:'Equal starter=2Lv1 weapons+1Lv1passive (3points); mid=2Lv4+3Lv2 (14); evolved=2Lv8+3Lv5 (31,+2evolutions); final=consumed twoLv8 evolved+Lv8fusion+3Lv5 (38,+fusion). Actual starter shown separately; Bloom and Butcher start with two weapons. Current Butcher uses sword+saw; its old saw+thorns route is retained separately.',
        rules:{techs:TECHS,cannon:WEAPONS.cannon,lotus_bloom:WEAPONS.lotus_bloom,absolute_bloom:WEAPONS.absolute_bloom,
            sword:WEAPONS.sword,sword_wheel:WEAPONS.sword_wheel},cannon:{},techs:{},legacyButcher:{},sword:{}};
    for(const [id,level,evolved]of[['cannon',1,false],['cannon',4,false],['cannon',8,false],['cannon',8,true],['lotus_bloom',1,false],['lotus_bloom',8,false],['absolute_bloom',1,false],['absolute_bloom',8,false]]){
        const key=`${id}:${level}:${evolved}`;report.cannon[key]={};
        for(const scene of BALANCE_SCENES)report.cannon[key][scene]=runBalanceScene({tech:'bloom',build:[[id,level,evolved]],passives:{regen:5,pollen:5,heart:5},scene,seconds});
    }
    for(const tech of Object.keys(ROUTES)){
        report.techs[tech]={};for(const phase of ['actual_starter','equal_starter','mid','evolved','final']){
            const config=balanceConfiguration(tech,phase);report.techs[tech][phase]={config,scenes:{}};
            for(const scene of BALANCE_SCENES)report.techs[tech][phase].scenes[scene]=runBalanceScene({tech,...config,scene,seconds});
        }
    }
    for(const phase of ['equal_starter','mid','evolved','final']){
        const config=balanceConfiguration('butcher',phase,{legacy:true});
        report.legacyButcher[phase]={config,scenes:{}};
        for(const scene of BALANCE_SCENES)report.legacyButcher[phase].scenes[scene]=runBalanceScene({tech:'butcher',...config,scene,seconds});
    }
    report.swordComparison='Boss probes here begin at 80px to exercise actual melee; main tech boss probes begin at250px. The old carnage_saw absolute consumes three different evolved inputs and is a cross-route comparison, not an upgrade of sword_wheel.';
    for(const [key,build]of[
        ['sword:1:false',[['sword',1,false]]],['sword:4:false',[['sword',4,false]]],
        ['sword:8:false',[['sword',8,false]]],['sword:8:true',[['sword',8,true]]],
        ['evolved_sword_and_saw',[['sword',8,true],['saw',8,true]]],
        ['sword_wheel:1:false',[['sword_wheel',1,false]]],['sword_wheel:8:false',[['sword_wheel',8,false]]],
        ['carnage_saw:1:false',[['carnage_saw',1,false]]],['carnage_saw:8:false',[['carnage_saw',8,false]]],
    ]){
        report.sword[key]={};
        for(const scene of BALANCE_SCENES)report.sword[key][scene]=runBalanceScene({tech:'butcher',build,passives:{whet:5,hide:5,heart:5},scene,seconds,bossDistance:80});
    }
    report.plagueFieldUptime={stationary:measurePlagueFieldUptime({moving:false}),moving:measurePlagueFieldUptime({moving:true})};
    if(baselinePath){
        const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));delete images.playerFire;
        report.baselineComparison={commit:baseline.commit,method:'Matches the original 30second, neutral-tech tier helper; ratios are separate from the modern-muzzle QA scenes above.',weapons:{}};
        for(const key of Object.keys(report.cannon)){
            const[id,level,flag]=key.split(':'),current=Object.fromEntries(TIER_SCENES.map(scene=>[scene,simulateWeapon(id,+level,flag==='true',scene)])),before=baseline.weapons[key];
            report.baselineComparison.weapons[key]={current,previous:before,ratios:Object.fromEntries(TIER_SCENES.map(scene=>[scene,round(current[scene]/before[scene])]))};
        }
    }
    return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
    const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
    console.log(JSON.stringify(balanceReport({seconds:Number(args.seconds)||30,baselinePath:args.baseline||null}),null,2));
}
