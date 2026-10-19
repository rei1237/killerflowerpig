# Archived design: charged cannon and character level

Superseded by item-only growth and two-weapon fusion. See `item-fusion.md`. The old charge/character-XP modules remain for save compatibility and historical tests only; no active game hooks award character XP or enable the manual ability. Existing saved XP is retained inert with no conversion or compensation.

# Petal cannon and permanent character growth

## Rules shown to players
- The permanent character level (`캐릭터 Lv`) is separate from run/build level (`런 Lv`). A stage settlement grants one character XP per real enemy kill and a clear bonus of `50 × stage` (maximum award 10,000 XP).
- XP is saved at stage end. A killed enemy cannot award XP twice within a settlement. Unfinished-stage XP is not banked. Storage failures retain pending awards in memory and must be disclosed in the UI; closing the tab before retry succeeds loses pending rewards.
- XP needed from level L to L+1 is `100 + 20 × (L−1)`. Maximum character level is 50 (28,420 total XP).
- Cannon base damage is `80 + 12 × (L−1)`, maximum 668. Radius is `min(340, 170 + 4 × (L−1))` world units. Existing critical-hit rules may multiply damage. It strikes once in a circular area with a floral wave, including bosses through the existing boss damage/invulnerability contract.
- Normal kills charge 5 points, elites charge 10, capped at 100. No idle-time charge, repeated-kill-event charge, or charge from the cannon's own kills. The counter and wave reset each stage/retry. Charge is not a saved currency.
- Manual fire consumes all 100 points atomically before dealing damage. Pause, dead, idle and clearing modes cannot fire. UI modals must set the existing pause state. Repeated clicks and keyboard-repeat cannot double fire.

## Integration
- `resetPetalCannon()` at stage start after kill counter restoration; `creditPetalKill(enemy)` on existing kill event.
- `firePetalCannon()` on button or keyboard intent. `getPetalStatus()` supplies current values and `canFire` for UI; the action checks again independently.
- `drawPetalCannon(ctx)` under world-coordinate canvas transform. It is read-only apart from expiring the visual and uses paused game clock.
- `queueCharacterXP(amount, stableEventId)` at settlement; retain settlement identity and do not reconstruct a new ID on render or repeated clicks. `retryPendingCharacterXP()` preserves queued order across storage outages. Show `pendingCharacterXP()` when nonzero.

## Save compatibility and authority
Version 4 uses a new `kfp.progress.v4.PROFILE` key. Versions 3, 2 and legacy 1 are validated and copied without deleting or changing their source. Wallet, pets, relics, upgrades and records are retained. Character XP starts at zero for older saves. `maxClearedStage` is inferred conservatively from previous `maxStage−1`, capped at 9 unless a real explicit clear record exists. Unknown versions/corrupt saves remain protected against overwrite.

A permanent `characterRewardCount` high-water sequence prevents replay of old character rewards after the bounded receipt list is pruned. The latest award stores its amount, ID and sequence for idempotent retries. State only changes in memory after durable storage succeeds; multi-tab revision conflicts fail closed.

This is local guest progression, not cheat-resistant server authority. A future server must issue run IDs, own accepted stage/kill outcomes and award sequences, validate elapsed time and replay limits, compute XP and cannon stats from its own progression, and atomically commit outcome/XP/wallet together. A client should send intent (run ID, checkpoint ID, expected revision, idempotency key), never authoritative damage, level, currency or XP. Server integration is deliberately not enabled. Offline pending awards are memory-only, not a durable server outbox.
