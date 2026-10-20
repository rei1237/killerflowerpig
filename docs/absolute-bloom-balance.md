> Historical e3d3b330 balance snapshot. The later user-requested Cannon impact/focus revision supersedes Cannon damage and derived TTK below; see [current revision](cannon-impact-revision.md). Other mechanics remain unchanged.

# Absolute Bloom: narrower power and clearer boss play

The user's latest request overrides the earlier requirement that a one-slot Absolute must exceed the combined damage of all three evolved parents. It still preserves the three-beam global cap, explicit focus, inherited attacks and a meaningful premium over a single related lower final. Other absolute definitions, guns, enemy stats and boss HP are unchanged by this pass.

## Exact adjustment

| Component | Before | After |
| --- | ---: | ---: |
| Main base beam damage | 150 | 125 |
| Main base interval | 2.4s | 2.9s |
| Inherited Cannon power at Absolute Lv 1 | 1.95 | 1.60 |
| Inherited thorn/fire power at Absolute Lv 1 | 1.65 | 1.40 |
| Inherited power per extra Absolute level | +0.08 | +0.05 |
| Inherited attack/regrowth interval | original | ×1.15 |
| Inherited thorn healing per valid contact | 0.30 | 0.15 |

Only owner `absolute_bloom` receives these core adjustments. Non-Cannon source damage remains capped at 600 before the existing tier factor; no cap was inflated. Thorn healing throughput is theoretically 43.5% of the prior value at sustained contacts (0.5 / 1.15), with actual healing still requiring a real damaging contact. Level-up increments, all other absolute/core owners and focus behavior retain their existing rules.

## Same-build actual boss evidence

Reproduce with `node tools/absolute-bloom-qa.mjs --variant=current`, `--variant=prebalance`, or `--variant=76d8593`. Every variant uses the same legal pre-boss progression snapshots, planner seed 1, 16s ordinary/48s elite residency and 85% collection, actual Absolute+scatter build, Bloom tech, seeds 1/7/13 and current stage 8/9/10 boss definitions. The historical comparison loads 76d combat/data modules while retaining current boss identity/HP, avoiding an invalid comparison against the former stage 9 encounter. The prebalance variant reverses only this narrow Absolute pass on the current runtime.

| Stage | Before automatic → after | Before focused → after | Historical 76d focused | Final minimum focused pattern starts |
| --- | ---: | ---: | ---: | ---: |
| 8 | 92.6→111.6s | 74.7→89.7s | 90.3s | 21 |
| 9 | 44.0→48.9s | 36.0→41.0s | 50.2s | 11 |
| 10 | 249.2→317.6s | 215.8→271.9s | 253.0s | 63 |

All 18 final encounters kill the boss and traverse both phase transitions. Stage 10 already had a long baseline; this pass does not inflate its HP or claim a short fight. The diagnostic runs real boss movement, patterns, summons, collisions, phases and hitstop, but uses a standing high-HP player to isolate kill time. It is not survival, human clear-rate, mobile performance or browser-rendering evidence. Stage 8/10 happen to produce identical times for these three seeds; that is deterministic behavior in this setup, not three independent movement policies. No ordinary-wave director, pickups, pets, purchases or mid-fight upgrades are included.

## Retained value and regressions

The neutral 30s actual-collision probe gives fresh Absolute 108,919 boss damage versus max-level lotus 103,800 and ember 85,698; normalized boss/scatter/corridor improvement remains >5% against both related max-level finals. It retains a broad role rather than winning every scene: fresh Absolute corridor 971,280 is below ember 8's 1,053,475. Absolute Lv 8 still grows to 137,662 boss damage. These are scene probes, not assumed human DPS.

`tests/absolute-bloom-balance.mjs` checks the narrow values, all unaffected fusion data, other core owners, thorn recovery and unchanged caps. `tests/tier-order.mjs` retains route-relative single-final premiums. Only Absolute Bloom is excluded from the old combined-three-parent floor in `tests/final-fusion-combat.mjs`; all other recipes retain it. Source hashes and raw before/after/historical rows are persisted in [absolute-bloom-evidence.json](absolute-bloom-evidence.json).
