# Interaction and combat updates

Focus targeting is persistent: a short tap/click selects a body, and selecting it again clears the lock. Death, a new stage/player, pooled-enemy identity reuse, or leaving the 720-unit selection leash returns to automatic targeting. Each attack still applies its own range; movement is never forced. Dragging, long presses, multitouch, modal UI and disabled input do not select enemies.

First-time new games offer the illustrated guide followed by a four-step interactive practice: movement, target selection, collecting a training coin and selecting an upgrade. Practice shares live movement/tap helpers but has isolated state and grants no wallet or inventory rewards. It can be skipped or reopened from the title/pause menu. Cancellation clears its animation/input and continuation callback.

Fusion success opens a brief, skippable reveal only after the atomic transaction succeeds. It shows both consumed ingredients, the new level-one item, its actual effects and the recovered slot. Explicit confirmation returns to the parent modal or combat; reduced motion shows the result immediately. All eight recipes are covered by UI-to-real-update/render regression tests including pooled-enemy reuse after the reveal.

Story text is manual: 65 ms per grapheme with punctuation pauses, first tap reveals the current text, and a distinct next tap after a 600 ms guard advances. There is no automatic advance. The next-stage transition explicitly selects its own chapter illustration.

Boss signatures now differ by stage: charge, fixed-lane barrage/reload, hunt leap/retreat, independently locked sniper shots, frontal artillery, toxic exits, crossing cuts, split-origin echoes, outer/central quake and financier coin volleys/hourglass settlement. Intro and archive include a concise escape hint. Boss health is strengthened by stage to match faster item growth; movement, contact damage, warning windows and body circles are retained. Warnings are cancelled on death/phase changes.

Automated tests use real modules with DOM/canvas boundaries. They establish state, event, input, reward and frame-loop behavior, not real-phone frame rate or visual layout quality. Public deployment browser verification is recorded separately after publication.

Each new item-selection event receives one reroll plus the purchased reroll bonus. Stable event IDs and a closed-event watermark prevent replay/refill; the active session retains its offered cards, budget, remaining count and revision through snapshot restoration. Reroll does not grant a new selection session. Old DOM cards are rejected after reroll, and immediate double taps cannot spend a second charge.

## Full-slot progression and gas coverage
When six weapon or passive slots are occupied, unowned entries were correctly filtered but this could strand a missing fusion/evolution partner. The tactical pause now provides an explicit, loss-disclosing exchange into an unowned ordinary item at Lv1. The old item's levels/evolution are consumed only after confirming the exact preview. Active choice sessions block swaps, preserving their cards and reroll budgets. All eight fusion recipes and eight ordinary evolutions are tested from full-slot builds; all twelve passives can reach their maximum. Evolution requires weapon Lv8 and the specified passive at least Lv1, then a field/boss chest.

Gas grenade radius is now 98 rather than 70 (+40% radius); plague fire is 100 rather than 72. The evolved following cloud now refreshes from its actual upgraded radius rather than resetting to the old hardcoded value. Elliptical damage and rendering share the same radius; pellet/saw collision sizes are unchanged.
