import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS,PASSIVES } from '../src/data/weapons.js';
import { RELICS } from '../src/data/relics.js';
import { SHOP } from '../src/data/shop.js';
import { itemArt } from '../src/ui/item-art.js';
const exists=p=>fs.existsSync(new URL('../'+p,import.meta.url));
test('every equipment and shop entry resolves to a real illustrated asset',()=>{
 for(const id of [...Object.keys(WEAPONS),...Object.keys(PASSIVES),'meat','gold']) assert.ok(exists(itemArt(id)),itemArt(id));
 for(const relic of RELICS)assert.ok(exists(itemArt(relic.id)),relic.id);
 for(const item of SHOP)assert.ok(exists(itemArt(item.id,'shop')),item.id);
});
test('all ten story chapters have distinct optimized scenes',()=>{
 const buffers=[];
 for(let i=1;i<=10;i++){const p=`asset/story/stage-${String(i).padStart(2,'0')}.webp`;assert.ok(exists(p),p);buffers.push(fs.readFileSync(new URL('../'+p,import.meta.url)).toString('base64'));}
 assert.equal(new Set(buffers).size,10);
});
test('all ten bosses have roster-specific art',()=>{
 for(let i=1;i<=10;i++){const p=`asset/bosses/boss-${String(i).padStart(2,'0')}.webp`;assert.ok(exists(p),p);}
});
