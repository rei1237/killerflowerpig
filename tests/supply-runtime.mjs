import { coinRandom, treasureRandom } from '../src/game/coin-drops.js';
coinRandom.next = () => .99;
treasureRandom.next = () => .99; // 보물 상자는 별도 테스트(rare-coins)에서 검증한다
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { atlases, fx } from '../src/core/assets.js';
import { ENEMIES, RANGED_UNLOCK_STAGE, stageScaling } from '../src/data/enemies.js';
import { STAGES } from '../src/data/stages.js';
import { supplyState } from '../src/game/supply-drops.js';
import { spawnEnemy, hitEnemy, updateEnemies } from '../src/game/enemies.js';
import { dropPickup, updatePickups, drawPickups } from '../src/game/pickups.js';
import { resetBuild, snapshotBuild, restoreBuild } from '../src/game/progression.js';
import { currentWeights } from '../src/game/spawner.js';
import { Boss } from '../src/game/boss.js';

const active = pool => pool.items.slice(0, pool.count);
const field = kind => active(G.pickups).filter(pickup => pickup.kind === kind);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function reset(stage = 1, hp = 80) {
    clearWorld();
    G.stage = stage; G.time = 0; G.clock = 0; G.kills = 0; G.gold = 0;
    G.supplyDrought = supplyState(); G.lowQ = false; G.godMode = false;
    G.events = {}; G.damageBy = {}; G.rerolls = 2;
    G.weapons = []; G.passives = {}; G.level = 1; G.xp = 0; G.xpNext = 4;
    G.pendingLevelUps = 0; G.banished = new Set();
    G.caps = { enemies: 420, particles: 0, texts: 0, gems: 500, decalScale: 0 };
    G.view = { w: 1000, h: 600 };
    G.player = {
        x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp, maxHp: 100,
        dead: false, iframes: 0, hurtT: 0,
        stats: { crit: 0, armor: 0, magnet: 70, greed: 1 },
    };
    for (const name of ['rabbit1', 'rabbit2', 'rabbit3', 'boss1', 'boss2', 'bossKing']) {
        atlases[name] = { walkH: 112, frameCount: () => 8 };
    }
}

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try { fn(); } finally { Math.random = original; }
}

function kill(elite = false) {
    const enemy = spawnEnemy('shambler', 500, 0, { elite, noAffix: true });
    assert.ok(enemy);
    const index = G.enemies.count - 1;
    hitEnemy(enemy, enemy.hp + 1, { silent: true });
    assert.equal(enemy.alive, false);
    assert.equal(hitEnemy(enemy, 100, { silent: true }), 0, 'a dead enemy cannot roll supplies twice');
    // Release the corpse as the real enemy-update loop does after its death animation.
    G.enemies.release(index);
}

test('healthy real kills never drop heals; magnet guarantee at 36 with exact coin and XP totals',()=>withRandom(.99,()=>{
 reset();let xp=0;
 for(let count=1;count<=36;count++){
  const prior=G.gems.count;kill();xp+=G.gems.items[prior].value;
  assert.equal(field('meat').length,0,'HP above 30% never spawns healing');
  assert.equal(field('magnet').length,count===36?1:0);
 }
 assert.equal(G.kills,36);assert.equal(field('coin').reduce((n,c)=>n+c.value,0),0);
 assert.ok(xp>0);close(G.gems.items[0].value,ENEMIES.shambler.xp*stageScaling(1,0,STAGES[1].duration).xp*5/3); // 스테이지 XP 배율(STAGE_XP_YIELD 포함)
}));

test('low HP real kills guarantee at8; elites drop their 10 coins on a winning roll without a chest',()=>withRandom(.99,()=>{
 reset(1,20);for(let n=0;n<7;n++)kill();assert.equal(field('meat').length,0);
 kill();assert.equal(field('meat').length,1);
 // Elite80% coin roll: winning .29 produces10 coins without altering supplies.
 const before={...G.supplyDrought};coinRandom.next=()=>.29;try{kill(true);}finally{coinRandom.next=()=>.99;}assert.deepEqual(G.supplyDrought,before);
 assert.equal(field('chest').length,0);assert.equal(field('coin').at(-1).value,10);
}));

