// Paired real-hit audit; historical modules are read-only Git snapshots.
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const variant=process.argv.find(a=>a.startsWith('--variant='))?.split('=')[1]||'current';
if(variant!=='current')registerHooks({load(url,context,next){
 if(!url.startsWith('file:'))return next(url,context);
 const p=fileURLToPath(url).slice(root.length);
 if(!p.startsWith('src/')||!p.endsWith('.js'))return next(url,context);
 return {format:'module',source:execFileSync('git',['show',`${variant}:${p}`],{cwd:root,encoding:'utf8'}),shortCircuit:true};
}});
const {G,clearWorld}=await import('../src/game/state.js');
const {createPlayer}=await import('../src/game/player.js');
const {createWeapon,weaponStats,updateWeapons}=await import('../src/game/weapons.js');
const {resetBuild}=await import('../src/game/progression.js');
const {clearFocus,tapFocusAt}=await import('../src/game/targeting.js');
const {save}=await import('../src/core/save.js');
const rows=[];
for(const tech of [null,'gunline','executioner','plague','bloom','butcher'])
 for(const level of [1,4,8])for(const focus of [false,true]){
  resetBuild();clearWorld();clearFocus();
  Object.assign(save,{upgrades:{},equippedPet:null,equippedCosmetics:{},equippedAccessory:null,relics:[]});
  Object.assign(G,{tech,clock:1,stage:1,mode:'play',paused:false,boss:null,damageBy:{},events:{},lowQ:true,caps:{particles:0,texts:0}});
  createPlayer();G.passives={};
  Object.assign(G.player.stats,{might:1,crit:0,amount:0,amountMul:0,area:1,cooldown:1,projSpeed:1,duration:1});
  const w=Object.assign(createWeapon('cannon',0),{level,cd:0});G.weapons=[w];
  const hits=[];G.boss={x:250,y:0,radius:30,alive:true,hp:1e9,hits:{},hurt(n){hits.push(n);this.hp-=n;}};
  if(focus)tapFocusAt(G.boss.x,G.boss.y-G.boss.radius);
  const s=weaponStats(w);updateWeapons(.001);
  if(hits.length!==1||G.beams.count>3)throw Error('invalid volley');
  rows.push({tech:tech||'neutral',level,focus,damage:+hits[0].toFixed(6),amount:s.amount,cd:s.cd,baseStatDamage:s.dmg,shownAuto:s.beamAutoImpact,shownFocus:s.beamFocusedImpact});
 }
console.log(JSON.stringify({variant,method:'One real volley, same Cannon level and global stats, no other inventory, no pets/permanent upgrades. Actual tech affinity and level imprints remain active. Separate automatic/focused runs.',rows},null,2));
