# Ten-stage progression and boss-fixture audit

## Result

A focused player can reach three chosen finals, or one absolute plus one final, before boss 10 under all three tested XP scenarios. No engine, XP, drop-rate, choice-weight or boss-HP changes were made in this audit. This demonstrates reachability under stated budgets, not a guaranteed win or a hard three-final maximum. The focused policy deliberately stops acquiring new recipe families after its chosen goal; fast scattered runs sometimes reached four finals.

## Reproducible method

Run `node tools/run-progression-audit.mjs 200`. `docs/run-progression-audit-results.json` records the 200-seed distributions and sensitivity checks. `tests/run-progression-audit.mjs` verifies replayed snapshots, exact item-investment conservation, chest-before-fusion requirements, one-exchange use, and six weapon / six passive slot limits.

The tool calls real `updateSpawner`, `spawnEnemy`, `hitEnemy`, XP drops, `addXP`, `rollChoices`, choice sessions/rerolls, `applyChoice`, `rollBossChest`, exchange previews/commit and fusion previews/commit. It does not replace candidate weights with a simplified distribution. Each run starts with the real level-1 shotgun and no purchases.

XP estimation uses 0.1-second ticks and synthetic enemy residency from spawn to death. Elites live three times the ordinary assumption. Actual splitter deaths spawn children through the central cap. The empty spatial grid excludes unmodeled explosion-chain damage; corpses retain the actual gore-off 0.15-second budget. Late wave survivors receive no invented XP; boss-phase ordinary kills, survival, combat DPS, travel and dodging are not modeled. The selected collection fraction is applied to both wave and boss XP. Actual boss drops contribute 24 × (5 + 2 × stage) XP. Coins and supplies do not add choices.

XP collection is treated as available by the end of each wave. The model does not predict when within a wave a level-up happens, and its assumed kill rate is independent of the selected build. Slow residency can therefore represent travel/avoidance, but is not a validated weak-build combat simulation.

Current XP cost is `8 + 7 × (level−1) + 10 × max(0,level−20) + 16 × max(0,level−40)`. Boss chests are opened before boss-drop XP choices by default, making the reward-order assumption explicit. The boss-10 reward is reported separately and never counted in its pre-fight build.

### XP scenarios

| Scenario | Ordinary / elite residency | Collection | Total collected XP | XP choices through full run |
| --- | --- | ---: | ---: | ---: |
| Slow | 24 / 72 s | 70% | 29,208 | 63 |
| Central | 16 / 48 s | 85% | 53,111 | 79 |
| Fast | 8 / 24 s | 95% | 116,023 | 107 |

Central seed-7 director results, before collection scaling:

| Stage | Wave kills | Wave XP | Boss XP | Level before boss |
| --- | ---: | ---: | ---: | ---: |
| 1 | 114 | 215 | 168 | 7 |
| 2 | 189 | 433 | 216 | 14 |
| 3 | 368 | 1,584 | 264 | 24 |
| 4 | 497 | 2,335 | 312 | 32 |
| 5 | 599 | 3,699 | 360 | 40 |
| 6 | 739 | 6,930 | 408 | 50 |
| 7 | 847 | 6,071 | 456 | 56 |
| 8 | 1,013 | 9,211 | 504 | 63 |
| 9 | 1,128 | 11,873 | 552 | 71 |
| 10 | 1,331 | 16,293 | 600 | 80 |

Ten alternate spawn seeds give total generated XP ranges 121,636–124,731 (8 s), 62,018–62,838 (16 s), and 41,067–42,756 (24 s), before collection. Low-quality caps reduce the central collected estimate to 44,931, versus 53,111 high-quality; 100 focused seeds still reached three finals. Opening boss XP before the chest also reached three finals in all 100 central seeds, but advanced some first-fusion timing. These sensitivities do not establish the actual player kill-rate assumption.

## Policies and reach distributions

Focused planning prioritizes the first unfinished recipe's parent levels, acquires required passives, uses the one free reroll when a screen has no high-priority progress, and legally skips irrelevant choices instead of filling prerequisite slots with unrelated items. Fused upgrades and already-owned passives are fallback investments. Scattered selection chooses uniformly among the actual three cards, does not reroll or skip, recognizes available recipes, and uses at most one passive exchange to rescue a level-8 evolution. It accepts the first available ordinary fusion rather than deliberately holding three parents for an absolute. This compares player policies, not equal decision skill or equal reroll use.