test('field cap retains pending guarantees and useful collection releases slots',()=>withRandom(.99,()=>{
 reset(1,20);for(let n=0;n<3;n++)dropPickup('meat',700+n*20,0);
 for(let n=0;n<2;n++)dropPickup('magnet',800+n*20,0);
 G.supplyDrought={heal:30,low:12,magnet:60};kill();
 assert.deepEqual(G.supplyDrought,{heal:30,low:12,magnet:60});
 const meat=field('meat')[0],magnet=field('magnet')[0];meat.x=magnet.x=0;meat.y=magnet.y=-14;
 updatePickups(0);assert.equal(G.player.hp,50);G.player.hp=20;kill();
 assert.equal(field('meat').length,3);assert.equal(field('magnet').length,2);
 assert.deepEqual(G.supplyDrought,{heal:0,low:0,magnet:0});
}));

test('JSON build reload retains fractional and legacy drought opportunity units',()=>withRandom(.99,()=>{
 reset(1,25);for(let n=0;n<7;n++)kill();const snapshot=JSON.parse(JSON.stringify(snapshotBuild()));
 close(snapshot.supplyDrought.heal,35/3);close(snapshot.supplyDrought.low,35/3);resetBuild();restoreBuild(snapshot);
 close(G.supplyDrought.heal,35/3);close(G.supplyDrought.low,35/3);
 G.player.hp=25;assert.equal(field('meat').length,0);kill();assert.equal(field('meat').length,1,'restored low-HP pity completes on the next kill');
 restoreBuild({...snapshot,supplyDrought:{heal:17,low:0,magnet:17}});assert.equal(G.supplyDrought.heal,17);
 delete snapshot.supplyDrought;restoreBuild(snapshot);assert.deepEqual(G.supplyDrought,{heal:0,low:0,magnet:0});
}));

test('ranged audit: boss summons cannot introduce ranged enemies before stage5; later summons retain them', () => {
    assert.equal(RANGED_UNLOCK_STAGE, 5);
    for (let stage = 1; stage <= 10; stage++) {
        reset(stage);
        const table = currentWeights(STAGES[stage], STAGES[stage].duration);
        let previous = 0;
        for (const [id, weight] of Object.entries(table)) {
            if (id === 'spitter') break;
            previous += weight;
        }
        const total = Object.values(table).reduce((sum, weight) => sum + weight, 0);
        const random = stage >= 5 ? (previous + table.spitter / 2) / total : 0.5;
        withRandom(random, () => {
            const boss = new Boss(stage);
            boss.patternSummon(10);
        });
        assert.equal(G.enemies.count, 6);
        assert.ok(active(G.enemies).every(enemy => stage < 5 ? !enemy.def.ranged : enemy.type === 'spitter'));
    }
});

test('ranged audit: stage5+ tables, forced/elite spawns and projectile timing retain the late-game values', () => withRandom(0.5, () => {
    const before = JSON.stringify(STAGES);
    for (let stage = 5; stage <= 10; stage++) {
        for (const [time, table] of STAGES[stage].weights) assert.deepEqual(currentWeights(STAGES[stage], time), table);
        for (const opts of [{}, { force: true }, { elite: true }, { force: true, elite: true }]) {
            reset(stage);
            const spitter = spawnEnemy('spitter', 100, 0, opts);
            assert.ok(spitter);
            spitter.shootT = 0;
            updateEnemies(0.01);
            assert.equal(G.enemyShots.count, 1);
            const shot = G.enemyShots.items[0];
            assert.equal(shot.kind, 'acid');
            close(Math.hypot(shot.vx, shot.vy), ENEMIES.spitter.ranged.speed);
            close(shot.dmg, 8 * (1 + (stage - 1) * 0.16));
            close(spitter.shootT, 2.6 * 1.025);
        }
    }
    assert.equal(JSON.stringify(STAGES), before, 'table filtering and summons cannot rewrite stage data');
}));

test('walking away from three old heals cannot block a guaranteed heal near the player', () => withRandom(0.99, () => {
    reset(1, 20);
    for(let i=0;i<3;i++) dropPickup('meat', -4000-i*20, 0);
    G.supplyDrought={heal:29,low:11,magnet:0};
    kill();
    assert.ok(field('meat').some(it=>it.x===500), 'next real kill must produce reachable healing');
    assert.ok(field('meat').length<=3);
}));

