# Hunter speed-boss pass

Requested change: make Hunter a threatening speed specialist. Only stage 3 boss movement/signature and its explanatory hint change; ordinary-enemy HP is handled in a separate balance pass.

## Exact before → after

| Property | Previous Hunter | Revised Hunter |
| --- | --- | --- |
| Base chase speed | 72 | 118 (+63.9%) |
| Phase 1 / 2 chase speed | 84.96 / 97.92 | 139.24 / 160.48, preserving ×1.18 / ×1.36 |
| Chase path | Direct pursuit | Normalized lateral pursuit, lateral component .6, inward component 1 beyond 160 units / .35 inside 160; side alternates with combos |
| Signature | One leap then 105-unit sideways retreat at 210/s | Two separately aimed, locked dashes; contact ends the combo early |
| Warning | 1.05 seconds | First .65 seconds, second .50 seconds, unchanged at every phase |
| Dash speed | 460/s | 650 / 702 / 754 per phase (+8% per phase) |
| Travel cap | 330 units | 350 per dash, minimum planned length 160 |
| Recovery | Moving retreat, then ordinary chase during attack cooldown | Stationary, contact-safe 1.25 seconds after second dash or dash contact; also on phase interruption |
| Additional attack cooldown after recovery | Previous randomized rest | max(1.35,1.8 / phaseMul × random(.85,1.15)) seconds; lateral chase resumes |

HP 4930, base damage 18, stage damage multiplier, phase thresholds, opening 2.2 seconds, collision radius, sheet/tint/scale, body anchors, all sprite assets and all other boss definitions remain unchanged. Hunter emits no extra projectile ring or summons.

## Collision, tells and transitions

Each warning captures the player's current position once. The second captures a fresh position only after the first dash finishes; neither direction tracks during warning or movement. The marker covers the entire swept contact capsule: full width 2×(boss radius + player radius +6), starts one contact radius behind the boss, and extends one contact radius beyond the endpoint. The rectangular warning is slightly conservative at its corners. It never advertises a narrower danger area than actual collision.

A dash solves swept segment/circle first contact, stops at contact, applies the existing contact damage once and enters recovery. A long frame cannot jump over the player. Windups and recovery do not apply the ordinary contact tick. The Hunter also does not receive the generic offscreen 300/s position correction, which would otherwise move a locked warning or interrupt stationary recovery.

Each warning is a separate state. Crossing a warning boundary does not spend the same frame's excess time moving or executing the next strike. Consequently large frame gaps cannot hide both tells inside one frame; smaller normal frame timing remains bounded. Attack poses begin when a warning releases, remain active for the dash, and switch to the recovery pose for the stationary hold. The Hunter becomes fully visible during tells/recovery; existing distant chase stealth remains.

Death and phase transitions cancel owned warnings. Stage changes and replacement player objects cancel the pending Hunter task before its second strike; stale hazard callbacks are inert. Unrelated friendly hazards remain. Phase changes retain their normal invulnerability/effects but now give Hunter the same stationary recovery before chasing again.

## Tests and controlled measurements

`node --test tests/hunter-speed.mjs tests/boss-signatures.mjs tests/boss-animation.mjs tests/beginner-balance.mjs`

Eight Hunter-specific tests cover exact speeds, preserved HP/damage/radius, lateral movement, separate fixed locks, phase-invariant tells, capped distances, long-frame swept contact, warning-side/endpoint safety, stationary recovery after miss/hit/phase, cancellation on death/stage/player replacement, and attack/recover sprite timing. Existing ten-boss, beginner and sprite tests continue to protect unrelated behavior.

Mobile-reaction geometry is simulated at 30/60 fps, all three phases, base movement 135/s and 200 ms reaction delay. During the shorter .50-second tell, remaining .30 seconds permits 40.5 units of sidestep versus 38.94 contact radius. With the renderer's short-side 600-unit mapping, a 360 px portrait viewport displays the warning about 46.7 CSS pixels wide; adaptive raster scaling does not change that logical footprint. This proves a scripted geometric escape under those assumptions, not real-phone readability, human reaction time, input latency or touch QA.

Real combat-code encounter runs use stage-3 pre-boss snapshots from the progression planner, refreshed after the additional 12% population reduction, no purchases,12 fixed seeds × starting distances 100/300/500. The weak route now explicitly uses scattered choices; the mid route uses focused choices. These labels describe both budget and policy, not merely character level:

| Build | Source | Min / median / max boss death |
| --- | --- | --- |
| Weak scattered build, level 18 | 24-second synthetic mob residency,70% XP collection, scattered policy seed 1 | 29.90 /33.08 /36.42 seconds |
| Mid focused build, level 23 | 16-second residency,85% collection, focused policy seed 1 | 10.02 /11.62 /13.22 seconds |

The weak build has shotgun 2/gas 3/thorns 3/rifle 1/saw 1, with magazine 5/hide 5/madness 1/pollen 1. It spends heavily on extra projectiles and defense while delaying weapon levels. The mid build concentrates its early offensive upgrades. All 72 encounters start a real Hunter attack and finish within the 90-second bound. Weapon firing, boss movement/phases, summons where applicable, hazards, collision and hitstop run through the real engine. The player stands still at high test HP to prevent death from truncating the measurement; ordinary-wave spawning, new mid-fight choices, pets and purchases are excluded. These results are neither survival guarantees nor predicted human clear times. Boss HP was not inflated to compensate for speed.
