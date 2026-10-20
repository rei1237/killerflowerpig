# Jade locomotion: held-equipment idle and walking

## Final assets

Five lossless **3072 × 256 RGBA PNGs**, each containing eight **384 × 256** frames:

- `asset/sprites/player-jade-fire-move.png`: compact rifle, correct two-handed ready grip
- `asset/sprites/player-jade-dual-move.png`: exactly two separately held compact pistols
- `asset/sprites/player-jade-throw-move.png`: green jade bottle stays held in all eight frames
- `asset/sprites/player-jade-cannon-move.png`: substantial lotus cannon supported by both hands
- `asset/sprites/player-jade-sword-move.png`: compact butcher cleaver-sword in a joined two-handed raised guard

The family name “fire” identifies the rifle stance. None of these locomotion sheets contain firing, attacks, muzzle flashes, impact arcs, released objects or projectiles. Bottle, cannon and sword families contain no rifle.

## Frame contract

| Frames | Motion |
| --- | --- |
| 0–3 | Four separately drawn idle poses: neutral breath, inhale, exhale/blink and relaxed return. Feet remain planted while shoulders, grip, scarf and robe folds change. |
| 4–7 | Four genuinely articulated walking poses: contact, passing, opposite contact and opposite passing. Thighs, knees, hoof orientation, raised/support hoof and robe hem change. |

The passing poses alternate which hoof is lifted and which supports the body. All frames are complete newly generated anatomical drawings; no frame is a translated or duplicate copy. Weapon grips remain integrated throughout the motion. The canonical pink face, pink head lotus, purple scarf, curly tail, brown hooves and fitted jade/gold short robe are preserved. The garment has natural sleeve openings, folds and split-hem motion.

## Anchoring and packing

- Fixed logical foot/root anchor **(192,240)**; maximum measured rounding error **0.4906 source-raster px**.
- To avoid jumping the root sideways when one foot lifts, x is measured from the midpoint of **both dark-hoof components**, including the raised hoof. The y anchor uses the lowest solid ground-contact baseline.
- One uniform scale across every frame of each sheet: **0.65 for rifle**, **0.68 for dual, bottle, cannon and sword**. The rifle source had taller walking poses; its sheet-wide scale preserves a clean top gutter without cropping the head lotus. No per-frame bounding-box fit, stretching or artificial pose translation is used.
- Sources are 1024 × 1536, two columns/four rows. Row cuts use actual transparent gutters; each character is Lanczos3 downsampled and translated to the fixed anchor.
- Only alpha ≤ 2 numerical residue at final cell borders was zeroed. Meaningful silhouette antialiasing remains.

## Final verification

- All five PNGs decode through sharp and awaited native-canvas loadImage at 3072 × 256 RGBA.
- Eight distinct RGBA frame hashes per sheet.
- **Zero nontransparent pixels on every border of all 40 cells.**
- Full-size family contacts and pale/navy overview contacts were visually checked, including runtime scale 0.24.
- Initial walking passes repeated the same lifted-leg phase in several families. Targeted imagegen edits changed the final passing pose to the opposite support leg and refined opposite-contact leg/cloth mechanics. The dual-pistol inhale was also corrected to quiet breathing with the same split-arm ready carry.

Proofs: `scratch/jade-move/all-five-proof.png` and `scratch/jade-move/{fire,dual,throw,cannon,sword}-proof.png`.
Measurement and hashes: `scratch/jade-move/validation.json` and `scratch/jade-move/final-qa.json`.
Reproducible independent staging: `scratch/jade-move/pack.js`, `proof.js`, `final-qa.js`, `manifest.json`.

## Built-in imagegen provenance

Actual current jade rifle, dual-pistol, bottle-throw, cannon and sword atlases were inspected and supplied as the corresponding identity/outfit/equipment references. All locomotion artwork was made using **built-in imagegen**, with no CLI fallback or code-generated stand-in poses.

| Family | Final generated source | Final PNG SHA-256 |
| --- | --- | --- |
| fire | `exec-97f10598-c5c4-4baa-80a8-dbad92b12440.png` | `80f5c173e9d69c8be0a331968b543a1943c9024114777da73f2388a22f8ac9c2` |
| dual | `exec-e822c01f-be58-41f1-a749-fd608ff7f8b9.png` | `b1800d137f03ead5d76a24c07b40098e9c022787c4690c41ab79830b55dc960b` |
| throw | `exec-37919813-908c-4763-adff-6d9251f43bc7.png` | `b7d09c1dfdca150ba0a22794f19c58c9331fc6db500e84997e065e00ec3ad697` |
| cannon | `exec-398a91d4-a794-4e54-95d0-f6c269f40e6d.png` | `75fae37f07ac1fc749174dd298129c51d8447670e969e20901200fef9e79d4ac` |
| sword | `exec-c3a944f0-2795-47ea-a245-aadcf6d29d98.png` | `acddf4e86b8761e60760695b41c07314eb3d769cb5df946362a33fd38136a959` |

