# Stage 9: Brutus King restored

The historical name is **브루투스 킹**, verified in `legacy/master-c968940/game.js:672` and the captured `tests/fixtures/bosses-before-relocation.json` stage-9 definition. Stage 9 again uses its existing `boss-09` portrait/pose sheet and `bossKing` fallback atlas. Stage 1 remains the beginner guard; stage 10 remains the distinct final character and is excluded from the bestiary.

## Challenge and fairness

- Fixed side fractures at 1.05s, center at 2s, then perpendicular fracture. Mutation adds diagonal X fractures; frenzy shortens the *gap between already visible* fractures, not initial warning time.
- Mutation reacquires the current position for one hammer verdict; frenzy does this twice. Every newly acquired circle is locked and gets its own full 1.05s warning. No tracking hit and no teleport onto the target.
- Every phase opens with its signature. The support volley also has explicit locked shot lanes: 10/15 projectiles in mutation/frenzy, first release at 1.05s. No King summons or phase adds.
- At least 1.5s recovery. Signature has at most six simultaneous warning shapes and zero projectiles. Warning callbacks are canceled on phase/death and cannot hit a replaced player/stage.
- Base HP 24,000 × existing 7 × existing 3.2 = 537,600. No damage resistance, per-build HP adjustment, added phase shield or weapon nerf.
- Stage-scaled contact/fracture damage is 47.6; verdict 42.84; projectile 28.56 before armor. Existing player hit immunity still applies; no stun mechanism added.

The 58px fracture uses exactly the drawn 29px half-width for the player's footpoint; no invisible body expansion. The 82px verdict ellipse has 57.4px vertical radius. Base movement 135px/s allows 141.75px travel in a full 1.05s warning. A finite-100HP actual player, zero upgrades, no god mode, moving continuously sideways survives all three signature phases unhurt at 60 and 15 FPS. This verifies an escape policy, not a human clear-rate claim or complete boss-wave survival simulation.

## Current legal damage audit

The run-progression simulator supplies the current pre-stage-9 two-final build, with no more than six weapons/passives. Actual weapon updates, collision, boss phases/movement and stage-scaled legendary gun are used. The standing player's high HP deliberately isolates outgoing-damage pacing, so these times are not human clear-time predictions.

Across seeds 1, 7, 13:

| Build | Seconds | Patterns by phase |
| --- | ---: | --- |
| Two finals, automatic | 62.20 | 4–5 / 4 / 2–3 |
| Two finals, focused | 41.25 | 3 / 3 / 2 |
| Two finals + legendary, automatic | 46.95–47.82 | 3 / 3 / 2 |
| Two finals + legendary, focused | 34.48–34.58 | 2 / 2 / 1 |

The optimized case keeps 7.07–7.13 seconds between its frenzy signature start and death: both final verdict warnings and releases fit before defeat. Growth remains measurable: focus and legendary ownership both reduce kill time. Reward code is unchanged; stage-9 coin/chest behavior is covered by existing boss reward tests.

Regression coverage: `boss-stage-relocation.mjs`, `boss-signatures.mjs`, `alpha-boss-pacing.mjs` (legacy test filename retained), `boss-durability.mjs`, art/animation/bestiary and coin tests.
