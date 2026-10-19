# Beginner difficulty curve

The initial tuning below is historical. The latest requested crowd/HP changes and reward compensation are documented in [population-balance.md](population-balance.md); current boss durability is in [boss-durability.md](boss-durability.md). The ranged-stage correction later in this document supersedes the earlier stage-3 spitter note.

This pass makes the first two stages more forgiving while preserving the later spawn/stat curve. A subsequent change defers enemy death-cloud hazards until stage 5. These are initial tuning passes, verified by executable regression checks, not measured human completion-rate claims.

## Ordinary enemies and director

| Setting | Stage 1 before → after | Stage 2 before → after |
| --- | --- | --- |
| Target enemy count, start → end | 16–70 → 8–36 | 20–80 → 14–56 |
| Early-stage enemy slot limit | No stage-specific cap → 48 | No stage-specific cap → 72 |
| Refill rate | 4 + deficit × 1.5 → min(5, 2 + deficit × 0.45)/s | 4 + deficit × 1.5 → min(8, 3 + deficit × 0.65)/s |
| HP multiplier on existing curve | 1 → 0.85 | 1 → 0.92 |
| Speed multiplier on existing curve | 1 → 0.85 | 1 → 0.92 |
| Contact damage multiplier on existing curve | 1 → 0.70 | 1 → 0.85 |
| Runner introduction | 40s → 55s | Existing timing |
| Brute introduction | 100s → 115s | Existing timing |

The cap is checked in `spawnEnemy`, so `force: true` events and boss summons cannot bypass it. It counts retained enemy pool slots, including briefly retained death animations; this can conservatively delay a replacement until that animation releases its slot. Normal refills also stop at the current target rather than overfilling it after a long frame. Resetting a stage clears fractional spawn credit.

Per-enemy XP, sprites, sizes and collision radii are unchanged by this balance pass. Coin/shop adjustments, if present in the same release, are separate from this curve.

## Timed events

Stage 1 now schedules a 10-enemy ring at 70s, one elite at 90s, a 12-runner rush at 115s, and a second 10-enemy ring at 140s. This replaces the shared 45s ring, 60s elite, 95s rush, 120s elite and 140s ring. Runners still first appear normally at 55s; the first 70s are free of timed ambush events, not free of enemies.

Stage 2 keeps the existing event schedule. Its rings contain 16 enemies and rushes 20, down from 24 and 32. Stage 1 rings/rushes were previously 21/29.

Rush speed multipliers are 1.15 in stage 1 and 1.30 in stage 2, down from 1.50, applied in addition to the stage's enemy speed multiplier. Event elites receive HP multipliers of 0.65 and 0.80, respectively; elite reward multipliers stay the same.

## First boss

- HP 750 → 520; movement speed 58 → 48; base damage 14 → 10.
- Initial attack delay 2.2s → 3.0s.
- Charge warning 0.75s → 1.15s before phase scaling. The line and actual charge share the same computed delay: approximately 1.15s / 1.03s / 0.94s across the three phases.
- Charge speed 620 → 480 world units/s. Charge distance and collision radius are unchanged.
- All attack recovery periods are multiplied by 1.5; the existing phase scaling and ±15% timing variation still apply.
- Phase-transition recovery 1.4s → 2.2s.
- Summon counts are multiplied by 0.6 and rounded up: ordinary summon 6/9/12 → 4/6/8; phase-transition summons 9/12 → 6/8.
- Pattern selection, projectile counts and phase thresholds remain the same. Bosses 2–10 retain their previous combat data/timing.

## Enemy death clouds unlock at stage 5

The lingering enemy poison cloud comes from the bloater (`팽창체`, internal type `bloater`), not the acid spitter. Previously every bloater death queued an immediate explosion, and flushing that explosion always created an acid pool. Because bloaters appear at the start of stage 3, their lingering pools could also appear immediately there.

`DEATH_CLOUD_UNLOCK_STAGE = 5` now gates only the `spawnHazard('acid', ...)` call in `flushExplosions`. Stages 1–4 cannot create a bloater death cloud, including forced spawns, elites and chain-reaction deaths. Stage 5–10 clouds keep their original radius (78 × 0.7 = 54.6), lifetime (3.5 seconds), tick interval (0.3 seconds) and damage (25% of the stage-scaled explosion damage).

Immediate bloater explosions keep their original 78-unit radius, stage-scaled damage and enemy splash/chain reactions. Death animations, regular/elite loot and splitter offspring are unchanged. Spitter projectiles still unlock at stage 3 at 90 seconds. Boss acid-pool attacks keep their existing timing and damage; this is not a global acid-hazard restriction.

## Preserved later-game behavior

Stage 3–10 duration, density, enemy tables, timed events, scaling, ordinary refill rates and forced-spawn behavior retain the previous values. Acid spitters remain absent in stages 1–2, first appearing in stage 3 at 90s; their damage and firing cooldown are unchanged. No save schema, item price, reward formula or rendering change is part of this file's balance pass.

## Verification

Run `node --test tests/beginner-balance.mjs tests/ranged-unlock.mjs tests/death-cloud-unlock.mjs`, then `node --test tests/*.mjs`.

The beginner tests exercise the real director, enemy spawn function and boss patterns with a deterministic random source and minimal atlas boundary. They verify refill limits, target overshoot prevention, retry reset, force/event/boss cap enforcement, event timing/counts, enemy stats and XP, charge line/attack synchronization, boss recovery and summons. The checked-in `tests/fixtures/later-stage-balance.json` records the pre-tuning later-stage data and guards it against unintended drift.

Death-cloud tests call real enemy spawning and lethal damage, flush the real explosion queue, and update actual hazards. They cover ordinary and elite bloaters in every stage, absence of lingering early damage, unchanged late cloud damage/expiry, chain explosions and loot, every other enemy type, an actual spitter shot and the stage-4 boss's acid-pool callback.

Human playtesting still needs to confirm that an unupgraded first run has enough time to learn movement, collect early upgrades, and dodge all three first-boss phases. Check keyboard and touch input, retry, and low-quality mode. Automated counts/timings do not establish a real player's completion rate.

## Ranged regression correction
Previous build fee60f7 delayed the spitter table to stage3/90s but stage4 still allowed it immediately; direct forced/elite/summon calls were not gated. The only ordinary ranged definition is `spitter` (산성 토사체, acid pellet). All ordinary ranged definitions are now rejected before stage5 centrally in spawnEnemy and filtered from stage1–4 normal and boss-summon tables. Defensive firing also rejects early-stage ranged objects. Stage5's normal table begins at60s. Boss projectiles are separate and retain their telegraphs/pacing.

## Battlefield support supplies
Ordinary eligible kills: healing0.6%→4%, or10% at≤40%HP; guaranteed after30 eligible kills without healing, or12 consecutive low-HP kills. Magnet0.2%→1.5%, guaranteed after60 eligible kills. Independent rolls permit both together. Active-field caps3 healing/2 magnets retain capped drought until collection frees space. Elite chest drops remain separate. Counters are bounded and included in run-build snapshots; a new run resets them. Shop odds/pity unaffected.
