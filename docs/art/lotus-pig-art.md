# Legendary lotus-gun flowerpig

## Delivered assets

- `asset/sprites/player-lotus-fire.png`: 1536 × 256 RGBA PNG, four 384 × 256 cells in `ready`, `fire`, `recoil`, `recover` order.
- `asset/sprites/player-lotus-portrait.png`: 640 × 640 RGBA PNG, the complete ready-pose character for a standalone download or inventory portrait.
- Both are original generated raster artwork. The normal gun atlas and all application code were left unchanged by this art task.

## Visual contract

The character keeps the official pink skin, large round head, glossy brown eyes, snout, blush, single head lotus, purple scarf, curly tail, small bare torso and brown hoof tips. It holds a compact version of the existing jade/pink/gold legendary lotus gun with two visible hands. The fire cell includes its own pink/gold lotus flash.

The four poses are intentionally restrained. The fire frame moves the gun rearward slightly, the recoil frame winks, and the recover frame returns to the ready pose. Feet remain stable; this is a firing sheet rather than a walking sheet.

- Cell size: `384 × 256`
- Foot anchor: `(192, 240)`
- Existing runtime scale: `0.24`
- Ready, recoil and recover outer muzzle: approximately `(312, 148)`
- Fire: muzzle shifts rearward approximately 14 px as the lotus flare opens; the existing `(312, 148)` emission point falls within that flare.
- Alpha > 16 bounds:
  - Ready: `[94, 10, 312, 240]`
  - Fire, including flare: `[94, 10, 362, 240]`
  - Recoil: `[94, 9, 312, 240]`
  - Recover: `[94, 10, 312, 240]`
- Solid hoof region center: x192 for the first three frames and x191.5 for recover.
- All outer atlas and portrait border pixels have alpha 0.

## Source and generation

Created with the built-in image-generation tool, not an SVG or programmatic drawing substitute. References were:

1. The existing `asset/sprites/player-fire.png` animation.
2. The existing `asset/items/lotus-gun.png` legendary weapon.
3. The latest official character profile sheet.

Initial generation specification:

> Produce a transparent 1536 × 1024 two-by-two sheet of four full-body sprites: ready, fire, recoil, recover. Preserve the official pink pig identity, pink head lotus, purple scarf and body proportions. Replace the modern gun with the reference mint-jade, pink-lotus, gold-trimmed gun. Keep a correct two-handed grip, identical camera/scale/lighting, stable feet and clean isolated transparent silhouettes. The fire frame has a concentrated pink/gold magical lotus muzzle flare. No labels, dividers, ground plane or background.

Final targeted edit prompt:

> Use case: precise-object-edit. This is a 1536×1024 game sprite sheet in a 2×2 grid. Make one small production correction only: make the legendary lotus gun more compact. Preserve the pig character, face, head lotus, scarf, pose, hands, proportions, position, scale, pink/gold/jade material style, animation expression, feet, and every other detail exactly as in the input image. Shorten only the horizontal barrel section between the pig's supporting forward hand and the decorative muzzle, bringing the entire pink lotus muzzle assembly closer to the hand by approximately 65 pixels within each 768-wide cell. Preserve all beautiful lotus petals, gold rims, bright turquoise muzzle opening and detail, just compact the gun so it is a small chibi hand cannon instead of a long rifle. Both hands remain correctly holding it, rear hand on grip, front hand beneath jade barrel. The gun muzzle should end near x580 inside each cell, rather than x645. Shorten all four gun frames consistently including the recoil pose. Bring the muzzle flash in the fire frame inward with the muzzle. Keep the character and its feet unchanged in all four cells. Keep the exact 2×2 grid and genuine transparent alpha background. Remove all atmospheric background glow and haze: transparency should be completely clear outside the crisp character and immediate muzzle flare. No ground shadow, no background color, no lettering.

## Reusable packing procedure

Generation was a 1536 × 1024 source divided into four 768 × 512 cells. Generated cells were not assumed to have identical margins: each was measured and individually foot-anchored.

The following crop rectangles are relative to their source cell. The source-cell origins are `(0,0)`, `(768,0)`, `(0,512)`, `(768,512)`.

| Frame | Crop x,y,w,h | Source foot x,y |
| --- | --- | --- |
| ready | 138,16,454,479 | 343,485 |
| fire | 75,17,555,478 | 279,485 |
| recoil | 139,11,453,478 | 343,480 |
| recover | 75,11,453,478 | 279,480 |

For each frame:

1. Read the generated RGBA source with `sharp`.
2. Crop the measured character/flare region, including an 8 px safety margin.
3. Create a transparent `768 × 512` normalization canvas.
4. Composite the crop at:
   - `left = 384 - sourceFootX + cropX`
   - `top = 480 - sourceFootY + cropY`
5. Resize that normalization canvas to `384 × 256` with Lanczos3.
6. Pack the frames horizontally without gaps in a transparent `1536 × 256` atlas.
7. Encode losslessly as ordinary 8-bit RGBA PNG with no inherited generation metadata. Zero RGB only where alpha is already zero; do not threshold away visible edges or muzzle glow.

The portrait uses the original-resolution ready crop on a transparent `640 × 640` canvas at `(93,80)`.

For new outfit sheets, repeat the measurements on each newly generated source rather than blindly copying these source coordinates. The destination contract remains unchanged. If using the final atlas as an image-generation reference, keep all four character bodies, faces, lotus flowers, gun silhouettes and anchors fixed, and alter only the requested worn outfit.

## Verification

- `sharp` decodes both delivered files.
- `@napi-rs/canvas` synchronous `new Image().src = buffer` decodes both delivered files and reports their expected dimensions.
- A native-canvas contact sheet was rendered over dark navy and pale backgrounds and at runtime scale 0.24.
- No colored rectangle or broad haze appears on either background. The source preview's apparent background glow was invisible RGB under alpha 0.
- Ready/recover muzzle and foot alignment were inspected with `(312,148)` and `(192,240)` guide marks.
- Every outer border alpha is 0. The character is not clipped; only the fire frame extends farther right for its intentional muzzle flare.
