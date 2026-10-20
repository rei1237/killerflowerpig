# Stage-entry retry (latest user override)

Death now offers retry from the beginning of the stage where the player died. This supersedes the former forced stage1 roguelike reset.

The durable run checkpoint records entry stage, level/XP, weapons/evolutions/fusions, passives, tech, difficulty, reroll/session state, bans, consumed ingredients, pending entry choices and the one-use exchange allowance. Death preserves this entry build; retry discards the failed attempt's equipment growth and enemies/boss phase. Full HP is recomputed using current permanent purchases, with zero retry invulnerability. Normal new-stage transitions retain their existing protection.

No permanent wallet, inventory, cosmetics, pet training or purchases are restored from the run checkpoint. Coins already earned stay earned; cleared world pools cannot be collected twice. Boss fallback coins and stage-clear bounty use stable run+stage receipt IDs. Duplicate clear screens and reload replay do not credit the same permanent bounty twice. Checkpoint advancement occurs after reward choices finish and points at the next stage, so reloading the clear screen starts that next stage. Final completion removes the checkpoint.

Retry clears enemies, projectiles, hazards/poison, focus, input, pending explosion queue, pet runtime, weapon timers, boss and visual effects. UI retry closes old choice/chest/fusion/story callbacks before starting. A fresh player removes stale status/velocity. Entry choices from advanced developer starts are checkpointed when finalized; unresolved choices are serialized instead of silently lost.

Existing valid flat checkpoints migrate as entry snapshots. Missing/empty legacy run IDs receive a short durable ID; accepted IDs reserve space for reward receipt prefixes. Inherited registry names, impossible evolution flags and cyclic callers are rejected. In-memory legacy sessions without an entry checkpoint use their current valid build at their current stage. Invalid/corrupt snapshots are rejected rather than inventing a powerful build or crashing. Historical deleted/tombstoned runs cannot be recovered. If storage fails, the current session can still retry its in-memory checkpoint and warns that persistence failed; a reload cannot recover data the browser refused to write.

LocalStorage is guest persistence, not secure server authority or cross-device saving. Existing permanent save conflict semantics remain unchanged.

New service-worker dependency: src/game/stage-checkpoint.js. Regression coverage includes stages1/5/10, boss deaths, repeated retries, fresh-module reload, finalized entry choices, permanent purchases after entry, invalid saves, stale chest callback cancellation and duplicate clear settlement.

Clear settlement is atomic with durable reward flags, unlocks, kills and titles. Failed settlement blocks next-stage navigation behind an explicit save-retry action. The active run's bounded reward ledger is pinned and unaffected by cosmetic receipt churn.
