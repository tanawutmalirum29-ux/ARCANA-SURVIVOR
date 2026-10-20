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
