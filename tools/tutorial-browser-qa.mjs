import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const harness = `<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/tutorial.css"><body style="margin:0;background:#081125;font-family:Arial,sans-serif"><button id="launch">게임 안내</button><div id="already-inert" inert></div><script type="module">import * as guide from '/src/ui/tutorial.js'; window.guide=guide; window.events=[]; guide.initTutorial({onOpen:()=>events.push('open'),onClose:()=>events.push('close')}); document.querySelector('#launch').onclick=()=>guide.openTutorial({onDone:()=>events.push('done')});</script></body></html>`;
const server = http.createServer((req,res)=>{
 if(req.url === '/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harness);return;}
 const file=path.join(root,new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/webp');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1100,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);await page.waitForFunction(()=>window.guide);
try {
 await test('first run, duplicate initialization/open, navigation, keyboard and focus',async()=>{
  assert.equal(await page.evaluate(()=>guide.shouldOfferTutorial()),true);
  await page.click('#launch');
  assert.deepEqual(await page.evaluate(()=>{guide.initTutorial({onOpen:()=>events.push('open'),onClose:()=>events.push('close')});return [guide.openTutorial(),document.querySelectorAll('#tutorial').length,events]}),[false,1,['open']]);
  assert.equal(await page.locator('[data-action=back]').isDisabled(),true);
  assert.equal(await page.locator('#launch').evaluate(n=>n.inert),true);
  await page.keyboard.press('ArrowRight');assert.match(await page.locator('.tutorial-count').textContent(),/^2/);
  await page.click('[data-action=back]');assert.match(await page.locator('.tutorial-count').textContent(),/^1/);
  await page.locator('[data-action=next]').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'skip');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'next');
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>events),['open','close','done']);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'launch');
  assert.equal(await page.locator('#launch').evaluate(n=>n.inert),false);
  assert.equal(await page.locator('#already-inert').evaluate(n=>n.inert),true);
  assert.equal(await page.evaluate(()=>guide.closeTutorial()),false);
 });
 await test('completion persists, reopening is permitted and starts at step one',async()=>{
  await page.reload();await page.waitForFunction(()=>window.guide);
  assert.equal(await page.evaluate(()=>guide.shouldOfferTutorial()),false);
  await page.click('#launch');assert.match(await page.locator('.tutorial-count').textContent(),/^1/);
  for(let i=0;i<4;i++)await page.click('[data-action=next]');
  assert.equal(await page.locator('[data-action=next]').textContent(),'준비 완료');
  await page.click('[data-action=next]');assert.equal(await page.evaluate(()=>guide.isTutorialOpen()),false);
 });
 await test('storage read/write failures never block opening, skipping, or session dismissal',async()=>{
  await page.reload();await page.waitForFunction(()=>window.guide);
  await page.evaluate(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('quota')};});
  assert.equal(await page.evaluate(()=>guide.shouldOfferTutorial()),true);
  await page.click('#launch');await page.click('[data-action=skip]');
  assert.equal(await page.evaluate(()=>guide.shouldOfferTutorial()),false);
  await page.click('#launch');assert.equal(await page.evaluate(()=>guide.isTutorialOpen()),true);
 });
 await test('desktop/mobile/short landscape fit, art loads, screenshots',async()=>{
  fs.mkdirSync(path.join(root,'scratch/tutorial-qa'),{recursive:true});
  for(const [label,width,height] of [['desktop',1100,800],['mobile',390,844],['small-mobile',320,568],['landscape',740,360]]){
   await page.setViewportSize({width,height});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);
   assert.equal(await page.locator('.tutorial-art').evaluate(n=>n.complete&&n.naturalWidth>0),true,label);
   await page.screenshot({path:path.join(root,`scratch/tutorial-qa/${label}.png`)});
   await page.locator('[data-action=next]').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('[data-action=next]').isVisible(),true,label);
  }
  assert.deepEqual(errors,[]);
 });
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
