# Fitted dawn-petal halo layer

## Deliverable

- `asset/sprites/player-halo-layer.png`
- 1536 × 256, four 384 × 256 animation cells.
- True RGBA transparency; 8-bit sRGB, non-indexed, non-interlaced PNG.
- Draw each cell at the exact same full destination rectangle as the selected complete player sprite, **before** drawing the player. The pig's head, ears, and existing lotus naturally cover the back of the nimbus.
- This file contains only the halo. There is no pig, body, weapon, ground, rectangular glow, or filled center.
- Retains the existing foot anchor `(192, 240)` through shared cell alignment.

## Fit and motion

The original ornate inventory-frame concept was redrawn as a slender, hand-painted gold nimbus with five small pink petals. The fitted nimbus is close to the head, with a plain upper-left arc so it does not compete with the existing lotus flower.

The generated halo is packed at 188 × 142 pixels. Cell-local top-left positions follow the slight head/recoil movement:

| Frame | Position | Visible alpha bounds, inclusive |
| --- | --- | --- |
| Ready | `(91, 3)` | `(92, 3)`–`(277, 144)` |
| Fire | `(90, 3)` | `(91, 3)`–`(276, 144)` |
| Recoil | `(92, 1)` | `(93, 1)`–`(278, 142)` |
| Recover | `(91, 3)` | `(92, 3)`–`(277, 144)` |

All four cells use the same generated painted nimbus, with small positional changes rather than invented decorative animation. This keeps the ornament stable while the head moves.

## Creation

Created using the built-in image-generation tool with genuine transparency. The original `player-fire.png`, new `player-lotus-fire.png`, and `dawn_petal_halo.png` were inspected and supplied as references. The first pass established the matching paint treatment; a targeted second pass made the ring taller, slimmer, and less ornate.

Final refinement prompt:

> Edit this exact hand-painted gold and pink-petal ring into a nearly circular head nimbus: its overall outside width should be only 1.25 times its height, so much taller and less horizontally flattened than it currently is. Preserve the warm gold and pink illustrated material and quality. Make the rim much slimmer and remove all large acanthus scrolls, keep only 5 delicate small petals total, each no larger than 8 percent of the ring's total diameter. Keep the top-left section especially plain and thin because the character's existing lotus flower will sit in front of it. Single standalone complete closed head halo, no character, no text, no large flowers, no dangling pendants. A clean completely empty transparent center and exterior, no glowing cloud, no ground or background. Render centered with transparent margin and all ring edges fully inside canvas. This will be used at about 185 pixels wide and 145 pixels tall behind a cute pig's head, so keep an elegant readable slim gold silhouette.

Production processing used Sharp only to crop the generated transparent margin, resize, pack the four cells, and normalize the PNG. No code-drawn geometry or inventory-icon overlay was substituted for the new artwork.

## Verification

- Visually checked full-size composites behind both original and legendary-weapon player sheets, all four frames.
- The large head lotus and ears remain unobstructed because they render in front.
- Verified native `@napi-rs/canvas` `Image.src` loading, awaited `Image.decode()`, and rendered all four cells successfully.
- Each cell has 4,818 visibly nontransparent pixels at alpha > 1.
- The center opening is fully transparent; sampled center alpha is zero in every frame.
- No code or other workers' assets were changed.
