# Base tech idle and walking sprites

## Final atlases

- `asset/sprites/player-base-fire-move.png`
- `asset/sprites/player-base-dual-move.png`
- `asset/sprites/player-base-throw-move.png`
- `asset/sprites/player-base-cannon-move.png`
- `asset/sprites/player-base-sword-move.png`

Each atlas is 3072×256 RGBA with eight 384×256 cells and foot/ground center `(192,240)`. Frames 0–3 are four separately drawn idle breathing/cloth poses. Frames 4–7 form an actual alternating walking cycle: contact A, passing A, contact B, passing B. Passing A visibly lifts one hoof and passing B lifts the other. Knees, legs, hips, torso, supporting arms and scarf change; these are not attack-ready sprites translated or bobbed.

The character keeps the canonical pink face, head lotus, purple scarf, curled tail, brown hooves and base outfit. The halo stays separate. Equipment remains held throughout: normal charcoal/magenta rifle; exactly two pistols; one green bottle with empty other hand; a two-hand lotus cannon; one held steel sword with empty other hand. No flashes, attacks, released projectiles, duplicate props, or gun on bottle/cannon/sword stance. Sword idle keeps a diagonal shoulder guard in all four idle poses.

## Inspection files

- Combined native contact sheet: `tmp/base-locomotion/base-locomotion-native-contact.png`.
- Per-family native contact sheets: `tmp/base-locomotion/{fire,dual,throw,cannon,sword}-native-contact.png`.
- Individual native cells: `tmp/base-locomotion/{family}-frame-{0..7}.png`.
- Independent idle and walking previews: `tmp/base-locomotion/{family}-{idle,walk}.gif`.
- Final generated sources: `tmp/base-locomotion/{family}-source.png`.
- Reproducible normalization: `tmp/base-locomotion/normalize.py`.
- Source registration, bboxes and forty unique frame hashes: `tmp/base-locomotion/validation.json`.

All five sheets were visually inspected at native size on dark/light backgrounds. The final opposite passing step was specifically checked across all five families. Every cell has a four-pixel alpha-zero guard border and all substantive pixels remain inside the guard. Each family uses one fixed scale for all eight cells; the actual brown hooves are used for registration, including both lifted and planted hooves. Ordinary sampling leaves the opaque sole edge within one pixel of y240. No code-drawn art, limb transforms, duplicated frames or translated artwork substitutes were used.

## Provenance and prompt set

Built-in `image_gen` generated each complete-character family independently using its actual canonical attack atlas as identity/equipment reference. The sword family referenced the newly completed `player-base-sword.png`. Prompted four subtle idle breathing/cloth states and four true alternating contact/passing walking steps, with same body scale, secure held equipment, two arms/two legs and no attacks or muzzle flashes. Sources were requested as four columns/two rows and then mechanically assembled into the runtime strip.

First generated sheets:
- Fire: `exec-8f0538d3-a984-4871-b25f-f1e8bcdb2768.png`.
- Dual: `exec-949d7b5c-c627-4656-8cc1-3e49f2d39d6a.png`.
- Throw: `exec-eded42a3-3436-460a-99bd-927100100888.png`.
- Cannon: `exec-6e926114-2f1a-457a-82e1-c94aa38a646d.png`.
- Sword: `exec-865c94e8-d09f-4c8c-877f-b58a395b4272.png`.

Targeted edits corrected repeated lifted-leg choice in fire, throw, cannon and sword frame7. The valid dual opposite-passing pose served as a leg-pose reference, without adopting its guns. Final passing-step corrections:
- Fire: `exec-3f83e3e3-fc2d-4d07-8222-b56a415964d3.png`.
- Throw: `exec-36e91a8d-81c8-4a44-9596-68e399166dae.png`.
- Cannon: `exec-9f67b614-4a97-4298-a657-db3819415fdc.png`.
- Sword: `exec-5b80571e-2bdf-49d1-95cd-d5f6d735e2bb.png`.

A final sword-only edit, `exec-199ed66b-dced-4534-9bd4-4323f893f37f.png`, changed idle frame3 back to relaxed diagonal guard so the idle loop does not resemble a cut; walking and all other poses remained intact.

No gameplay code, other outfit assets, or publication state was changed by this art work.
