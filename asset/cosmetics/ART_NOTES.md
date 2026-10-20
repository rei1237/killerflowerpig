# Lotus Regalia artwork

Created 2026-10-20 with the built-in OpenAI image generation tool. These are original generated, genuinely transparent game-equipment cutouts, not CSS or vector placeholders.

## Canon and invariants

Visual references were the actual `asset/sprites/player-fire.png`, the previous `asset/items/lotus-gun.png`, the supplied Flowerpig reference sprite, and the supplied Yeoni profile sheet.

The pink pig, its existing pink lotus blossom, purple scarf, expressions, proportions, and animation are unchanged. The new images contain equipment only. Their glossy pastel rendering, rose-brown outlines, jade, pink petal, purple silk, and warm gold palette match the established character.

## Files and integration

| File | Native pixels | Suggested source rectangle (x,y,width,height) |
| --- | --- | --- |
| `../items/lotus-gun.png` | 2172 × 724 | 105, 7, 1888, 710 |
| `dusk_lotus_cape.png` | 1561 × 1007 | 60, 106, 1439, 804 |
| `jade_lotus_guard.png` | 1610 × 977 | 121, 96, 1377, 826 |
| `dawn_petal_halo.png` | 1397 × 1126 | 51, 89, 1316, 904 |

The source rectangles bound visible pixels with alpha greater than 16, excluding almost invisible generation-edge flecks. All original alpha is preserved in the files. Runtime should downsample only when loading/drawing, retaining these originals for future display sizes.

Matching `dusk_lotus_cape-icon.png`, `jade_lotus_guard-icon.png`, and `dawn_petal_halo-icon.png` files are exact copies for the inventory catalog. Display with `object-fit: contain`; decorative inventory frames belong in UI, not in the artwork.

Runtime-validated placement within the existing 384 × 256 animation frame:

- Cape: back layer, x45 y128, 180 × 107. Its clasp is at upper right and its embroidered hem flows left.
- Armor: front layer, x140 y174, 108 × 61. Keep below the arms and snout.
- Halo: back layer, x90 y-2, 190 × 145. Its empty middle lets the original head remain unobstructed.
- Gun: front layer, x182 y119, 148 × 55. Apply the existing recoil offset; validate each firing frame against the original gun silhouette.

The runtime owner verified the wearable placements using an actual runtime comparison, widening the cape and armor to improve the small gameplay silhouette.

## Validation and contact sheet

- All seven game PNG files were normalized to standard 8-bit RGBA PNG using `sharp.ensureAlpha().png()`.
- Pixel-by-pixel comparisons against generated originals confirmed lossless RGB and alpha preservation.
- Every normalized game PNG was successfully decoded with `@napi-rs/canvas.loadImage`.
- All cutouts were visually reviewed individually and on a dark inventory-style backdrop.
- A 1600 × 1120 presentation contact sheet is available at `docs/art/lotus-regalia-art-contact-sheet.png`.

## Generation prompts

### Legendary lotus gun

Use case: stylized-concept. Asset type: premium legendary equipment sprite for the cute 2D Flowerpig action game. Primary request: a single lavish legendary lotus gun, isolated, genuinely transparent background. Supporting visual canon: cute plush/painterly glossy chibi pig with pink lotus blossom and purple scarf (references attached); only create the equipment, do not create the pig. A compact fantasy lotus blaster pointing perfectly horizontally RIGHT, broad SIDE VIEW, straight barrel; pale mint jade body, rose-gold and warm gold decorative rims, luminous pink lotus-flower emblem embedded in the receiver, large gorgeous sculpted pink lotus petals wrapping the upper rear receiver like a crown, intricate but bold gold filigree, one small dangling purple silk ribbon near grip. Small gem and glowing aqua inner muzzle; no long light beam, no bullet, no muzzle flash. Grip slants down on the LEFT beneath receiver; muzzle on RIGHT. Crisp warm rose-brown outlines, soft dimensional painted shading matching glossy cute mobile-game illustration, premium ornate MMORPG legendary loot polish, appealing rounded friendly proportions, gold highlights and tiny subtle glints. Composition: wide 3:1 object silhouette, centered horizontally, object fills 90% of canvas width and 80% height, full weapon visible with generous safe margin. No hand, no character, no background, no ground, no frame, no labels, no words, no watermark. Must have real alpha transparency. The lotus is part of the blaster's body, not floating. Make a clean usable game cutout.

