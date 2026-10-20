# Beginner guard and relocated Alpha

## Encounter mapping

- Stage 1 is now **길목 경비 청토끼**, a separate beginner encounter. Base HP is **600**, effective HP **4,200** under the unchanged ×7 multiplier. It uses only one locked-direction charge in every phase. Opening delay is 3 seconds; warning is always 1.5 seconds; dash speed is 300, maximum range 280; recovery is always 2.5 seconds, stationary and contact-safe. No summons, landing ring, aimed shots or phase-speed increase. A dash stops after its first player contact. The warning encloses the entire swept contact path.
- Stage 9 is the original **알파 청토끼**, with its original name, title, scale, artwork, speed, base damage, pacing and phase lists: charge/summon → charge/ring/summon → charge/ring/aimed. Phase summons and landing rings are preserved. Only its HP is tuned for the late encounter: **13,000 base ×7 ×3.2 = 291,200 effective**. The existing stage rule still makes contact damage 14 from base 10; summons use the existing stage-9 enemy table/scaling.
- The former stage-9 hammer-king encounter is replaced. Stages 2–8 and 10 are unchanged field-for-field, checked against a captured pre-change fixture. Global HP multipliers are unchanged. Stage 9 can therefore have less HP than stage 8: encounter duration, not a mandatory HP ladder, determined this replacement's value.
- Runtime sprites, portraits and bestiary follow Alpha's art ID 1 while gameplay stage remains 9. The lazy cache holds current/next actual art IDs; stage 9 preloads art 1 and 10, and stage 10 evicts art 1.

## Beginner measurements

`node tools/beginner-boss-qa.mjs` uses all five actual techs, seeds 1/7/13, two route weapons Lv4 plus two passives Lv1 (10 item levels, no evolutions). That is 7–8 level choices after the real starting kit, equivalent to run level 8–9. The same 100px circular movement policy and real movement speed are used for every tech. No purchases, artificial healing, god mode, wave director or mid-fight upgrades.

| Tech | Mean kill time | Three-run survival |
| --- | ---: | ---: |
| Gunline | 23.2s | 3/3 |
| Bloom | 17.3s | 3/3 |
| Plague | 23.5s | 3/3 |
| Executioner | 29.4s | 3/3 |
| Butcher | 33.2s | 3/3 |

At lower equal investment (two Lv3 weapons + two Lv1 passives, run level 6–7), all 15 runs also clear; mean times are 24.7 / 22.2 / 28.0 / 53.1 / 33.6 seconds in the same tech order. Executioner is slower before its next weapon upgrade. Run `node tools/beginner-boss-qa.mjs --level=3` to reproduce.

All runs retained full HP under this prescribed dodge policy and completed at least two real boss dashes before defeat. Completed warnings/recoveries retain the full 1.5/2.5-second windows. Starter-only tests also verify that all five actual starting kits can dodge and land real hits for up to 60 seconds. These are controlled runtime tests, not human success-rate or browser-playtest claims.

## Stage-9 HP selection

`node tools/alpha-boss-qa.mjs` obtains the actual pre-stage-9 snapshot from the existing progression planner: level 47, scatter rail Lv5, lotus bloom Lv3, six Lv5 passives, two actual final weapons and no absolute weapon. Planner assumptions are 16-second ordinary / 48-second elite residency and 85% XP collection. Three paired seeds compare automatic targeting with one actual focus tap at encounter start and use actual boss movement, phases, summons, weapon collisions and hitstop; a standing high-HP player isolates kill time rather than survival.

| Base HP | Effective HP | Automatic kill time | Explicit-focus kill time |
| --- | ---: | ---: | ---: |
| 13,000, selected | 291,200 | 83.5–93.3s (mean 87.4s) | 69.2–76.9s (mean 73.0s) |

These final combined-source runs preserve at least 24 automatic or 21 focused real pattern starts and both phase transitions. This deliberate-focus advantage remains after the global three-beam cap, exact union collision, consumable thorn curve and narrow Absolute Bloom balance pass. The two-final comparison itself contains no Absolute weapon. Earlier 14,000/18,000/20,000 experiments used different intermediate cannon/thorn mechanics and are not paired HP-only evidence for this final build.

The old stage-9 base 44,800 already meant 1,003,520 effective HP; moving the Alpha definition did not add another multiplier. Its excessively long earlier two-final diagnostic motivated selecting encounter-specific base HP rather than changing global scaling. Full final hashes and rows are in [boss-stage-evidence.json](boss-stage-evidence.json).

## Regression coverage

- `tests/boss-stage-relocation.mjs`: exact identity mapping, unaffected encounters, all-phase timing, low-FPS swept contact, no invisible lane hits, stationary safe recovery, interrupted warnings, art metadata/cache, five starter kits and five grown early builds.
- `tests/alpha-boss-pacing.mjs`: real stage-9 two-final build, three seeds, 60–100-second target, both phase transitions and repeated actual patterns.
- Existing boss-signature, durability, animation, beginner, bestiary and supply tests retain their applicable protections, with old Alpha-specific assertions moved to stage 9.
- Both QA tools record source hashes and reject a report if combat sources change during execution.
