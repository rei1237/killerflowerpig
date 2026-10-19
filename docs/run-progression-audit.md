# Ten-stage progression and boss-fixture audit

## Result

Refreshed after the additional 12% population reduction, ordinary-HP 1.62 multiplier, new stage 5 suiciders/stage 6 gunners and late encirclement event. These results supersede the earlier higher-density tables.

A focused player can reach three chosen finals, or one absolute plus one final, before boss 10 under all three tested XP scenarios. No engine, XP, drop-rate, choice-weight or boss-HP changes were made in this audit. This demonstrates reachability under stated budgets, not a guaranteed win or a hard three-final maximum. The focused policy deliberately stops acquiring new recipe families after its chosen goal; fast scattered runs sometimes reached four finals.

## Reproducible method

Run `node tools/run-progression-audit.mjs 200 --sensitivity --compact` for the complete recorded result; `--fixtures` emits the exact boss fixture JSON. `docs/run-progression-audit-results.json` records the 200-seed distributions and sensitivity checks. `tests/run-progression-audit.mjs` verifies replayed snapshots, exact item-investment conservation, chest-before-fusion requirements, one-exchange use, and six weapon / six passive slot limits.

The tool calls real `updateSpawner`, `spawnEnemy`, `hitEnemy`, XP drops, `addXP`, `rollChoices`, choice sessions/rerolls, `applyChoice`, `rollBossChest`, exchange previews/commit and fusion previews/commit. It does not replace candidate weights with a simplified distribution. Each run starts with the real level-1 shotgun and no purchases.

XP estimation uses 0.1-second ticks and synthetic enemy residency from spawn to death. Elites live three times the ordinary assumption. Actual splitter deaths spawn children through the central cap. The empty spatial grid excludes unmodeled explosion-chain damage; corpses retain the actual gore-off 0.15-second budget. Late wave survivors receive no invented XP; boss-phase ordinary kills, survival, combat DPS, travel and dodging are not modeled. Encirclement clocks advance, but no movement/survival pressure is simulated. Suiciders and gunners use actual spawn weights and death XP; their attacks and self-detonation timing are outside the synthetic-residency model. The selected collection fraction is applied to both wave and boss XP. Actual boss drops contribute 24 × (5 + 2 × stage) XP. Coins and supplies do not add choices.

XP collection is treated as available by the end of each wave. The model does not predict when within a wave a level-up happens, and its assumed kill rate is independent of the selected build. Slow residency can therefore represent travel/avoidance, but is not a validated weak-build combat simulation.

Current XP cost is `8 + 7 × (level−1) + 10 × max(0, level−20) + 16 × max(0, level−40)`. Boss chests are opened before boss-drop XP choices by default, making the reward-order assumption explicit. The boss-10 reward is reported separately and never counted in its pre-fight build.

### XP scenarios

| Scenario | Ordinary / elite residency | Collection | Total collected XP | XP choices through full run |
| --- | --- | ---: | ---: | ---: |
| Slow | 24 / 72 s | 70% | 26,777 | 61 |
| Central | 16 / 48 s | 85% | 49,896 | 77 |
| Fast | 8 / 24 s | 95% | 107,211 | 103 |

Central seed-7 director results, before collection scaling:

| Stage | Wave kills | Wave XP | Boss XP | Level before boss |
| --- | ---: | ---: | ---: | ---: |
| 1 | 97 | 190 | 168 | 7 |
| 2 | 167 | 372 | 216 | 13 |
| 3 | 324 | 1,406 | 264 | 23 |
| 4 | 441 | 2,197 | 312 | 31 |
| 5 | 512 | 3,448 | 360 | 39 |
| 6 | 644 | 5,635 | 408 | 48 |
| 7 | 743 | 6,204 | 456 | 54 |
| 8 | 883 | 9,218 | 504 | 62 |
| 9 | 977 | 11,539 | 552 | 70 |
| 10 | 1,152 | 14,652 | 600 | 78 |

Ten alternate spawn seeds give total generated XP ranges 110,034–112,853 (8 s), 56,857–58,991 (16 s), 38,253–39,521 (24 s), before collection. Low-quality caps reduce the central collected estimate to 42,668, versus 49,896 high-quality;100 focused seeds still reached three finals. Opening boss XP before the chest also reached three finals in all 100 central seeds, but changed some first-fusion timing. These sensitivities do not establish the actual player kill-rate assumption.

## Policies and reach distributions