Inputs: Yeoni profile sheet as style reference and prior lotus-gun crop as equipment reference.

### Dusk lotus cape

Use case: stylized-concept. Asset type: premium wearable BACK-LAYER equipment cutout for the cute 2D Flowerpig action game. Create ONE isolated small midnight-purple cloak/cape, with real transparent background. No pig, no body, no head, no mannequin, no hands, no scarf, no neck band, no weapon. Supporting reference shows the glossy pastel chibi game art style to match. This cape is seen in side-three-quarter view with its narrow attachment at UPPER RIGHT, fabric flowing dramatically LEFT and downward behind a short cute character facing RIGHT. Broad lower left sweep; the silhouette is like a softly billowing triangular wing. Rich amethyst velvet, lavender silk lining, opulent polished gold edging, a graceful large embroidered golden lotus motif near lower left hem, scattered tiny gold stars and delicate lotus-vine embroidery. Painterly dimensional mobile-game loot illustration with confident rose-brown colored outlines, glossy highlights and simple readable folds. Wide silhouette approximately 1.55:1, full object centered with clear margin. Keep the upper right clasp small, not a collar. It must be usable as behind-character overlay and an inventory icon. No floating particles, no opaque background, no shadow, no scenery, no text, no frame. Full isolated cloak only.

Input: Yeoni profile sheet as style reference.

### Jade lotus guard

Use case: stylized-concept. Asset type: premium wearable FRONT-LAYER equipment cutout for the cute 2D Flowerpig action game. Create ONE isolated compact jade and gold lotus breastplate, with real transparent background. No pig, no body, no mannequin, no head, no hands, no arms, no legs, no weapon, no cape. Supporting reference shows glossy pastel chibi game art style. This is a small rounded cute torso cuirass viewed almost frontally with slight three-quarter turn facing RIGHT; shaped to protect the short round lower torso of a chibi pig. A compact broad crescent-shaped mint-jade breastplate with two small petal pauldrons at upper left and right. Polished ivory-mint enamel, rich warm gold borders, one glowing pink lotus jewel at center, simple rounded layered petal plates along lower hem. Open neck notch at top. Solid plate surface in center, squat broad silhouette roughly 1.65:1 suitable for overlay below arms and snout. Painterly dimensional mobile-game legendary loot illustration, soft warm rose-brown outlines, gentle pink reflected light, glossy gold highlights, exquisite but readable detailing. Full object centered with clear margin. Avoid realistic human armor proportions, no tall shoulders, no dark scary styling, no background, no shadow, no scenery, no floating particles, no frame, no labels or words.

Input: Yeoni profile sheet as style reference.

### Dawn petal halo

Use case: stylized-concept. Asset type: premium wearable BACK-LAYER equipment cutout for the cute 2D Flowerpig action game. Create ONE isolated radiant dawn-petal halo, genuinely transparent background. No pig, no character, no face, no mannequin, no head, no body, no weapon. Supporting reference shows the matching glossy pastel chibi game art style. A beautiful thin oval halo ring of polished warm gold encircling a completely EMPTY transparent center, with elegant gold filigree and sparse pale pink lotus petals attached around the OUTSIDE edge. Major petals clustered at 11 o'clock, 1 o'clock, 7 and 5 o'clock; the middle stays totally transparent, hollow aperture occupies at least 75% of width and height. Slightly wider than tall, aspect ratio 1.24:1, gentle near-front view. Tiny pink gemstone at the top. Faint warm golden luminous rim and three tiny sparkle accents very close to ring, never a solid glow covering center. Stylish ornate holy lotus aura, luxury collectible mobile-game equipment art, warm rose-brown colored outlines, translucent pearly pink petals and dimensional golden highlights. Keep full object and tiny glints in canvas with safe margin. This must read clearly behind the large round pig head without obscuring face or original pink lotus. No backdrop, no ground, no shadow, no text, no watermark, no frame.

Input: Yeoni profile sheet as style reference.
