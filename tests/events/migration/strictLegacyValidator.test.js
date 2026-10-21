import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLegacyEventSnapshot as check} from '../../../src/integration/eventLegacyValidator.js';

const copy = value => structuredClone(value);
const start = '2030-01-13T00:00:00.000Z';
const period = 'event_arcane_orders@' + start;
const receipt = period + '#finish_run';

function fixture() {
  const event = {
    id: 'event_arcane_orders', revision: 1, type: 'once',
    start_at: start, end_at: '2030-01-15T00:00:00.000Z',
    claim_until: '2030-01-16T00:00:00.000Z', earning_cap: 0,
    objectives: [{id: 'finish_run', signal: 'RUN_FINISHED', goal: 1,
      reward: {kind: 'GOLD', amount: 25}}]
  };
  return {
    schemaVersion: 1,
    progress: {[period]: {
      eventId: event.id, revision: 1, definition: JSON.stringify(event),
      earningCap: 0, from: Date.parse(start), end: Date.parse(event.end_at),
      claimUntil: Date.parse(event.claim_until), seen: ['run-1'],
      objectives: {finish_run: {
        count: 1, goal: 1, reward: {kind: 'GOLD', amount: 25}
      }}
    }},
    claims: {[receipt]: {
      claimedAt: '2030-01-14T00:00:00.000Z', kind: 'GOLD',
      intent: {idempotencyKey: 'arcana:demo:' + receipt, rewardType: 'GOLD',
        amount: 25, sourceRef: receipt}, delivered: false
    }},
    tokens: {}, purchases: {}
  };
}
function expectStatus(change, status) {
  const raw = fixture();
  const original = copy(raw);
  change(raw);
  const before = copy(raw);
  const result = check(raw);
  assert.equal(result.ok, false);
  assert.equal(result.status, status, JSON.stringify(result));
  assert.deepEqual(raw, before, 'validator mutated its input');
  assert.ok(original.progress[period], 'fixture source is complete');
}

