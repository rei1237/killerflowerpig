# CODE DESTINY progression integration

## Shipping locally

The browser currently uses a **guest, localStorage-only** adapter. There is no deployed API, account login, shared database, payment or authenticated cloud save. Browser profiles/devices do not sync, and clearing site data removes guest progress. A guest balance is editable by the player and is not trusted currency.

Schema v4 stores integer gold, existing permanent upgrade IDs, owned pet IDs, active pet, stage/kill/story records, revision and a bounded recent receipt cache. The new key is `kfp.progress.v4.guest`. Existing v3, v2, then `kfp.save.v1`, is read only when v4 is absent and is left untouched as a backup. Corrupt or newer unsupported saves are not overwritten. Purchases only update in-memory state after a successful durable write; UI should show `lastSaveError` when a write fails. Changing pet requires ownership. Local adapter checks stored revision before writing to catch an already-updated other tab; localStorage is not an atomic cross-tab transaction and must not be presented as secure concurrency.

## Gameplay / integration contract

- Enemy kill: `dropCoin(x,y, elite ? 12 : 1)`; collection calls `earnCoins` and increments run HUD gold. Do not credit these coins again at stage end. Coin piles merge above the pickup budget without discarding value.
- `queueCoins(amount, eventId)` retains failed non-repeatable rewards in memory; `retryPendingCoins()` retries them and `pendingCoinTotal()` supplies an unsaved-reward warning. This queue is lost on reload if storage remains blocked, so the UI must say so. Never queue the same reward and leave a coin pickup alive.
- Existing stage/chest/skip bonuses can call `earnCoins(integerAmount, stableEventId)` separately. The bounded 128-event cache only protects recent guest retries, not a lifetime server ledger.
- Catalog in `src/data/shop.js`: legacy upgrade IDs retained, six Yeongnyang-themed permanent items and one 180-coin pet. Stage bonuses plus early coin kills make the first companion achievable in a starter run.
- `buyUpgrade(id, capturedExpectedLevel, requestId?)` rejects stale level changes and unaffordable buys. The default purchase ID includes item and level. Use the level captured when the button was rendered to prevent stale/double clicks from buying the next tier accidentally.
- `equipPet(id|null)` supports owned pet or unequip. `upgradeLevel` works for permanent upgrades and one-time pets.
- Call `resetPets()` at stage start, `updatePets(dt)` while alive, `drawPets(ctx, optionalLoadedImage)` in world coordinates. Pet follows, attracts coins within 180 units, and strikes up to three nearby living enemies within 180 units every 0.9 seconds. Damage is 14 + 0.8 per run level capped at level 30, scaled by might, with a 25% brief slow. It heals 3 HP every 6 seconds. Attack work is bounded to one pool scan and at most three hit calls, without projectile spawning. It cannot independently open chests. Pause is inherited from the game step.

## Future online adapter (implemented seam, not deployed)

`createServerAdapter({baseUrl:'/api/kfp'})` exposes asynchronous `load()` and `buy({itemId,expectedRevision,requestId})`, validates response envelopes, uses same-origin session cookies and sends purchase intent only. It never submits client gold, prices, inventory or a purported account ID. The game must deliberately switch away from its synchronous guest facade when auth/backend integration exists; the adapter is not silently activated.

Endpoints:

- GET /api/kfp/progress → `{state: <schema v4>}`
- POST /api/kfp/purchases → `{itemId, expectedRevision, requestId, catalogVersion}` → `{state: <schema v4>}`
- Add POST /runs to obtain a server-owned run ID, and POST /runs/:id/events for sequenced event evidence. Reward amounts must be computed from validated server-owned run state; never accept the guest `earnCoins(amount)` API remotely.
- Add authenticated pet-equip intent endpoint with ownership check; client equip is not proof of ownership.

Required backend rules before production:

1. Resolve account from verified session identity. Scope every read, write, run and receipt to that identity; reject cross-user run IDs. Implement CSRF protection, Origin checks, secure cookie settings, authorization, rate limits and payload limits.
2. Store server catalog prices and item effects. In one database transaction check expected revision, balance, level/ownership, debit, grant item, record idempotency receipt and increment revision. Unique `(accountId, requestId)` prevents concurrent repeated charges. Store original request fingerprint and response; same ID with different intent is an error. Keep durable receipts at least as long as permitted retries, unlike the guest bounded cache.
3. Server validates kill rewards against a server-simulated run or independently verifiable event stream with signed/session-bound run IDs, ordered event sequence, enemy IDs, one reward per kill, and plausible limits. Merely signing client-claimed kills does not make them trustworthy.
4. Return HTTP 409 for revision/catalog conflicts and authoritative latest state. Refresh and ask user to retry against current price/ownership; never blindly replay a purchase with a new request ID. Unknown outcomes retry only the identical idempotency key.
5. When offline, online profiles are read-only for purchases. Keep offline play in a separate guest namespace and display unsynced status. Do not merge guest balances/inventory into an account automatically; any one-time guest import must be a bounded, server-reviewed grant with a one-use migration receipt.
6. Explicit account switch/logout clears the loaded online state and pending UI intents before loading another account. Never use local profile names as authentication. Keep backups, audit events and database migrations for schema evolution.