Focused planning prioritizes the first unfinished recipe's parent levels, acquires required passives, uses the one free reroll when a screen has no high-priority progress, and legally skips irrelevant choices instead of filling prerequisite slots with unrelated items. Fused upgrades and already-owned passives are fallback investments. Scattered selection chooses uniformly among the actual three cards, does not reroll or skip, recognizes available recipes, and uses at most one passive exchange to rescue a level-8 evolution. It accepts the first available ordinary fusion rather than deliberately holding three parents for an absolute. This compares player policies, not equal decision skill or equal reroll use.

Counts below are out of 200 seeds, before boss 10:

| XP scenario / policy | 0 finals | 1 final | 2 finals | 3 finals | 4 finals | Absolute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Slow / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Central / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Fast / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Slow / scattered | 9 | 97 | 88 | 6 | 0 | 0 |
| Central / scattered | 11 | 68 | 107 | 14 | 0 | 0 |
| Fast / scattered | 12 | 69 | 79 | 39 | 1 | 0 |
| Each scenario / absolute-focused | 0 | 200 | 0 | 0 | 0 | 200 |

Central focused pre-boss progression: stage 5 has 102 zero-final and 98 one-final builds; stage 6 has 26/130/44 zero/one/two-final builds; stage 7 has 32 one-final,129 two-final and 39 three-final; stage 8 has 52 two-final and 148 three-final. All reach three by stage 9. Thus three finals at stage 5 is an unsuitable representative benchmark. Central absolute-focused runs have an absolute in 14/200 by boss 5,104/200 by boss 6,195/200 by boss 7 and 200/200 by boss 8.

Median skipped choices are 5/13/32 for slow/central/fast focused runs. These are forgone opportunities, not hidden extra levels. All 200 scattered runs in each scenario used the one repair exchange. Focused runs did not need it because they reserved prerequisite slots. Failures in scattered runs can therefore be inventory planning failures even with ample XP; one exchange does not repair several incompatible passives.

## Allocation and chest constraints

Three disjoint finals use shotgun + rifle → scatter rail, cannon + thorns → lotus bloom, and molotov + gas → plague fire. Their required passive slots are exactly magazine, scope, pollen, regen, spread and sap. Acquiring/upgrading six parents to level 8 costs 47 item steps after the starting shotgun; six passive acquisitions bring this to 53. Six separate evolution rewards are also required. Maxing all three outputs adds 21 steps; maxing those six passives adds 24. Chest upgrades may supply item steps; they are not counted twice as XP choices.

Absolute bloom consumes evolved cannon + thorns + molotov, requiring pollen, regen and spread. Adding scatter rail uses shotgun/rifle and magazine/scope: five parents, five prerequisite passives, 44 pre-fusion item steps after the starting shotgun, and five evolutions. One passive slot remains for whetstone. Holding the three absolute ingredients delays simpler two-parent fusion and commits those inputs to the absolute. The output begins at level 1, never drops as a new random choice, and upgrades through level 8.

Two finals can instead reserve four passive slots for magazine/scope/pollen/regen and spend the remaining two on whetstone/heart. The benchmark's actual level-78 two-final snapshot has both finals at 8, all six passives at 5, might 1.5 and HP 200. The three-final snapshot has scatter rail 8, plague fire 8 and lotus bloom 5; it uses all six prerequisites at 5 and has might 1.0 and HP 100. The absolute-plus-final snapshot has both outputs at 8 and five prerequisites plus whetstone at 5.

Boss chests supply 2/2/3/3/3/5/5/5/5/5 guaranteed reward opportunities: 33 before boss 10 and 38 after its chest. They prioritize already-eligible evolutions; otherwise they upgrade owned items, and cannot discover missing weapons/passives. Premium +2 levels happen after guaranteed rewards, so a premium that first reaches level 8 may have to wait for the next boss chest to evolve. Expected premium wins are 3.6 before boss 10 and 4.25 through the full run; each yields at most two levels. Actual seeded outcomes use real rolls, not expected values.

The planner tests conserve every item step, including consumed level-8 parents, level-1 fusion outputs and any lost exchange levels. No elite chest, free evolution, unlimited exchange or seventh passive is inserted.

## Boss pacing and remaining limits

See [boss-durability.md](boss-durability.md) for reachable mid/late fixtures and 144 real-AI encounters. Current stage-5 median is 16.92 seconds; stage-10 medians are 12.15 seconds with two finals, 11.02 with three, and 7.77 with absolute plus one final. Keep current boss HP based on this bounded evidence; do not inflate it against an impossible six-final fixture.

These policies and finite seeds establish selected routes, not optimal play or an exhaustive maximum. Faster collection, extra boss-phase kills, other recipe combinations, purchased rerolls, and taking risks may change totals. Survival, within-wave timing and mobile movement still need human or full closed-loop combat validation. No hard cap of three crafted finals is claimed or introduced.
