# Lotus equipment and fitting room

## Scope

Based on master `01bb4d8fc025186f92f4587c2a1ffd8b62c3e059`. Three permanent appearance-only items use independent outfit/ornament slots, separate from stat accessories. Original wallet, purchases, titles and progression migrate in place. The legendary lotus gun retains its existing stage-3 unlock, 2,400-coin price and combat effect; its shop illustration is replaced with new premium artwork.

- Dusk lotus cape: outfit, stage 1, 360 coins
- Jade lotus guard: outfit, stage 2, 780 coins
- Dawn petal halo: ornament, stage 3, 1,200 coins

Buying also equips. Owned items can be equipped or removed freely. The fitting-room try-on is temporary and does not grant ownership, spend coins or write a save. Changing appearance has no combat bonuses and never heals the player.

## Runtime contract

`src/game/player-appearance.js` is shared by live player rendering and the shop fitting room. The original 384 × 256 firing frame, foot anchor (192,240), scale .24, shot-facing lock, movement bob, muzzle and radius-10 collision remain unchanged. Cape and halo render behind the pig; armor renders over the lower torso, leaving the face, flower, scarf and weapon readable. Equipment is read from the current durable profile when drawn, including after a run is continued. Optional art load failures use compact vector silhouettes without breaking gameplay.

## Verification

Run `node --test tests/*.mjs` for aggregate regression coverage. `node tools/cosmetic-native-qa.mjs` generates actual shared-renderer contact/combat images and checks real purchase/equip/unequip/continue state, unchanged health/stats/hitbox, and changed rendered pixels. `COSMETIC_FAIL=image node tools/cosmetic-native-qa.mjs` exercises optional-art failures.

Native canvas evidence is not a browser or phone screenshot. Local Chromium cannot launch in the current sandbox; mobile layout/touch behavior is not represented as device-tested. Vercel preview and production have separate local-storage origins; existing production saves are not automatically copied to a preview. Production promotion remains with the user.

### Final verified results (2026-10-20)

- Aggregate suite: 463 tests passed, zero failures.
- Actual runtime native-canvas QA: equipped vs unequipped changes 1,624 pixels; HP 37 unchanged; stats unchanged; collision radius 10; saved-run continue passed.
- Optional cosmetic-image failure mode: passed; 1,330 changed pixels via fallback silhouettes.
- Source-module import resolution: 273 imports passed. Service-worker precache: 61 paths exist.
- Lossless RGBA PNG normalization and native decoder validation passed for all seven new/replaced artwork files.
