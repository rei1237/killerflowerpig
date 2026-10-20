# Fitted-cape sword warrior motion

## Deliverable

`asset/sprites/player-cape-sword.png`: 3072 × 256, standard lossless 8-bit RGBA PNG, eight 384 × 256 cells. Complete costume-compatible flowerpig with a physically held silver broadsword, gold crossguard, purple grip and pink lotus pommel. No disc, rifle, cannon, detached sword, or projectile.

## Frames

0. Anticipatory diagonal guard, sword in both hands
1. Immediate extended-arm horizontal sword impact, with a compact lavender swish attached to the blade
2. Downward/rightward held-sword follow-through
3. Peak follow-through, torso turn, wink and greatest cape wave
4. Low held-sword settling and delayed hem curl
5. Sword drawn back toward torso, recovering elbows and shoulders
6. Returning diagonal guard with inward cloth follow-through
7. Final guard settle

All eight are genuine independently generated drawings, with different arms, torso and cape folds. No duplicated or translated attack frame. The sword remains visibly connected to its gripping hand in every pose. The canonical pink face, forehead lotus, scarf, fitted purple/gold cape, lining, tail and hooves remain coherent.

## Geometry

- Fixed cell foot-center `(192,240)` with ≤0.51 pixel source-mapping rounding error.
- One uniform normalization factor `0.762712` for all eight frames.
- Approximately 225-pixel median head-to-hoof body size; no individual bounding-box stretching.
- Whole sword, hands, cape and blade-attached swish are inside every cell.
- All eight outside cell borders have alpha 0.
- Existing runtime scale and code are unchanged.

## Provenance

Created with built-in `image_gen`, referencing the actual current `asset/sprites/player-cape-blade.png` and its larger `scratch/cape-tech-motion/blade-source.png`. A targeted imagegen correction shortened the oversized generated sword blades and tightened the first-impact swish, without changing body/cloth poses.

Initial generated source: `exec-792faba1-534a-461c-ac89-c3c90f97aa0e.png`.

Selected corrected source: `exec-a85e645b-a1e1-4950-8319-805d28f93d9e.png`, copied to `scratch/cape-sword-motion/sword-source.png`.

Exact generation and correction prompts: `scratch/cape-sword-motion/prompts.json`.

No artwork was painted in code. Mechanical processing only: component extraction with anti-aliasing margins, premultiplied-alpha uniform Lanczos downsampling, foot alignment, near-invisible alpha residue cleanup, hidden-RGB zeroing and lossless PNG packing. Downsampling is explicitly resampling; only the final PNG encoding is lossless.

## Verification

- Pillow, Sharp and native `@napi-rs/canvas` decode the final file at 3072 × 256.
- Eight distinct full-frame pixel hashes.
- All cell borders fully transparent.
- Every measured normalized foot-center within 0.51 pixel of `(192,240)`.
- Full proof visually inspected for physical hilt grip, complete sword silhouettes, immediate impact pose, cape movement and no duplicate projectile.

Contact proof: `scratch/cape-sword-motion/sword-contact-proof.png`.

Measurements and hashes: `scratch/cape-sword-motion/sword-validation.json`.

Mechanical packer: `scratch/cape-sword-motion/pack.py`.

No gameplay code or publishing was performed by this art task.