Run `node --test tests/progression-store.mjs` for migration, purchase, replay, ownership, failure, namespacing and online-intent contract tests. These tests do not verify a deployed backend.


## Earned-coin wing relics (catalog v3 / save v4)

The shop adds a 100-earned-coin chest; no money, payment, trading, cash-out or transferable value. Normal probabilities are common 60%, rare 30%, epic 10%. After nine consecutive non-epic chest results, opening ten is 100% epic, and epic resets pity. The UI must display normal rates, current effective rates, cost, pity progress and duplicate compensation before opening. There is no countdown or timed promotion.

- Common wind_feather: movement +6%; direct purchase 120; duplicate returns 20 coins.
- Rare moon_wings: movement +12%, damage +8%; direct purchase 400; duplicate returns 45 coins.
- Epic star_wings: movement +18%, damage +15%, HP +20; direct purchase 1000; duplicate returns 90 coins.

Only the strongest owned relic applies automatically; duplicates never stack stats. Existing paw speed upgrade and madness passive are retained. All movement sources combined cap at 243 (base 135 × 1.8). Stat bonuses are additive to their base multipliers. Direct purchases bypass randomness entirely, do not alter pity, and never charge again for an owned item.

`openChest(capturedCount, requestId?)` commits debit, reward ownership/duplicate compensation, count, pity and outcome receipt in one storage write. It returns `{ok,reward:{itemId,duplicate,compensation},duplicate}`; stale count or insufficient balance does not call RNG. Repeated committed requests return the same last result; older receipt replays fail without charging. UI must use the count captured by its rendered button. A failed storage write does not reveal or grant a result or debit coins. `buyRelic(id)` is the deterministic alternative. `relicStats(stats,save)` applies the strongest owned bonus and speed cap.

Backend additions: POST `/relic-chests` accepts only requestId, expectedRevision and catalogVersion. The **server** owns secure random generation, prices, rates, pity, duplicate rules and inventory. Debit+RNG outcome+grant+pity+idempotency receipt must be one database transaction, including retry recovery. POST `/relic-purchases` accepts the same fields plus itemId. Never accept a client roll, outcome, pity, reward amount or balance. Local Math.random is a guest-game convenience, not a secure server implementation. Test boundary probabilities, all pity states and duplicate outcomes against the server catalog before enabling online mode.


## Stage expansion and exclusive companion

Unlocks use persisted `maxClearedStage`, not current stage selection or replay. New players can buy HP/speed/magnet upgrades and common wing relic. Clear stage 1 to unlock might/reroll; stage 2 unlocks greed, exclusive Yeongnyang companion and rare wings; stage 4 unlocks epic wings and the random chest. Opening the entire fixed-rate chest only after stage 4 avoids offering locked outcomes or silently changing the published rates. All purchase/chest transactions must check the same gate as UI. Previously owned effects remain available when replaying earlier stages. The v4 migration derives at most nine clears from the old highest-unlocked stage; a tenth clear cannot be inferred and must be recorded on actual victory.

Yeongnyang is not included in enemy drops, boss/stage chest rewards or random relic chest outcomes. It is a direct-shop exclusive companion, with a possible separately configured event redemption route. Existing owners retain their pet.

## Event redemption: disabled placeholder

No actual birthdate/answer has been provided or inferred. No birthdate, hash, comparison, secret or active free-claim button is embedded in the client. `PET_REDEMPTION.enabled` is false. `createPetRedemptionAdapter()` refuses redemption without making a network request by default. An approved fictional/public character-event answer and an authenticated backend are required before activation. Do not use a real person's birthdate as a security secret or store it in game data.

Future POST `/api/kfp/pet-redemptions` receives an ephemeral answer plus requestId with same-origin authenticated cookies. Server-only comparison must follow an agreed data/storage plan, with no request-body logging; validate CSRF/origin, enforce bounded length and per-account plus IP rate limits/cooldown, use generic rejection messages, and allow at most one grant per account/campaign. Atomically grant pet inventory/ownership with a unique account-campaign redemption receipt; retries are idempotent. Do not trust client account/reward ownership. The client only refreshes authoritative progression after success. Do not activate this endpoint or persist/transmit a real birthdate without the required explicit data-sharing approval. Existing 429 handling is only a response handler, not an implemented server rate limiter.
