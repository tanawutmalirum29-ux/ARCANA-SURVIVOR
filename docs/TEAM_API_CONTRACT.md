# ARCANA SURVIVOR — Parallel Module Contract (CEO-owned proposal)

Applies to #22–#26; deliberately supports isolated modules while `src/main.js` and `src/storage.js` remain CEO-only.

## 1. Domain events (game -> missions)
Use pure JSON-serializable events:
```js
{
  eventId: "run-001:kill-12", // stable per run/action, used for deduplication
  runId: "run-001",
  type: "ENEMY_KILLED", // also RUN_STARTED, SKILL_UPGRADED, BOSS_DEFEATED, RUN_FINISHED
  tick: 1234,           // deterministic gameplay tick
  payload: { enemyType: "swarmer" }
}
```
No `Date.now()` inside deterministic gameplay reducer. Online server grant validation is a separate future workstream.

## 2. Economy engine (ENGINEER-ECONOMY owns `src/economy/**`)
Target public API (proposal; refine in #24 **before** consumers depend on it):
```js
createEconomyState() // local earned balances, inventory, rewardClaims versioned
applyEconomyCommand(state, command) // {state, result}; pure, no browser/global/localStorage dependencies
```
Commands: `EARN_GOLD`, `SPEND_GOLD`, `EARN_DUST`, `CRAFT_COSMETIC`, `GRANT_REWARD`. `GRANT_REWARD` uses stable idempotencyKey to prevent duplicate claims. Cosmetic rights are offline-demo only, never paid entitlement.

## 3. Event engine (ENGINEER-EVENTS owns `src/events/**`)
Target public API:
```js
validateEventCatalog(catalog) // structured errors for invalid dates, IDs and reward references
advanceEventProgress(state, domainEvent, catalog, nowUtc) // { state, claimable[] }
claimEventReward(state, rewardId, nowUtc) // { state, rewardIntent }
```
The event engine **must not** import the economy module or mutate wallet balances. It emits `rewardIntent = {idempotencyKey, rewardType, amount, sourceRef}`, consumed by CEO integration via economy commands. One stable claimKey per account/event/objective or local demo player; event claims stay local and test-only until backend #12 is delivered.

## 4. Cosmetic presentation
Visual module takes skin ID, quality and reducedMotion, with read-only hero/world state; it must not affect damage, HP, collision or seeded enemy decisions. If new UI hook is required, post `API_REQUEST` to CEO with function name, data contract and tests.

## 5. QA contract
Validate frozen baseline and each PR head. QA can add regression tests in its own paths and comment on others' PRs, without rewriting engineer implementation.

## 6. CEO integration gate
- Validate all proposed API shapes against actual submitted code **before wiring**.
- CEO owns implementing `src/main.js` event subscriptions, economy/save adapters, wardrobe controls, test workflow and release notes; staging only until QA passes.
- Cosmetic and paid event previews **cannot** grant paid inventory or start billing; no provider/client receipt trust.
- Any contract change should be recorded in #21 and linked worker Issues. Do not silently change another role's API.
