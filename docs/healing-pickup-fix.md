# Healing pickup diagnosis and fix

Current modular engine and commit 7a41 counted every meat pickup globally against a cap of three. Pickups had no expiry or abandoned-distance cleanup. Walking away from three heals blocked future random AND guaranteed healing indefinitely. Additionally, touching meat at full HP consumed it for zero healing. Both faults were reproduced with real kills/updatePickups tests before fixing.

`origin/master` is the earlier single-file game.js engine with REPAIR/HEAL gates; its architecture does not have this modular supply guarantee. This is not a missing loot hook: direct, pet and bleed deaths all use killEnemy; ordinary kills roll supplies and elites produce chests separately.

## Final HP-dependent policy
- Full HP, dead or invalid HP: no newly generated healing; full-health kills do not advance healing drought.
- Injured and above 40% HP: 6.5774% each ordinary kill; guarantee at 18 injured kills without a heal drop.
- At/below 40% HP: 16.1047% each ordinary kill; guarantee at 8 consecutive low-HP kills.
- Existing capped pity remains pending. Returning to full HP resets only consecutive low-HP drought.
- Meat heals 30 HP and cannot be consumed or pulled while full/dead.
- At most three field heals. Before rolling and each pickup update, abandoned meat/magnets beyond max(900, viewport width + height) is removed. Offscreen meat/magnets older than 90 simulation seconds is also removed (offscreen = beyond either half-view axis +48px). Magnet cap remains two and its compensated 36-kill guarantee applies. Nearby visible reserves are preserved regardless of age. Coins/chests/inventory are unaffected.
- Meat retains its actual medical illustration and gains a pale green ring/plus for visibility. Missing image does not crash pickup rendering.

## Regression evidence
`tests/supply-runtime.mjs`: real kill and exact low-HP thresholds; abandoned cap release; full-HP preservation then actual healing; restored JSON build drought; rendered medical image/marker; movement and actual +30 HP; old visible reserves; bleed deaths; actual companion deaths; full-health winning RNG suppression. `tests/supply-drops.mjs` tests probability boundaries across HP bands.

This is local deterministic Node runtime/canvas-call testing, not a claim of browser visual QA or deployed production verification. No drop-price/coin/shop changes.

Population compensation details and old-opportunity counter compatibility: see economy-balance.md.
