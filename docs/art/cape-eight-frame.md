# Eight-frame fitted cape firing atlases

## Delivered files

- `asset/sprites/player-cape-fire.png`
- `asset/sprites/player-cape-lotus-fire.png`

Both are **3072 × 256**, standard lossless 8-bit RGBA PNGs, with eight **384 × 256** cells in one row. Each cell is a complete integrated character illustration. No runtime code or gameplay constants were changed by this art task.

Frame order:

0. Ready aim, cloth resting
1. Immediate firing flash, both arms bracing
2. Recoil onset, gun/arms rising and cloth beginning to lift
3. Peak recoil, wink and greatest leftward cape flare
4. Settling, cloth wave still travelling through the hem
5. Return, elbows/shoulders relaxing and different cape S-curve
6. Cape followthrough, gun level with cloth bending inward
7. Ready settle, final relaxed fold

All sixteen cells are genuine distinct generated drawings. None was made by duplicating, translating, mirroring, or warping another animation frame. The cape has different drawn silhouettes and folds across recoil and recovery, with physically connected shoulder attachment and natural occlusion behind the head, scarf, arms, torso, and tail. Both hands remain integrated with their respective weapon.

## Runtime alignment

- Fixed foot anchor remains `(192, 240)` in every cell, with less than 0.51 pixel rounding error in source-to-cell mapping.
- Runtime scale remains `0.24`.
- Shared gameplay emission point remains `(312, 148)`.
- Normal firing barrel artwork is approximately `(311, 149)`.
- Lotus firing cyan muzzle artwork is approximately `(298, 148)`; its attached petal flash covers the fixed emission point, so the projectile begins within the flash. The body was not stretched to force an exact muzzle location.
- Recoil muzzle art rises naturally. It does not require changing the gameplay emission point.
- Head-to-hoof height is approximately 225–232 pixels, close to the previous 232-pixel cape character. The eight-frame sequence keeps the same upright canonical head, pink lotus, face, purple scarf, and planted hooves.

## Generation provenance

Built-in `image_gen` was used for all character/cape/weapon artwork. The actual previous `player-cape-fire.png` and `player-cape-lotus-fire.png` assets were inspected and passed as image references. No costume, arm, grip, weapon, or animation artwork was painted in code.

Selected generated sources, copied into task staging:

- Normal: `scratch/cape-eight-frame/normal-final-source.png`, from `exec-066dca43-12df-458b-8af8-062f6a6f96c6.png`.
- Lotus: `scratch/cape-eight-frame/lotus-final-source.png`, from `exec-14ba27a2-0095-47bb-9812-5c08f36aafec.png`.

The initial normal generation expanded the existing four-frame normal cape atlas into the eight phases above, retaining the pink canonical face, lotus head flower, purple scarf, fitted gold-edged purple cape, lavender lining, tail, and two-handed black-and-pink rifle grip. A subsequent weapon-only edit lowered the normal guns and attached hands seven source pixels and extended the front barrels eleven source pixels to align the immediate firing flash. The final normal edit fixed the last muzzle's safe canvas margin.

### Final normal prompt

Use case: precise-object-edit. Fix only the rightmost gun in the BOTTOM row (frame7) of this exact eight-character transparent atlas. Its barrel is too long and almost touches the right image edge. SHORTEN ONLY the forward black rifle barrel to the right of its supporting hand by 20 source-image pixels, so the complete muzzle has at least20 pixels of transparent margin to the right canvas edge. Preserve that gun's hand positions and its current height. Preserve EVERY other pixel, every other frame, heads, faces, feet, body, cape, folds, scarf, positions and transparency exactly. No new layout or redesign. Canvas stays1536x1024. Do not modify top-row firing flash. Keep the natural eight-frame animation.

### Final lotus prompt

Use case: precise-object-edit. INPUT1 is the exact edit target: eight normal-gun pigs wearing fitted capes, arranged4columns2rows. INPUT2 is weapon design reference only: canonical ornate jade/gold/pink lotus blaster. In INPUT1 replace ONLY each black rifle with the legendary lotus blaster from INPUT2, and frame1 yellow flash with pink-white petal flash. Critical: retain EXACT INPUT1 muzzle-tip pixel position, vertical height, weapon angle and weapon length in each frame. The new lotus weapon must fit from the exact existing rear grip to exact existing front muzzle, keeping both hands where they are and naturally gripping it. The cyan muzzle circle sits at the same location as the existing black barrel tip. Do not move any character, head, face, flower, hand, arm, body, foot, scarf, cape, tail, gold clasp or embroidery. Do not reset cape motion: preserve peak flare and eight different natural cloth silhouettes from INPUT1. Do not enlarge or lengthen weapons beyond input1 bounds. Lotus gun is jade-green body with flowing gold scrolls, a little rear pink flower, large pink front lotus petals surrounding cyan muzzle; preserve compact silhouette and integrated two-handed grip. Eight frames remain in identical positions on exact1536x1024 canvas, all full sprites completely visible. Exact same character scale in all eight. True transparent background. No haze, ground, shadow, labels or added items. This is a weapon-only replacement; all pig and cape pixels should stay exactly as INPUT1.

The final output was measured rather than assuming every requested exact coordinate had been followed by generation. Actual muzzle alignment is disclosed above.

## Mechanical normalization

The packing script is `scratch/cape-eight-frame/pack.py`; measurements and hashes are in `scratch/cape-eight-frame/validation.json`.

1. Identify eight large disconnected silhouette components at alpha ≥ 16.
2. Retain original pixels in each component plus an eight-source-pixel antialiasing/glow margin; assign margins to the nearest component so neighbouring silhouettes cannot leak into a crop.
3. Uniformly downsample every frame of both variants by the same **0.72** scale using premultiplied-alpha Lanczos. There is no frame-specific size fitting or stretching.
4. Align each measured hoof-center to `(192, 240)` and paste into a transparent 384 × 256 cell.
5. Remove only near-invisible alpha ≤ 8 residue, zero hidden RGB where alpha is zero, and save as lossless RGBA PNG.
6. Pack the eight independently generated frames without duplicating frames.

The downsampling is explicitly a raster resampling step; the final PNG encoding is lossless. No claim is made that downsampling itself is lossless.

## Verification

- Both atlases decode with Pillow, Sharp, and native `@napi-rs/canvas`.
- Native decoded size is 3072 × 256 for both files.
- All sixteen cells have completely transparent outer borders.
- Eight distinct full-frame hashes per atlas.
- Each non-ready frame changes approximately 36–40% of all RGBA pixels relative to ready, with visually verified distinct arm/gun and cape drawings.
- Both normal and lotus variants were inspected together on dark and light backgrounds.
- Full contact proof: `scratch/cape-eight-frame/cape-eight-frame-contact-proof.png`. Cyan foot markers show `(192,240)`; the small cyan circle on each firing frame marks the fixed `(312,148)` emission point.

## Final bounds

The following are alpha ≥ 16 bounds `[left, top, right, bottom]`, relative to each 384 × 256 cell:

- normal: [68, 14, 316, 240], [69, 14, 381, 241], [60, 16, 326, 241], [45, 16, 307, 241], [56, 12, 329, 240], [66, 13, 333, 240], [70, 17, 328, 241], [80, 14, 317, 241]
- lotus: [67, 14, 309, 240], [69, 14, 359, 240], [59, 14, 303, 241], [44, 14, 296, 240], [56, 9, 309, 240], [64, 9, 312, 240], [66, 12, 308, 240], [77, 10, 316, 240]
