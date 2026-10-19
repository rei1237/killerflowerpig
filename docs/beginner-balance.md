# Beginner difficulty curve

This pass makes the first two stages more forgiving without changing the stage 3–10 balance curve. It is an initial tuning pass, verified by executable regression checks, not a measured human completion-rate claim.

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

## Preserved later-game behavior

Stage 3–10 duration, density, enemy tables, timed events, scaling, ordinary refill rates and forced-spawn behavior retain the previous values. Acid spitters remain absent in stages 1–2, first appearing in stage 3 at 90s; their damage and firing cooldown are unchanged. No save schema, item price, reward formula or rendering change is part of this file's balance pass.

## Verification

Run `node --test tests/beginner-balance.mjs tests/ranged-unlock.mjs`, then `node --test tests/*.mjs`.

The beginner tests exercise the real director, enemy spawn function and boss patterns with a deterministic random source and minimal atlas boundary. They verify refill limits, target overshoot prevention, retry reset, force/event/boss cap enforcement, event timing/counts, enemy stats and XP, charge line/attack synchronization, boss recovery and summons. The checked-in `tests/fixtures/later-stage-balance.json` records the pre-tuning later-stage data and guards it against unintended drift.

Human playtesting still needs to confirm that an unupgraded first run has enough time to learn movement, collect early upgrades, and dodge all three first-boss phases. Check keyboard and touch input, retry, and low-quality mode. Automated counts/timings do not establish a real player's completion rate.
