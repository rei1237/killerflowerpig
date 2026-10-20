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
try {
 for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:844,height:390}]) {
  const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(()=>window.ready,{timeout:60000});
  await page.addStyleTag({url:'/src/ui/mobile.css'});
  await page.evaluate(async()=>{const ui=await import('/src/ui/screens.js');window.ui=ui;ui.initUI();r.saving.save.gold=10000;r.saving.save.maxClearedStage=10;ui.showTitle();});
  const checks=[];
  async function inspect(name,selector) {
   const result=await page.locator(selector).evaluate(el=>{const rect=el.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,client:el.clientWidth,scroll:el.scrollWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,viewport:[innerWidth,innerHeight]};});
   checks.push({name,...result});
   assert.ok(result.x>=-1 && result.x+result.width<=viewport.width+1,`${name} horizontal bounds ${JSON.stringify(result)}`);
   assert.ok(result.y>=-1 && result.y+result.height<=viewport.height+1,`${name} vertical bounds ${JSON.stringify(result)}`);
   assert.ok(result.scroll<=result.client+1,`${name} internal horizontal overflow ${JSON.stringify(result)}`);
  }
  await page.locator('#btn-shop').click();await inspect('shop','#shop .shop-box');
  await page.screenshot({path:`/workspace/shared/mobile-shop-${viewport.width}.png`});
  await page.evaluate(()=>ui.closeModal('shop'));
  await page.evaluate(()=>ui.openModal('settings'));await inspect('settings','#settings .modal-box');
  await page.evaluate(()=>{const buttons=[...document.querySelectorAll('#settings button')].filter(e=>e.getClientRects().length&&!e.disabled);buttons.at(-1).focus();});
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement.closest('#settings')!==null));
  await page.evaluate(()=>ui.closeModal('settings'));
  await page.evaluate(async()=>{const tech=await import('/src/ui/tech-select.js');tech.openTechSelect(()=>{});});
  await inspect('tech selection','#tech-select .modal-box');
  await page.evaluate(()=>ui.closeModal('tech-select'));
  await page.evaluate(async()=>{window.bestiary=await import('/src/ui/bestiary.js');bestiary.openBestiary();});
  await inspect('bestiary','.bestiary-panel');
  await page.evaluate(()=>bestiary.closeBestiary());
  await page.evaluate(()=>{r.game.newRun(1,'bloom','normal');ui.showLevelUp();});await inspect('levelup','#levelup .modal-box');
  const recipe=page.locator('#levelup summary').first();if(await recipe.count())await recipe.click();
  await inspect('levelup expanded','#levelup .modal-box');await page.screenshot({path:`/workspace/shared/mobile-choice-${viewport.width}.png`});
  await page.evaluate(()=>ui.closeModal('levelup'));
  await page.evaluate(async()=>{window.exchange=await import('/src/ui/loadout-exchange.js');exchange.openLoadoutExchange();});
  await inspect('loadout exchange','.loadout-exchange-panel');
  await page.evaluate(()=>exchange.closeLoadoutExchange());
  await page.evaluate(()=>ui.showFusion());await inspect('fusion','#fusion .modal-box');
  await page.evaluate(()=>ui.closeModal('fusion'));
  // Simulate nonzero safe-area env values through shared production variables.
  await page.addStyleTag({content:':root{--ui-top:44px;--ui-bottom:34px;--ui-left:44px;--ui-right:44px}'});
  await page.evaluate(()=>ui.openModal('shop'));await inspect('shop simulated notch','#shop .shop-box');
  await page.evaluate(()=>ui.closeModal('shop'));
  assert.deepEqual(errors,[]); console.log(JSON.stringify({viewport,checks,errors}));await context.close();
 }
} finally {await browser.close();server.close();}
