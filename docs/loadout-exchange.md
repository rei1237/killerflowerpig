# Full-loadout progression and explicit exchange

## Cause and reachability audit

The level-up candidate builder intentionally excludes unowned weapons when six weapon slots are occupied, and excludes unowned passives when six passive slots are occupied. Weighting discovery or missing fusion partners cannot help an item excluded from the candidate pool. Eight base weapons and twelve passives compete for six slots in each category. A build can therefore lock itself out of a desired fusion partner or evolution passive.

The exchange route preserves both six-slot limits and allows only ONE exchange per run, shared between weapons and passives. It never silently destroys progress and does not put fusion-only items into ordinary drops. A player explicitly selects an owned item to discard and an eligible missing ordinary item to receive at Lv1. Losing the old item's levels and evolution is disclosed before confirmation. All other owned progress is retained. Banished items remain unavailable until the run resets.

Current graph verification: eight base weapons each have seven upgrade steps to Lv8 and an existing passive-linked chest evolution; eight two-evolved Lv8 final recipes and one three-evolved Lv8 absolute recipe each produce a unique fusion-only item with seven upgrades to Lv8; twelve passives each upgrade through Lv5. Tests exercise each edge using real candidate, apply-choice, fusion and chest APIs. The graph tests use a separate reset run for each recipe/passive. Every configured item can be pursued in a suitable build, but the shared one-use exchange budget prevents cycling through all builds within one run. Fusion weapons do not have a second evolution in the current data.

## UI contract

Import from `src/game/loadout-exchange.js`:

- `exchangeRemaining()`: returns 1 or 0 for the current run, shared by both item categories.
- `listExchangeTargets(kind)` with `weapon` or `passive`: missing, unbanished ordinary targets, `{id,name,icon,desc,level:1}`. This is a read-only catalog; preview still validates capacity and state.
- `previewExchange(kind, fromId, toId)`: `{ok,code,signature,removed:{id,name,icon,level,evolved},replacement:{id,name,icon,level:1},slotsAfter}`. Preview never changes inventory or budgets. Show removed level/evolution and explicit loss warning. Cancel performs no API mutation.
- `exchangeItem(kind, fromId, toId, expectedSignature)`: call only from the explicit confirmation button using the exact preview signature. On success, refresh loadout/fusion/evolution panels. The `loadoutExchanged` event contains `{kind,fromId,toId}`.

Require full slots for the selected category. A non-full loadout acquires items through the existing level-up route. Do not open an exchange over an unresolved level-up choice: `CHOICE_ACTIVE` deliberately blocks this so cached offers, reroll counts and choice receipts cannot be bypassed or refreshed for free. Exchange is usable in `play`/`boss` while the player is alive, including a paused loadout screen. Signature includes run revision, stage, loadout, player modifiers, banishment, and choice state. Restore/reset/fusion/exchange invalidate stale previews. Duplicate confirmation cannot consume again.

Failure codes: `EXCHANGE_SPENT` (run budget consumed), `INVALID_KIND`, `UNKNOWN_ITEM`, `FUSION_ONLY`, `NOT_OWNED`, `ALREADY_OWNED`, `BANISHED`, `INVALID_INVENTORY`, `SLOTS_NOT_FULL`, `CHOICE_ACTIVE`, `NOT_PLAYING`, `STALE_PREVIEW`. Re-preview or refresh the menu on failure; never retry with a fresh signature without another user confirmation.

Weapon exchanges replace one slot with a fresh instance, release the removed weapon's shots/hazards/beams, remap surviving shot slots, reset enemy/boss hit channels, and preserve pooled typed enemy hit buffers. Passive exchanges recompute stats and clamp health without granting healing (prevents heart exchange cycling). Slot limits, level-up reroll budgets, reward balances, wallet and archive are unchanged. The additive snapshot field `loadoutExchangesUsed` stores 0/1. Only `resetBuild` resets it; restore preserves the greater of current and saved usage so an older checkpoint cannot refill it. The game persists the spent flag into the stage checkpoint immediately on successful exchange, preserving checkpoint inventory. UI cancellation, reopening and rejected confirmations never consume or replenish the budget.

## Verification

Run `node --test tests/loadout-exchange.mjs` and the complete `node --test tests/*.mjs` suite. Browser integration should confirm the cancel action preserves the old item, explicit loss confirmation swaps exactly once, missing fusion partner can then be upgraded/fused, and evolution condition display matches the actual chest requirement (weapon Lv8 plus its passive at Lv1 or higher; final fusion requires both recipe weapons to have completed evolution).
