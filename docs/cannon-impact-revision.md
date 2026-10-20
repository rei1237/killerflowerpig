# Cannon impact revision during sprite polish

Baseline: `e3d3b330c465c96cd1bc38f68c07127bd9b055da`.

The user first requested 3× damage, then explicitly replaced it with **2×** and stronger cross-tech use. The final focus instruction specifies total damage of a little more than two or three strengthened beams. Intermediate 3× and +15% focus proposals are not shipped.

## Final rules

- Beam impact damage is doubled after the existing stat/passive/tier/cap pipeline.
- Focus total is exactly **1.1 / 2.2 / 3.3 × one strengthened beam** for one/two/three capped rays. This already includes ray count; count is never multiplied a second time.
- No extra +15% focus multiplier remains.
- Cannon-family beam off-affinity penalty is reduced from 20% to 5%. The existing raw stats and all other weapon penalties are unchanged.
- Mixed final weapons apply these changes only to their Cannon impacts. Their orbit, fire, poison, healing, cooldown and other mechanics are unchanged.
- Global maximum three displayed rays, focus-only target, actual-hit geometry, targeting, width, range and cadence are unchanged.
- Fusion preview displays actual dispersed/focused impact separately instead of the lower raw shared stat.

## Ordinary Cannon, neutral global stats

| Level | Rays | Previous automatic | Final automatic | Previous focus | Final focus |
|---|---:|---:|---:|---:|---:|
| 1 | 1 | 44 | 88 | 55 | 96.8 |
| 4 | 3 | 57.8 | 115.6 | 95.88 | 448.8 |
| 8 | 3 | 65 | 130 | 141 | 660 |

Focus at three rays is 4.681× the previous focused impact because the user's latest count-based instruction replaces the previous capped 1.41× focus bonus. It is not merely 2× the previous focused hit.

## Same weapon and global stats across five techs

No purchases/pet/global passive differences; Cannon Lv8, no other inventory. Real collisions, one fresh volley each:

| Tech | Previous auto / focus | Final auto / focus |
|---|---:|---:|
| Shooting | 52 / 112.8 | 123.5 / 627 |
| Executioner | 52 / 112.8 | 123.5 / 627 |
| Plague | 52 / 112.8 | 123.5 / 627 |
| Lotus Garden | 202.8 / 439.92 | 405.6 / 2059.2 |
| Butcher | 52 / 112.8 | 123.5 / 627 |

Other-tech automatic damage rises **2.375×**, because the common 2× and reduced off-family penalty both apply. Lotus's existing explicit 2.6× affinity power and Lv7 damage imprint remain; no duplicate tech multiplier was found. Its specialization remains substantially stronger. This is intentional preservation of the accepted tech identity, not a claim of equal cannon strength across techs.

## Late boss consequence

Same legal Absolute Bloom + one-final progression build, three paired seeds, actual moving boss AI/collision, standing high-HP diagnostic. Not human survival evidence.

| Stage | Prior auto → final auto | Prior focus → final focus | Minimum final focused attack starts |
|---|---:|---:|---:|
| 8 | 111.6 → 92.6s | 89.7 → 38.7s | 9 |
| 9 | 48.9 → 42.7s | 41.0 → 18.1s | 4 |
| 10 | 317.6 → 277.2s | 271.9 → 136.9s | 32 |

Both later phases occurred in every tested encounter. Focus is now deliberately much stronger, especially stage9; enemy HP was not increased to cancel the requested buff. Absolute retains boss superiority but may trail a specialized final in an area-clearing scene. The earlier blanket +5% in every route comparison is replaced by explicit boss/role checks, without buffing its non-beam cores again.

Evidence: `cannon-impact-revision-evidence.json`. Reproduce real impact matrix with `node tools/cannon-impact-qa.mjs --variant=current` and `--variant=e3d3b330`; late-boss probe uses `tools/absolute-bloom-qa.mjs`.