Counts below are out of 200 seeds, before boss 10:

| XP scenario / policy | 0 finals | 1 final | 2 finals | 3 finals | 4 finals | Absolute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Slow / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Central / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Fast / focused | 0 | 0 | 0 | 200 | 0 | 0 |
| Slow / scattered | 5 | 101 | 86 | 8 | 0 | 0 |
| Central / scattered | 12 | 73 | 95 | 20 | 0 | 0 |
| Fast / scattered | 11 | 62 | 90 | 30 | 7 | 0 |
| Each scenario / absolute-focused | 0 | 200 | 0 | 0 | 0 | 200 |

Central focused pre-boss progression: stage 5 has 107 zero-final, 89 one-final and four two-final builds; stage 6 has 23/126/51; stage 7 has 14 one-final, 129 two-final and 57 three-final; stage 8 has 17 two-final and 183 three-final. All reach three by stage 9. Thus three finals at stage 5 is an unsuitable representative benchmark. Central absolute-focused runs have an absolute in 17/200 by boss 5, 121/200 by boss 6, 197/200 by boss 7 and 200/200 by boss 8.

Median skipped choices are 6/14/36 for slow/central/fast focused runs. These are forgone opportunities, not hidden extra levels. Scattered runs used the one repair exchange in 199/199/200 seeds. Focused runs did not need it because they reserved prerequisite slots. Failures in scattered runs can therefore be inventory planning failures even with ample XP; one exchange does not repair several incompatible passives.

## Allocation and chest constraints

Three disjoint finals use shotgun + rifle → scatter rail, cannon + thorns → lotus bloom, and molotov + gas → plague fire. Their required passive slots are exactly magazine, scope, pollen, regen, spread and sap. Acquiring/upgrading six parents to level 8 costs 47 item steps after the starting shotgun; six passive acquisitions bring this to 53. Six separate evolution rewards are also required. Maxing all three outputs adds 21 steps; maxing those six passives adds 24. Chest upgrades may supply item steps; they are not counted twice as XP choices.

Absolute bloom consumes evolved cannon + thorns + molotov, requiring pollen, regen and spread. Adding scatter rail uses shotgun/rifle and magazine/scope: five parents, five prerequisite passives, 44 pre-fusion item steps after the starting shotgun, and five evolutions. One passive slot remains for whetstone. Holding the three absolute ingredients delays simpler two-parent fusion and commits those inputs to the absolute. The output begins at level 1, never drops as a new random choice, and upgrades through level 8.

Two finals can instead reserve four passive slots for magazine/scope/pollen/regen and spend the remaining two on whetstone/heart. The benchmark's actual level-80 two-final snapshot has both finals at 8, all six passives at 5, might 1.5 and HP 200. The three-final snapshot uses all six prerequisites at 5 and has might 1.0 and HP 100. The absolute-plus-final snapshot has both outputs at 8 and five prerequisites plus whetstone at 5.

Boss chests supply 2/2/3/3/3/5/5/5/5/5 guaranteed reward opportunities: 33 before boss 10 and 38 after its chest. They prioritize already-eligible evolutions; otherwise they upgrade owned items, and cannot discover missing weapons/passives. Premium +2 levels happen after guaranteed rewards, so a premium that first reaches level 8 may have to wait for the next boss chest to evolve. Expected premium wins are 3.6 before boss 10 and 4.25 through the full run; each yields at most two levels. Actual seeded outcomes use real rolls, not expected values.

The planner tests conserve every item step, including consumed level-8 parents, level-1 fusion outputs and any lost exchange levels. No elite chest, free evolution, unlimited exchange or seventh passive is inserted.

## Boss pacing and remaining limits

See [boss-durability.md](boss-durability.md) for reachable mid/late fixtures and 144 real-AI encounters. Current stage-5 median is 17.67 seconds; stage-10 medians are 12.15 seconds with two finals, 10.93 with three, and 7.77 with absolute plus one final. Keep current boss HP based on this bounded evidence; do not inflate it against an impossible six-final fixture.

These policies and finite seeds establish selected routes, not optimal play or an exhaustive maximum. Faster collection, extra boss-phase kills, other recipe combinations, purchased rerolls, and taking risks may change totals. Survival, within-wave timing and mobile movement still need human or full closed-loop combat validation. No hard cap of three crafted finals is claimed or introduced.
