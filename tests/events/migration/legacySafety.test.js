import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEventState, migrateEventStateV1, claimEventReward,
  listPendingEventGrantIntents
} from '../../../src/events/core.js';
import {
  createEventLocalStorage, EVENT_V2_LOCAL_KEY
} from '../../../src/integration/eventLocalStorage.js';
import {prepareStoredEventState} from '../../../src/integration/eventV2Store.js';
import {commitExclusiveEventTransition} from '../../../src/integration/eventExclusiveWriter.js';

const clone = value => structuredClone(value);

function legacyWithPendingClaim() {
  const state = createEventState();
  const period = 'event_arcane_orders@2030-01-13T00:00:00.000Z';
  const rewardId = period + '#finish_run';
  state.progress[period] = {
    eventId: 'event_arcane_orders', revision: 1, definition: '{}',
    earningCap: 0, from: 0, end: 4102444800000,
    claimUntil: 4102444800000, seen: ['pre-cutover-event'],
    objectives: {
      finish_run: {count: 1, goal: 1, reward: {kind: 'GOLD', amount: 25}}
    }
  };
  state.seenEventIds.push('pre-cutover-event');
  state.claims[rewardId] = {
    claimedAt: '2030-01-13T00:00:00.000Z', kind: 'GOLD',
    intent: {
      idempotencyKey: 'arcana:demo:' + rewardId, rewardType: 'GOLD',
      amount: 25, sourceRef: rewardId
    },
    delivered: false
  };
  state.schemaVersion = 1;
  delete state.seenEventIds;
  delete state.mintedTokens;
  return {state, rewardId};
}

function legacyStorage(raw) {
  const values = new Map([[EVENT_V2_LOCAL_KEY, raw]]);
  let writes = 0;
  const backend = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes++; values.set(key, value); }
  };
  return {
    store: createEventLocalStorage({storage: backend}),
    original: () => values.get(EVENT_V2_LOCAL_KEY),
    get writes() { return writes; }
  };
}

function emptyIdb() {
  let writes = 0;
  const db = {
    close() {},
    transaction() {
      const tx = {
        onabort: null, oncomplete: null, error: null,
        abort() { queueMicrotask(() => tx.onabort?.()); },
        objectStore() {
          return {
            get() {
              const req = {result: undefined, error: null, onsuccess: null, onerror: null};
              queueMicrotask(() => req.onsuccess?.());
              return req;
            },
            put() { writes++; throw new Error('MIGRATION_HOLD_MUST_NOT_WRITE'); }
          };
        }
      };
      return tx;
    }
  };
  return {
    open() {
      const req = {result: db, error: null, onsuccess: null, onerror: null};
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    get writes() { return writes; }
  };
}

test('safe v1 reducer conversion retains replay and the exact pending outbox receipt; source stays unchanged', () => {
  const {state, rewardId} = legacyWithPendingClaim();
  const original = clone(state);
  const migrated = migrateEventStateV1(state);
  assert.deepEqual(state, original);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.seenEventIds, ['pre-cutover-event']);
  assert.deepEqual(migrated.claims, original.claims);
  assert.deepEqual(listPendingEventGrantIntents(migrated).map(x => x.idempotencyKey),
    ['arcana:demo:' + rewardId]);
  assert.equal(claimEventReward(migrated, rewardId, '2030-01-14T00:00:00.000Z').status,
    'DUPLICATE');
});

test('v1 token claim, token spending, and nonzero token balance are migration HOLDs', () => {
  const {state} = legacyWithPendingClaim();
  const period = 'event_astral_lantern@2030-01-14T00:00:00.000Z';
  for (const mutate of [
    s => { s.claims[period + '#gather_sparks'] = {kind: 'EVENT_TOKEN', delivered: true}; },
    s => { s.purchases[period + '#shop_trail'] = {cost: 1}; },
    s => { s.tokens[period] = 1; }
  ]) {
    const original = clone(state);
    mutate(original);
    const before = clone(original);
    assert.throws(() => migrateEventStateV1(original), /LEGACY_TOKEN_HISTORY_UNKNOWN/);
    assert.deepEqual(original, before);
  }
});

test('v1 missing or damaged period replay ledger cannot authorize copy', () => {
  const {state} = legacyWithPendingClaim();
  const period = Object.keys(state.progress)[0];
  for (const value of [undefined, null, [''], [42], 'unknown']) {
    const broken = clone(state);
    if (value === undefined) delete broken.progress[period].seen;
    else broken.progress[period].seen = value;
    assert.throws(() => migrateEventStateV1(broken), /Invalid legacy progress/);
  }
});

test('an existing invalid v2 ledger is rejected with zero writes, not reset to fresh', () => {
  const {state} = legacyWithPendingClaim();
  const v2 = migrateEventStateV1(state);
  for (const mutate of [
    s => { delete s.seenEventIds; },
    s => { s.seenEventIds = []; },
    s => { s.mintedTokens = []; },
    s => { s.schemaVersion = 999; }
  ]) {
    const saved = clone(v2);
    mutate(saved);
    let writes = 0;
    const store = {read: () => clone(saved), write: () => {writes++; return true;}};
    const result = prepareStoredEventState({store});
    assert.equal(result.ok, false);
    assert.equal(writes, 0);
  }
});

test('bad JSON, JSON null and unknown versions preserve legacy bytes without a write', () => {
  for (const raw of ['{', 'null', '[]', '{"schemaVersion":999}']) {
    const legacy = legacyStorage(raw);
    const result = prepareStoredEventState({store: legacy.store});
    assert.equal(result.ok, false);
    assert.equal(legacy.writes, 0);
    assert.equal(legacy.original(), raw);
  }
});

test('a false-null first legacy read must not erase a later visible receipt', () => {
  const raw = JSON.stringify(legacyWithPendingClaim().state);
  const values = new Map([[EVENT_V2_LOCAL_KEY, raw]]);
  let reads = 0, writes = 0;
  const store = createEventLocalStorage({storage: {
    getItem(key) {return ++reads === 1 ? null : values.get(key) ?? null;},
    setItem() {writes++;}
  }});
  const result = prepareStoredEventState({store});
  assert.equal(result.status, 'READ_FAILED');
  assert.equal(writes, 0);
  assert.equal(values.get(EVENT_V2_LOCAL_KEY), raw);
});

test('legacy data alone never permits empty IDB initialization or any IDB put', async () => {
  const raw = JSON.stringify(legacyWithPendingClaim().state);
  const old = legacyStorage(raw);
  const idb = emptyIdb();
  const result = await commitExclusiveEventTransition({
    indexedDBFactory: idb,
    transition: state => ({state})
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'MIGRATION_REQUIRED');
  assert.equal(idb.writes, 0);
  assert.equal(old.original(), raw);
  assert.equal(old.writes, 0);
});
