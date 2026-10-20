# Fitted lotus cape character atlases

## Deliverables

- `asset/sprites/player-cape-fire.png`: complete pig wearing the fitted purple lotus cape and holding the normal black-and-pink gun.
- `asset/sprites/player-cape-lotus-fire.png`: the same fitted costume with the legendary jade, gold and pink lotus gun.

Both files are transparent, ordinary 8-bit RGBA PNGs, 1536 × 256 pixels. Each has four 384 × 256 cells in **ready, fire, recoil, recover** order. They are complete character illustrations, not accessory overlays.

The cloak is secured with a gold lotus-and-purple-jewel shoulder clasp below the existing scarf. Purple cloth wraps the back and near side, falls behind the torso, and trails left. The head, scarf, arms, gun and body correctly cover the cloth. The curled tail emerges naturally outside its side opening. Gold lotus embroidery, a golden hem and lavender lining follow the fabric folds. Pink belly and hooves remain visible.

## Runtime contract

- Cell size: 384 × 256.
- Foot anchor: `(192, 240)`, with normal subpixel/antialiasing variation.
- Runtime scale: `0.24`, unchanged.
- Shared gameplay muzzle anchor: `(312, 148)`, unchanged.
- Ready muzzle artwork is approximately `(311, 148)` for the regular gun and `(308, 148)` for the lotus gun. The latter is less than one runtime pixel from the shared emission point.
- Recoil intentionally lifts the muzzle. Firing includes its own short muzzle flash.
- Head-to-hoof size and body proportions match the existing character closely. The cloak adds a silhouette behind the body, without changing its collision or gameplay geometry.

Final alpha > 16 bounds, relative to each 384 × 256 cell:

| Variant | Ready | Fire | Recoil | Recover |
| --- | --- | --- | --- | --- |
| Regular gun | `[67,9,311,241]` | `[68,9,349,241]` | `[65,9,315,241]` | `[69,9,307,241]` |
| Lotus gun | `[68,7,308,240]` | `[68,8,355,240]` | `[66,7,307,241]` | `[71,8,311,240]` |

## Artwork sources

Created with the built-in image-generation tool. No costume pixels were painted in code.

Reference inputs:

1. `asset/sprites/player-fire.png`: normal weapon and canonical firing poses.
2. `asset/sprites/player-lotus-fire.png`: complete legendary-weapon character and runtime proportions.
3. `asset/sprites/player-lotus-portrait.png`: clean character and weapon detail.
4. `asset/cosmetics/dusk_lotus_cape.png`: purple cloth, gold lotus embroidery, lavender lining and clasp design.

Initial generated 1536 × 1024 source:

`/workspace/scratch/fe0829da0b21/generated_images/exec-9ddc0aeb-a87b-4551-b6ff-f04e5a256c28.png`

Final corrected 1536 × 1024 source, used for both delivered atlases:

`/workspace/scratch/fe0829da0b21/generated_images/exec-72bd8970-d292-4503-9fa8-8ce11236d1e8.png`

### Initial generation prompt

Use case: identity-preserve. Asset type: production game character sprite animation sheet, transparent background. Redraw the SAME adorable pink pig character from references as a complete integrated costumed character, wearing the purple-and-gold lotus cloak in reference 4, naturally tailored and secured at its shoulders beneath its existing purple scarf. Exactly EIGHT full-body sprites in an evenly spaced FOUR-column TWO-row grid, isolated on actual transparency, no text, labels or borders. The TOP ROW is the reference 1 black-and-pink science-fiction gun version. The BOTTOM ROW is the reference 2 and 3 ornate jade-green/gold/pink-lotus blaster version. Four poses each row, left-to-right: 1 ready aim right, 2 firing a small bright muzzle flash right, 3 recoil with one eye closed and gun tilted very slightly upward, 4 recovered ready aim right. Every pig keeps the canonical face, glossy brown eyes, tiny pink snout, large pink lotus on its upper-left forehead, floppy ears, purple neck scarf with bow tails behind the neck, round pink body, stubby legs, brown hooves, curled pink tail, two little hands holding its gun naturally. EXACTLY the same body size, head and face identity, and cloak design in both rows. Very important: this is a new fitted cloak drawn ON the body, never an unattached cape icon floating beside the pig. Collar folds originate at both shoulders behind the scarf. Small gold lotus-and-purple jewel clasp lies just below the scarf at the near shoulder. Purple cloth hugs the back and partly wraps its left side, naturally occluded by the head, scarf, nearer arm, gun, and body. Cape hangs behind the body down toward hoof height, and flows a short distance to the LEFT of its back. The trailing hem is bounded close behind the pig, not long. Lavender lining, broad golden hem, one elegant golden lotus embroidery motif near its lower back, a few gold tendrils. Keep the pink belly and both feet clear and visible; curled tail peeks naturally outside a small opening in cape side. All equipment obeys real overlap and weight. Preserve the reference weapons exactly and in the hands, gun muzzle aligned at approximately belly-top/forearm height, pointing horizontally right except tiny recoil. Match clean glossy polished hand-painted 2D fantasy game art from reference 3 with crisp edges and soft rich shading. Eight independent silhouettes with wide clear gutters; no sprite or muzzle flash touches another cell. Feet baseline and head height exactly consistent across all eight. Use a 1536x1024 landscape canvas with 4 equal columns and 2 equal rows; each pig centered and completely visible in its own cell with generous transparent margins. No floor, shadow, ground, opaque background, watermark, invented objects, extra limbs, white outline or copied flat accessory overlay.

