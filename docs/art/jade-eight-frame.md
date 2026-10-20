# Jade robe: eight-frame fitted firing animation

## Final assets

- `asset/sprites/player-jade-fire.png`
- `asset/sprites/player-jade-lotus-fire.png`

Both are lossless **3072 × 256 RGBA PNGs**, with eight consecutive **384 × 256** cells. This document supersedes the four-frame dimensions and pose order in `jade-costume.md` for these two files. No renderer, gameplay, publishing, or other equipment asset changes are included in this art work.

| Index | Pose | Visible animation work |
| --- | --- | --- |
| 0 | Ready | Level two-handed aim; robe and scarf at rest |
| 1 | Immediate shot | Attached muzzle flash, first arm/shoulder compression, cloth tension |
| 2 | Recoil onset | Elbows draw back, gun begins rising, torso and split hem move |
| 3 | Peak recoil | Highest gun angle, winking expression, compressed arms, raised hem |
| 4 | Settle | Gun lowers, eye reopens, cloth follows returning torso |
| 5 | Return | Near-level gun, extending arms, trailing scarf and robe |
| 6 | Cloth secondary motion | Almost-restored aim with opposite scarf curl and swinging robe hem |
| 7 | Ready settle | Final shoulder release, level gun, relaxed but separately drawn cloth |

The two sheets use the same pose family. The second is a surgical weapon conversion to the jade/pink/gold legendary lotus cannon, with a pink-gold shot burst. Both retain the canonical pink flowerpig face, pink head lotus, purple scarf, curly tail, brown hooves, warm outlines and polished illustrated finish. The short jade robe is integrated around the torso, shoulders and arms, with sleeve openings, fitted gold piping, natural folds and a split cloth hem. It is not a flat overlay. Hands remain integrated into the two-handed grip.

## Fixed placement contract

- Runtime cell size: **384 × 256**.
- Foot center/baseline: **(192, 240)**, within 0.42 source-raster pixels after integer placement. Faint hoof antialiasing can reach y241.
- Gameplay firing point stays **(312, 148)**. No costume-specific gameplay offset is needed.
- The visual muzzle rises during recoil; it is deliberately not fixed in every pose. The fixed shot point lies in the attached flash in frame 1 for both weapons. Its verified RGBA is `[253,234,80,251]` for the normal rifle and `[253,239,220,253]` for the lotus cannon.
- All eight frames use a single nominal **0.68** uniform source scale, with only integer raster rounding. No per-frame bounding-box fitting, redrawn transforms, per-frame stretch, or fake pose duplication is used.
- Raw generated source cells were two columns and four rows. The final row separator was moved from y1152 to y1144 to retain the last row's highest lotus petal. Row boundaries are `[0,384,768,1144,1536]`.
- Each complete source cell was downsampled with Lanczos3 and translated to the measured solid-hoof center/baseline. Its full body, weapon and cloth were preserved. Only alpha=1 numerical residue at the final outside border was cleared; all meaningful antialiasing and muzzle-flash transparency were retained.
- Outer atlas and cell borders are alpha 0. No opaque rectangle, clipping, or neighboring-pose fragment remains.

Alpha > 16 bounds, inclusive `[left,top,right,bottom]`:

| Index | Normal rifle | Lotus cannon |
| --- | --- | --- |
| 0 | 83,9,310,240 | 84,9,300,241 |
| 1 | 86,12,352,241 | 87,10,351,241 |
| 2 | 75,5,315,240 | 75,5,310,241 |
| 3 | 53,6,302,240 | 53,5,304,240 |
| 4 | 71,6,311,240 | 71,5,303,241 |
| 5 | 65,10,307,241 | 66,8,308,240 |
| 6 | 62,4,308,240 | 61,3,309,240 |
| 7 | 76,6,307,240 | 76,4,303,240 |

## Generation and reference provenance

Mode: **built-in imagegen**, genuine transparent-background generation. No CLI/API fallback, vector stand-in, or generated-by-transform poses.

Actual existing pixel references were opened and inspected before generation:

1. `asset/sprites/player-jade-fire.png`, original four-frame integrated character and normal gun.
2. `asset/sprites/player-jade-lotus-fire.png`, original four-frame character and legendary gun.

Generated normal source: `call_e51543a05df64267a6de13d774ee877a.png`.
Generated lotus source: `call_310476c438ca4599bf0ef87b48006743.png`.

### Normal-gun final prompt

Use case: identity-preserve. Asset: a production game character firing-animation sprite sheet. The input is the ACTUAL current game sprite; preserve this exact polished chibi flowerpig identity and style. Create EIGHT genuinely different complete drawings of this same pig, wearing a naturally fitted jade lotus ceremonial ROBE with the same pale jade and gold trim, small pink lotus details and petal shoulders. Tailored short tunic robe wraps around its round body under the arms, has natural cloth folds and a short split hem above the hooves. Pink face, original eyes and snout, large pink head lotus, purple scarf, curly tail, brown hooves, stocky silhouette, and compact black futuristic rifle with pink glowing accent all stay consistent. Both hands grip the weapon naturally in every frame. Keep the original compact gun length. Never hide the hands under ornamental plates.

