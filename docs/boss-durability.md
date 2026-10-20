# Boss durability adjustment

## Current beginner and Alpha relocation

The earlier stage-1 1,400-HP claims below are historical and superseded. Stage 1 is now the beginner gate guard at **600 base HP / 4,200 live HP**, with one fixed 1.5-second charge tell and 2.5-second stationary contact-safe recovery, no summons, and no bullets in any phase. The old Alpha definition and art have moved to stage 9 at **13,000 base HP / 291,200 live HP**. The old stage-9 44,800 base value would remain 1,003,520 live HP, not 44,800. The replacement now takes **83.5–93.3 seconds** with automatic targeting, or **69.2–76.9 seconds** with one explicit focus tap, for the actual pre-stage-9 two-final planner build. Its final HP/TTK measurements are documented in [boss-stage-relocation.md](boss-stage-relocation.md). Stages 2–8 and 10 retain their previous definitions and the global HP multipliers are unchanged.

The current legal two-final equipment probe retains **25.5% actual DPS growth** when might increases 1.50→2.15: 10,324.94→12,955.84 DPS. The existing inherited non-Cannon 600 damage cap remains intact; the regression requires >20% measured improvement rather than inflating the cap to preserve an obsolete >30% assumption. The following older DPS/timing tables predate current cannon, thorn and Absolute mechanics and are historical, not final release measurements. See also [absolute-bloom-balance.md](absolute-bloom-balance.md).

## Historical durability pass

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

## Historical reason for the HP pass

The paragraph below records the earlier economy/HP decision. The XP curve was subsequently raised to `8 + 7 × (level−1) + 10 × max(0, level−20) + 16 × max(0, level−40)`; do not use the old 20% easing statement as the current progression contract. Current reachability is audited in [run-progression-audit.md](run-progression-audit.md).

The economy reduces run XP requirements by 20% and makes permanent damage upgrades easier to obtain. Permanent damage adds up to 25 percentage points, the strongest wing adds 15, and the late crown adds 25. Boss rewards also accelerate weapon levels. At fixed maximum whetstone (+50 percentage points), the equipment comparison is might 1.50 → 2.15, or about 43% more uncapped damage. Accessories occupy one slot; their bonuses are not all stacked together in this audit.

Stages 2–10 receive progressively larger relative adjustments. Stage 1 has a separate evidence-driven correction because its earlier reduced HP allowed phase transitions to cancel every charge before death. A strong build still clears faster than a weak one; purchases are not nullified by adaptive scaling.

## Historical actual-code samples, after inherited-core finals

Run `node tools/boss-damage-bench.mjs`. The old stage-5 three-final and stage-10 six-final samples were removed. They assumed implausible investment and their old DPS numbers no longer described the inherited-core combat implementation.

Later fixtures are exact pre-boss snapshots produced by actual choice rolls and boss rewards, with no purchases. See `tests/fixtures/planned-boss-builds.json`; regression tests reproduce their levels, evolutions, six passive slots and stats from the ten-stage planner. Stage 5 uses seed 1; late examples seed 101. Fixtures were refreshed after the subsequent 12% density reduction and new late enemy roles. The XP assumptions are 16-second ordinary / 48-second elite residency and 85% collection, not a measured human clear rate.

| Build | Measured stationary DPS | Current HP / DPS | Live encounter min / median / max |
| --- | ---: | ---: | ---: |
| Stage 1: retained strong three-weapon stress fixture | 179.1 | 7.82 s | See early check below |
| Stage 5: shotgun/thorns evolved 8; gas 8, rifle 8, cannon 5, molotov 1 | 958.6 | 13.30 s | 13.92 / 16.92 / 23.02 s |
| Stage 10: scatter rail 8 + lotus bloom 8 | 6,709.2 | 10.02 s | 11.08 / 12.15 / 15.88 s |
| Stage 10: scatter rail 8 + lotus bloom 5 + plague fire 8 | 11,182.7 | 6.01 s | 10.38 / 11.02 / 14.12 s |
| Stage 10: absolute bloom 8 + scatter rail 8 | 14,706.5 | 4.57 s | 7.22 / 7.77 / 11.18 s |

Stationary samples hold the target still at high test HP for 30 seconds. Live samples use real movement, phase transitions, summons, projectile collisions, hazard ticks, `Boss.hurt` and hitstop: 12 seeds × three distances (100/300/500) per build. All 144 mid/late cases began a real attack pattern before dying. This asserts pattern start, not that every pattern completed.

The player stands still at high test HP. There is no survival validation, ordinary-wave director, pet, purchase bonus, mid-fight XP or new item choice. These are controlled comparisons, not predicted human clear times. The early fixture is deliberately strong and retained for signature regression; it is not claimed to be reachable under the current first-stage XP budget.

The two-final build invests its spare passive slots in whetstone and heart (might 1.5 / HP 200); the three-final build needs all six evolution passives and has might 1.0 / HP 100. Absolute + scatter uses five evolution passives plus whetstone. This is a meaningful build-allocation tradeoff, not a comparison with impossible stacked passive bonuses. Equipment scaling is tested separately by changing only might 1.50 → 2.15 at equal legal weapon/passive levels.

Recommendation from these bounded samples: retain current HP. Do not inflate HP to compensate for the removed six-final fixture. Human survival and mobile encounter pacing remain unmeasured.

## Live early encounter check

The initial 700-HP proposal was rejected after an actual movement/phase/summon test, rather than relying on stationary DPS alone. With the same early three-weapon build and a standing high-HP test player, 700 HP died at 5.70 seconds from distance 100 and 7.32 seconds from distance 300, without any completed charge windup. Phase transitions had interrupted the attempts.

At 1,400 HP, all 36 combinations of 12 fixed seeds and starting distances 100/300/500 released at least one real charge. First charge: 4.17–6.20 seconds; death: 12.32–14.87 seconds. The 1,600 and 1,800 candidates also passed but did not fix another failure, so the lowest verified value was selected. Stage 2 remains 2,240, preserving an increasing HP curve. These are bounded simulation results, not human playtest guarantees. The test includes real boss updates, firing, projectile/orbit hits, phase adds, enemy updates, hazard updates and hitstop; ordinary wave spawning and new level choices are excluded.

## Smaller summon groups

The subsequent fewer/stronger-mob request also scales explicit boss summons to 60% of the already-rounded effective count, rounded again with a minimum of one. This preserves the beginner summon multiplier. Stage 1 ordinary summons: 4 → 2; phase adds: 6/8 → 4/5. Stage 6 ordinary summons: 6 → 4; phase adds: 9/12 → 5/7. All still use `spawnEnemy` and its central cap. The enemy-count/HP pass itself is owned by the ordinary-mob system.

## Tests

`tests/boss-durability.mjs` verifies exact HP values, the unchanged HP ladder outside the encounter-specific stage-9 replacement and later-stage multipliers, unchanged direct damage taken, collision geometry, early timing, ten signatures, reproducible legal-build damage samples, equipment scaling, explicit summon counts, 36 live early encounters and 144 live mid/late encounters. Existing boss-signature, animation, hazard and beginner tests remain applicable. The earlier fixture's HP-only assertions were updated to reflect this explicit later request; damage/speed/scaling protections remain.
