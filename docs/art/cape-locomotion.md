# Fitted-cape technology-specific idle and walk atlases

## Delivered assets

Five 3072 × 256 lossless 8-bit RGBA PNGs, each containing eight 384 × 256 cells:

- `asset/sprites/player-cape-fire-move.png`
- `asset/sprites/player-cape-dual-move.png`
- `asset/sprites/player-cape-throw-move.png`
- `asset/sprites/player-cape-cannon-move.png`
- `asset/sprites/player-cape-sword-move.png`

Each is a separately generated complete character animation, not an attack frame moved up and down. The actual current cape family ready sprite was the reference. The canonical pink face, head lotus, purple scarf, fitted purple/gold cloak, lavender lining, curly tail and brown hooves remain coherent.

## Frame contract

- Frames 0–3: subtle idle breathing, with independently drawn shoulder, wrist, chest and cloth changes; feet remain in the resting stance.
- Frames 4–7: a walking sequence with changed leg/hoof silhouettes, bent knees, planted/lifted feet, hip support and cape sway. These drawings are not translated or duplicated standing frames.
- All eight frames keep the correct equipment physically held.
- No attack, recoil, muzzle flash, slash arc, projectile, magic cast or release effect appears in any locomotion frame.

Equipment and stance:

- Fire: one compact normal black-and-pink rifle, supported by both hands.
- Dual: exactly two compact pistols, one in each hand, in split-height carry.
- Throw: green lotus bottle held at chest/waist in a relaxed carry, with the other hand free. No cocked throwing posture or released bottle.
- Cannon: large jade/gold/pink heavy cannon, carried in a firm two-handed braced stance. Plain cyan bore, no firing light.
- Sword: continuously held physical silver broadsword in a calm diagonal guard. No disc, gun or swinging effect.

## Geometry and packing

- Fixed runtime body-root / ground anchor: `(192,240)` in every cell, within 0.51 pixel mapping-rounding error.
- Ground-contact baseline is aligned to 240 while lifted hooves remain above it.
- The horizontal anchor is registered to the same face/body root across the sequence. It is deliberately **not** recentered on whichever single hoof happens to be planted, which would introduce lateral body snapping during the walk.
- One uniform normalization scale per family, shared by all eight poses, restores approximately 225-pixel median head-to-hoof height.
- No individual pose stretching or bounding-box size fitting.
- All equipment, cape and hooves are fully inside their cells; all 40 cell borders are transparent.

Mechanical extraction uses connected silhouettes and antialiasing margins, premultiplied-alpha Lanczos uniform downsampling, stable root/ground registration, near-invisible alpha residue cleanup, transparent-RGB zeroing and PNG packing. Downsampling is resampling; the final PNG encoding is lossless. No character, weapon, knee, hoof or cloth artwork was painted in code.

## Built-in image generation provenance

Ready-frame reference crops came from the actual current `player-cape-{fire,dual,throw,cannon,sword}.png` assets and are saved as `scratch/cape-locomotion/reference-<family>.png`.

All five initial sheets were generated with built-in `image_gen`, explicitly requesting four non-attacking idle drawings and four genuine walk drawings. Targeted imagegen corrections shortened overlong rifle, far-pistol and cannon barrels and corrected a left cape margin, preserving faces/body/leg/cloth poses and physical grips.

Exact full prompts: `scratch/cape-locomotion/prompts.json`.

Selected generated sources and shared per-family normalization factors:

- fire: `exec-246213eb-94df-48c0-8834-4b22b6862eee.png`, scale `0.56962`.
- dual: `exec-fd153b30-8324-48dd-8e49-4b2422126e99.png`, scale `0.57398`.
- throw: `exec-fa1f3df9-3985-450b-a6dd-860ada153af9.png`, scale `0.536353`.
- cannon: `exec-f92e9fed-18b6-4654-bd32-0609b52261af.png`, scale `0.647482`.
- sword: `exec-52f85770-6713-421d-b95a-057370d7d40e.png`, scale `0.556931`.

Selected source copies: `scratch/cape-locomotion/<family>-source.png`.

## Verification

- All five decode with Pillow, Sharp and native `@napi-rs/canvas` as RGBA 3072 × 256.
- Eight unique full-frame hashes per atlas; 40 unique generated drawings in total.
- All 40 outer cell borders have alpha zero.
- Every registered root/ground anchor maps within 0.51 pixel of `(192,240)`.
- Every per-family contact proof was visually inspected for correct held equipment, idle/walk differences, actual knee/hoof changes, cloth movement, no extra weapons and no attack effects.

Combined proof: `scratch/cape-locomotion/all-five-cape-locomotion-proof.png`.

Individual proofs: `scratch/cape-locomotion/<family>-contact-proof.png`.

Detailed sources, scales, root coordinates, final bounds, border checks and hashes: `scratch/cape-locomotion/<family>-validation.json`.

Mechanical packer: `scratch/cape-locomotion/pack.py`.

No gameplay code, animation timing or publishing was performed in this art task. All five image files are final.