Layout: transparent 1024x1536 canvas, exactly TWO equal columns and FOUR equal rows, eight 512x384 cells, read left-to-right then top-to-bottom. Each cell has ONE full figure, aligned on the same horizontal foot baseline at cell y360 and with foot midpoint cell x240, around 340 pixels tall. All art and muzzle flash inside each cell, large clean transparent gutters. No labels, numbers, grid lines, shadows or background. No crops.

These are eight consecutive frames of ONE natural firing movement, not a new idle/walk sequence. Every pose must be a separately drawn, visibly different anatomy/cloth pose, never merely a translated or duplicated sprite:

Frame 0 top-left: ready stance, eyes open, level rifle, scarf relaxed, robe at rest.
Frame 1 top-right: the IMMEDIATE actual shot, bright small yellow-white muzzle flash attached to level rifle, front hand braces, shoulders start compression, brow focused, robe has first small tension folds.
Frame 2 second row-left: recoil begins, NO flash, elbows pull back, gun rises about 5 degrees, torso leans back slightly, lower robe starts to swing forward.
Frame 3 second row-right: peak recoil, gun rises about 12 degrees, one eye winks naturally like the source, shoulder and arm compression strongest, scarf swept back, robe hem lifted subtly by movement.
Frame 4 third row-left: recoil settling, gun lowers to 7 degrees, eye reopening, elbows extending, robe folds follow torso.
Frame 5 third row-right: return toward aim, gun almost level, both eyes open, hands returning forward, scarf and hem still lag.
Frame 6 fourth row-left: body back at aim but secondary cloth movement, scarf curls slightly in opposite direction and tunic hem/folds visibly settle; small distinct elbow and shoulder pose.
Frame 7 fourth row-right: ready settle, rifle level, tiny final shoulder release, robe relaxed, scarf draped slightly differently from frame 0. This is distinct artwork from frame 0.

Keep feet planted at the same baseline, consistent head and body size in all eight frames, motion should be in elbows, shoulders, torso expression and cloth. Full integrated grip and silhouette. Do not add armor shields or detach the robe. Crisp clean transparent alpha; preserve the illustrated painted game sprite finish.

### Legendary-gun final prompt

Use case: precise-object-edit. Asset type: eight-frame game sprite animation sheet with true transparent alpha. Image 1 is the edit target and must keep its exact layout, character positions, body sizes and eight distinct anatomical poses. Image 2 is only the DESIGN reference for a compact legendary lotus gun. In Image 1 replace ONLY the black rifle held by the pig in each of the eight cells with the compact legendary jade/gold/pink lotus hand cannon from Image 2. Preserve the original muzzle positions, compact length and arm/hand grip positions from Image 1. The cannon has a short mint-jade barrel, gold rims, pink lotus petals wrapped around its body, and a turquoise open circular muzzle on the right. Make it naturally held between both hands; no detached gun or giant ornaments. Match gun orientation to each original pose. The immediate-shot frame, upper right, has a small pink-and-gold lotus flash attached to its muzzle instead of the yellow rifle flash. All other frames have NO flash. Keep all eight full pigs, pink faces and head lotuses, original distinct facial expressions, purple scarves, fitted jade robes with gold piping and folded split hems, feet, tails, colors, soft painted texture and silhouette from Image 1 UNCHANGED. Keep the genuine 1024x1536 transparent two-column/four-row layout. No background, no ambient glow, no text, no labels, no extra decorations, no vignette. Keep complete clean transparent gutters and leave all body and foot positions untouched. This is a surgical weapon conversion of all eight existing animation frames, NOT a new sheet redesign.

## Validation and visual proof

- Both final PNGs decode successfully with `sharp` and awaited native-canvas `loadImage`.
- Eight distinct RGBA hashes per sheet; none are duplicates.
- A translation-aligned adjacent-frame comparison also rules out simple shifted copies: the largest alpha-mask IoU after a ±12 px search is 0.9304, and at least 43.5% of overlapping opaque pixels differ by >15 RGB units. Even frame 7 → 0 differs visibly in cloth and body details.
- Visually inspected full-size contacts on navy and pale backgrounds, and all sixteen sprites at runtime scale 0.24. Identity, two-handed grips, fitted robe, recoil and cloth motion remain readable.
- Contact proof: `scratch/jade-eight/contact-proof.png`.
- Detailed measurements: `scratch/jade-eight/validation.json` and `scratch/jade-eight/distinctness.json`.
- Independent reproducible packing/proof scripts and original four-frame backups are in `scratch/jade-eight/`.