## Prompt set

The exact creation and correction call texts are also preserved in `scratch/jade-move/prompts.json` and `scratch/jade-move/correction-prompts.json`. The shared creation prompt was:

> Use case: identity-preserve. Create a NEW genuine eight-frame IDLE AND WALK animation of the exact flowerpig in the current game reference. Use the reference for identity, fitted jade outfit and held equipment only. This is NOT an attack animation. Preserve the canonical pink face, large pink head lotus, purple scarf, curly tail, brown hooves, chubby proportions and naturally fitted pale-jade/gold short robe with pink lotus motifs, sleeve openings, natural folds and split hem. Same polished painted game-sprite art. Exactly two arms and two legs, believable hand grips. No muzzle flash, slash accent, magic aura, smoke, impact, projectile, attack pose, speed lines, floor shadow, label, grid or background.
>
> Genuinely transparent 1024x1536 sheet, TWO columns and FOUR rows, eight complete figures in 512x384 cells reading left-to-right and top-to-bottom. Each figure faces right in the same three-quarter camera angle, consistent about330pixel body height, feet centered aroundx240 and floor baseliney360. Draw every entire head, flower, weapon, scarf and hoof inside its cell, with clear transparent gutters. All held equipment should stay insidecellx40..460 andy25..355. No crop.
>
> FRAMES0–3 are four genuinely drawn IDLE BREATHING poses with planted feet and NO leg stepping: 0 neutral breathing start and naturally held ready equipment; 1 subtle inhale, chest/shoulders rise and robe folds gently expand, wrists adjust while maintaining grip; 2 soft exhale and brief natural blink, chest settles, scarf drapes differently; 3 eyes open and relaxed return, slight elbow/shoulder release, distinct robe hem and scarf settling. These must not be four copies or translated versions.
>
> FRAMES4–7 are four genuinely different ACTUAL WALKING STEP poses while still safely holding the equipment. Actual leg articulation and alternating hoof contact are mandatory. 4 first contact: near leg/hoof steps FORWARD toward right, far leg trails BACK toward left, opposite heels/toes and knees clearly different, weight over the forward contact; 5 passing step: far knee lifts and passes forward under the hips, near planted leg supports weight, one raised hoof visibly above baseline; 6 opposite contact: FAR leg/hoof now reaches FORWARD right and near leg trails BACK left, opposite toframe4; 7 opposite passing: near knee/hoof lifts to pass forward while far leg supports weight. One hoof remains grounded in every walk frame. No jumps. Feet and knees must visibly change relative positions, not both legs reused under a bobbing body. Keep the root position centered, with small natural body bob and the fitted robe, split hem and scarf responding to the step. Hands and equipment remain integrated throughout. This is a seamless four-step in-place rightward walk cycle.
>
> Every frame must be separately drawn with natural anatomy and cloth, never duplicated or translated sprites. Clean true transparent alpha outside the character and held equipment, no broad glow/haze or translucent backdrop.

### Per-family held equipment instructions

#### fire

> HELD EQUIPMENT: one compact black futuristic rifle with pink accent from the reference, both hands maintaining a correct comfortable two-handed chest-height low-ready grip. Same compact barrel length. No pistol, no sword, no bottle. Keep the gun roughly level during breathing and walking, never recoil or fire.

#### dual

> HELD EQUIPMENT: EXACTLY TWO separate compact black-and-pink pistols, one in EACH hand, with clearly separate wrists and forearms. Use a calm split-arm ready carry, one pistol a little higher, both directed right. Exactly two guns and two hands, never a third weapon. No rifle. Both pistols stay held and unfired throughout all idle/walk frames.

#### throw

> HELD EQUIPMENT: ONE small round green jade grenade-bottle with short gold-capped neck and pink lotus motif, like the held bottle in referenceframe0. The near hand firmly HOLDS that same bottle in every one of all EIGHT frames, in a relaxed ready carry near the waist/chest; other empty hand balances naturally. Do NOT throw or release it. No gun, sword, disc, detached bottle, projectile or trail. Walking arm movement is natural but the bottle stays in the hand.

#### cannon

