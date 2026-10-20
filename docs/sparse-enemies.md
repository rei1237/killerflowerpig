# Sparse, tougher enemies

Baseline: local f9c66526bfd0e95a4f2d376ea0e2bd6c38de0ee8. No publication performed.

## Fixed encounter budgets

Hard caps, old → new, stages 1–10: 26→15, 38→18, 74→22, 88→26, 102→30, 116→33, 130→36, 144→39, 158→42, 172→48. End-of-wave ordinary targets: 19→9, 30→12, 53→16, 66→20, 79→24, 92→27, 106→30, 119→33, 132→36, 148→40. Rings are 4–8; first rush waves 3–5, with a half-sized delayed pincer from stage 2. The shared central cap also bounds elites, forced events, summons and splitter children; corpses conservatively occupy a slot until released.

Enemy HP multiplies previous HP by 1.3, 1.9, 2.5, 2.8, then 3 for stages 5–10. XP per kill multiplies by 2.1, 2.5, then 3. No player-damage/equipment-based scaling. Movement, contact damage, unlock stages and first-stage 70-second event grace remain unchanged. Individual ordinary enemies are tougher through fixed HP rather than untelegraphed new attacks.

## Current five-tech controlled combat

Three seeds, twelve finite moving enemies, equal investment 3/14/31 for base/mid/evolved builds. Both variants use current weapons, including the strengthened legendary when enabled. Two evolved weapons receive equal evolution rewards. No damage-player survival claim is made for invulnerable finite-wave comparisons.

| Tech | Mid without legendary before→after | Mid with legendary before→after |
|---|---:|---:|
|gunline|6.52→10.42s|2.93→4.03s|
|executioner|6.89→10.42s|2.53→3.79s|
|bloom|4.13→6.75s|2.25→3.18s|
|plague|7.81→13.96s|2.84→4.18s|
|butcher|6.90→10.68s|2.68→3.83s|

Full per-seed base/mid/evolved data are in sparse-enemies-before.json and sparse-enemies-after.json. Strong evolved and permanent gear still clears fast, intentionally: increased HP does not erase earned power.

## Opening and progression

A separate actual 70-second first-stage director simulation uses normal difficulty, actual starter loadouts, no permanent equipment, no level-ups, no invulnerability, and scripted circular kiting. All five routes survive; peak 8–9 enemies versus previous 14–16. This is a controlled survival smoke test, not human/mobile playtesting.

Central synthetic 16-second residency: kills are about 30% of the prior count and wave XP retains 93%. On default easy difficulty, forty actual choice/chest planning seeds produce 36 three-final and 4 two-final pre-boss-10 builds. Normal/hard/hell retain their existing higher XP costs and smaller chest rewards; 2–3 finals is not promised on those settings. Slow/fast collection and 24/8-second residency are included in the artifact. Residency models are explicitly not DPS/survival predictions; skilled collection, choices and actual kill speed matter.

## Gold impact, intentionally not compensated

Coin probabilities/values, guaranteed boss bounties and recently increased shop prices remain unchanged. At the same 16-second residency and 85% collection, expected full-run coins fall 2726.49→1218.32 (-55.3%); stage1 35.63→31.80, stage5 238.12→109.34, stage10 595.81→234.65. This makes purchases take longer; gold compensation requires a separate decision. Full stage rows: sparse-enemies-coins.json.

## Reproduce

Run node tools/sparse-enemy-bench.mjs --before and node tools/sparse-enemy-bench.mjs for paired artifacts; the baseline loader reads only the fixed commit’s enemy/stage/director modules. Run node tools/coin-income-audit.mjs for current expected gold and node tools/run-progression-audit.mjs --fixtures for actual build fixtures. Existing non-gun finite-wave tests now use twelve targets fitting sparse caps; moving base saw retains at least a 10% improvement (formerly 20% in dense waves), while mid thorns clears twelve tougher targets in 27.16 seconds. No weapon damage was altered to force old density-specific thresholds.
