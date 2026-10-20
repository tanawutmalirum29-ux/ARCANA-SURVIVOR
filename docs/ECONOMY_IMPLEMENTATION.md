# Economy Engine — Local Earned-Only Prototype

Issue: #24 (tasks #6 and #9). Owner: ENGINEER-ECONOMY. This is a pure ES module; it does not modify the running game's UI, save hooks, network or payment behavior.

## Public API

Import from `src/economy/index.js`:
- `createEconomyState()` returns a fresh serializable schema-v1 earned wallet with `balances.gold`, `balances.dust`, `inventory`, `rewardClaims`, `appliedKeys` and `ledger`.
- `applyEconomyCommand(state, command) -> { state, result }` returns a new snapshot on success and the original snapshot on failure/replay. `result = {ok,code,...}` with success code `APPLIED`, repeat code `ALREADY_APPLIED`, and error codes such as `INSUFFICIENT_BALANCE`, `INVALID_COMMAND`, `INVALID_REWARD` and `BALANCE_OVERFLOW`.
- `hydrateEconomyState(raw) -> { state, status }` accepts JSON text or an object: `LOADED`, `MIGRATED_V0` or `CORRUPT_RESET`. The caller must tell users when a corrupted save was reset. Migration v0 has only `gold`, `dust`, `unlocked_free_cosmetics` plus `schema_version: 0`. No paid entitlement migration.
- `validateEconomyState(state) -> null | errorCode` validates the local shape.

All commands require string `idempotencyKey` (stable for the *same* earn/spend/reward/transaction) and `sourceRef` (stable mission/run/event reference). Keys must be unique across distinct operations and carried forward with saves.

| Command | Additional required fields | Result |
| --- | --- | --- |
| `EARN_GOLD` | `amount` positive integer | Adds earned Gold |
| `EARN_DUST` | `amount` positive integer | Adds Arcane Dust |
| `SPEND_GOLD` | `amount` positive integer | Subtracts Gold, no item grant |
| `CRAFT_COSMETIC` | `recipeId` | Uses catalog-set Gold/Dust costs, grants one cosmetic |
| `BUY_FREE_COSMETIC` | `offerId` | Uses free-shop catalog price, grants one cosmetic |
| `GRANT_REWARD` | `rewardType` = `gold`, `dust`, `cosmetic`; `amount` or `cosmeticId` | Idempotent, local-demo-only claim; owning a cosmetic converts a later distinct reward into catalog-set Dust |

Example:

```js
import { createEconomyState, applyEconomyCommand } from "./src/economy/index.js";
let economy = createEconomyState();
let result = applyEconomyCommand(economy, {
  type: "GRANT_REWARD",
  idempotencyKey: "run:demo-001:boss-1",
  sourceRef: "run:demo-001",
  rewardType: "dust",
  amount: 200
});
if (result.result.ok) economy = result.state;
// Persist JSON.stringify(economy) via CEO-owned storage integration.
```

## Catalog and cosmetic fairness

`src/content/economy/catalog.js` contains only earned, cosmetic-only items. A Rare trail costs 140 Gold; an Epic aura is available from the free shop or by crafting; a Mythic crown is craftable for 900 Gold + 180 Arcane Dust. All prices are prototype balance hypotheses, **not** live offers. Duplicate reward conversion yields catalog-fixed Dust without re-granting items. There are no HP/attack/crit/cooldown bonuses, no Astral Gems, no real-money purchase API, and no paid entitlements.

## Integration and security

- Callers (future validated gameplay/mission reducers) must issue each earn with a stable ID. The local reducer guards duplicates, balance limits and malformed input; **it cannot prove a client earned a reward**. Local saves can be edited; it is unsafe for commercial entitlements, competitive events or online leaderboards.
- Events may emit `rewardIntent = {idempotencyKey,rewardType,amount,sourceRef}`. CEO can adapt this to `applyEconomyCommand(state,{type:"GRANT_REWARD",...rewardIntent})`, or pass `cosmeticId` for visual rewards. The events module must not directly modify the wallet.
- CEO owns `src/main.js` subscription, `src/storage.js` adapter, wardrobe ownership checks, package test script, and eventual server-authoritative ledger. Existing `npm test` targets root-level tests only. **API_REQUEST to CEO**: include `tests/economy/*.test.js` in the CI test command or run `node --test tests/economy/*.test.js` independently.
- v1 snapshot preserves appliedKeys forever in the prototype so saved/reloaded commands cannot grant again; never truncate them without a documented migration and reconciliation plan. A corrupt reset explicitly loses replay protection for the lost snapshot and must not be used to reconcile real rewards.
- Keep future payment provider receipts, paid grants, real user IDs, profile merges and server validation in separate gated workstreams (#12/#13). `ledger` here is a local audit trail, **not** the authoritative server wallet transaction ledger in DATA_SCHEMA.md.

## Tests and scope

Run `node --test tests/economy/economy.test.js` in Node >=20. Test cases cover earn/spend/craft/free shop, replay across serialized snapshots, no double claim, duplicate conversion, insufficient funds, overflow, unknown IDs, invalid amounts, v0 migration, corrupt save fallback, and no-stat cosmetics. `npm test` / `npm run build` should also be run by CEO/CI after integration. No real-device/browser or payment testing is claimed by this worker.