> HELD EQUIPMENT: ONE chunky large mint-jade/pink/gold LOTUS CANNON from the reference, with round turquoise muzzle, thick barrel and petal casing. Both hands support it firmly across the torso at a comfortable LOW READY, rear hand on grip and front hand under barrel. Slight braced forward weight because it is heavy. Cannon stays held during idle and all walking steps, no recoil, flash, firing or raised attack. No rifle or pistol. Keep cannon length compact enough to fit within its cell.

#### sword

> HELD EQUIPMENT: ONE compact broad silver-jade butcher CLEAVER-SWORD from the reference, modest gold lotus guard and dark wrapped hilt. BOTH hands keep a proper joined grip on the HILT near the shoulder, blade angled up/right in a calm ready guard. Blade tip does not rise above the head lotus. Same compact sword proportions, no long enlarged sword, no gun, no disc. The sword remains held in all idle and walk frames. NO slash, swing, attack arc or effect.

### Final walking-phase corrections

#### fire

> Precise animation correction of this existing eight-frame idle/walk sprite sheet. Preserve identity, exact head/face shape, head lotus, fitted jade robe, purple scarf, held equipment and its grip, every figure's scale and position, and the transparent1024x1536 two-column/four-row layout. The upper four cells are idle and the lower four cells are walking. No attacks or effects.
>
> Change the BOTTOM-LEFT cell (frame6) into the OPPOSITE contact step from the THIRD-ROW-LEFT cell (frame4). Swap the leg mechanics: the other hip/leg now reaches forward toward screen-right while the first leg trails behind toward screen-left. Show distinct thigh/knee angles and opposite overlap of the near and far legs, not just a wider version of the earlier stance. One forward hoof is grounded and the trailing heel is lifted. Keep two legs only. The fitted split robe folds respond naturally to the opposite step. Preserve the held equipment and upper-body stance.
>
> In the BOTTOM-RIGHT cell (frame7), change ONLY the leg phase to the opposite passing step from THIRD-ROW-RIGHT(frame5): the hoof on the VIEWER'S RIGHT must now be clearly lifted with its knee bent forward; the hoof on the VIEWER'S LEFT must be firmly planted at the shared floor baseline. This is the reverse of frame5, which has the left-side hoof raised. Make the changed knee and weight support obvious. Keep two legs, naturally fitted cloth, same held equipment and grip. Also keep both eyes naturally open in THIRD-ROW-LEFT(frame4). All unmentioned frames and artwork stay unchanged. No added prop, projectile, flash, slash, mist, background or floor shadow. Outside the actual character and held equipment must be true transparent alpha, with clean gutters.

#### dual

> Precise animation correction of this existing eight-frame idle/walk sprite sheet. Preserve identity, exact head/face shape, head lotus, fitted jade robe, purple scarf, held equipment and its grip, every figure's scale and position, and the transparent1024x1536 two-column/four-row layout. The upper four cells are idle and the lower four cells are walking. No attacks or effects.
>
> Change the BOTTOM-LEFT cell (frame6) into the OPPOSITE contact step from the THIRD-ROW-LEFT cell (frame4). Swap the leg mechanics: the other hip/leg now reaches forward toward screen-right while the first leg trails behind toward screen-left. Show distinct thigh/knee angles and opposite overlap of the near and far legs, not just a wider version of the earlier stance. One forward hoof is grounded and the trailing heel is lifted. Keep two legs only. The fitted split robe folds respond naturally to the opposite step. Preserve the held equipment and upper-body stance.
>
> In the BOTTOM-RIGHT cell (frame7), change ONLY the leg phase to the opposite passing step from THIRD-ROW-RIGHT(frame5): the hoof on the VIEWER'S RIGHT must now be clearly lifted with its knee bent forward; the hoof on the VIEWER'S LEFT must be firmly planted at the shared floor baseline. This is the reverse of frame5, which has the left-side hoof raised. Make the changed knee and weight support obvious. Keep two legs, naturally fitted cloth, same held equipment and grip. Additionally, correct TOP-RIGHT idleframe1: retain the same split-arm two-pistol pose as TOP-LEFTframe0, with only a subtle inhale/shoulder rise and a small natural grip adjustment. Do not raise or exchange the arms dramatically; this is quiet breathing, not attack. Exactly TWO pistols and TWO arms/hands. All unmentioned frames and artwork stay unchanged. No added prop, projectile, flash, slash, mist, background or floor shadow. Outside the actual character and held equipment must be true transparent alpha, with clean gutters.

#### throw

