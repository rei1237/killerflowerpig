# Authored sprite polish

Replaces 39 runtime atlases across Shooting, Executioner, Plague, Lotus Garden and Butcher, each with eight distinct authored poses. The three costumes retain the canonical pink pig, warm brown eyes, layered pink head lotus, purple scarf and curly tail. The cape and jade garments are redrawn with the body poses rather than overlaid on a fixed body.

## Runtime contract

- Each sheet remains RGBA 3072 × 256, with eight 384 × 256 cells.
- Attack sheets use ready frame 0 and immediate release frame 1, then recoil/follow-through and recovery.
- Movement sheets retain four idle and four walking poses.
- Existing animation cadence, sprite scale, cache limits and gameplay collision geometry remain unchanged.
- Normalization is extraction, uniform scaling and registration of generated artwork. No procedural limb rotation or duplicate-frame animation is introduced.
- Gunline registration is adjusted within its artwork to meet the existing muzzle anchor, without changing projectile origin.
- The service-worker cache version advances to v23 so previously cached sprite URLs refresh.

## Coverage

- Shooting: standard gun, lotus gun and idle/walk × three costumes (9).
- Executioner: dual-gun attack and idle/walk × three costumes (6).
- Plague/channel: throw, channel and throw idle/walk × three costumes (9).
- Lotus Garden: cannon attack and idle/walk × three costumes (6).
- Butcher: sword, blade launch and sword idle/walk × three costumes (9).

The approved Cannon impact revision is documented separately in `../cannon-impact-revision.md`. No other combat behavior is changed by this art pass.

## Verification

`node --test tests/*.mjs` includes fixed-dimension, distinct-frame, alpha-border and compressed-size checks in `tests/sprite-polish.mjs`. Uniqueness alone is not evidence of good animation; contact sheets and real-timing native-renderer clips are also reviewed. `tools/tech-motion-native-qa.mjs` checks 168 attack poses; `tools/tech-locomotion-native-qa.mjs` checks 120 idle/walk poses. These native-renderer checks do not claim mobile-device performance or human gameplay testing.

Source packs retain accepted and intermediate generations, normalization scripts, registration reports and review media for reproducibility. Runtime files contain only the final atlases.