test('full-health overlap preserves meat until it can actually heal', () => {
    reset(1,100);
    dropPickup('meat',0,-14);
    updatePickups(0);
    assert.equal(field('meat').length,1);
    G.player.hp=65;
    updatePickups(0);
    assert.equal(G.player.hp,95);
    assert.equal(field('meat').length,0);
});


test('guaranteed real-kill healing is drawn and collected after movement, including a restored drought', () => withRandom(0.99, () => {
    reset(1,20);
    for(let i=0;i<7;i++)kill();
    const saved=JSON.parse(JSON.stringify(snapshotBuild()));
    resetBuild();restoreBuild(saved);
    G.player.hp=20;G.player.maxHp=100;
    kill();
    const meat=field('meat')[0];assert.ok(meat);
    const calls=[];
    const image={width:30,height:30};fx.meat=image;fx.gems=[image,image,image];
    const ctx=new Proxy({}, {get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
    drawPickups(ctx,-500,-300,500,300);
    assert.ok(calls.some(call=>call[0]==='drawImage'&&call[1]===image));
    assert.ok(calls.some(call=>call[0]==='stroke'), 'healing has a distinct green ring');
    G.player.x=meat.x;G.player.y=meat.y+14;
    updatePickups(0);
    assert.equal(G.player.hp,50);
    assert.equal(field('meat').length,0);
}));

test('old visible heals remain useful while expired offscreen heals release the cap', () => withRandom(0.99, () => {
    reset(1,20);
    const visible=dropPickup('meat',100,0);visible.t=100;
    for(let i=0;i<2;i++){const old=dropPickup('meat',800+i*20,0);old.t=100;}
    G.supplyDrought={heal:29,low:0,magnet:0};kill();
    assert.ok(field('meat').includes(visible));
    assert.equal(field('meat').length,2);
    assert.ok(field('meat').some(it=>it.x===500));
}));

test('damage-over-time kills feed the same healing guarantee', () => withRandom(0.99, () => {
    reset(1,20);G.supplyDrought={heal:29,low:11,magnet:0};
    const enemy=spawnEnemy('shambler',200,0);
    enemy.hp=1;enemy.bleedT=1;enemy.bleed=100;
    updateEnemies(.1);
    assert.equal(enemy.alive,false);assert.equal(field('meat').length,1);
    updateEnemies(.01);assert.equal(field('meat').length,1);
}));

test('full-health real kills cannot create healing even with winning rolls and pending pity',()=>withRandom(.01,()=>{
 reset(1,100);G.supplyDrought={heal:30,low:12,magnet:0};
 for(let i=0;i<40;i++)kill();
 assert.equal(field('meat').length,0);
 G.player.hp=20;kill();assert.equal(field('meat').length,1);
}));

test('actual companion kills use the same low-HP supply guarantee', async () => {
    const {save}=await import('../src/core/save.js');
    const {resetPets,updatePets}=await import('../src/game/pets.js');
    const previous={inventory:save.inventory,equippedPet:save.equippedPet};
    try {
        save.inventory=['pet_yeongnyang'];save.equippedPet='pet_yeongnyang';
        withRandom(.99,()=>{
            reset(1,20);resetPets();G.player.stats.might=1;
            G.supplyDrought={heal:29,low:11,magnet:0};
            const enemy=spawnEnemy('shambler',50,0);enemy.hp=1;
            updatePets(.7);
            assert.equal(enemy.alive,false);assert.equal(field('meat').length,1);
            assert.equal(G.damageBy.pet_yeongnyang>0,true);
        });
    } finally {Object.assign(save,previous);resetPets();}
});

test('abandoned magnet cap releases its exact36-kill guarantee while visible old magnets remain',()=>withRandom(.99,()=>{
 reset(1,80);
 dropPickup('magnet',-4000,0);dropPickup('magnet',-4020,0);
 for(let i=0;i<35;i++)kill();
 assert.equal(field('magnet').length,0);
 kill();assert.equal(field('magnet').length,1);
 const visible=field('magnet')[0];visible.x=100;visible.t=100;
 const old=dropPickup('magnet',800,0);old.t=100;
 G.supplyDrought.magnet=59;kill();
 assert.equal(field('magnet').length,2);assert.ok(field('magnet').includes(visible));
 assert.ok(field('magnet').some(it=>it.x===500));
}));
