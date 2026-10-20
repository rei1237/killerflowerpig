# Base butcher sword motion

Final asset: `asset/sprites/player-base-sword.png`, 3072×256 RGBA, eight 384×256 cells, foot-center anchor `(192,240)`.

The canonical pink flowerpig keeps its face, head lotus, purple scarf, curled tail, brown hooves and base outfit. One broad steel sword with brass guard and purple grip stays in the hand throughout all eight poses. There is no gun, circular disc, detached projectile, ghost blade or floating icon. Halo remains a separate compatible overlay.

Frame order: 0 ready guard; 1 immediate horizontal impact; 2 downward slash follow-through; 3 deepest forward finish; 4 low settle; 5 recovering guard; 6 scarf follow-through; 7 ready settle. The arm, wrist, torso, knees and scarf really change pose. Attack playback should start immediately at frame 1 and recover through frames 2–7 to 0; these PNGs do not encode timing.

## Inspection and reproducibility

- Native-size contact sheet: `tmp/base-sword-motion/sword-native-contact.png`.
- Individual cells: `tmp/base-sword-motion/sword-frame-{0..7}.png`.
- Animation preview: `tmp/base-sword-motion/sword-cycle.gif` (inspection-ready holds added).
- Source: `tmp/base-sword-motion/sword-source.png`.
- Normalization: `tmp/base-sword-motion/normalize.py`.
- Registration, bboxes and eight unique frame hashes: `tmp/base-sword-motion/validation.json`.

Built-in `image_gen` created the complete character artwork using the actual completed `player-base-blade.png` and `player-fire.png` as identity references. First source: `exec-2a3cf766-159a-4e6b-9143-d29b3122c71a.png`; selected fit refinement: `exec-d82573f1-b90e-4db6-ab56-c93d2e8bdb07.png`.

Prompt: generate eight genuine full-body right-facing butcher-sword poses in a four-column/two-row transparent sheet, preserve canonical pig/lotus/scarf identity, hold one broad steel sword in the right hand in every frame, immediate impact at frame 1, then physical follow-through and guard recovery; no thrown weapons, guns, duplicate blades or trails. Targeted refinement shortened the blade and bent the impact elbow enough to keep its reach inside a native cell without shrinking the pig.

One fixed scale (0.7848101266) is used for every generated cell. Sole registration explicitly detects actual brown hooves so a low-reaching sword cannot be mistaken for the ground anchor. Standing height is approximately 222–228 px; the low finish naturally compresses the silhouette. Generated character/weapon alpha is retained. A four-pixel transparent atlas guard band clears only exterior low-alpha margin specks; every substantive artwork bbox remains inside it. Sword tips have at least six pixels of right clearance.

The source and native contact sheet were visually inspected. All eight frame hashes are distinct. No artwork was drawn or synthesized in code; normalization only rescales, aligns, packages and provides transparent padding. No gameplay code or other costume assets were edited.
