# Fitted jade robe: five tech-specific motion families

## Delivered assets

All five files are lossless **3072 × 256 RGBA PNGs**, with eight **384 × 256** cells, ordered 0–7 left to right.

| File | Technique | Animation content |
| --- | --- | --- |
| `asset/sprites/player-jade-dual.png` | Dual pistols | Two distinct pistols; split-arm aiming; asymmetric wrist/elbow recoil |
| `asset/sprites/player-jade-throw.png` | Bottle/grenade throw | Held bottle in anticipation, open-hand release, overarm followthrough |
| `asset/sprites/player-jade-cannon.png` | Heavy lotus cannon | Chunky cannon, supporting front hand, braced torso and firm two-arm recoil |
| `asset/sprites/player-jade-blade.png` | Circular saw/disc | Held disc in anticipation, sidearm release, empty-hand sweep/followthrough |
| `asset/sprites/player-jade-channel.png` | Lotus channel/cast | Cupped hands, open-palm thrust, sustained open-hand cast and relaxed recovery |

Frame 0 is anticipatory ready; frame 1 is the immediate actual attack; frames 2–7 show technique-specific followthrough/recovery with robe and scarf secondary motion. All poses were generated as complete anatomical drawings, rather than icons placed over a rifle pose or duplicate sprites translated across cells.

The pink face, head lotus, purple scarf, curly tail, brown hooves, pale-jade fitted robe, gold piping and pink lotus details remain consistent. The robe has real arm openings, follows the shoulders/torso, and changes its folds and split-hem silhouette with the motion. Hands and equipment have integrated grips.

## Projectile ownership

- **Throw:** Only frame 0 has a held bottle. Frame 1 has an open empty release hand. Frames 1–7 contain no bottle, grenade, detached projectile, or trail. Gameplay renders the released projectile.
- **Blade:** Only frame 0 has the held saw-disc. Frames 1–7 have empty release/recovery hands and contain no detached disc, streak or trail. Gameplay renders the disc.
- **Channel:** Frame 0 has compact gathered magic between the hands. Frames 1–3 have compact glow directly on the open palm. Detached flying petals and long outward trails were removed so emitted projectiles can remain in gameplay.
- **Dual/cannon:** The attached frame-1 muzzle flashes remain part of the sprite. No rifle or compact legendary hand-cannon is substituted for these tech-specific poses.

## Packing and anchors

All frames use fixed foot center/baseline **(192,240)**, rounded to the nearest placement pixel. Faint hoof antialiasing can reach y241. The maximum measured subpixel placement error is under 0.5 source-raster pixels per axis. Runtime gameplay offsets are unchanged.

Each source was a 1024 × 1536 transparent two-column/four-row sheet. Rows were separated through the actual empty gutters instead of blindly slicing through neighboring artwork. The blade source uses a vertical separator at x480, because the top-right character's scarf extended left of x512; this preserves that scarf and prevents its tip from appearing in frame 0.

One uniform scale is used for all eight poses within each family:

- Dual, blade and channel: 0.68
- Throw: 0.67, preserving a transparent top gutter around the taller final lotus poses
- Heavy cannon: 0.66, preserving the full large cannon, flash and peak-recoil silhouette inside the fixed cells

There is no per-frame bounding-box fit or stretching. Frames were uniformly Lanczos3-downsampled, foot-aligned by translation, and packed horizontally. Only alpha ≤ 2 numerical residue on the final outer cell boundary was zeroed; meaningful edge antialiasing and compact glows remain.

## Generation workflow and final sources

Mode: **built-in imagegen**, with actual current sprite pixels as references. No CLI fallback, vector substitute, or programmatically fabricated animation poses.

Inspected canonical references:

- `asset/sprites/player-jade-fire.png`
- `asset/sprites/player-jade-lotus-fire.png` for the heavy cannon's jade/pink/gold design language

Final selected generated sources:

