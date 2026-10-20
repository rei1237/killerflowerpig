# Lotus equipment and fitting room

## Scope

Based on master `01bb4d8fc025186f92f4587c2a1ffd8b62c3e059`. Three permanent items use independent outfit/ornament slots, separate from stat accessories. Original wallet, purchases, titles and progression migrate in place. The legendary lotus gun retains its existing stage-3 unlock, 2,400-coin price and combat effect; its shop illustration is replaced with new premium artwork.

- Dusk lotus cape: outfit, stage 1, 360 coins
- Jade lotus guard: outfit, stage 2, 780 coins
- Dawn petal halo: ornament, stage 3, 1,200 coins

Buying also equips. Owned items can be equipped or removed freely. The fitting-room try-on is temporary and does not grant ownership, spend coins or write a save. Outfits now provide bounded mobility/collection or damage mitigation effects (see Eight-frame outfit effects below); ornaments remain cosmetic. Changing equipment never heals the player.

## Runtime contract

`src/game/player-appearance.js` is shared by live player rendering and the shop fitting room. The original 384 × 256 firing frame, foot anchor (192,240), scale .24, shot-facing lock, movement bob, muzzle and radius-10 collision remain unchanged. Cape and armor each use a complete eight-frame character sheet with the outfit painted around the body and naturally occluded by the arms, scarf and weapon. The head-aligned halo renders behind the pig so the head flower and ears occlude it. Inventory icons are never drawn onto the body. Equipment is read from the current durable profile when drawn, including after a run is continued. Optional outfit/layer load failures retain the base character without breaking gameplay; the fitting-room state explicitly reports when it is showing the fallback.

## Verification

Run `node --test tests/*.mjs` for aggregate regression coverage. `node tools/cosmetic-native-qa.mjs` generates actual shared-renderer contact/combat images and checks real purchase/equip/unequip/continue state, unchanged health/offensive stats/hitbox with bounded outfit effects, and changed rendered pixels. `node tools/costume-native-qa.mjs` exercises all six body/gun variants across eight poses and both facing directions. `COSMETIC_FAIL=image node tools/cosmetic-native-qa.mjs` exercises optional-art failures.

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

## Bounded outfit gameplay effects (2026-10-20)

The requested outfit revision adds modest utility without changing weapon damage, firing cadence, collision radius, max HP, or healing:

- 황혼 연꽃 망토: final movement speed ×1.04, respecting the existing 243 speed ceiling; XP/coin attraction radius ×1.08, respecting the existing 1.25 collection-multiplier ceiling. Its Korean description explicitly discloses the existing caps. Meat, chest, and bomb attraction ranges are unchanged. A capped build can receive less than the headline increase.
- 비취 연꽃 예복: incoming damage ×0.95 after flat armor, retaining the existing minimum damage of 1. Fractional HP is preserved; no rounding-based immunity or bonus armor is introduced. Barrier blocks, invulnerability, god mode, and death behavior retain their existing order.
- 새벽 꽃잎 광환: visual ornament only.

`src/game/cosmetic-effects.js` applies one owned/equipped outfit to freshly rebuilt stats after relics/accessories. Temporary try-on, unowned items, invalid slots, stale purchase intents, and failed storage writes cannot grant a bonus. Successful durable outfit changes refresh a paused or active run immediately; frame-time reconciliation and normal player creation/continue rebuilds also use the equipped save. No derived bonus is persisted, and repeated equips/recalculations cannot stack. Changing outfit never restores HP; stage-start/continue healing remains the existing game rule.

The jade hit accent reads `player.outfitGuardHitAt`, recorded at `G.clock` only for a real HP hit while that outfit is active. It does not add combat particles, damage, or timers; switching outfit clears the old visual timestamp.

Run `node --test tests/cosmetic-effects.mjs` for focused runtime, cap, pickup, damage, durable commit, reload/continue, and no-heal coverage, then `node --test tests/*.mjs` for the aggregate suite.

## Eight-frame firing revision

All six complete body variants now use 3,072 × 256 atlases with eight 384 × 256 cells. Frame 0 is ready; frames 1–7 are the immediate shot, recoil onset, recoil peak, settle, return, cloth follow-through and ready settle. The visual cycle lasts 300 ms (32 / 36 / 42 / 50 / 50 / 50 / 40 ms), independently of weapon cooldown; another actual shot restarts it immediately. The original radius-10 hitbox, foot (192,240), muzzle (312,148), scale .24, and projectile parameters remain intact. The legendary auto-volley now explicitly triggers the same firing pose at its actual emission timestamp.

The halo retains its four-cell source and uses explicit mapping [0,1,2,2,3,3,3,0]. Body/halo crops are cached. A draw uses at most two image draws plus one bounded outfit accent, with no per-frame image cache, particle emitter or simulation writes. Reduced-motion suppresses idle bob and outfit accents while retaining essential shot feedback. The fitting room uses the same motion function and catalog shot cadence, with an isolated clock that freezes while hidden.

`node tools/costume-native-qa.mjs` renders all 48 authored poses and 150 native frames at 50 fps. Normal-gun examples use the starter shotgun's 1.0-second cadence; legendary examples use 0.45 seconds. These are controlled renderer captures, not a recording of an actual phone/browser session.

## Costume purchase investigation and recovery

On 2026-10-20, the public `https://killerflowerpig.vercel.app/` served service-worker `v16-declutter`; its HTML had no `cosmetic-room` or `cosmetic-shop` reference, and `/src/ui/cosmetic-shop.js` returned HTTP 404. A cloud-browser inspection of the actual shop confirmed only the earlier upgrades, relics and stat accessories. That deployment therefore did not include this branch's costume shop. Production promotion is separate from publishing this feature preview.

Actual shop/UI/save tests with 10,000 coins at cleared stages 1, 2 and 3 successfully purchase the eligible cape, jade outfit and halo; legacy saves migrate and purchase correctly. Existing unlock stages and prices are preserved.

A separate real multi-tab defect was reproduced and fixed: when another tab advanced durable progression, a costume purchase could remain stuck in `REVISION_CONFLICT` on every retry. The rejected action now refreshes validated durable wallet/equipment into the current tab without replaying or spending. The player reviews the refreshed state and makes a new deliberate click. Corrupt/unreadable storage is not overwritten. Tests cover debit exactly once, ownership/equipment persistence, and no automatic purchase after conflict.
