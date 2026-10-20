# Permanent Yeongnyang training

Current shop prices: [higher gold shop prices](shop-pricing.md). Price examples below describe earlier revisions and are superseded by catalog 6; reward rates and item effects remain unchanged.

Requires ownership of pet_yeongnyang. Deterministic gold purchases, no random draws or real money. Tracks are independent; no stage requirement beyond acquiring the shop-exclusive pet.

| Track | Level cap | Effect at levels 0 → max | Consecutive costs | Total |
|---|---:|---|---|---:|
| Attack | 5 | Base damage14 →24, +2/level |30,50,80,120,180|460|
| Heal |3|HP3 →6 per6seconds, +1/level|40,80,140|260|
| Support |3|Coin attraction radius180 →240, +20/level|25,50,90|165|

Attack retains0.9-second cadence, at most3 targets, existing +0.8 per run level capped30 and player might scaling. Support does not create coins, increase coin value, collect chests or change XP. Healing cannot exceed maxHP. Training changes the amount/radius at the next normal action, without granting immediate HP, resetting cooldowns or respawning the pet. Purchase UI displays ownership requirement, current/next value, price and maximum level.

Save format v5 gets additive petUpgrades fields, normalized to finite integer caps. Old saves default to0; absent pet ownership strips training. Currency, cosmetics, accessories and pet ownership remain unchanged. Durable commit succeeds before the live save changes. Canonical track/expected-level request IDs make retries idempotent even after receipt eviction. Existing optimistic revision checks reject stale tabs; the facade refreshes durable state and asks for a new explicit click rather than replaying a purchase. As with the existing guest adapter, localStorage is not a server transaction or a secure account boundary; simultaneous cross-process writes are not fully serialized by browser storage.

Future server seam POST /pet-training sends only trackId, expectedLevel, expectedRevision and requestId. The server must authorize account ownership, check catalog prices and limits, and atomically debit/grant with account-scoped uniqueness and row revision locking. No server deployment is included.

New modules for precache: src/data/pet-upgrades.js, src/core/pet-upgrades.js, src/ui/pet-upgrade-shop.js. Runtime pets.js and shop screens.js are connected. Tests cover legacy migration, caps, ownership, insufficient funds, retries, reload, stale tabs/conflict refresh, storage failure, actual damage/heal/radius, unchanged timer, restart and visible UI values. Browser visual QA remains unverified.
