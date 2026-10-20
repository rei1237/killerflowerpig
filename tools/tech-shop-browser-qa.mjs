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
 for(const viewport of [{width:1100,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ready,{timeout:60000});
  await page.evaluate(async()=>{const ui=await import('/src/ui/screens.js');window.ui=ui;ui.initUI();r.saving.save.gold=10000;r.saving.save.maxClearedStage=10;r.saving.save.inventory=['pet_yeongnyang'];r.saving.persist();localStorage.setItem('kfp.tech.v1','butcher');ui.showTitle();});
  await page.locator('#btn-shop').click();await page.locator('[data-cosmetic-focus="buy-jade_lotus_guard"]').click();
  await page.locator('[data-pet-training="attack"] button').click();
  await page.locator('#cosmetic-preview-walk').click();
  await page.waitForFunction(()=>document.querySelector('#cosmetic-preview-walk').getAttribute('aria-pressed')==='true');
  const result=await page.evaluate(()=>({gold:r.saving.save.gold,look:r.saving.save.equippedCosmetics,training:r.saving.save.petUpgrades,family:document.querySelector('#cosmetic-preview-family').value,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.equal(result.family,'sword');assert.equal(result.look.outfit,'jade_lotus_guard');assert.equal(result.gold,9190);assert.equal(result.overflow,false);
  await page.screenshot({path:`/workspace/shared/flowerpig-shop-${viewport.width}.png`});
  await page.reload();await page.waitForFunction(()=>window.ready,{timeout:60000});
  const persisted=await page.evaluate(()=>({gold:r.saving.save.gold,look:r.saving.save.equippedCosmetics,training:r.saving.save.petUpgrades}));
  assert.equal(persisted.gold,9190);assert.equal(persisted.look.outfit,'jade_lotus_guard');assert.deepEqual(persisted.training,result.training);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewport,result,persisted,errors}));await context.close();
 }
}finally{await browser.close();server.close();}
