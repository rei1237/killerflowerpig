# Boss durability adjustment

The user reported weak bosses in the existing release. The ten new signatures have not yet been human-playtested in production; this adjustment does not treat that feedback as a test of the new patterns.

## HP before → after

| Stage | Previous | Revised | Increase |
| --- | ---: | ---: | ---: |
| 1 | 520 | 1,400 | 169.2% |
| 2 | 1,600 | 2,240 | 40% |
| 3 | 3,400 | 4,930 | 45% |
| 4 | 5,600 | 8,120 | 45% |
| 5 | 8,500 | 12,750 | 50% |
| 6 | 12,000 | 18,000 | 50% |
| 7 | 16,000 | 24,800 | 55% |
| 8 | 21,000 | 32,550 | 55% |
| 9 | 28,000 | 44,800 | 60% |
| 10 | 42,000 | 67,200 | 60% |

Only visible HP increases. No hidden resistance, damage cap, damage increase, shorter warning, faster movement, extra projectile or reduced recovery is introduced. Stage 1 retains its 3-second opening, 1.15-second base charge tell, 480-unit charge speed, and 1.5 recovery multiplier. The signature-specific warning/recovery floors and contact radii stay intact.

## Why this range

The economy reduces run XP requirements by 20% and makes permanent damage upgrades easier to obtain. Permanent damage adds up to 25 percentage points, the strongest wing adds 15, and the late crown adds 25. Boss rewards also accelerate weapon levels. At fixed maximum whetstone (+50 percentage points), the equipment comparison is might 1.50 → 2.15, or about 43% more uncapped damage. Accessories occupy one slot; their bonuses are not all stacked together in this audit.

Stages 2–10 receive progressively larger relative adjustments. Stage 1 has a separate evidence-driven correction because its earlier reduced HP allowed phase transitions to cancel every charge before death. A strong build still clears faster than a weak one; purchases are not nullified by adaptive scaling.

## Actual-code stationary samples

Run `node tools/boss-damage-bench.mjs`. It uses a fixed seed, actual weapon firing/collision, beam/orbit damage, hazard ticks, and `Boss.hurt`, with real sprite collision radii. The boss is held still with high test HP for 30 seconds so phase invulnerability and movement do not contaminate the damage sample. Pets and critical bonuses are excluded.

| Selected build | Measured DPS | Old HP / DPS | New HP / DPS |
| --- | ---: | ---: | ---: |
| Stage 1: shotgun 5, pistols 3, thorns 2; modest passives | 179.1 | 2.90 s | 7.82 s |
| Stage 5: scatter rail 5, lotus bloom 3, plague fire 3, pistols 6 | 808.5 | 10.51 s | 15.77 s |
| Stage 10: six level-8 fusions, maximum relevant passives, permanent damage/wing/crown | 2,735.5 | 15.35 s | 24.57 s |

These divisions are controlled damage-throughput references, not predicted human clear times. Dodging, range, aim, actual phase transitions and different builds change encounter length. A strong build still defeats a boss quickly; no minimum-life immunity gate is added.

## Live early encounter check

The initial 700-HP proposal was rejected after an actual movement/phase/summon test, rather than relying on stationary DPS alone. With the same early three-weapon build and a standing high-HP test player, 700 HP died at 5.70 seconds from distance 100 and 7.32 seconds from distance 300, without any completed charge windup. Phase transitions had interrupted the attempts.

At 1,400 HP, all 36 combinations of 12 fixed seeds and starting distances 100/300/500 released at least one real charge. First charge: 4.17–6.20 seconds; death: 12.32–14.87 seconds. The 1,600 and 1,800 candidates also passed but did not fix another failure, so the lowest verified value was selected. Stage 2 remains 2,240, preserving an increasing HP curve. These are bounded simulation results, not human playtest guarantees. The test includes real boss updates, firing, projectile/orbit hits, phase adds, enemy updates, hazard updates and hitstop; ordinary wave spawning and new level choices are excluded.

## Smaller summon groups

The subsequent fewer/stronger-mob request also scales explicit boss summons to 60% of the already-rounded effective count, rounded again with a minimum of one. This preserves the beginner summon multiplier. Stage 1 ordinary summons: 4 → 2; phase adds: 6/8 → 4/5. Stage 6 ordinary summons: 6 → 4; phase adds: 9/12 → 5/7. All still use `spawnEnemy` and its central cap. The enemy-count/HP pass itself is owned by the ordinary-mob system.

## Tests

`tests/boss-durability.mjs` verifies exact HP values, stage-monotonic HP and later-stage multipliers, unchanged direct damage taken, collision geometry, early timing, ten signatures, actual-code damage samples, equipment scaling, explicit summon counts and 36 live early encounters. Existing boss-signature, animation, hazard and beginner tests remain applicable. The earlier fixture's HP-only assertions were updated to reflect this explicit later request; damage/speed/scaling protections remain.
