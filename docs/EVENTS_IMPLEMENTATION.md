# EVENTS IMPLEMENTATION — ENGINEER-EVENTS

**OFFLINE PROTOTYPE ONLY.** All dates in `src/content/events/` and `src/content/seasons/` are deliberately simulated **2030 UTC** test fixtures; no launch date, payments, server time or commercial entitlement is implied. The 50 premium tiers are cosmetic **previews only**, not purchase ownership or functioning art assets.

## Owned deliverables

- `src/events/core.js`: `parseUtc`, `validateEventCatalog`, `createEventState`, `advanceEventProgress`, `listClaimableEventRewards`, `claimEventReward`, `redeemEventOffer`, `listPendingEventGrantIntents`, `acknowledgeEventGrant`.
- `src/events/season.js`: `validateSeasonCatalog`, `createSeasonState`, `advanceSeasonXp`, `claimSeasonTier`, `getSeasonView`, `listPendingSeasonGrantIntents`, `acknowledgeSeasonGrant`.
- `src/content/events/s01_events.json`: three daily orders, five weekly trials, capped 250-token Astral Lantern campaign with 180/40/30-token cosmetic offers, W05 Warden boss, W08 Comet Trials.
- `src/content/seasons/season_s01.json`: four 3-week acts, 12-week simulated schedule, 50 monotonic free/pass tiers, 50 **nonfunctional** premium-preview cosmetic proposals, week-11 catch-up configuration.
- `tests/events/core.test.js`: 13 executable pure unit tests.

The free Starbound Adept cosmetic sits at **tier 42**. Illustrative XP scenario: 3 runs x 80 XP + 180 weekly XP = 420 XP/week; ten weeks = 4,200 XP and tier 42, twelve weeks = 5,040 and tier 50. This is **not** a validated balance guarantee; user playtesting remains necessary.

## Integration contract for CEO #21 and Economy #24

1. CEO supplies stable JSON domain signals `{eventId,runId,type,tick,payload}` and explicit simulated ISO UTC timestamps. Do not read system time inside deterministic gameplay logic; engine modules do not import DOM/storage/wallet.
2. `advanceEventProgress(state,domainEvent,catalog,nowUtc)` returns `{state,claimable}`. Claimable item has a `rewardId`. `claimEventReward(state,rewardId,nowUtc)` returns `{state,rewardIntent,status}`, with intent `{idempotencyKey,rewardType,amount,sourceRef,itemId?}`.
3. Reward types `GOLD`/`DUST`/`COSMETIC` are **proposed** free Economy adapter inputs; Economy must deduplicate the stable key. `EVENT_TOKEN` is credited locally **inside Events** and returns no Economy intent. `SEASON_XP` routes only to `advanceSeasonXp` with an equally stable sourceKey. CEO/ECONOMY must agree on final adapter signatures before integration.
4. Pending grants persist in the **local outbox**. A failed Economy save/grant must retry via `listPendingEventGrantIntents` or `listPendingSeasonGrantIntents` using the **same** key, then acknowledge only after verification. No purchase/paid entitlement is created by any API.
5. Daily resets at 00:00 UTC, weekly resets Monday 00:00 UTC. Events earn during `[start_at,end_at)`; earned rewards are claimable through `claim_until` inclusive. The event token shop closes at `end_at`. No unannounced mid-event edits: revised configs require explicit migration; changed definitions without revision are rejected. Local saves require version-aware migration before production.

## Verification and scope

Run `node --test tests/events/*.test.js`. The current CEO-owned `package.json` runs `node --test tests/*.test.js` and does **not** discover nested tests; CEO must update the root test script/CI after review. This worker has **not** modified `src/main.js`, `src/storage.js`, `src/engine.js`, `src/render.js`, `src/economy/**`, or shared CI/package files.

**Not verified:** project-wide npm build, browser/physical devices, gameplay integration, published assets/music/license clearance, content freeze, season staging rehearsal, live server clock, security, paid purchases. This is a self-contained deterministic test prototype, not a live event deployment. Future production requires server-authoritative user identity, signed reward records, payment gates, audit trail, rollback, and archive/rerun policy.

Refs #10 #11 #15; appointment #25; CEO #21.

## Independent config audit after module-only merge (2026-10-20)

The Events source from superseded PR #32 is already in main via CEO PR #34, still **dormant** (no wallet/shop/season UI activation or server-authoritative rewards). This review does not touch the safety-held Economy catalog or create substitute cosmetic mappings.

