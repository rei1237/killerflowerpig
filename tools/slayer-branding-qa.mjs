// Actual local Chromium captures. Boot module is held for initial loading screenshots;
// progress remains truthfully at 0. The final case runs the real complete loader.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/qa/slayer-branding');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];
try{
for(const [label,width,height] of [['desktop',1280,800],['mobile',390,844],['small-mobile',320,568],['landscape',844,390]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await page.route('**/src/main.js',r=>r.fulfill({contentType:'text/javascript',body:''}));await page.goto(url);await page.locator('#loading-art').evaluate(n=>n.decode());
 const metrics=await page.evaluate(()=>{const s=document.querySelector('#loading'),a=document.querySelector('#loading-art'),t=document.querySelector('#loading-title');return {overflow:document.documentElement.scrollWidth>innerWidth,title:t.textContent,progress:document.querySelector('#loading-progress').getAttribute('aria-valuenow'),fit:getComputedStyle(a).objectFit,artWidth:a.getBoundingClientRect().width,screenWidth:s.clientWidth,artLoaded:a.naturalWidth};});
 assert.equal(metrics.overflow,false);assert.equal(metrics.title,'꽃돼지 청토끼 슬레이어!');assert.equal(metrics.progress,'0');assert.equal(metrics.fit,'contain');assert.ok(metrics.artLoaded);await page.screenshot({path:path.join(out,`${label}-loading.png`),fullPage:true});results.push({label,...metrics});await page.close();
}
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForSelector('#title:not([hidden])',{timeout:45000});assert.equal(await page.title(),'꽃돼지 청토끼 슬레이어!');assert.equal(await page.locator('#loading').isVisible(),false);await page.screenshot({path:path.join(out,'mobile-title.png'),fullPage:true});assert.deepEqual(errors,[]);results.push({realBoot:'PASS',errors});await page.close();
const fallback=await browser.newPage({viewport:{width:320,height:568}});await fallback.route('**/src/main.js',r=>r.fulfill({contentType:'text/javascript',body:"import {createLoadingScreen} from './ui/loading.js'; createLoadingScreen();"}));await fallback.route('**/asset/branding/slayer-launch*',r=>r.abort());await fallback.goto(url);await fallback.waitForSelector('#loading-art-fallback:not([hidden])');assert.equal(await fallback.locator('#loading-art').isVisible(),false);await fallback.screenshot({path:path.join(out,'mobile-fallback.png'),fullPage:true});results.push({artFailureFallback:'PASS'});
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
