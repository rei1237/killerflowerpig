// Design composition proof only: uses shipped images but does not render HTML/CSS.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const {createCanvas,loadImage,GlobalFonts}=createRequire(import.meta.url)('@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','Korean');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/qa/slayer-branding');fs.mkdirSync(out,{recursive:true});
const hero=await loadImage(path.join(root,'asset/branding/slayer-launch-900.webp'));const icon=await loadImage(path.join(root,'asset/branding/slayer-icon-512.png'));
const c=createCanvas(1440,980),g=c.getContext('2d');g.fillStyle='#090f18';g.fillRect(0,0,c.width,c.height);
const text=(s,x,y,size=18,color='#d7dfdc')=>{g.font=`${size}px Korean`;g.fillStyle=color;g.fillText(s,x,y)};
text('DESIGN COMPOSITION PROOF • SHIPPED ART • NOT A BROWSER SCREENSHOT',38,38,17,'#c4b48c');
g.fillStyle='#101827';g.fillRect(30,64,960,630);text('FLOWERPIG / SLAYER',62,106,14,'#dfc48f');text('LOTUS PROTOCOL',795,106,12,'#a9cbbd');
g.drawImage(hero,62,145,420,420);text('BLOOM IN THE DARK',525,198,13,'#dfc48f');text('꽃돼지 청토끼',525,262,43,'#fff1e6');text('슬레이어!',525,319,43,'#fff1e6');text('꽃돼지의 장비와 감염 구역을',525,374,18);text('불러오고 있어요.',525,403,18);text('OPERATION PREPARATION',525,452,12);text('0%',909,452,22,'#edccdc');g.fillStyle='#33423f';g.fillRect(525,468,422,4);text('준비 항목 확인 중',525,496,12,'#9ab1aa');text('SURVIVAL NOTE / 01',525,546,12,'#dfc48f');text('적에게 둘러싸이지 않도록 움직이세요.',525,574,15);text('작은 영웅, 끝나지 않은 밤.',62,651,13,'#a7b8b6');
g.fillStyle='#101827';g.fillRect(1020,64,390,844);text('FLOWERPIG / SLAYER',1040,102,12,'#dfc48f');g.drawImage(hero,1080,128,270,270);text('BLOOM IN THE DARK',1040,434,11,'#dfc48f');text('꽃돼지 청토끼 슬레이어!',1040,480,29,'#fff1e6');text('꽃돼지의 장비와 감염 구역을',1040,526,15);text('불러오고 있어요.',1040,553,15);text('OPERATION PREPARATION',1040,604,11);text('0%',1350,604,20,'#edccdc');g.fillStyle='#33423f';g.fillRect(1040,624,350,4);text('준비 항목 확인 중',1040,655,12,'#9ab1aa');text('SURVIVAL NOTE / 01',1040,704,11,'#dfc48f');text('적에게 둘러싸이지 않도록 움직이세요.',1040,733,13);text('조준과 사격은 자동입니다.',1040,758,13);
text('APP ICON / 192 · 96 · 48 · 32',42,735,15,'#dfc48f');let x=42;for(const n of [192,96,48,32]){g.drawImage(icon,x,765,n,n);x+=n+35;}
text('Artwork generated from the original flowerpig reference.',650,812,14);text('Brown eyes · pink skin · lotus · purple scarf · curl tail',650,842,13);text('Actual runtime progress is event-driven; 0% shown here.',650,878,13);
fs.writeFileSync(path.join(out,'design-proof.png'),c.toBuffer('image/png'));console.log(path.join(out,'design-proof.png'));