**New optional static validator:** `auditSeasonEventContent(season,catalog)` from `src/events/contentAudit.js`. It checks the 2030 UTC calendar: full-season recurring ranges, campaign W02–03 / W05–06 / W08–09, campaign grace within season, free casual XP targets, catch-up with no login streak, duplicate cosmetic identifiers, and cap-safe Token Festival reward fixture totals. Returns `{valid,errors}`, never creates grants. CEO must explicitly integrate this audit into a CI/content gate before activation. Run `node --test tests/events/contentAudit.test.js`.

**KNOWN ISSUE — recurrence replay, not fixed by this scoped content audit:** The current daily/weekly engine deduplicates events only inside each recurrence-window `record.seen`. The same stable `domainEvent.eventId` can be counted again after UTC midnight/Monday. Existing `tests/events/core.test.js` reuses `eventId: 'a'` across periods and does not protect against replay. Remains **INERT_OFFLINE_ONLY**. CEO must separately authorize reducer/global-source replay guard plus save migration/boundary tests before activation.

**KNOWN ISSUE — token cap after spending, not fixed in core:** `claimEventReward` bounds token minting against **current unspent balance**, not cumulative lifetime tokens earned. New content audit disallows demonstration configs whose full potential `EVENT_TOKEN` rewards exceed `earning_cap`, reducing risk in S01 fixtures only. Future token shops require authorized earned-total ledger and spend-before-claim regression before activation; arbitrary configs are still unsafe without the audit gate.

**Other holds:** Economy grants require explicit adapters for stable `GOLD`/`DUST`/`COSMETIC` intent types and persistent idempotency keys; unknown cosmetic IDs remain `CONTENT_NOT_AVAILABLE`, never substituted. Economy catalog and its rejected changes are not modified or reproduced. Premium remains display-only; no server, checkout, live grant, real money or launch permission. Independent QA/physical touch and browser integration required.

**Updated root test discovery:** The current CEO-owned `package.json` now runs `node --test` and includes nested tests. The old root-only glob warning in the original verification section above is historical.

## Events v2 reducer correctness — offline-only implementation

**Status: core fixed on Events branch; QA/CEO integration approval pending.** This supersedes the historical *known issue, not fixed* section above once the new PR is reviewed. No wallet, player UI, server authority or premium purchase may be activated merely because these pure functions pass.

- `createEventState()` returns `schemaVersion:2` with durable global `seenEventIds` and `mintedTokens` keyed by event instance. A stable domain `eventId` is counted at most once globally across daily/weekly UTC rollover, while its FIRST eligible arrival can progress more than one currently active mission. IDs must remain stable across retries/reloads; caller must persist new state atomically before treating grant intents as delivered.
- `claimEventReward` credits Token based on cumulative `mintedTokens[instance]`, **not available balance**. `tokensEarned` is persisted per Token claim. Redeeming a free shop offer reduces the balance only; spending cannot restore mint capacity. Zero-token capped claims are still marked consumed to prevent repeated attempts.
- `stateCopy` validates v2 replay IDs and token conservation `minted = current_balance + accumulated_offer_spend = sum(tokensEarned in claim ledger)` before updating. Corrupt or incomplete saves throw without silently resetting replay/cap history.
- Explicit `migrateEventStateV1(legacy)` copies v1 progress/claims and unions saved `progress[*].seen` into v2 global replay IDs **only** when v1 has no token claim/purchase history and no positive balance. V1 did not store cumulative minted amounts; any token history makes reconstruction ambiguous, so the migration throws `LEGACY_TOKEN_HISTORY_UNKNOWN`, preserving the original save. There is no automatic migration. Previously pruned or independently lost v1 replay logs cannot be recovered; the migration must remain offline/HOLD until an authoritative snapshot policy exists.
- An integrator MUST explicitly migrate, persist/verify the v2 save and only then apply any new domain event. The CEO-owned storage coordinator must handle the rollback/unsupported save status, preserve prior data when migration fails, and independently QA crash/retry around the persist-before-ACK boundary. The Events engineer did not edit `src/storage.js`, `src/main.js`, `src/integration/**` or the safety-held Economy catalog.
- Regressions: `tests/events/core.test.js` uses a genuinely new signal ID across periods; `tests/events/replayLedger.test.js` checks cross-midnight and Monday replays, unique new IDs, token claim/spend/claim under an adversarial valid config, JSON reload, v1 clean migration and unsafe legacy rejection, tampering/corrupt saves, UTC grace and frozen revision behavior.

**QA and launch holds:** independent QA #26 exact new PR SHA and CEO post-merge CI are mandatory. Other blockers (missing cosmetic IDs, runtime event/season UI, real devices, backend clock, commercial/paid ownership) remain unchanged; real event grants remain disabled.
