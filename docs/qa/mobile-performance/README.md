# Mobile performance audit (2026-10-20)

Baseline: source snapshot taken before this audit from the current `feat/lotus-regalia` checkout (parent starting commit `1bc30e261da880d3e726da287e1471a82b95191e`). No simulation balance/data files changed.

## Changes
- A single owned animation request is cancelled on visibility loss and `pagehide`; `pageshow`/visibility restoration reset accumulated time and resume exactly one request chain. Gameplay remains paused until the user resumes. Practice also cancels and clears held input; cosmetic preview handles BFCache lifecycle.
- Images await `decode()` when supported before readiness. Abort and the existing timeout also cover decoding. Character cache limits and current/next-boss preloading remain unchanged.
- Minimal adaptive quality now trims optional weapon decoration (12 detail units, 6 petals, 2 impacts), retaining projectile cores, real beam footprints, warnings and collision. Normal mobile quality is unchanged. Merged beam rendering no longer allocates a spread object for each component.
- Reduced-motion rendering removes camera shake and full-screen hit flashes and stabilizes low-HP/hallucination pulsing. Damage, health, timing and the visible world are unchanged.

## Existing optimizations retained
Mobile DPR 1 and fallback .75; high-quality DPR cap 2; frozen-frame caching; pooled simulation objects and spatial grid; enemy/projectile culling; bounded particles/decals; field fill/glow budgets; lazy bounded character/boss atlases. No duplicate caches or new enemy/damage caps were added. Adaptive settings never call `configureCaps()`.

## Controlled measurements
`RENDER_BENCHMARK=1 PERF_ROOT=<source root> PERF_SCENE=<scene> PERF_TIER=<1|2> node tests/render-performance.mjs`

These are actual game drawing functions on a counting Canvas shim, with controlled fixed combat poses. They are **not phone FPS, GPU, power, or real-device measurements**. Dense fixture has 180 enemies/150 friendly shots/60 hostile shots/12 hazards/260 particles. King fixtures use the real Boss renderer and sprite cell selection, 3 two-component beams, legendary lotus projectiles and 3 bloom events; sparse King uses 3 enemies/18 shots/40 particles. All before/after snapshots report unchanged combat state.

| Scene | Tier | Canvas calls before | After |
|---|---:|---:|---:|
| Dense | 1 | 2874 | 2874 |
| Dense | 2 | 2745 | 2661 |
| King + beams + lotus | 1 | 2935 | 2935 |
| King + beams + lotus | 2 | 2806 | 2785 |
| Sparse King | 1 | 1127 | 1127 |
| Sparse King | 2 | 1126 | 1090 |

These gains are deliberately modest because the baseline was already budgeted. Timing samples are preserved in JSON but were noisy and do not support a CPU speedup claim. Paused renders issue zero Canvas calls over 120 repeated frames. Lifecycle tests now establish zero pending RAFs while hidden.

The real `updateWeapons`/`updateShots` deterministic 20-second lotus replay is byte-for-byte identical before/after for stages 1, 4, 10, moving groups, focused targeting, near/far bosses, nonowners and 15 Hz timestep (`lotus-runtime-*.json`). Existing full-suite King pacing, sparse-density, HP, XP, damage and fusion invariants also pass.

## Browser verification limitation
An attempted local headless Chromium run could not launch: the sandbox blocked its socket, and the escalation runner failed during bwrap setup on a read-only runtime path. No browser timings were produced or claimed. Browser preview smoke testing is handled separately; real-device QA is still required before making device-FPS claims.

Final shared-tree verification: `node --test tests/*.mjs` passed **814/814**, 0 failures (15.88 seconds). `node --check src/main.js` and `git diff --check` passed. This includes the branding and mobile UI commits already present in the shared checkout.
