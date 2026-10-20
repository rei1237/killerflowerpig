# Fitted jade lotus ceremonial costume

## Delivered game assets

- `asset/sprites/player-jade-fire.png`: complete pig, naturally worn jade outfit, normal compact rifle.
- `asset/sprites/player-jade-lotus-fire.png`: same outfit and complete pig, compact legendary lotus gun.

Both files are ordinary lossless 8-bit RGBA PNGs, 1536 × 256. Four 384 × 256 cells are ordered **ready, fire, recoil, recover**. Each pose is generated character art, including the torso, shoulders, hands, weapon and garment. The costume is not an accessory pasted over a bare-pig sprite.

## Fit and identity

The pale-jade cuirass curves around the chubby torso. Gold-trimmed pink lotus shoulder petals sit on the shoulder, the nearer forearm and gun occlude the chest, and the purple scarf emerges behind the shoulder. The garment continues around the side and ends at the hips. Bare short pink legs, brown hoof tips and curly tail remain visible. Face, head lotus, scarf, proportions, warm outlines and polished game-art style follow the canonical flower-pig reference.

The firing and recovering poses have distinct arm/gun positions. The recoil pose raises the gun and winks. The costume follows every pose rather than remaining a static overlay.

## Placement contract

- Runtime scale: 0.24.
- Foot-center anchor: `(192, 240)` in every cell, rounded to the nearest source-raster placement pixel. Faint hoof antialiasing can extend to y241.
- One uniform source scale is used across all four frames of each sheet: 0.50 for the normal-gun sheet and 0.48 for the legendary-gun sheet. This keeps the normal character approximately 232 px tall and the legendary character approximately 230 px tall. There is no per-frame bounding-box scaling.
- Ready/recover normal-rifle muzzle: approximately `(313, 144)`.
- Ready legendary-gun outer muzzle: approximately `(306, 145)`; recovering muzzle: approximately `(310, 142)`.
- These are measured visual approximations, not exact gameplay emission anchors. The unchanged runtime point `(312, 148)` differs by less than two rendered game pixels at scale 0.24. The fire point lies within each muzzle flash.
- Recoil raises the muzzle naturally, like the original firing atlas. Do not add per-costume gameplay offsets.
- Outer atlas border pixels have alpha 0. All character bodies and muzzle flashes fit inside their cells.

Alpha > 16 cell bounds, `[left, top, right, bottom]`:

| Frame | Normal gun | Legendary gun |
| --- | --- | --- |
| Ready | 85, 8, 314, 241 | 89, 10, 306, 241 |
| Fire | 84, 8, 360, 241 | 87, 11, 361, 241 |
| Recoil | 66, 12, 300, 240 | 69, 14, 299, 241 |
| Recover | 84, 11, 314, 240 | 86, 14, 311, 240 |

## Generation references and prompts

Created with the built-in image-generation tool. Actual raster references were inspected before generation:

1. `asset/sprites/player-fire.png`, the canonical normal-gun firing atlas.
2. `asset/cosmetics/jade_lotus_guard.png`, the original costume item art, used as design reference only.
3. `asset/sprites/player-lotus-fire.png`, the final compact legendary-gun character atlas.
4. `/workspace/shared/flowerpig-reference-v3/profile.png`, the latest canonical character profile.

Initial costume prompt:

> Redraw the complete same pig in all four shooting poses wearing a naturally fitted miniature jade lotus ceremonial armor vest. The ivory-pale-jade cuirass curves around the rounded torso with gold piping, a small pink lotus inlay and layered pink-gold lotus-petal shoulder caps. The vest wraps around the sides beneath the arms, has real arm openings, and ends at the hip. Preserve the original face, single head lotus, purple scarf, curly tail, stocky silhouette, short legs, brown hooves and correct two-handed rifle grip. The near arm and gun naturally occlude the chest. No detached bib, flat belly badge or pasted apron. Four complete ready/fire/winking-recoil/recover poses in a transparent 1536 × 1024 two-by-two sheet.

Final normal-gun edit prompt:

> Compact the black/pink rifle by shortening only the barrel section between the supporting hand and muzzle by approximately 50 source pixels. Preserve the pig, fitted outfit, face, head flower, hands, scarf, feet and poses. Ready outer muzzle near x624,y308 in its source cell; fire near x568,y308 with flash moved inward; recover near x572,y294. Preserve the raised recoil pose. Genuine transparent background, no text or ambient haze.

Legendary-gun conversion prompt:

> Replace only the modern gun in all four poses with the compact mint-jade/pink/gold lotus hand cannon from the legendary reference. Preserve the fitted costume, complete pig, hands, identity, poses, body and foot positions. Keep the turquoise open round muzzle, short jade barrel, gold rims and pink lotus petals. Fire has a pink-and-gold lotus burst. Keep the same four-cell layout and genuine transparent alpha.

Final legendary-gun edit prompt:

> Make only the upper-right pink/gold muzzle flash more compact, reducing its horizontal width by roughly 35 percent, stopping no farther than x680 in that source cell. Keep the burst attached to the existing muzzle. Preserve all four complete characters, guns, costume, faces, scarves, hands, feet, size and positions. Genuine transparent alpha, no labels or background.

## Packing and validation

The generated 1536 × 1024 sources were split into four 768 × 512 cells. Each subject was measured, cropped with an 8 px safety margin, uniformly downsampled with Lanczos3 and independently translated so the measured solid-hoof center/baseline lands on `(192,240)`. The four cells were packed horizontally. RGB was zeroed only where alpha was already zero. PNG was reencoded through `sharp` without generation metadata.

Selected generated sources:

- Normal gun: `call_3e609090a6784b26932e120d6f040d92.png`.
- Legendary gun: `call_d6d2cfe1990d4965aadaf314d179c181.png`.

Validated with `sharp` and awaited `@napi-rs/canvas` `loadImage(buffer)`. Both decode to the expected dimensions. A native-canvas contact sheet was inspected on dark navy and pale backgrounds, including every pose at runtime scale 0.24. Silhouettes are clean, no broad haze or opaque rectangle is present, the worn vest reads at game size, and no pose is clipped.
