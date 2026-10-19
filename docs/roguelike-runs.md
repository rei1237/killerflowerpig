# Run lifecycle and final-tech UI

- Normal death ends the run immediately in `onPlayerDeath`, before the delayed result panel. The stage checkpoint is removed and the unique run ID is recorded in `kfp.dead-runs.v1`.
- `loadRun` and `continueRun` reject tombstoned IDs. Stage transitions also reject dead players/runs, including stale callbacks after title navigation.
- The compatibility API `retryStage()` now starts a fresh stage-1 run. Level, weapons, passives, fusion/evolution progress, run ID, and the shared one-use exchange allowance reset. Permanent wallet/shop/relic/accessory records are untouched.
- Alive continuation restores its existing checkpoint and run ID. Each stage checkpoint includes `runId` in addition to the existing build snapshot.
- Successful loadout exchange calls `markLoadoutExchangeSpent` through the UI event hook, immediately saving the spent flag while preserving checkpoint inventory.
- Death persists its tombstone independently of checkpoint deletion. If deletion fails, overwriting the checkpoint with a dead marker is attempted. Any storage failure produces a warning; the current session still rejects dead runs in memory. When all storage writes/deletions are unavailable, persistence across a browser restart cannot be guaranteed.
- Recipe UI requires every input at Lv8 and evolved (two for final weapons, three for absolute_bloom), using actual `requiredEvolution`/`evolved` preview fields. The field guide explains base weapon → Lv8 plus required passive Lv1 → chest evolution → two evolved inputs consumed by final fusion, or three (cannon, thorns, molotov) consumed by absolute fusion. Absolute reveal displays three sources, two freed slots and a slow monumental bloom, with immediate static results for reduced-motion preferences.

Coverage in `tests/premium-ui.mjs`: alive continuation; immediate death invalidation; fresh retry and permanent-progress retention; old dead ID rejection after new run; stale stage transition rejection; tombstone/overwrite fallback and warning on storage failure; total storage failure; final recipe locking; immediate exchange budget persistence.
