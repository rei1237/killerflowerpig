# Cape technology-specific motion atlases

## Final deliverables

Five standard 8-bit RGBA PNG atlases, each **3072 × 256**, eight **384 × 256** cells in one row:

- `asset/sprites/player-cape-dual.png`
- `asset/sprites/player-cape-throw.png`
- `asset/sprites/player-cape-cannon.png`
- `asset/sprites/player-cape-blade.png`
- `asset/sprites/player-cape-channel.png`

All are complete fitted-cape flowerpig drawings. They retain the canonical pink face/body, forehead lotus, glossy brown eyes, purple scarf, brown hooves, curled tail, gold-trimmed purple cape, lavender lining, gold lotus embroidery and shoulder clasp. Equipment is naturally gripped or released by the actual hands. There is no inventory-icon overlay, remaining rifle, or unchanged rifle-holding pose in the non-gun families.

No gameplay code, renderer code, projectile spawning, publishing, or animation timing was changed in this art task.

## Eight-frame action contract

Frame 0 is anticipatory ready with the relevant prop. Frame 1 is the immediate shot/release/cast. Frames 2–7 are genuine independently drawn follow-through and recovery poses with delayed cape motion. These are not translated, duplicated, mirrored or synthetically warped copies of one sprite.

### Dual pistols

Two compact single-barrel black-and-pink pistols, one in each hand, with split-height aim. Frame 1 has two small muzzle flashes attached to the two physical guns. Alternating forearm recoil, a wink at peak, shoulder settling, and a leftward cape wave follow. Exactly two guns and two arms, with no orphan third barrel. Recoil and recovery frames have no firing flash.

### Bottle/grenade throw

Frame 0 holds a small green lotus-sealed bottle in a cocked throwing hand. Frame 1 shows the released empty hand extending outward. The arm continues its forward/downward arc, torso settles and the cape follows through. Frames 1–7 contain no bottle or detached flight streak. The engine renders the actual released projectile separately.

### Heavy lotus cannon

A visibly large jade/gold cannon with a broad cyan bore and petal housing is held in a firm integrated two-hand grip. The pose braces, the elbows bend strongly, the cannon recoils upward and the cloth follows the body. Frame 1 has a bright cyan-white firing light **inside the bore**, with no long external flash or duplicate projectile. The cannon is visibly distinct from the compact legendary blaster.

### Circular saw/disc release

Frame 0 directly holds a circular toothed silver/jade/gold disc with a lotus center. Frame 1 is an empty-handed sidearm release, followed by an upward sweep, cross-body/downward follow-through and empty-handed recovery. Frames 1–7 have no disc, detached projectile, flight streak or residual black rifle grip. The game draws the projectile separately.

### Open-hand lotus channel/cast

The character has no weapon or physical object. Frame 0 gathers a small light between open palms; frame 1 extends the palms for a brief nearby lotus/petal cast aura; frame 2 has two tiny fading petals. All later frames are empty open-hand gesture recovery. The cape has its own delayed wave. All frames have exactly two connected arms; the initial extra recovery arm was corrected with imagegen. Residual black grip/tie artifacts were also removed.

## Geometry and normalization

- Cell size: `(384,256)`.
- Fixed foot-center: `(192,240)`, within 0.51 pixel rounding in the measured source-to-cell map.
- Existing runtime scale: `0.24`.
- Canonical body size: approximately 225 pixels median head-to-hoof height in each family.
- A single uniform scale is used for all eight frames within a family; no individual pose is stretched or scaled to its bounding box.
- Cannon source characters were generated smaller than the other source sheets, so their family has a larger uniform normalization factor to restore the same character body size.
- Emission/release timing is frame 1. Detached throw/disc projectiles are deliberately absent from the atlas to avoid duplicating the renderer's projectile.

Mechanical processing only: connected-component extraction, an eight-source-pixel antialiasing margin, assignment of isolated generated aura pixels to the correct frame, premultiplied-alpha Lanczos uniform downsampling, foot alignment, alpha ≤ 8 residue cleanup, transparent-RGB zeroing and lossless PNG encoding. Downsampling is a resampling step; only the final PNG encoding is lossless. No character, prop, limb or cloth pixels were painted in code.

## Generation and correction provenance

All artwork used the built-in `image_gen` tool with actual new cape sprites as references:

1. `asset/sprites/player-cape-fire.png`
2. `scratch/cape-eight-frame/normal-final-source.png`

Initial per-family prompts requested the eight distinct phases, physical grip/release, natural cape secondary motion, same canonical identity and true transparency. Targeted imagegen corrections removed an extra dual barrel, a channel extra arm, residual grips, and detached throw/disc projectiles. Cannon corrections compacted its flash and restored clean alpha.

Exact prompt history, including the initial family prompts and the selected final correction prompts, is recorded in `scratch/cape-tech-motion/prompts.json`. Selected sources are copied to `scratch/cape-tech-motion/<family>-source.png`.

Selected generation filenames and normalization factors:

- dual: `exec-84480f78-5760-4ff7-b7ae-7e049a29c608.png`, uniform scale `0.705329`.
- throw: `exec-a7d55afb-20a4-4e20-a42f-161694604b00.png`, uniform scale `0.709779`.
- cannon: `exec-0c490810-e8cb-408d-9cf9-72d8151e0829.png`, uniform scale `0.847458`.
- blade: `exec-86fb1ba7-ce7d-45da-b25b-c9f98e66d2dd.png`, uniform scale `0.703125`.
- channel: `exec-72a8601e-d7c5-4082-bc5d-9bba5305f6b0.png`, uniform scale `0.696594`.

## Verification and proofs

- All five final atlases decode with Pillow, Sharp and native `@napi-rs/canvas`.
- Native image dimensions are 3072 × 256 for every atlas.
- All 40 cells have fully transparent outer borders.
- Each family has eight distinct full-frame pixel hashes.
- All five contact sheets were visually inspected, including two-handed weapon grips, empty post-release hands, cape motion, feet, complete silhouettes and the absence of detached projectiles.
- Cannon background haze is resolved in the delivered RGBA atlas.
- All files are final; no further art corrections are pending.

Per-family proofs: `scratch/cape-tech-motion/<family>-contact-proof.png`.

Combined proof: `scratch/cape-tech-motion/all-five-cape-tech-contact-proof.png`.

Empty release hands proof: `scratch/cape-tech-motion/throw-blade-final-proof.png`.

Detailed source bounds, foot anchors, scale factors, final bounds, transparent-border checks and distinct hashes: `scratch/cape-tech-motion/<family>-validation.json`.

Reproducible mechanical packer: `scratch/cape-tech-motion/pack.py` and `sources.json`.
