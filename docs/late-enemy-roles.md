# Late-stage enemy roles

The original seven rabbit definitions, atlas identities, relative XP and coin policy are retained. Ordinary enemy toughness remains 1.62×. All spawn routes apply role unlocks, including forced, elite, summon and event calls.

- Stage 5: `suicider` / 돌진 폭발체. HP 18 before scaling, XP 3. Approaches within 260 px, locks its heading with a 0.8 s warning, dashes at 300 px/s for at most 0.55 s, then stops for a 0.6 s fuse. Radius 68 blast deals `min(30, 18 × (1 + (stage − 1) × .16))` through the standard 0.5 s player invulnerability window. No contact damage, no toxic field, no enemy chain explosion. Killing it before its fuse expires disarms it. The outline marks the real blast radius and the fuse ring fills toward detonation; sidestep the locked dash and leave the circle.
- Stage 6: `gunner` / 탄환 사냥꾼. HP 28 before scaling, XP 4. Keeps a ranged distance, holds a locked golden aim line for 0.7 s, and fires one radius-5 bullet at 255 px/s. Base cooldown 2.8 s. Sidestepping or interrupting it is effective. Ordinary bullets reset pooled boss acceleration.
- Existing `spitter`: ranged spawn unlock stage 5 on every route.
- Existing `bloater`: death acid field unlock stage 5; remains the persistent area-denial enemy. The new suicider deliberately does not leave acid.

New roles use optional generated transparent images at `asset/enemies/rabbit-suicider.png` and `asset/enemies/rabbit-gunner.png`, with cached flash/elite/flipped variants and restrained movement/attack/death poses. Original rabbit atlases provide fallback if either image fails. Original seven mobs retain their art. Reduced-motion preference disables decorative bobbing; attack warnings remain visible.

## Event integration

Use `spawnEnemy('suicider', x, y, { lineX, lineY, hpMul, speedMul })`. Before stage 5 this safely returns null; events must explicitly select an earlier-stage type when desired. Directional movement runs until the player is within charge range, then the warning/dash/fuse state machine takes over. `speedMul` changes approach speed, not the carefully bounded dash or blast damage. Normal shared population caps remain in force. For gunner events use `spawnEnemy('gunner', ...)` only at stage 6+.

Tests: `node --test tests/late-enemy-roles.mjs` covers all-route gates, warning/aim locking, kill-to-disarm, overlap invulnerability and damage cap, distinct bullet behavior, and pooled-projectile reset.
