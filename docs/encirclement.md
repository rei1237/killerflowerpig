# Timed poison-fog encirclement

Stage 5+ wave events may call `startEncirclement()`. It returns false if paused, outside ordinary play, already enclosing, or within 90 gameplay seconds of the previous warning. A successful call locks the circle center at the player's current position. The normal radius is 230 world units; smaller logical viewports use 39% of their short side (minimum 70). Resizing never changes an active wall.

- 2-second dashed gold warning, followed by a solid green fog wall for at most 7 seconds.
- Escaping outside the inner collision edge during the warning cancels the event. Activation never teleports the player across the wall.
- During the active phase, normal movement, high-speed movement, knockback, and teleported endpoints are constrained to radius minus player radius. Tangential motion is preserved; outward velocity is removed.
- The interior and wall cause no damage. Health and invulnerability timers are not modified by the enclosure. Enemies remain the combat threat.
- A readable player-relative countdown says when confinement ends. Code-native translucent fog wisps surround a clear interior, without rapid flashing, raster downloads, or particle pool pressure. Rendering uses a constant 18 wisps at every quality tier.
- Pause and hitstop freeze the event alongside gameplay. Large updates expire it rather than leaving a stale wall. Stage changes, boss transition, clearing, death, title step, run continuation, and world reset clear it. This is transient state, not checkpoint data.

`updateEncirclement(dt)` runs before player movement; the player movement hook clamps afterward. A final game-step clamp also catches displacement from later systems. `clearEncirclement()` removes a wall without resetting its cooldown; `clearWorld()` resets both for the next stage/run.

Validation: `node --test tests/encirclement.mjs tests/premium-ui.mjs` covers timing, one-wall/cooldown rules, warning escape, pause, large movement/delta, invulnerability, lifecycle cleanup, mobile radius, bounded drawing, and actual game-step integration. Browser visual verification remains separate from the DOM/runtime fixtures.

Camera: the warning smoothly interpolates from its initial camera position to the fixed enclosure center over the full two seconds. During confinement the camera remains centered and suppresses visual shake, keeping the entire fog wall and wisps within the logical mobile view even when the player touches an edge. Release resumes ordinary smooth player-follow. Existing render-derived world-to-screen and tap transforms remain the single source of truth; regression tests cover all four player extremes.
