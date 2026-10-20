# Lotus equipment and fitting room

## Scope

Based on master `01bb4d8fc025186f92f4587c2a1ffd8b62c3e059`. Three permanent appearance-only items use independent outfit/ornament slots, separate from stat accessories. Original wallet, purchases, titles and progression migrate in place. The legendary lotus gun retains its existing stage-3 unlock, 2,400-coin price and combat effect; its shop illustration is replaced with new premium artwork.

- Dusk lotus cape: outfit, stage 1, 360 coins
- Jade lotus guard: outfit, stage 2, 780 coins
- Dawn petal halo: ornament, stage 3, 1,200 coins

Buying also equips. Owned items can be equipped or removed freely. The fitting-room try-on is temporary and does not grant ownership, spend coins or write a save. Changing appearance has no combat bonuses and never heals the player.

## Runtime contract

`src/game/player-appearance.js` is shared by live player rendering and the shop fitting room. The original 384 × 256 firing frame, foot anchor (192,240), scale .24, shot-facing lock, movement bob, muzzle and radius-10 collision remain unchanged. Cape and armor each use a complete four-frame character sheet with the outfit painted around the body and naturally occluded by the arms, scarf and weapon. The head-aligned halo renders behind the pig so the head flower and ears occlude it. Inventory icons are never drawn onto the body. Equipment is read from the current durable profile when drawn, including after a run is continued. Optional outfit/layer load failures retain the base character without breaking gameplay; the fitting-room state explicitly reports when it is showing the fallback.

## Verification

Run `node --test tests/*.mjs` for aggregate regression coverage. `node tools/cosmetic-native-qa.mjs` generates actual shared-renderer contact/combat images and checks real purchase/equip/unequip/continue state, unchanged health/stats/hitbox, and changed rendered pixels. `node tools/costume-native-qa.mjs` exercises all six body/gun variants across four poses and both facing directions. `COSMETIC_FAIL=image node tools/cosmetic-native-qa.mjs` exercises optional-art failures.

Native canvas evidence is not a browser or phone screenshot. Local Chromium cannot launch in the current sandbox; mobile layout/touch behavior is not represented as device-tested. Vercel preview and production have separate local-storage origins; existing production saves are not automatically copied to a preview. Production promotion remains with the user.

### First snapshot verified results (2026-10-20)

- First published snapshot aggregate suite: 463 tests passed, zero failures. The later fitted-costume verification is reported below.
- Actual runtime native-canvas QA: equipped vs unequipped changes 1,624 pixels; HP 37 unchanged; stats unchanged; collision radius 10; saved-run continue passed.
- Optional cosmetic-image failure mode: passed; 1,330 changed pixels via fallback silhouettes.
- Source-module import resolution: 273 imports passed. Service-worker precache: 61 paths exist.
- Lossless RGBA PNG normalization and native decoder validation passed for all seven new/replaced artwork files.

## Legendary-gun character follow-up

A complete four-frame pink flowerpig carrying the new jade/gold/pink lotus gun is selected automatically when `lotus_gun` is owned. This replaces the complete base character draw, so the ordinary rifle is not drawn underneath a second gun. The regular character remains available for unowned profiles and optional-atlas load/shape failures. Both character sheets use the same 384 × 256 frame contract, foot anchor, firing timer and muzzle code, and both compose with the new cape, armor and halo. Preview and combat continue to share one renderer. The original 2,400-coin purchase, damage and cooldown remain unchanged.


## Fitted costume redraw

After visual feedback, the first flat cape/armor composition was replaced rather than patched with another badge. The final renderer chooses one complete character body from six variants: base / fitted cape / fitted jade vest, each with the ordinary or legendary gun. Each sheet includes ready, fire, recoil and recover. A separate head-aligned halo layer shares the same frame timing and mirror transform. Thus the outfit cannot paint over the pig's gripping hands or weapon. Shop inventory art remains separate. Existing owners automatically use the new art without paying again; no inventory IDs, prices or effects change.

### Final fitted-costume verification (2026-10-20)

- 466 aggregate tests passed; zero failures.
- Six complete body variants × four firing poses, plus all four halo frames, decode and render through the real shared renderer; every runtime sheet is 1536 × 256.
- Current-run cosmetic equip/unequip: 3,756 changed native-render pixels; HP 37, stats and radius 10 unchanged; reload/continue passed.
- Legendary ownership selects the complete legendary body/weapon sheet (five observed actual draws across firing/continue checks), without double drawing the ordinary rifle.
- Missing wearing sheets use the base character and an explicit shop warning; deliberate cosmetic failure changed zero appearance pixels, and missing legendary sheets drew zero legendary frames while remaining playable.
- Fitted art keeps the exact foot anchor. Artist-measured ready muzzle positions vary by less than two rendered pixels; gameplay emission coordinates remain unchanged.
- Native comparison images are controlled game renders, not browser or phone captures. Browser deployment page requires Vercel login; exact-commit status is checked separately.
