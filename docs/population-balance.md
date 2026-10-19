# Fewer, tougher ordinary enemies

This tuning follows the request to reduce crowds while making each enemy sturdier. It replaces the previous population/HP values in `beginner-balance.md`. Boss durability is documented separately in `boss-durability.md`.

## Population before and after

Target counts interpolate across each stage; values below show stage start–end before quality/boss relief factors. Endpoints are approximately 40% lower (37.5–42.9%, allowing whole-enemy rounding).

| Stage | Previous target | New target | New hard stage cap | Ring before → after | Rush before → after |
| --- | --- | --- | --- | --- | --- |
| 1 | 8–36 | 5–22 | 29 | 10 → 6 | 12 → 7 |
| 2 | 14–56 | 8–34 | 43 | 16 → 10 | 20 → 12 |
| 3 | 26–100 | 16–60 | 84 | 27 → 16 | 35 → 21 |
| 4 | 32–125 | 19–75 | 100 | 30 → 18 | 38 → 23 |
| 5 | 38–150 | 23–90 | 116 | 33 → 20 | 41 → 25 |
| 6 | 45–175 | 27–105 | 132 | 36 → 22 | 44 → 26 |
| 7 | 52–200 | 31–120 | 148 | 39 → 23 | 47 → 28 |
| 8 | 60–225 | 36–135 | 164 | 42 → 25 | 50 → 30 |
| 9 | 68–250 | 41–150 | 180 | 45 → 27 | 53 → 32 |
| 10 | 76–280 | 46–168 | 196 | 48 → 29 | 56 → 34 |

- Global enemy limits: high quality 420 → 252, low quality 260 → 156. Particle/text/gem budgets are unchanged.
- Every route uses the minimum of the stage and global caps: ordinary, elite, forced event, boss summon and splitter offspring. `force: true` no longer bypasses a late-stage population cap.
- Caps count retained pool slots, including corpses awaiting animation cleanup. Near the cap, a splitter may release fewer than three offspring; a wave or summon fills only available slots.
- The normal director reserves 12 slots rather than 20, matching the 0.60 population factor. Boss relief (×0.35) and low-quality target reduction (×0.85) remain unchanged.
- Normal spawning now stops at its current target even after a long frame in every stage. It does not accumulate failed-spawn credit behind a full cap.
- Boss summons use 60% of their previous effective rounded counts, rounded again to whole enemies, with at least one requested summon. Central caps still apply. That change is implemented by the boss owner in `boss.js`.

## Refill pace

Stage 1: `min(5, 2 + deficit × 0.45)` → `min(3, 1.2 + deficit × 0.45)` enemies/second.

Stage 2: `min(8, 3 + deficit × 0.65)` → `min(4.8, 1.8 + deficit × 0.65)` enemies/second.

Stages 3–10: `4 + deficit × 1.5` → `2.4 + deficit × 1.5` enemies/second.

The deficit coefficient is deliberately retained: the target and therefore the comparable deficit are already about 60% of the previous value. Multiplying both would accidentally reduce that term to about 36%. At equal population fullness (empty, half-full and 90%-full), tested refill rates remain between 55% and 65% of their previous values in every stage.

Event times and stage durations are unchanged. Stage 1 still waits until 55s for runners, 70s for the first ring and 115s for brutes. The stage 1/2 rush speed reductions and elite HP modifiers remain.

## Individual durability and TTK proxies

`ENEMY_TOUGHNESS_MULTIPLIER = 1.45` multiplies the existing stage-scaled enemy HP. It applies once to normal/elite mobs and their summoned/split variants. Boss HP is separate. Enemy speed, contact damage, projectile damage/cooldown, sprite/tint, animation scale and collision radii do not change.

Examples use a shambler at stage start with no random elite modifier:

| Stage | Previous HP | New HP | 9-damage hits before → after | Fixed 40-DPS time before → after |
| --- | --- | --- | --- | --- |
| 1 | 8.500 | 12.325 | 1 → 2 | 0.213s → 0.308s |
| 2 | 16.781 | 24.332 | 2 → 3 | 0.420s → 0.608s |
| 5 | 53.040 | 76.908 | 6 → 9 | 1.326s → 1.923s |
| 10 | 144.640 | 209.728 | 17 → 24 | 3.616s → 5.243s |

The fixed-damage tests apply real `hitEnemy` calls until death. The 40-DPS values are HP/DPS proxies, not measured weapon or human clear times; pellets, overkill, pierce, movement and build choices change real TTK. The same target with constant DPS takes 45% longer. At an exact 0.60 density factor, the crowd's combined HP proxy is 0.60 × 1.45 = 0.87 of the former value.

## Rewards and support compensation

The economy change alongside this tuning uses a `5 / 3` old-opportunity factor:

- Ordinary coins 3 → 5; elite coins 24 → 40.
- Actual gem-drop XP ×5/3, with fractional XP retained. Enemy combat objects retain their base XP values.
- Supply probability becomes `1 - (1 - previousChance)^(5/3)`, and eligible drought counters advance 5/3 previous opportunity units per ordinary kill.
- Guarantees become 18 injured kills for healing, 8 consecutive low-HP kills and 36 for a magnet. Existing full-HP healing suppression, caps, stale cleanup and persisted drought units remain.

At 60% as many matched kill opportunities, ordinary raw coin/XP totals equal the previous totals. Compensation tests verify this matched-budget comparison. This does not claim measured income per minute for all player builds.

## Preserved gates and verification

Ordinary ranged enemies remain blocked in stages 1–4 by the spawn, table, summon and firing gates. Stage 5's normal spitter table opens at 60s. Bloater death clouds remain blocked until stage 5. No ordinary appearance changes are included.

Run `node --test tests/population-balance.mjs tests/beginner-balance.mjs tests/ranged-unlock.mjs`, followed by `node --test tests/*.mjs`.

The population regression suite covers all stage endpoints, refill ratios, HP/speed/damage/appearance, real fixed-damage kills, both global quality caps, forced/elite/event/boss/splitter cap enforcement and long-frame director limits. The latest complete suite passed 327/327 at integration; rerun after any subsequent edits. This is automated engine verification, not a browser or human playtest.
