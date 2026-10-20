# Durable reward transaction order (CEO integration, offline-only)

Gate from QA #26: an in-memory `ackReady` is **not** confirmation that a wallet grant is safely stored. Claim persistence/ACK order errors can permanently lose event/season rewards on crashes.

`src/integration/persistedRewards.js` provides a reusable, synchronous, testable local-demo coordinator, deliberately **not mounted into the game UI**:

1. The caller must first persist the event/season outbox record that contains a pending claim, using existing event/season reducers.
2. Coordinator loads **persisted outbox** and **persisted wallet** via injected stores; it refuses missing pending keys.
3. Normalize/map the pending earned-only intent and apply an idempotent economy grant.
4. **Persist wallet successfully before acknowledging the event/season outbox**. The store's write method must return literal `true` only after storage succeeds.
5. Acknowledge the outbox intent by its original key, then persist the acknowledged outbox.
6. On app restart, call `recoverPersistedGrants`. If wallet was saved but ACK was lost, replay returns `ALREADY_APPLIED` and persists ACK without double Gold. If wallet save failed, the outbox remains pending and can be retried.

Inject either `listPendingEventGrantIntents / acknowledgeEventGrant` or `listPendingSeasonGrantIntents / acknowledgeSeasonGrant` as the callbacks. The normal event/season claims must be stored before calling the coordinator. Unknown cosmetics remain `CONTENT_NOT_AVAILABLE` and **cannot** be ACKed or swapped to another skin. `SEASON_XP` and `EVENT_TOKEN` stay in their respective engines and cannot be acknowledged as wallet grants. Premium entitlements and actual payment providers remain out of scope.

`tests/integration/persistedRewards.test.js` injects crashes (before wallet write; after wallet saved/before ACK; after ACK saved), wallet/outbox save failures, unsaved claim, content unknown, local-only reward and faulty ACK, with save/reload assertions.

This is a **module-level protection**; a separate explicit CEO wiring task remains for actual `src/main.js` / `src/storage.js`, feature UI, verified event/season catalog compatibility, and real browsers/devices. Do not claim events are active merely because unit tests pass. Store backends must be designed with versioned separate keys and proper error propagation if/when connected to UI.