| Family | Generated source |
| --- | --- |
| Dual | `call_f6bd34a459f54a29b0108ad7750aa543.png` |
| Throw | `exec-434c05c2-f390-4abf-964d-479d30abf117.png` |
| Cannon | `exec-c3ab9564-194d-4dd2-a28f-cd7bc7090eea.png` |
| Blade | `exec-335b0ccb-132d-44b9-ab0a-65c8aa43c684.png` |
| Channel | `exec-d29af1b3-5fb7-42f5-b539-7e35f2d03f7c.png` |

The initial dual shot had a redundant third pistol; a targeted imagegen correction removed it and redrew the near forearm to grip the lower of exactly two pistols. The final sheet has exactly two arms/hands and two pistols.

The cannon flash was compacted before packing. A later generated source contained gray semitransparent backdrop residue; an explicit imagegen background-extraction pass removed this. Final cannon transparency was inspected over navy and checked numerically.

Throw/blade initially included a released projectile. Following gameplay QA, these were removed with imagegen, preserving the exact open-hand release pose. Channel's distant petals and long trails were similarly reduced to compact palm glow.

## Prompt set

The per-family creation calls all specified the actual canonical reference, full integrated anatomy, eight separately drawn poses, fitted jade robe, exactly two arms/hands, consistent character size, planted feet, a 1024 × 1536 two-column/four-row layout, transparent gutters, and no labels, floor shadows, backdrop or ambient haze. The technique-specific instructions were:

### Dual

Two separate compact black-and-pink pistols, one naturally held in each hand; never two hands on one gun. Frame 0 uses split aim, with one forearm extended and the other arm slightly higher. Frame 1 is the immediate shot with both flashes and independent bracing wrists. Frames 2–3 show asymmetric rising recoil and flexed arms. Frames 4–5 return the arms independently; frames 6–7 settle the aim with robe/scarf secondary motion. No rifle, duplicate arms or extra pistols.

Final correction prompt:

> Precise correction of ONLY the top-right cell of this eight-frame sprite sheet. That firing frame accidentally has THREE pistols. It must have EXACTLY TWO pistols and EXACTLY TWO arms/hands. Remove completely the extra horizontal center pistol directly under the pig's snout (the one with no flash) and its redundant grip. Redraw the near forearm naturally extending from the near shoulder to hold the LOWER forward pistol with its muzzle flash. The far hand holds the UPPER forward pistol with its muzzle flash. Thus two arms, two hands, two pistols, two flashes, and absolutely no third weapon near the chest or face. Preserve the original fitted jade robe, pink face, head lotus, scarf, feet, overall pose, scale and location. Keep all SEVEN other complete character cells unchanged. Keep the same 1024x1536 two-column/four-row layout and genuinely transparent alpha. No new objects, no background, no haze, no text.

### Throw

Remove every gun. Frame 0 winds the near arm back with one green jade grenade-bottle held near the shoulder and the other hand balancing. Frame 1 is a genuine overhead-arc release with open fingers. Frames 2–3 are empty-hand followthrough with shoulder rotation and forward torso lean. Frames 4–7 return the empty arms, torso and cloth to rest. The released bottle shown in the creation pass was removed by the final prompt:

> Surgical object removal in ONLY the TOP-RIGHT cell: completely REMOVE the airborne green grenade-bottle to the right of the extended hand, leaving genuinely TRANSPARENT empty space there. Keep the character's extended open empty hand exactly unchanged. No projectile, no detached object, no trail, no glow should remain in that cell. The game renders the released projectile separately. The TOP-LEFT frame must KEEP its HELD green bottle unchanged. All other six frames must keep EMPTY hands, unchanged. Preserve every character face, hand, arm, fitted jade robe, scarf, foot, position, size, and eight-frame layout exactly. 1024x1536 genuine transparent alpha. No replacement item, no weapon, no background or text.

### Cannon

A thick mint-jade barrel, round turquoise muzzle, pink lotus petal casing and gold rims make a substantial chest-width cannon. The rear hand grips and the front hand supports the barrel. Frame 0 is a low braced stance, frame 1 an immediate attached blast with compressing shoulders, frames 2–3 a firm two-arm recoil with changing weight and torso angle, and frames 4–7 lowering/returning aim with cloth settling. No black rifle or compact pistol.

Final cleanup prompt:

