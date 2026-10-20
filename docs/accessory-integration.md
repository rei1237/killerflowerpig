# Premium accessories: second-batch integration contract

Current shop prices: [higher gold shop prices](shop-pricing.md). Price examples below describe earlier revisions and are superseded by catalog 6; reward rates and item effects remain unchanged.

Accessory data, durable purchase/equip, save v5 migration, player stats and pickup-radius hooks are integrated in the second-batch working tree. Six dedicated WebP icons are present. Publication is owned by the integration lead; these files do not belong to the first bug-fix snapshot.

## Data and state

`src/data/accessories.js` defines six one-time direct purchases and exactly one equipped accessory slot. Existing starter upgrades, pet, wing relic, coin income and stage gates are not altered. Asset paths are `asset/items/<id>.webp`.

Persist `accessoryInventory: string[]` and `equippedAccessory: string|null`. Add `normalizeAccessories(raw)` to the owning save schema migration/validation; old saves default to an empty inventory and null slot without altering balance or other ownership. Never debit existing owners for new prices. Strong accessories do not enter the random chest or stage loot pool.

## API

- `purchaseAccessory(state,{itemId,expectedRevision,requestId})` returns `{ok,state}` or a failure code. It validates stage, funds and revision, grants once, auto-equips the purchased item and adds a recent receipt. Already-owned items return duplicate success with no debit. UI must disclose automatic equip.
- `equipAccessory(state,id|null)` checks ownership and switches the one slot. Unchanged choice returns duplicate success.
- Commit the returned state through the existing durable save adapter before replacing live state. `commitAccessoryResult(result,commit)` is an optional helper but does not replace schema integration.
- `accessoryStats(freshStats,state)` applies only the equipped owned accessory. Invoke once on newly reconstructed stats after wing relic bonuses. Repeated recomputation must begin with fresh base stats, not the previously modified object.
- `accessoryEquipHP(currentHP,newMaxHP)` preserves or clamps current absolute HP; it never heals on equip/unequip. The player may still receive the normal full heal when starting a new stage. Avoid treating an accessory switch as a new-stage full heal.
- `pollen_lantern` supplies `pickupMultiplier=1.25`, not a change to the shared magnet stat. Multiply only XP-gem and coin attraction radii by this value in pickups; chest/bomb/meat trigger ranges remain unchanged.

## Limits

Comet boots retain the movement cap of 243. Hourglass retains the cooldown multiplier floor of 0.40. Critical chance cannot exceed 1.0. None changes manual cannon charging, its cooldown or permanent character progression.

## UI

Show each dedicated illustration, name, exact bonuses, cost, required cleared stage, owned state and active slot. Include a brief “한 번에 장신구 1개 장착” explanation. Purchasing/equipping should refresh stat previews. Provide unequip/switch without paying again. All purchases are guaranteed and gameplay-coin-only; no timers or scarcity pressure.

## Future server

The server must own catalog, price, stage unlocks, inventory and the one-slot equip rule. Authenticate account identity, transactionally debit/grant with durable request-id uniqueness, validate ownership on equip and return authoritative state. Never import local accessory inventory as trusted proof. Existing offline/server conflict policy still applies.

## Tests

`node --test tests/accessories.mjs`: six passing tests cover unique catalog, migration defaults, ownership, immutable/idempotent purchase, revision and affordability gates, one-slot effects, stat caps, pickup isolation, no equip-heal loop and failed durable write. Additional integration tests are required after save/UI/player/pickup hooks land.


## Integrated facade and schema

`core/save.js` now exports `buyAccessory(itemId, capturedRevision, requestId?)` and `setAccessory(itemId|null, capturedRevision?)`. Both return `{ok:true,duplicate:boolean}` or `{ok:false,code}`. Capture `save.revision` when rendering; refresh after a revision conflict. Default purchase IDs are `accessory:<itemId>`; inventory ownership prevents repeated charges even if old receipts expire. Durable write failures do not change the live wallet, inventory or equipment.

Schema v5 uses `kfp.progress.v5.<profile>` and imports v4, v3, v2, then the original guest save while retaining earlier keys. Accessory normalization rejects unknown ownership and unowned equipment. Existing character records, relics, pet, currency and upgrades are preserved.

`player.recomputeStats` applies accessories after relics and tracks the active slot to prevent HP gain when switching. New-stage full healing remains unchanged. Pickups apply the lantern multiplier to XP/coin attraction only.

`tests/accessory-runtime.mjs` adds six integration checks: migration, durable replay/failure/reload, real player recomputation/no-heal exploit, actual pickup isolation, distinct local illustrations and future server intent endpoints. Combined accessory test total: 12 passing.
