import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP, CATALOG_VERSION } from '../src/data/shop.js';
import { PET_UPGRADES } from '../src/data/pet-upgrades.js';
import { RELICS, RELIC_CHEST } from '../src/data/relics.js';
import { ACCESSORIES } from '../src/data/accessories.js';
import { COSMETICS } from '../src/data/cosmetics.js';
import { defaultProgress, validateProgress, purchase, purchaseRelic, openRelicChest } from '../src/core/progression-store.js';
import { purchasePetUpgrade } from '../src/core/pet-upgrades.js';
import { purchaseAccessory } from '../src/core/accessories.js';
import { purchaseCosmetic } from '../src/core/cosmetics.js';
const state = gold => ({ ...defaultProgress(), gold, maxClearedStage: 10 });
function boundary(s, cost, buy) {
    const poor = { ...s, gold: cost - 1 }, before = structuredClone(poor);
    assert.equal(buy(poor).code, 'INSUFFICIENT_FUNDS');
    assert.deepEqual(poor, before);
    const exact = { ...s, gold: cost }, result = buy(exact);
    assert.equal(result.ok, true);
    assert.equal(result.state.gold, 0);
    assert.equal(exact.gold, cost, 'transaction does not mutate caller');
    assert.equal(buy(result.state).duplicate, true);
    assert.equal(buy(result.state).state.gold, 0, 'same purchase cannot charge again');
}
test('every permanent upgrade tier and pet enforces the displayed catalog price', () => {
    assert.equal(CATALOG_VERSION, 6);
    assert.deepEqual(SHOP.map(i => i.cost), [[100,240,480,800,1300],[180,400,700,1100,1700],[120,280,520],[80,200,400],[400,1000],[280,640,1280],[9000],[600]]);
    for (const item of SHOP) for (const [level, cost] of item.cost.entries()) {
        boundary({ ...state(cost), upgrades: { [item.id]: level } }, cost,
            s => purchase(s, { itemId: item.id, expectedLevel: level, requestId: `price:${item.id}:${level}` }));
    }
});
test('every training tier enforces exact funds with canonical replay protection', () => {
    assert.deepEqual(PET_UPGRADES.map(t => t.cost), [[180,300,480,720,1080],[320,640,1120],[150,300,540]]);
    for (const track of PET_UPGRADES) for (const [level, cost] of track.cost.entries()) {
        boundary({ ...state(cost), inventory: ['pet_yeongnyang'], petUpgrades: { attack: 0, heal: 0, support: 0, [track.id]: level } }, cost,
            s => purchasePetUpgrade(s, { trackId: track.id, expectedLevel: level, expectedRevision: 0, requestId: `pet-training:${track.id}:${level}` }));
    }
});
test('all direct relic, accessory and cosmetic purchases use the same affordability/debit boundary', () => {
    for (const [catalog, transact] of [[RELICS,purchaseRelic],[ACCESSORIES,purchaseAccessory],[COSMETICS,purchaseCosmetic]]) {
        for (const item of catalog) boundary(state(item.price), item.price,
            s => transact(s, { itemId: item.id, expectedRevision: 0, requestId: `price:${item.id}` }));
    }
});
test('chest price rises without changing odds, pity or duplicate refund rewards', () => {
    assert.equal(RELIC_CHEST.cost,160);
    assert.deepEqual(RELIC_CHEST.rates,[.6,.3,.1]);assert.equal(RELIC_CHEST.pityAt,10);
    assert.deepEqual(RELICS.map(r=>r.duplicateCoins),[3,7,14]);
    boundary(state(160),160,s=>openRelicChest(s,{expectedCount:0,requestId:'price:chest'},()=>0));
});
test('catalog migration preserves existing balances, all purchased tiers and equipped collections', () => {
    const old = { ...state(377), catalogVersion: 5,
        upgrades: Object.fromEntries(SHOP.filter(i=>i.kind!=='pet').map(i=>[i.id,i.max])),
        inventory:['pet_yeongnyang'],equippedPet:'pet_yeongnyang',petUpgrades:{attack:5,heal:3,support:3},
        relics:RELICS.map(i=>i.id), accessoryInventory:ACCESSORIES.map(i=>i.id),equippedAccessory:ACCESSORIES[0].id,
        cosmeticInventory:COSMETICS.map(i=>i.id),equippedCosmetics:{outfit:COSMETICS[0].id,ornament:COSMETICS[2].id} };
    const migrated=validateProgress(JSON.parse(JSON.stringify(old)));
    assert.equal(migrated.catalogVersion,6);
    const {catalogVersion: oldVersion,...before}=old,{catalogVersion:newVersion,...after}=migrated;
    assert.deepEqual(after,before,'no refund, retroactive debit, ownership reset, or equip reset');
});
