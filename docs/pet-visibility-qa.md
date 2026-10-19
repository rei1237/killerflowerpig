# Yeongnyang visibility and animation QA

## Report investigation

The reported invisible equipped pet was traced through purchase, equipment, save migration, new run, continue, reset, update and full-frame render. Both7a41 and the latest local engine contain real sprite loading/render hooks. v4→v5 migration retains the valid owned/equipped `pet_yeongnyang` ID. No persistent local invisibility was reproduced.

On2026-10-19 at14:08UTC the public production URL `https://killerflowerpig.vercel.app/asset/sprites/pet-yeongnyang.json` returned404. Production was still the older engine at this audit. This supports a deployment/version mismatch; it does not prove the exact state/origin of the reporting user's browser. Guest progress is origin-local and is not cross-origin server synchronization.

## Actual rendered evidence

`node tools/pet-native-qa.mjs` uses the real decoded image files, durable purchase/equip facade, newRun and continueRun, gameplay step, and entire render() scene in native Canvas. It asserts actual changed pixels between equipped and unequipped frames, damage and healing, not merely that an asset file exists.

- `/workspace/shared/pet-owned-full-frame.png`: actual complete equipped gameplay frame.
- `/workspace/shared/pet-owned-attack-frame.png` and `pet-owned-heal-frame.png`: action frames in the complete scene.
- `PET_FAIL=metadata` and `PET_FAIL=image` simulate atlas metadata/image404. Both retain a visible portrait fallback and working effects.
- `PET_FAIL=all` also removes the portrait, proving the procedural wingless cat fallback remains visible.
- Matching fallback images use `pet-metadata-*`, `pet-image-*`, `pet-all-*` filenames.

Chromium QA was attempted but blocked by sandbox socket permissions; the permitted escalation also failed because the environment wrapper could not create its session path. These images are native renderer QA, not browser gameplay screenshots or production verification. `tools/pet-browser-qa.mjs` is provided for a working browser environment.

## Wingless replacement contract

New artwork uses wingless idle/follow and10 distinct attack/10 distinct healing poses. Attack clip0.9seconds, healing clip1.2seconds; each releases the actual gameplay effect on frame5 (zero-based). Attack windup starts0.45seconds before the existing release, heal windup0.6seconds before it. Existing attack0.9second cadence, heal6second cadence, damage/targets/ranges are retained. Simulation time drives poses, so pause redraw cannot duplicate hits/heals. Floating timer tolerance prevents an exact boundary from missing release.

Fixed allowlisted, lazy WebP sheet paths and validated source rectangles avoid arbitrary metadata-driven URLs. Downsampled pet art enables image smoothing inside save/restore only. All complete frame bounds, including hat/effects, remain≤36×34 world units with current player art (and≤23×32 with legacy player), below65% of the minimum player's measured silhouette. The procedural/portrait fallback has no wings.

Re-run native and unit tests after installing final replacement sheets; runtime snapshots and screenshot files always reflect the last local execution, not publication status.

## Final local verification

All24 wingless poses are now integrated as base4 (1254×1254), attack10 and heal10 (each1983×793), about700KiB combined. Native full-frame checks passed against these final files, including actual attack/healing release poses and all three failure modes. The full automated suite passed339/339 and focused pet tests13/13. High-quality smoothing is scoped only to the pet. The later HP-recovery clip takes visual priority over continuous attacks so healing poses remain visible; attack effects and damage cadence continue unchanged. Asset padding is cropped only at render time using measured alpha bounds, a shared visible-body scale and per-frame foot placement, preventing the generator's differing cell baselines from causing jumps.
