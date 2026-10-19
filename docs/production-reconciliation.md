# Production reconciliation

Verified public origin: https://killerflowerpig.vercel.app/

Before migration, the live index.html, game.js?v=5 and service-worker.js SHA256 bytes match repository master c968940838ea1dc7b8136d6d91e2c66af64b3e4a. Main uses a different HTML script query and is not the observed live artifact. Main and master have independent root histories; do not force-push either branch.

The approved new survival engine intentionally replaces the old single-file engine. Production integration must retain the old master as one parent and the tested implementation commit as another. Resolve active index/style/manifest/service-worker/Vercel configuration to the tested new engine. Preserve the former root game.js under legacy/master-c968940/game.js and master-only original sprite as inactive legacy assets, and keep the old conflicting sprite version under a legacy asset name. The new entry point must import only src/main.js, never legacy game.js.

The previous master game.js/index.html have no localStorage, IndexedDB or cookie persistence calls. Its ctx.save calls are canvas context operations, not player saves. Existing new-engine v1–v4 progression keys are independently migrated non-destructively by the v5 adapter; no wallet or inventory is reset. Legacy source history remains recoverable through the merge parent.

Manifest start_url remains relative ./ and the service-worker path remains /service-worker.js. Cache activation removes obsolete cache buckets, not localStorage progression keys. Verify the final public HTML, module and service-worker bytes against the exact deployed production commit, then perform available public-browser checks. No credential or protection-setting changes are part of this migration.
