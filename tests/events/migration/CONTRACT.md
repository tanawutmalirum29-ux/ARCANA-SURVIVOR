# ENGINEER-MIGRATION #48 — dormant Events legacy → IndexedDB contract

Status: **DESIGN / NEGATIVE TESTS ONLY; CUTOVER AND RUNTIME HOLD**. No production module, feature flag, wallet, Economy catalog or existing user save is modified by this PR. The separate profile/Gold wallet key is **not** an Events migration source.

## Verified source and destination (main `bef57421bde4f2f5f4396fee9a5140c4379abec1`)

- Source: `localStorage['arcana-survivor-events-v2']` through `src/integration/eventLocalStorage.js`. Despite the key name, value may have `schemaVersion: 1` or `2`. Missing key means `getItem() === null` **only**; parse failure, denied storage, undefined and JSON null mean error, never a new save.
- Legacy v1: `{schemaVersion:1,progress,claims,tokens,purchases}`. The pure `migrateEventStateV1` gathers deduped `progress[*].seen` into `seenEventIds` and adds `mintedTokens:{}` only for a provably clean ledger. Existing `claims[*].intent.idempotencyKey` and `delivered:false` outbox must remain unchanged.
- Valid v2: `{schemaVersion:2,progress,claims,tokens,purchases,seenEventIds,mintedTokens}`. Global replay IDs, token minted/balance/spend conservation, pending claim/purchase intents and ACK flags are indivisible historical data.
- Destination: IndexedDB `arcana-survivor-event-v2-transactional`, object store `event-snapshots`, record `v2`, via `src/integration/eventExclusiveWriter.js`. A `readwrite` transaction serializes origin tabs and reports COMMITTED only after `oncomplete`.
- **No legacy → IDB copy API exists in main.** `commitExclusiveEventTransition` defaults `allowInitialize=false` and returns `MIGRATION_REQUIRED` on absent IDB. Enabling `allowInitialize:true` is **not migration**: it would start a fresh Events history. Do not enable it for existing users. Standalone localStorage writer has no cross-tab serialization.

## Proposed cutover algorithm — requires separate CEO production API approval

1. **Freeze/fence all legacy Events writers and ACKs**, including already-open tabs. If any old tab may write localStorage outside a common fence, a race-free cutover cannot be proved; stop. The current Events runtime is unmounted/dormant, and must remain so. No unlock/retry based on a timer or Web Locks plus stale localStorage.
2. On same origin, read dedicated legacy key with strict absence and JSON semantics, retain exact source bytes and schema/version. Distinguish missing, corrupt, unsupported, permission denied and transient failures. A missing legacy key is not sufficient to initialize IDB without explicit attestation of a genuinely fresh profile.
3. Validate v2 with the existing Events reducer invariant validator. Convert clean v1 with `migrateEventStateV1` **only** if token history and replay provenance are genuinely complete. Refuse purchases, any EVENT_TOKEN claim, positive balance and unknown/pruned token or replay history (including an apparently zero balance whose earlier spending cannot be excluded): `LEGACY_TOKEN_HISTORY_UNKNOWN` / explicit HOLD. Do not reconstruct token mint from balance.
4. Inside **one** IDB readwrite transaction, read destination `v2`. If already populated, verify a durable migration provenance marker and full snapshot equality or a later authorized transaction lineage; otherwise `MIGRATION_CONFLICT` HOLD. Never overwrite an existing IDB ledger from a stale localStorage copy. If empty and the fenced/validated source is eligible, atomically put the complete v2 snapshot **and** a migration receipt (source checksum/schema/version, destination identity, completed marker) in the same store/transaction. No `COMMITTED` before `oncomplete`; abort leaves destination unchanged.
5. Verify committed IDB snapshot + receipt in a fresh read transaction and check that no legacy writer advanced after the freeze. If the process crashes before commit, retry from preserved source; if after commit but before verification, compare/verify existing IDB and return `ALREADY_MIGRATED` without recopy or grant. **Keep legacy bytes untouched** at all stages; any future deletion/retirement needs its own approved backup/rollback gate.
6. After an explicit authority switch, **all** Events progress, Claim, Token spend, pending outbox mutations and outbox ACKs must use the same IDB transactional authority. Never fall back to legacy localStorage; reject writes from stale tabs. IDB protects Events only, not the separate wallet transaction.
7. Wallet delivery remains OFF. Any future earned-only coordinator must persist the Events pending intent first, durably persist an idempotent wallet grant with the same key, **then** persist IDB outbox ACK. Crash after wallet write/before ACK must replay to ALREADY_APPLIED and ACK once without double grant. SEASON_XP/EVENT_TOKEN are not wallet payments; premium/real-money entitlements are excluded.

## Negative test matrix / stage gating

| Scenario | Required response and invariant | Evidence |
|---|---|---|
| Clean, complete v1 progress + Gold pending claim | Preserve global replay, exact claims and stable pending intent; duplicate claim refused | `legacySafety.test.js` |
| v1 token claim/spend or nonzero token balance | `LEGACY_TOKEN_HISTORY_UNKNOWN`; no mutation | `legacySafety.test.js` |
| v1 malformed progress replay list | Refuse; no invented event IDs | `legacySafety.test.js` |
| Corrupt/unknown v2, absent global replay or token ledger | Fail closed; zero writes | `legacySafety.test.js` |
| Bad JSON, JSON null, unsupported existing version, transient false missing key | Refuse; preserve original localStorage bytes | `legacySafety.test.js` |
| Legacy exists, IDB absent, normal writer called | `MIGRATION_REQUIRED`, zero puts; no implicit fresh state | `legacySafety.test.js` |
| Crash before IDB put / during transaction / after commit before verification | Abort/no overwrite or verified idempotent resume; legacy bytes intact | **PENDING new migration API** |
| Existing IDB data diverges from legacy / conflicting migration marker | No overwrite, do not merge receipts heuristically | **PENDING new migration API** |
| Two tabs migrate/claim/ACK concurrently, or old tab writes after cutover | One authority, serialized commit, no lost replay/claim or double ACK | **PENDING new API + real browser QA** |
| Stale localStorage writes/replays after successful cutover | IDB remains authoritative; no replay or replacement | **PENDING new API + real browser QA** |
| Wallet saved but outbox ACK interrupted | Stable key replay, no double grant; never ACK without durable wallet | **PENDING CEO wallet integration gate** |
| Source blocked/quota/IDB unavailable or corrupt | Fail closed, preserve all source data, no localStorage fallback | **PENDING new API + fault injection** |

## API_REQUEST to CEO #46 (not authorized for this branch)

Request explicit ownership for `src/integration/eventExclusiveWriter.js` (new export to stage and verify a fenced, atomic legacy copy), and if needed a **new** `src/integration/eventMigration.js` adapter (strict localStorage read, v1/v2 validation, byte/provenance checks) plus test-only fault injection. Specify the exact names/signatures and tab-fence mechanism **before** any implementation. Do not edit `src/storage.js`, `src/main.js`, Economy catalog, wallet or payment systems. If all-tab legacy write quiescence cannot be proved, return HOLD, not an unsafe best-effort copy.

**Review gates:** Node tests on exact PR HEAD; independent CEO review and QA #26 real Chromium/WebKit cross-tab/fault probes before any integration; new main CI if separately approved. This draft is test/design-only and not activation authorization.
