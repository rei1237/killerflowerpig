# Mobile visual workload controls

Simulation remains fixed-step; adaptive rendering does not alter enemy limits, spawns, damage or collision. Automatic visual fallback changes only DPR and decorative budgets, with hysteresis. A390×844 logical viewport falls from329,160 pixels at DPR1 to185,469 at DPR0.75 (43.7% fewer), without changing the visible world. Manual quality settings remain available.

The renderer skips unchanged paused frames and hidden-tab simulation/render catch-up. Offscreen text/effects are culled; particles, decals, optional glows and weapon detail are bounded. Hostile projectiles render over friendly weapon effects. Boss sheets load current/next only, and the eight-frame pet is a327KB WebP. Six new shop illustrations total about200KB and load lazily.

Controlled before/after test: Node v24.19.0, Linux AMD EPYC9V74, counting Canvas shim, five alternating runs. Active command count3080→2901 (−5.8%); drawImage619→532 (−14.1%); text draw/stroke44→22 each;120 unchanged paused frames369600→0 commands. Median shim time0.0900→0.0865ms, median P950.2289→0.2629ms. Timing variance does not establish a reliable latency or FPS improvement. These are deterministic workload reductions, not phone/GPU measurements or a60FPS guarantee.

Regression tests verify pause/hidden behavior, logical viewport invariance, visual-only caps and unchanged gameplay state. Real device thermal, GPU and touch testing remains required.
