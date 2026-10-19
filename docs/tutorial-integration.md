# Illustrated survival guide

Owned files: `src/ui/tutorial.js`, `src/ui/tutorial.css`, `asset/tutorial/`, `tests/tutorial.mjs`, `tools/tutorial-browser-qa.mjs`.

Import `initTutorial`, `openTutorial`, `shouldOfferTutorial`, `isTutorialOpen` from the module. Link the standalone CSS. Initialize once with `onOpen` and `onClose` callbacks that manage the game's existing modal stack, pause and input state. The guide does not mutate game state. `onDone` runs after close and focus restoration, including on Skip/Escape. For the first new run, check `shouldOfferTutorial()` and use `openTutorial({onDone: beginStory})`; otherwise begin the story directly. Title and pause entry points simply call `openTutorial()`.

Repeated opening is a no-op, preventing stacked callbacks. Back/Next clamp to six steps. Escape and Skip dismiss; both count as acknowledgment to avoid repeatedly forcing onboarding. The dedicated `kfp.tutorial.v1` key contains only `done`; player progression storage is untouched. Storage errors do not block UI; a session flag prevents repeated first-run prompts in that session. Reopening manually always starts at step one.

Keyboard events are captured before the game's global handlers. Tab loops through enabled buttons; opening focuses Next; closing restores the invoking control. Existing inert states of body siblings are preserved. The integrator must still pause the simulation and reset movement on opening. The guide can safely remain nested over pause without resuming the underlying battle prematurely.

## Art
- `asset/tutorial/field-guide.webp`: new built-in image generation, transparent hero instructional illustration based on the provided Flowerpig identity. 700×560, 78,694 bytes.
- `asset/tutorial/yeongnyang.webp`: optimized existing generated profile-faithful cat art. 584×600, 74,690 bytes.
- `asset/tutorial/moon-hat.webp`: optimized existing generated moon hat. 600×600, 44,934 bytes.
- All alpha channels verified to contain transparent and opaque pixels; no text baked into images.

Generation prompt: polished transparent tutorial illustration, exact peach-pink chibi pig identity with lotus over left ear, purple scarf, mint-green lotus blaster and brown hooves; lively running pose, one mint projectile, sparse trail of gold coins and blue experience gems; warm outlines and softly shaded hand-painted game style; no background, UI, lettering or extra characters. Source reference: Flowerpig idle art. Built-in generation output was visually inspected, then resized and WebP-compressed without altering its content.

## Verification
`node --test tests/*.mjs`: 71 tests pass at integration checkpoint, including six guide tests for lifecycle, navigation, focus trapping, repeated calls, completion/skip, manual reopening, storage failures, asset existence and independent save key.

`node tools/tutorial-browser-qa.mjs`: optional real-browser harness for 1100×800, 390×844, 320×568 and 740×360. Requires Playwright and a launchable Chromium (CHROMIUM_PATH optional). Browser execution here is blocked by the environment: Chromium socket operation is not permitted; escalated run fails during sandbox setup. No screenshot or visual-layout pass is claimed. The source illustration itself was visually checked.
