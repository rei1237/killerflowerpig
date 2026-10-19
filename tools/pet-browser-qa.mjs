import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'..');
const script=`<script type="module">
import * as assets from '/src/core/assets.js';import * as game from '/src/game/game.js';import * as pets from '/src/game/pets.js';import * as sprite from '/src/game/pet-sprite.js';import * as saving from '/src/core/save.js';import * as rendering from '/src/game/render.js';import {G} from '/src/game/state.js';import {spawnEnemy} from '/src/game/enemies.js';
window.r={assets,game,pets,sprite,saving,rendering,G,spawnEnemy};await assets.loadAssets();rendering.initRender(document.querySelector('canvas'));window.ready=true;
</script>`;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')+script;
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}const file=path.join(root,pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.webp')?'image/webp':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ready,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const {saving,game,pets,sprite,rendering,G,spawnEnemy}=r;
  saving.save.gold=1000;saving.save.maxClearedStage=2;saving.persist();
  if(!saving.buyUpgrade('pet_yeongnyang',0,'browser-pet'))throw Error('BUY_FAILED');
  if(!saving.equipPet('pet_yeongnyang'))throw Error('EQUIP_FAILED');
  game.newRun(1);game.step(.016);await sprite.loadPetSprite();
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),calls=[];const original=ctx.drawImage;
  ctx.drawImage=function(image,...args){if(image===sprite.getPetSprite()?.image)calls.push(args);return original.call(this,image,...args)};
  for(const el of document.querySelectorAll('.screen,.overlay,#loader'))el.style.display='none';
  rendering.render(.016);const first=calls.length;
  const before=ctx.getImageData(0,0,canvas.width,canvas.height).data.slice();
  saving.equipPet(null);pets.updatePets(0);rendering.render(.016);
  const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;let changed=0;for(let i=0;i<before.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++;
  saving.equipPet('pet_yeongnyang');game.continueRun(game.loadRun());game.step(.016);rendering.render(.016);const continued=calls.length>first;
  G.player.hp=50;const enemy=spawnEnemy('shambler',G.player.x-35,G.player.y,{force:true});enemy.hp=1000;const priorHP=enemy.hp;pets.updatePets(.7);const damage=priorHP-enemy.hp;
  G.enemies.clear();pets.updatePets(6);const heal=G.player.hp-50;rendering.render(.016);
  return {first,continued,changed,damage,heal,atlas:!!sprite.getPetSprite(),owned:saving.save.inventory,equipped:saving.save.equippedPet,calls};
 });
 assert.ok(result.first>0);assert.ok(result.changed>30);assert.ok(result.continued);assert.ok(result.damage>0);assert.equal(result.heal,3);assert.equal(result.atlas,true);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/workspace/shared/pet-full-frame-qa.png'});
 console.log(JSON.stringify({status:'PASS',...result,errors},null,2));
}finally{await browser.close();server.close();}