> Background-extraction precision edit. Preserve all EIGHT complete flowerpig/cannon sprites, their original colors, exact poses, locations and scale unchanged. Remove ALL residual background and broad gray-white haze around and between sprites. Especially the lower half of this sheet currently has broad semitransparent gray residue: remove it completely to true ALPHA ZERO. Keep only the actual characters, held cannons, clean anti-aliased silhouette edges, and the SMALL attached muzzle flash in top-right. Everything beyond these actual object silhouettes must be genuinely transparent. No floor shadows, ambient aura, haze, paper texture, rectangle or backdrop. Do not redraw or shift characters; do not crop. 1024x1536 exact two-column/four-row layout. This is a clean transparent PNG sprite cutout.

### Blade

Remove every gun. One circular silver/jade saw-disc with a gold hub is held near the hip for frame-0 anticipation. Frame 1 is a sidearm sweep and open-hand release. Frames 2–3 continue the empty-arm sweep and shoulder/torso rotation; frames 4–7 untwist and settle the empty hands, scarf and robe. The released disc shown in the creation pass was removed by the final prompt:

> Surgical object removal in ONLY the TOP-RIGHT cell: completely REMOVE the airborne silver/jade circular saw-disc AND ALL its curved motion streaks and glow to the right of the extended open hand. Leave genuinely TRANSPARENT empty space. Keep the character's extended EMPTY open hand exactly unchanged. No projectile, detached object, streak, halo or residual glow should remain in that cell; the game renders its projectile separately. The TOP-LEFT frame must KEEP its HELD disc unchanged. All other six frames keep EMPTY hands unchanged. Preserve every character face, hand, arm, fitted jade robe, scarf, foot, position, size, and eight-frame layout exactly. 1024x1536 genuine transparent alpha. No replacement item, no gun, no background or text.

### Channel

Remove all physical weapons. Frame 0 has cupped empty palms gathering magic; frame 1 thrusts the near open palm forward while the other supports lower and behind. Frames 2–3 sustain with changing wrist angles, open hands and torso lean. Frames 4–7 lower and relax empty palms with secondary scarf and robe motion. The final particle prompt was:

> Precise editing of ONLY the magic particles in this 8-frame sheet. The game emits projectiles separately, so REMOVE every detached flying petal, every long outward streak and every glow trail far from hands in the TOP-RIGHT cell and BOTH cells of the second row. Keep only a TINY compact pink/gold glow attached directly to the extended open palm in these three cells, extending at most 10 source pixels beyond fingertips. Do not alter any hand, arm, face, pink flower, robe, scarf, foot, anatomy, pose, scale or placement. In top-left keep the little gathered magic BETWEEN the cupped hands. Keep all other 4 cells unchanged and emptyhanded. Background and all former particle/trail areas must be truly transparent. No replacement projectile, no gun, no haze, no shadow, no background, no text. Exact original 1024x1536 eight-cell layout.

## Final verification

- All five final files decode through `sharp` and awaited native-canvas `loadImage` as 3072 × 256 RGBA.
- Eight distinct RGBA frame hashes in each sheet.
- **Zero nontransparent pixels on every outside border of all 40 cells.**
- Full-size family proof sheets and an overview at 0.5 and actual runtime 0.24 scale were visually inspected on navy/pale backgrounds.
- Verified no detached throw/blade projectile, no rifle remaining in non-rifle families, no third pistol, no broad cannon alpha haze, no clipped channel particles, and no neighboring blade scarf fragment.

Proof and reproducible QA files:

- `scratch/jade-tech/all-five-proof.png`
- `scratch/jade-tech/{dual,throw,cannon,blade,channel}-proof.png`
- `scratch/jade-tech/final-qa.json` contains final dimensions, border counts, hashes and decode results.
- `scratch/jade-tech/validation.json` contains source cuts, measured foot coordinates, final bounds and frame hashes.
- `scratch/jade-tech/pack.js`, `proof.js`, `final-qa.js` and `manifest.json` preserve independent packing/verification staging.

Only the five assigned sprite files, this document, and independent staging were changed. No gameplay, renderer or publishing work is included.