> Precise animation correction of this existing eight-frame idle/walk sprite sheet. Preserve identity, exact head/face shape, head lotus, fitted jade robe, purple scarf, held equipment and its grip, every figure's scale and position, and the transparent1024x1536 two-column/four-row layout. The upper four cells are idle and the lower four cells are walking. No attacks or effects.
>
> Change the BOTTOM-LEFT cell (frame6) into the OPPOSITE contact step from the THIRD-ROW-LEFT cell (frame4). Swap the leg mechanics: the other hip/leg now reaches forward toward screen-right while the first leg trails behind toward screen-left. Show distinct thigh/knee angles and opposite overlap of the near and far legs, not just a wider version of the earlier stance. One forward hoof is grounded and the trailing heel is lifted. Keep two legs only. The fitted split robe folds respond naturally to the opposite step. Preserve the held equipment and upper-body stance.
>
> Keep the BOTTOM-RIGHT(frame7) opposite passing step unchanged: its right-side hoof is already raised and its left-side hoof grounded. Keep the bottle firmly held, no release. All unmentioned frames and artwork stay unchanged. No added prop, projectile, flash, slash, mist, background or floor shadow. Outside the actual character and held equipment must be true transparent alpha, with clean gutters.

#### cannon

> Precise animation correction of this existing eight-frame idle/walk sprite sheet. Preserve identity, exact head/face shape, head lotus, fitted jade robe, purple scarf, held equipment and its grip, every figure's scale and position, and the transparent1024x1536 two-column/four-row layout. The upper four cells are idle and the lower four cells are walking. No attacks or effects.
>
> Change the BOTTOM-LEFT cell (frame6) into the OPPOSITE contact step from the THIRD-ROW-LEFT cell (frame4). Swap the leg mechanics: the other hip/leg now reaches forward toward screen-right while the first leg trails behind toward screen-left. Show distinct thigh/knee angles and opposite overlap of the near and far legs, not just a wider version of the earlier stance. One forward hoof is grounded and the trailing heel is lifted. Keep two legs only. The fitted split robe folds respond naturally to the opposite step. Preserve the held equipment and upper-body stance.
>
> In the BOTTOM-RIGHT cell (frame7), change ONLY the leg phase to the opposite passing step from THIRD-ROW-RIGHT(frame5): the hoof on the VIEWER'S RIGHT must now be clearly lifted with its knee bent forward; the hoof on the VIEWER'S LEFT must be firmly planted at the shared floor baseline. This is the reverse of frame5, which has the left-side hoof raised. Make the changed knee and weight support obvious. Keep two legs, naturally fitted cloth, same held equipment and grip. All unmentioned frames and artwork stay unchanged. No added prop, projectile, flash, slash, mist, background or floor shadow. Outside the actual character and held equipment must be true transparent alpha, with clean gutters.

#### sword

> Precise animation correction of this existing eight-frame idle/walk sprite sheet. Preserve identity, exact head/face shape, head lotus, fitted jade robe, purple scarf, held equipment and its grip, every figure's scale and position, and the transparent1024x1536 two-column/four-row layout. The upper four cells are idle and the lower four cells are walking. No attacks or effects.
>
> Change the BOTTOM-LEFT cell (frame6) into the OPPOSITE contact step from the THIRD-ROW-LEFT cell (frame4). Swap the leg mechanics: the other hip/leg now reaches forward toward screen-right while the first leg trails behind toward screen-left. Show distinct thigh/knee angles and opposite overlap of the near and far legs, not just a wider version of the earlier stance. One forward hoof is grounded and the trailing heel is lifted. Keep two legs only. The fitted split robe folds respond naturally to the opposite step. Preserve the held equipment and upper-body stance.
>
> In the BOTTOM-RIGHT cell (frame7), change ONLY the leg phase to the opposite passing step from THIRD-ROW-RIGHT(frame5): the hoof on the VIEWER'S LEFT must now be lifted with its knee bent forward; the hoof on the VIEWER'S RIGHT must be firmly planted at the shared floor baseline. This is the reverse of frame5, which has the right-side hoof raised. Make the changed knee and weight support obvious. Keep two legs, naturally fitted cloth and the same two-handed sword grip. Also open the eyes naturally in THIRD-ROW-LEFT(frame4); walking must not look asleep. All unmentioned frames and artwork stay unchanged. No added prop, projectile, flash, slash, mist, background or floor shadow. Outside the actual character and held equipment must be true transparent alpha, with clean gutters.

Only these five assigned locomotion sprites, this documentation and independent staging were changed. No gameplay, renderer, or publishing edits are included.
