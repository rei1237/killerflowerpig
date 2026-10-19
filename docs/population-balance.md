# Fewer, tougher ordinary enemies

This tuning follows the request to reduce crowds while making each enemy sturdier. It replaces the previous population/HP values in `beginner-balance.md`. Boss durability is documented separately in `boss-durability.md`.

## Current population revision

The follow-up reduces the prior target endpoints and hard stage caps by another 12%, rounded to whole enemies. The first-stage minimum goes from 5 to 4 because of rounding. Normal enemy identities and rewards are retained; late specialist waves use fewer, more distinct threats.

| Stage | Previous target | Current target | Current cap | Ring count | Rush count |
| --- | --- | --- | --- | --- | --- |
| 1 | 5–22 | 4–19 | 26 | 5 | 6 runners |
| 2 | 8–34 | 7–30 | 38 | 9 | 11 runners |
| 3 | 16–60 | 14–53 | 74 | 14 | 18 runners |
| 4 | 19–75 | 17–66 | 88 | 16 | 20 runners |
| 5 | 23–90 | 20–79 | 102 | 18 | 6 suiciders |
| 6 | 27–105 | 24–92 | 116 | 19 | 7 suiciders |
| 7 | 31–120 | 27–106 | 130 | 20 | 8 suiciders |
| 8 | 36–135 | 32–119 | 144 | 22 | 9 suiciders |
| 9 | 41–150 | 36–132 | 158 | 24 | 10 suiciders |
| 10 | 46–168 | 40–148 | 172 | 26 | 10 suiciders |

Global limits remain252/high and156/low, and all spawn routes use the stricter stage cap. Refill base rates and early max rates are also12% lower; the deficit coefficient is unchanged to avoid double reduction. Boss relief0.35 and low-quality0.85 factors remain. Long-frame refill never exceeds its target.

Event times and stage durations are unchanged. Stage1 keeps its55s runner,70s ring and115s brute introduction. Stages1–4 rings stay escapable enemy formations; stage5+ rings also request the 2s-warning/7s-active poison enclosure with at least90s between triggers. Late rushes use at most10 spaced suiciders, not a dense crowd, with per-enemy warning and fuse. Per-kill XP, rare coin probabilities/amounts and shop prices are unchanged. Fewer enemies can lower total earnings; no unmeasured claim of equal payout is made.

## Individual durability and TTK proxies

`ENEMY_TOUGHNESS_MULTIPLIER = 1.62` multiplies existing stage-scaled HP once, up 11.72% from the previous 1.45 tuning. Normal/elite mobs and summoned/split variants use the same factor. Boss HP is separate. Density, rewards, speed, damage, artwork and collision radii are unchanged by this adjustment.

Examples at stage start (shambler, no elite modifier):

| Stage | Previous 1.45 HP | New 1.62 HP | 9-damage hits before → after |
| --- | --- | --- | --- |
| 1 | 12.325 | 13.770 | 2 → 2 |
| 2 | 24.332 | 27.185 | 3 → 4 |
| 5 | 76.908 | 85.925 | 9 → 10 |
| 10 | 209.728 | 234.317 | 24 → 27 |

Constant-DPS time rises 11.72% against the same target. These are HP/DPS proxies, not human completion times. The first-stage starter's basic hit breakpoint remains two 9-damage hits. Existing beginner multipliers and stage durations are retained. At the approximate 0.528 density, combined crowd HP is 0.528 × 1.62 = 0.85536 of the original pre-density-reduction baseline.

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
