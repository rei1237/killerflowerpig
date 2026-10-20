# Base flowerpig: eight-frame firing art

## Deliverables

- `asset/sprites/player-fire.png`: 3072 × 256 RGBA, eight 384 × 256 cells.
- `asset/sprites/player-lotus-fire.png`: same layout and anchor.
- Native-size inspection sheet: `tmp/base-eight-frame/base-eight-frame-native-contact.png` (1536 × 1120, no enlarged sprite pixels).
- Individual native frames: `tmp/base-eight-frame/{normal,lotus}-frame-{0..7}.png`.
- Animation previews: `tmp/base-eight-frame/{normal,lotus}-cycle.gif`.
- Reproducible normalization: `tmp/base-eight-frame/normalize.py`.
- Source registration and all 16 unique pixel hashes: `tmp/base-eight-frame/validation.json`.

## Contract

Cells are ordered ready, immediate shot, recoil onset, peak recoil, settle, return, secondary cloth motion, ready settle. Frame 1 is the actual shot and contains the single compact muzzle flash. Frames 2–4 visibly change elbow bend, weapon angle, torso/head lean, knees, and scarf. Frames 5–7 return the arms/body while the scarf follows through. These are separately generated poses, not duplicated or translated copies.

Foot-center anchor is `(192,240)` in every cell, with ordinary subpixel/resampling rounding of one pixel at the opaque edge. All source frames within each atlas use one fixed horizontal and vertical scale, never per-frame bounding-box rescaling. The original standing silhouette is preserved at roughly 227–236 px high. Facing remains right; left-facing runtime rendering mirrors about the same anchor.

The frame-1 flash core/muzzle rim overlaps the runtime `(312,148)` origin. Visual muzzle centers land approximately `(312,149)` for normal and `(312,149–150)` for lotus; the luminous rim/flash covers the fixed origin. Both muzzle flashes fit the cells with their substantive alpha ending at x377, leaving a six-pixel right gutter. All substantive body pixels fit inside the cells, including lotus peak-recoil scarf. The flash is generated artwork; no synthetic flash or code-drawn replacement is used.

Playback intent: start immediately at frame 1, continue frames 2–7 and return to 0 over 0.20 s total. Suggested frame-1–7 durations: 25, 25, 30, 30, 30, 30, 30 ms. PNGs contain no timing metadata. The preview GIF adds a ready hold for inspection; its quantized GIF timing is only a preview.

## Artwork source and method

Built-in `image_gen` was used, with actual existing complete sprites and `asset/items/lotus-gun.png` supplied as image references. The normal weapon remains a charcoal rifle with magenta inset; the legendary weapon retains jade body, gold ornament, pink petal forms and cyan muzzle. The pink pig face, head lotus, purple scarf, curly tail and brown hooves remain visible. No costume is included in these two base variants.

Selected normal generated output: `exec-1258ae5c-047c-4a18-b824-ef36edafe173.png`, copied to `tmp/base-eight-frame/normal-final-source.png`.

Selected lotus generated output: `exec-630e6e0d-c987-481b-99c4-cd7f2088ceb7.png`, copied to `tmp/base-eight-frame/lotus-final-source.png`.

Normalization only crops the generated 4×2 sheets, uses a single fixed resampling transform per atlas, mechanically aligns the soles, and assembles the eight cells into a lossless PNG. No arm, face, cloth, weapon or pose was painted, reconstructed, translated from another frame, or otherwise invented in code. Generated alpha was retained.

## Prompt set

Initial normal generation: preserve the reference pink flowerpig with normal charcoal/magenta rifle, lotus head flower, purple scarf, tail and hooves; generate exactly eight full-body right-facing poses in a four-column/two-row transparent sheet. Request ready, immediate shot, recoil onset, peak recoil, settle, return, cloth follow-through, ready settle; require real arm/body/cloth changes, one flash only in frame 1 and a fast 0.20-second action.

Normal registration refinement: make the rifle six percent shorter and move it nine source pixels down while retaining all eight body poses, the upward recoil angles, natural supporting hand positions and the single frame-1 flash.

Lotus generation: replace the ordinary gun with the actual jade/gold/pink/cyan legendary lotus weapon; preserve the complete eight-pose pig and scarf animation. Refine the weapon to the compact reference proportion. Restore explicit 15-degree recoil onset, 25-degree peak recoil, bent arms, backward body lean and forward settling without flattening the weapon angles. Final targeted refinement: shrink only the top-row second sprite's magical muzzle bloom, retaining the same muzzle and every other pose, to leave transparent cell margin.

## Validation

- Visually inspected source sheets, native-size outputs and dark/light-background contact sheets.
- All 16 cells have unique pixel hashes.
- All cells use 384 × 256 native dimensions; both atlases are 3072 × 256 RGBA.
- Body, arm and scarf deformation is visibly distinct, particularly frames 2–4 and frame 6.
- No code or other costume sprites were edited by this work.