test('complete self-consistent v1 remains HOLD: localStorage is not provenance', () => {
  expectStatus(() => {}, 'LEGACY_PROVENANCE_UNKNOWN');
});
test('v2 complete structure remains HOLD and never becomes an entitlement', () => {
  expectStatus(s => {
    s.schemaVersion = 2;
    s.seenEventIds = ['run-1'];
    s.mintedTokens = {};
  }, 'LEGACY_PROVENANCE_UNKNOWN');
});
test('absent snapshot and unsupported schema are refused', () => {
  for (const value of [null, undefined, [], {}, {schemaVersion: 3}]) {
    assert.deepEqual(check(value).ok, false);
    assert.equal(check(value).status, 'INVALID_SAVE');
  }
});
test('missing claim idempotency key is refused', () => {
  expectStatus(s => {delete s.claims[receipt].intent.idempotencyKey;}, 'MIGRATION_INVALID_RECEIPT');
});
test('forged claimed amount cannot pass against the earned objective', () => {
  expectStatus(s => {s.claims[receipt].intent.amount = 999999;}, 'MIGRATION_INVALID_RECEIPT');
});
test('arbitrary but syntactically plausible reward key is rejected', () => {
  expectStatus(s => {s.claims[receipt].intent.idempotencyKey = 'arcana:demo:unrelated';},
    'MIGRATION_INVALID_RECEIPT');
});
test('reward sourceRef and rewardType must exactly match the earned reward', () => {
  expectStatus(s => {s.claims[receipt].intent.sourceRef = 'foreign';}, 'MIGRATION_INVALID_RECEIPT');
  expectStatus(s => {s.claims[receipt].intent.rewardType = 'DUST';}, 'MIGRATION_INVALID_RECEIPT');
  expectStatus(s => {s.claims[receipt].kind = 'DUST';}, 'MIGRATION_INVALID_RECEIPT');
});
test('delivered ACK must be explicit boolean', () => {
  expectStatus(s => {delete s.claims[receipt].delivered;}, 'MIGRATION_INVALID_RECEIPT');
  expectStatus(s => {s.claims[receipt].delivered = 'false';}, 'MIGRATION_INVALID_RECEIPT');
});
test('outbox receipt with missing earned period cannot be imported', () => {
  expectStatus(s => {s.progress = {};}, 'INCOMPLETE_PROGRESS');
});
test('incomplete objectives cannot masquerade as earned progress', () => {
  expectStatus(s => {delete s.progress[period].objectives;}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {s.progress[period].objectives.finish_run.count = -1;}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {s.progress[period].objectives.finish_run.count = 0;}, 'MIGRATION_INVALID_RECEIPT');
});
test('missing historical event definition or windows refuse import', () => {
  expectStatus(s => {delete s.progress[period].definition;}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {delete s.progress[period].claimUntil;}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {s.progress[period].revision = 2;}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {s.progress[period].from = 0;}, 'INCOMPLETE_PROGRESS');
});
test('invalid replay history and impossible global IDs cannot be reconstructed', () => {
  expectStatus(s => {s.progress[period].seen = ['run-1', 'run-1'];}, 'INCOMPLETE_PROGRESS');
  expectStatus(s => {s.schemaVersion = 2; s.mintedTokens = {}; s.seenEventIds = [];},
    'INCOMPLETE_PROGRESS');
});
test('token claim and even a zero-value token ledger are provenance holds', () => {
  expectStatus(s => {s.tokens[period] = 0;}, 'LEGACY_TOKEN_HISTORY_UNKNOWN');
  expectStatus(s => {
    s.schemaVersion = 2; s.seenEventIds = ['run-1']; s.mintedTokens = {[period]: 0};
  }, 'LEGACY_TOKEN_HISTORY_UNKNOWN');
});
test('unknown and premium cosmetic grants never authorize entitlement', () => {
  expectStatus(s => {
    s.progress[period].objectives.finish_run.reward = {kind: 'COSMETIC', item_id: 'premium'};
    const def = JSON.parse(s.progress[period].definition);
    def.objectives[0].reward = {kind: 'COSMETIC', item_id: 'premium'};
    s.progress[period].definition = JSON.stringify(def);
    s.claims[receipt].kind = 'COSMETIC';
    s.claims[receipt].intent.rewardType = 'COSMETIC';
    s.claims[receipt].intent.amount = 1;
    s.claims[receipt].intent.itemId = 'premium';
  }, 'MIGRATION_INVALID_RECEIPT');
});
test('purchases cannot spoof claim idempotency or spend unproven tokens', () => {
  expectStatus(s => {
    const def = JSON.parse(s.progress[period].definition);
    def.event_shop = [{id: 'trail', cost: 10, reward: {kind: 'GOLD', amount: 25}}];
    s.progress[period].definition = JSON.stringify(def);
    const purchaseId = period + '#shop_trail';
    s.purchases[purchaseId] = {
      cost: 10, at: '2030-01-14T00:00:00.000Z', delivered: false,
      intent: {...s.claims[receipt].intent}
    };
  }, 'MIGRATION_INVALID_RECEIPT');
  expectStatus(s => {
    const def = JSON.parse(s.progress[period].definition);
    def.event_shop = [{id: 'trail', cost: 10, reward: {kind: 'GOLD', amount: 25}}];
    s.progress[period].definition = JSON.stringify(def);
    const purchaseId = period + '#shop_trail';
    s.purchases[purchaseId] = {
      cost: 10, at: '2030-01-14T00:00:00.000Z', delivered: false,
      intent: {idempotencyKey:'arcana:demo:' + purchaseId, sourceRef: purchaseId,
        rewardType: 'GOLD', amount: 25}
    };
  }, 'LEGACY_TOKEN_HISTORY_UNKNOWN');
});
test('out-of-window receipt timestamp and unrecognized fields are refused', () => {
  expectStatus(s => {s.claims[receipt].claimedAt = '2040-01-01T00:00:00.000Z';},
    'MIGRATION_INVALID_RECEIPT');
  expectStatus(s => {s.claims[receipt].intent.premium = true;},
    'MIGRATION_INVALID_RECEIPT');
});
test('malicious objects and malformed JSON-shaped inputs never throw', () => {
  const cyclic = fixture(); cyclic.progress[period].seen = cyclic;
  assert.equal(check(cyclic).ok, false);
  assert.equal(check(Object.create(null)).status, 'INVALID_SAVE');
  assert.equal(check('not-json').status, 'INVALID_SAVE');
});
