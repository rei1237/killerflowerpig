# Boss chest rewards

Boss chests guarantee basic run upgrades/evolutions, with one independent chance for an additional premium upgrade:

| Stage | Guaranteed basic rolls | Additional premium chance |
|---|---:|---:|
| 1–2 | 2 | 20% |
| 3–5 | 3 | 35% |
| 6–8 | 5 | 50% |
| 9–10 | 5 | 65% |

A basic roll retains existing behavior: eligible owned weapon evolution first, then an owned weapon/passive upgrade, otherwise `30 + 10 × stage` coins. This ordinary pool remains separate from shop rarity and chest pity.

A premium reward is run-only 고급 강화재: a random owned, non-banished ordinary or fused weapon gains two item levels, capped at8. At level7 it gains only one; the result explicitly reports the actual change. If no eligible weapon remains after the basic rolls, the premium reward becomes `90 + 10 × stage` coins. No new item slot is occupied. No permanent pet, accessory, relic or shop purchase enters this pool.

`bossRewardTier(stage)` returns published odds, guaranteed count and fallback values. `rollBossChest(stableRequestId)` returns `{ok,rewards,tier,premiumWon,duplicate}`; repeating the same current-run session ID returns a copy of the original result without random rolls, upgrades or coin additions. Each upgrade includes `fromLevel`, `level` and `levelsGained`; a premium entry has `premium:true`. Existing regular `rollChest(count)` behavior remains unchanged.

The UI creates one stable chest-session ID and credits only the change in run gold through the existing idempotent pending-coin queue. A storage failure retries the coin credit, never the chest roll. Run upgrades retain existing stage-checkpoint semantics; receipts are in-memory and cleared for a new run. This is local guest gameplay, not a server-authoritative reward or a new permanent save schema.
