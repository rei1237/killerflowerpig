# Base flowerpig tech-specific motion

## Final assets

Five RGBA PNG atlases, each 3072×256 with eight 384×256 cells and foot-center anchor `(192,240)`:

- `asset/sprites/player-base-dual.png`: two compact charcoal/magenta pistols, independently posed arms and alternating recoil.
- `asset/sprites/player-base-throw.png`: overhand bottle release, arm arc, deep forward follow-through and empty-hand recovery.
- `asset/sprites/player-base-cannon.png`: large thick jade/gold/pink lotus cannon, two-hand brace, heavy angled recoil and compact muzzle flash.
- `asset/sprites/player-base-blade.png`: circular saw/disc held ready, empty-hand sidearm release, sweeping follow-through and recovery.
- `asset/sprites/player-base-channel.png`: empty open-hand lotus casting, spreading arms, relaxed return and delayed scarf motion.

Frame 0 is anticipatory ready; frame 1 is the immediate shot/release/cast; frames 2–7 are follow-through and recovery. The ready sprite does not delay a gameplay attack. Intended attack playback is 1→2→3→4→5→6→7→0 in 0.20 seconds; illustrative frame durations are 25,25,30,30,30,30,30 ms. PNGs do not encode timing.

## Projectile and equipment correctness

- Throw and blade show the held bottle/disc only in frame 0. Frames 1–7 contain empty hands and no detached projectile, streak, icon or held duplicate. Runtime remains responsible for emitted projectiles.
- Dual contains exactly two pistols and two arms; the initially generated extra pistol in peak recoil was rejected and replaced with a newly generated two-pistol peak pose.
- Cannon contains one two-hand cannon; frame 1 uses a small muzzle flash that fits the cell.
- Channel uses open empty hands and a compact frame-1 palm flash. It has no held gun, orb or prop and no persistent detached projectile.
- No rifle or legendary long gun remains in any family’s active hands. No floating inventory icons are baked in.
- The canonical pink pig, head lotus, purple scarf, curled tail and hooves remain visible. Halo remains a separate compatible runtime overlay; it is not baked into these base sprites.

## Native inspection

- All-five contact sheet: `tmp/base-tech-motion/base-tech-native-contact.png` (1536×2800).
- Per-family native sheets: `tmp/base-tech-motion/{dual,throw,cannon,blade,channel}-native-contact.png` (1536×560).
- Individual native cells: `tmp/base-tech-motion/{family}-frame-{0..7}.png`.
- Animation previews: `tmp/base-tech-motion/{family}-cycle.gif`. These add a ready hold for inspection; GIF quantizes timing.
- Validation and per-frame hashes: `tmp/base-tech-motion/validation.json`.
- Reproduction script: `tmp/base-tech-motion/normalize.py`.

All forty frames have unique pixel hashes and were visually inspected at native size on dark and light backgrounds. Arms, torso, knees, head and scarf actually change between action phases. No frames were constructed by duplicating or translating a prior pose. The sole-registration process uses one fixed scale per family, never per-frame bbox scaling. The independently generated high-resolution dual peak pose was first resolution-normalized to the source sheet’s drawing unit before uniform atlas normalization. Ordinary resampling leaves the opaque sole edge within one pixel of the anchor.

Substantive pixels retain at least a six-pixel horizontal gutter in each family (the exact alpha bbox is in validation). The tall casting scarf and cannon peak scarf were refined through image generation so the body scale could remain consistent without clipping. Output PNG compression is lossless; source alpha was preserved.

## Generation method and prompts

Built-in `image_gen` was used throughout. Actual completed `player-fire.png` and `player-lotus-fire.png` supplied the canonical character reference. Final source PNGs are retained as `tmp/base-tech-motion/{family}-source.png`.

Common prompt: preserve exact pink flowerpig identity and polished 2D shading, head lotus, purple scarf, curled tail, brown hooves and no costume/halo; generate exactly eight distinct full-body right-facing poses in a four-column/two-row transparent sheet, same character scale and foot placement; two arms/two legs, no extra limbs; immediate frame-1 attack; real elbow/shoulder/body/knee/cloth motion rather than copies or translated frames.

Family prompts:

- Dual: two compact charcoal pistols, one per hand; split-level ready; immediate twin shot; alternating raised/extended recoil; bent-arm peak; settling arms; ready return and cloth follow-through. Final peak correction was generated as a single complete two-pistol pose, using a valid preceding recoil pose as reference.
- Throw: bottle behind right shoulder in ready; frame-1 release with empty hand; high outward extension; deep forward/downward arm arc; torso rise and empty-hand recovery. Final targeted edit removed the re-readied frame-7 bottle, leaving held prop only in frame 0.
- Cannon: one oversized compact thick lotus cannon, jade barrel, gold ornament, pink petal muzzle and turquoise bore, braced with both hands; shot, heavy raised recoil, peak brace, settling and return. Targeted refinements compacted only the flash and peak scarf to fit the cell at canonical scale.
- Blade: one silver toothed disc with teal center held across waist in ready; immediate empty-hand sidearm release; sweeping out/up follow-through and empty-hand recovery. Final targeted edit removed the re-readied frame-7 disc.
- Channel: two empty palms near chest; immediate compact lotus-petal cast; arms spread at different heights; outward palm fan; lowered hands and relaxed return; scarf follow-through. Targeted refinements compacted only the cast flash and peak scarf.

No artwork was drawn or reconstructed in code. Code only normalized resolution, cropped source cells, mechanically aligned soles, packaged PNG atlases and created inspection layouts. No gameplay code or other costume assets were edited for this work.
