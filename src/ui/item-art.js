// Catalog-aligned illustrations. Generated PNGs cover signature items; authored SVGs
// cover weapon hardware so no browser-dependent emoji is used for inventory art.
const ROOT = 'asset/items/';
const weapons = {
    burst_rail:'fusion-burst.svg',venom_saw:'fusion-venom.svg',ember_lance:'fusion-ember.svg',orbit_saw:'fusion-orbit.svg',toxic_scatter:'fusion-toxic.svg',
    lotus_bloom:'cannon.svg',scatter_rail:'shotgun.svg',plague_fire:'molotov.svg',petalCannon:'cannon.svg',shotgun:'shotgun.svg', pistols:'pistols.svg', rifle:'rifle.svg',
    thorns:'thorns.svg', molotov:'molotov.svg', cannon:'cannon.svg', gas:'gas.svg', saw:'saw.svg',
};
const passives = {
    premium_upgrade:'violet-orb.png',
    meat:'medical-kit.png',gold:'coin-stack.svg',magazine:'ammo-magazine.png',focus:'scope.svg',sap:'vial.svg',scope:'scope.svg',
    spread:'shotgun.svg',pollen:'vial.svg',whet:'blade.svg',heart:'medical-kit.png',
    regen:'medical-kit.png',nose:'field-magnet.png',madness:'boots.svg',hide:'rusted-armor-plate.png',
};
const shop = {
    wind_feather:'wing-common.png',moon_wings:'wing-rare.png',star_wings:'wing-epic.png',maxHp:'celestial-cloak.png',might:'violet-orb.png',speed:'paw-charm.png',magnet:'celestial-hat.png',
    reroll:'star-charm.png',greed:'fish-snack.png',pet_yeongnyang:'pet-yeongnyang.png',
};
export function itemArt(id, kind) {
    const file = kind === 'shop' ? shop[id] : weapons[id] || passives[id] || shop[id];
    return file ? ROOT + file : ROOT + 'salvage-cache.png';
}
export function mountItemArt(container, id, kind, label = '') {
    const img = document.createElement('img');
    img.src = itemArt(id, kind);
    img.alt = label;
    img.className = 'inventory-art';
    img.loading = 'lazy';
    container.replaceChildren(img);
    return img;
}
