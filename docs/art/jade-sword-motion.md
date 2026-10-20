# Jade sword warrior: eight-frame slash

## Asset and playback

`asset/sprites/player-jade-sword.png` is a lossless **3072 × 256 RGBA PNG**, containing eight **384 × 256** frames.

| Frame | Motion |
| --- | --- |
| 0 | Raised two-handed ready guard |
| 1 | Immediate broad forward/downward impact slash, compact blade-adjacent accent |
| 2 | Early low followthrough |
| 3 | Deep torso-rotated followthrough |
| 4 | Hilt drawn toward the torso to recover |
| 5 | Intermediate rising diagonal guard |
| 6 | Near-ready raised guard with scarf/hem motion |
| 7 | Settled raised ready, separately drawn shoulders/cloth |

The same broad silver-jade butcher cleaver-sword remains held throughout, with a gold lotus guard and wrapped dark hilt. Both hands stay on the hilt. There is no disc, rifle, thrown sword, detached projectile, or extra arm. The canonical pink face, head lotus, purple scarf, curly tail, brown hooves and fitted jade robe remain integrated into the full character drawing. Torso rotation, crouch, elbows, wrists, robe folds and scarf change with the slash.

## Placement and QA

- Foot center/baseline **(192,240)**; maximum raster placement error **0.4141 px**.
- One nominal uniform source scale **0.71** across all eight frames, with integer raster rounding and per-frame translation only. No per-frame bbox scaling and no fabricated translated poses.
- Source rows were separated through true gutters at y **0,386,750,1129,1536**, with x512 as the column separator.
- Eight distinct RGBA frame hashes.
- Both `sharp` and awaited native-canvas `loadImage` decode the final PNG at 3072 × 256.
- **Zero nontransparent pixels on every border of every frame.**
- Full-scale navy contact sheet and pale/navy/runtime-scale proof were inspected. Grip, sword continuity, fitted garment, alpha, slash, followthrough and recovery are readable and intact.
- Final SHA-256: `63b6d066523f96f4fc5927864c22dd305e99e7ed174dfa1f34d6b43928a3e6d5`.

Proofs: `scratch/jade-sword/sword-proof.png` and `scratch/jade-sword/sword-final-proof.png`.
Detailed measurements: `scratch/jade-sword/validation.json` and `scratch/jade-sword/final-qa.json`.

## Generation provenance

Built-in **imagegen** used the actual, inspected `asset/sprites/player-jade-blade.png` as the identity and outfit reference. The eight sword poses are newly generated anatomical drawings, not the disc animation with a pasted sword.

Initial generated source: `call_e0f24411958b4d44a9c9e06186c8b4a9.png`.
Final corrected source: `call_bfac02c5e92e4244a15fbd250fa08376.png`.

The initial sword length and slash accent exceeded the fixed-cell placement budget. A targeted imagegen correction shortened only the blade and tightened the impact accent, preserving the already-drawn character anatomy and grip. Clean alpha was explicitly requested. Mechanical packing used Lanczos3 downsampling, fixed-foot translation, and removal only of alpha ≤ 2 numerical residue on the outside cell border.

## Prompt set

Creation prompt:

> Use case: identity-preserve. Create a genuinely hand-drawn EIGHT-FRAME SWORD WARRIOR slash animation of the exact flowerpig in the reference. Keep its canonical pink pig face, large pink head lotus, purple scarf, curly tail, brown hooves, chubby proportions, and naturally fitted pale-jade short robe with gold piping, pink lotus motifs, real sleeve openings, flowing cloth folds and split hem. Same polished painted game-sprite finish. Replace the circular disc completely with ONE broad silver-jade BUTCHER SWORD: a wide single-edged fantasy cleaver-sword blade, modest gold guard, small pink lotus gem and dark wrapped hilt. It is an actual sword with a clearly readable connected blade and hilt, not a saw-disc, gun, wand or projectile. The same sword is physically HELD by both hands together on its hilt in EVERY frame. Exactly two arms and two hands, fully integrated grip. Never let a hand grab the blade.
>
> Layout: genuinely transparent 1024x1536 sheet, exactly TWO columns and FOUR rows, eight complete characters in 512x384 cells, read left-to-right and top-to-bottom. Full right-facing three-quarter pig in each cell, consistent approximately 330-pixel character height, planted feet at cell baseline 360 and midpoint 240. Sword and any compact slash accent must remain INSIDE its cell, between x25..475 and y20..365. Sword no taller than the pig's head lotus. No labels, grid lines, floor shadow, ambient haze or background.
>
> Frame 0 RAISED READY: two hands together gripping the hilt near the right shoulder, sword angled upward/right beside the head, blade tip stays below the top of the head lotus, focused warrior eyes, body slightly wound back. Frame 1 IMMEDIATE BROAD IMPACT: real two-handed forward/downward slash through the right-front of the body, torso rotated forward, arms extend with connected hands gripping the hilt, blade sweeps right with one SHORT compact pale-gold curved accent closely following the blade. Sword stays held; no detached object. This is actual impact, not a preparatory pose. Frame 2 early followthrough: sword and both hands travel lower toward the right hip, torso follows, no impact accent. Frame 3 peak followthrough: blade points lower/right while remaining entirely above the feet, hands stay joined on hilt, elbows bend with the twisting torso, scarf and robe swing visibly. Frame 4 return begins: both hands draw hilt toward torso, sword angled forward-right, knees/shoulders recover, robe folds change. Frame 5 sword rises through a distinct intermediate diagonal guard, two hands still on hilt. Frame 6 near-ready raised sword with secondary scarf curl and split-hem flutter, distinct wrist/elbow pose. Frame 7 settled raised ready, two hands together on hilt, same sword, slightly relaxed shoulders and differently settled cloth from 0.
>
> All eight frames are genuinely distinct anatomy and cloth drawings with clear shoulder/elbow/wrist/torso motion, never duplicates or merely translated sprites. No discarded sword, no thrown blade, no flying projectile, no disc, no gun, no extra arms or extra weapons. Preserve character identity and naturally worn jade outfit. Clean crisp anti-aliased transparent silhouette, full transparent gutters.

Final correction prompt:

> Precise production correction of this eight-frame sword sprite sheet. Keep all character bodies, faces, head flowers, hands, forearms, grip positions, jade robes, scarves, feet and distinct poses UNCHANGED. In EACH of the eight cells, shorten ONLY the sword BLADE from the gold guard to its tip by approximately 45 percent, keeping the current width/thickness, silver-jade material, gold guard and dark hilt unchanged. This should become a compact broad butcher cleaver-sword while remaining firmly held by both hands. Do not shorten the hilt or detach the blade. Particularly the second-row-right sword tip must end at source x935 or earlier, and the top-right impact sword tip at source x935 or earlier. Raised sword tips in bottom-row frames must be no higher than the pig's head lotus. All blade orientations must follow their original poses.
>
> Also shorten the TOP-RIGHT slash accent into a tight pale-gold curved accent immediately around the shortened held blade, ending no farther right than source x950, with no long tail under the feet and no detached projectile. Remove all broad ambient aura, gray-white background residue and haze outside actual sprite silhouettes. Everything beyond the characters, held swords and this one compact impact accent must be true transparent alpha. Preserve exact 1024x1536 two-column/four-row layout and all other details. No extra arms, hands, weapons, text, floor shadow or backdrop.

Only the assigned sword sprite, this document and independent staging were changed; no gameplay or publishing work is included.