### Final targeted correction prompt

Use case: precise-object-edit. Edit FIRST IMAGE only, the 1536x1024 eight-pig cape sprite sheet in a 4-column 2-row grid. This is a SMALL final alignment correction. Preserve every pig face, head flower, cloak, scarf, embroidery, tail, pink body, feet position, body height, cell layout, shading and the beautiful natural cloak exactly unchanged. Keep all eight sprites exactly in place. Make only these weapon-position corrections: (1) TOP ROW black sci-fi rifles: shorten ONLY the front barrel extending to the right of the forward supporting hand by approximately 29 image pixels, bringing the muzzle 29 pixels LEFT. Keep hand positions horizontally unchanged, gun recognizable, exact same design and styling. In top-row columns 1 and 4, muzzle should end near x358 and x1497 respectively instead of x387 and x1526. Similarly shorten top-row fire and recoil gun in place, move flash left with it. (2) BOTH ROWS: lower each entire held gun and BOTH supporting hands and forearms together by exactly 12 image pixels, keeping the same elbows and natural bent-arm two-handed grip. This places top-row ready muzzle around y342 and bottom-row ready lotus muzzle around y766. The pig heads, torso, hips, legs, feet, cloak and scarf stay at exactly the existing positions and scale. The correct compact lotus gun from image3 is already right in length; do NOT shorten bottom-row guns. Retain the firing flash on column2 and small upward recoil on column3. This is a weapon alignment edit only, NOT a character redesign. Preserve the eight independent silhouettes on a genuinely transparent background, crisp alpha edges, no ground or shadow, no text, no colored background, and no atmospheric haze.

## Mechanical extraction and packing

The generation contains eight disconnected character silhouettes. Individual silhouette bounds were measured from alpha, rather than assuming the generation obeyed exact cell boundaries. This avoids clipping the top-row fire flash or retaining a neighboring cape at a cell edge.

1. Find the eight large connected components at alpha ≥ 16.
2. Preserve each component's original pixels and its eight-pixel low-alpha antialiasing/glow margin. Assign any shared margin to the nearest silhouette. This is extraction only; no new character or costume pixels are drawn.
3. Crop each component with the eight-pixel safety margin.
4. Resize each crop uniformly at approximately `0.70` using Lanczos3.
5. Place the crop on a transparent 384 × 256 cell with the measured foot centered on `(192,240)`.
6. Pack each row into its own 1536 × 256 atlas.
7. Re-encode losslessly with `sharp`, without generation metadata, and zero RGB where alpha is already zero.

Source crop coordinates and measured foot coordinates are in the full 1536 × 1024 source:

| Frame | Crop x,y,w,h | Source foot x,y |
| --- | --- | --- |
| Regular ready | `4,137,365,348` | `188,475` |
| Regular fire | `373,138,417,347` | `558,475` |
| Regular recoil | `766,137,374,348` | `956,475` |
| Regular recover | `1146,138,358,347` | `1330,475` |
| Lotus ready | `3,559,359,350` | `187,899` |
| Lotus fire | `374,559,426,350` | `558,899` |
| Lotus recoil | `767,559,361,350` | `954,899` |
| Lotus recover | `1148,560,362,349` | `1330,899` |

## Verification

- Both final files successfully decode with `sharp`.
- Both final files successfully decode synchronously through native `@napi-rs/canvas` using `new Image().src = buffer`, each reporting 1536 × 256.
- Every outside border of all eight cells has alpha 0.
- The generated source's colored atmospheric preview is hidden RGB under transparent alpha; it is not an opaque background in the delivered files.
- All eight poses were viewed composited on dark navy and pale backgrounds, both enlarged and at runtime scale 0.24.
- Cloak embroidery remains legible at normal game scale, the clasp is attached below the scarf, and the visible belly, tail and hooves preserve the pig silhouette.
- The shared muzzle anchor and gameplay scale require no variant-specific change.
