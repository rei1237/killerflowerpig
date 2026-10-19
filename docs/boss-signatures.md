# Boss encounter signatures

Each stage opens with its signature. A secondary move cannot displace it twice in a row. These are movement, spatial and timing differences, rather than reskins of the same random bullet list. Base speed, damage and contact radii retain the previous values. The later requested durability adjustment raises HP only; see `boss-durability.md`.

| Stage | Signature | Readable response |
| --- | --- | --- |
| 1 Alpha | Existing long-windup, single-lane charge with reduced early summons | Step beside the lane, punish the long recovery. Existing beginner warning/speed/recovery multipliers are unchanged. |
| 2 Elite gunner | Stationary locked corridor, 3–5 spaced machine-gun bursts, then reload | Leave the locked line once; reload always lasts at least 1.8 seconds. |
| 3 Hunter | Short marked leap followed by a perpendicular retreat | Sidestep the leap, then track the sideways landing recovery. No surprise landing ring. |
| 4 Predator sniper | Two separately reacquired sights; each tracks for .6 seconds then locks for .55 | Change direction after the sight stops; prepare for the second independent lock. |
| 5 Tank | Three forward impact circles detonate in sequence; final phase adds an offset return shell | Move to a flank/back rather than running along the artillery corridor. |
| 6 Abomination | Five acid pockets form a horseshoe around a captured position | Use the broad missing sector. Pools last 2.8 seconds; phase changes rotate the exit, not its width. |
| 7 Assassin queen | Two perpendicular, locked cuts separated by .8 seconds; the queen relocates to each advertised lane origin | Leave the first diagonal and watch the crossing second line. |
| 8 Psychic king | Two projection origins emit delayed radial echoes, each with a 90-degree missing wedge | Read the gap, then reposition for the later echo's changed bearing. |
| 9 Brutus hammer king | Outer fault lines strike first, then the center splits .95 seconds later | Begin in the center gap, then move sideways before the center strike. Slam remains a secondary. |
| 10 Time creditor | Five marked coin lanes at 1.05 seconds; a fixed hourglass contract settles at 2 seconds; final phase adds a second staggered debt mark | Dodge coins and leave the old contract footprint before settlement. Outward settlement coins leave an escape wedge. |

## Safety, animation and performance

- Stages 2–10 retain at least 1.05 seconds before their first damaging event, independent of phase. Recovery floors are 1.25–1.8 seconds depending on signature. Stage 1 retains its tested beginner values.
- Circle damage uses the existing radius and 0.7 vertical ratio. New instantaneous line damage uses exactly the rendered rectangle, without invisible radius expansion.
- Projectile sight lines use their actual locked firing angles. The financier has one sight line per outgoing coin ray.
- Windup begins with the warning. Attack poses are triggered by actual shots, leap movement or hazard release. Simulation pause still freezes both warning and sprite clocks.
- Death, phase changes and replacement patterns invalidate and remove this boss's pending warning callbacks. Unrelated friendly hazards are retained. Already emitted projectiles/acid retain the ordinary game lifecycle.
- Phase adds are explicit brute/brood behavior (stages 1 and 6), rather than an identical surprise wave on every boss.
- A final-phase signature is bounded to at most 7 simultaneous warning/acid hazards and 40 emitted projectiles before the next rest. No new hazard type, sheet, image request or unbounded particle system is added.
- Every boss supplies a short Korean `signatureHint` for the intro/HUD.

## Verification

`tests/boss-signatures.mjs` covers all ten identifiers, unchanged damage/speed/radii, early timing, each move's actual event sequence and safe area, exact sight locking, coin/hourglass settlement, bounded output, interruption cancellation and pooled marker reset. Existing animation/hazard/beginner tests still exercise the original hooks. Native canvas previews use the real rendering functions, but are not browser gameplay recordings.
