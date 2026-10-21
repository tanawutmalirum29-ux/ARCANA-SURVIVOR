/**
 * Read-only, offline structural gate for legacy Events snapshots.
 *
 * This module deliberately NEVER grants, migrates, acknowledges, repairs or
 * writes anything. LocalStorage is untrusted: structural validation, including
 * matching the serialized definition embedded in a save, CANNOT attest to
 * historical authenticity or prior wallet deliveries.
 *
 * A structurally acceptable snapshot therefore still returns
 * LEGACY_PROVENANCE_UNKNOWN (ok:false). No caller may treat this as cutover
 * authority. This module is not wired into the gameplay/runtime.
 */
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[a-z][a-z0-9_]*$/.test(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const positive = x => Number.isSafeInteger(x) && x > 0;
const utc = s => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) &&
  Number.isFinite(Date.parse(s)) && new Date(Date.parse(s)).toISOString() === s;
const blocked = (status, detail) => ({
  ok: false, status, ...(detail ? {detail} : {})
});
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const validReward = v => plain(v) &&
  (v.kind === 'GOLD' || v.kind === 'DUST' || v.kind === 'SEASON_XP' ||
   v.kind === 'EVENT_TOKEN' || v.kind === 'COSMETIC') &&
  (v.kind === 'COSMETIC' ? id(v.item_id) && (v.amount === undefined || v.amount === 1) :
    positive(v.amount) && v.item_id === undefined);

function inspectProgress(key, value) {
  if (!plain(value) || !id(value.eventId) || !positive(value.revision) ||
      typeof value.definition !== 'string' || !integer(value.earningCap) ||
      !integer(value.from) || !integer(value.end) || !integer(value.claimUntil) ||
      !(value.from < value.end && value.end <= value.claimUntil) ||
      !Array.isArray(value.seen) || value.seen.some(v => typeof v !== 'string' || !v) ||
      new Set(value.seen).size !== value.seen.length || !plain(value.objectives)) return null;
  if (key !== value.eventId + '@' + new Date(value.from).toISOString()) return null;

  let definition;
  try { definition = JSON.parse(value.definition); } catch { return null; }
  if (!plain(definition) || definition.id !== value.eventId ||
      definition.revision !== value.revision ||
      !['once', 'daily', 'weekly'].includes(definition.type) ||
      !utc(definition.start_at) || !utc(definition.end_at) ||
      !utc(definition.claim_until) || !integer(definition.earning_cap) ||
      definition.earning_cap !== value.earningCap ||
      !Array.isArray(definition.objectives) || !definition.objectives.length) return null;

  const start = Date.parse(definition.start_at), end = Date.parse(definition.end_at);
  const graceEnd = Date.parse(definition.claim_until);
  if (!(start < end && end <= graceEnd) || value.from < start || value.from >= end) return null;
  const interval = definition.type === 'daily' ? 86400000 :
    definition.type === 'weekly' ? 604800000 : null;
  const from = interval === null ? start :
    start + Math.floor((value.from - start) / interval) * interval;
  const to = interval === null ? end : Math.min(end, from + interval);
  const until = interval === null ? graceEnd :
    Math.min(graceEnd, to + definition.grace_hours * 3600000);
  if (value.from !== from || value.end !== to || value.claimUntil !== until) return null;

  const objectives = new Map();
  for (const objective of definition.objectives) {
    if (!plain(objective) || !id(objective.id) || objectives.has(objective.id) ||
        !positive(objective.goal) || !validReward(objective.reward)) return null;
    objectives.set(objective.id, objective);
  }
  if (Object.keys(value.objectives).length !== objectives.size) return null;
  for (const [key, objective] of objectives) {
    const saved = value.objectives[key];
    if (!plain(saved) || !integer(saved.count) || saved.count > objective.goal ||
        saved.goal !== objective.goal || !same(saved.reward, objective.reward)) return null;
  }
  return {definition, objectives};
}

function validIntent(intent, receiptId, reward) {
  if (!plain(intent) || typeof intent.idempotencyKey !== 'string' ||
      intent.idempotencyKey !== 'arcana:demo:' + receiptId ||
      intent.sourceRef !== receiptId || intent.rewardType !== reward.kind ||
      intent.amount !== (reward.amount ?? 1)) return false;
  if (reward.kind === 'COSMETIC') return false; // no trusted cosmetic entitlement source
  if (own(intent, 'itemId') || own(intent, 'paid') || own(intent, 'premium')) return false;
  return Object.keys(intent).every(k =>
    ['idempotencyKey', 'sourceRef', 'rewardType', 'amount'].includes(k));
}

function validate(raw) {
  if (!plain(raw) || ![1, 2].includes(raw.schemaVersion) ||
      !['progress', 'claims', 'tokens', 'purchases'].every(k => plain(raw[k])) ||
      (raw.schemaVersion === 2 &&
        (!plain(raw.mintedTokens) || !Array.isArray(raw.seenEventIds))))
    return blocked('INVALID_SAVE');

  const progress = new Map(), replay = new Set();
  for (const [key, entry] of Object.entries(raw.progress)) {
    const verified = inspectProgress(key, entry);
    if (!verified) return blocked('INCOMPLETE_PROGRESS', key);
    progress.set(key, {...verified, entry});
    for (const eventId of entry.seen) replay.add(eventId);
  }

  if (raw.schemaVersion === 2) {
    const ids = raw.seenEventIds;
    if (ids.some(v => typeof v !== 'string' || !v) ||
        new Set(ids).size !== ids.length ||
        ids.length !== replay.size || ids.some(v => !replay.has(v)))
      return blocked('INCOMPLETE_PROGRESS', 'global replay history mismatch');
  }

  const allKeys = new Set();
  let hasTokenClaim = false;
  for (const [receiptId, claim] of Object.entries(raw.claims)) {
    const split = receiptId.lastIndexOf('#');
    if (split <= 0 || split === receiptId.length - 1)
      return blocked('MIGRATION_INVALID_RECEIPT', receiptId);
    const period = receiptId.slice(0, split), objectiveId = receiptId.slice(split + 1);
    const record = progress.get(period);
    if (!record) return blocked('INCOMPLETE_PROGRESS', receiptId);
    const objective = record.objectives.get(objectiveId);
    if (!objective || !plain(claim) || !utc(claim.claimedAt) ||
        Date.parse(claim.claimedAt) < record.entry.from ||
        Date.parse(claim.claimedAt) > record.entry.claimUntil ||
        !Number.isSafeInteger(record.entry.claimUntil) ||
        !integer(record.entry.objectives[objectiveId].count) ||
        record.entry.objectives[objectiveId].count < objective.goal ||
        claim.kind !== objective.reward.kind || typeof claim.delivered !== 'boolean')
      return blocked('MIGRATION_INVALID_RECEIPT', receiptId);

    if (claim.kind === 'EVENT_TOKEN') {
      hasTokenClaim = true;
      if (claim.intent !== null || claim.delivered !== true ||
          !integer(claim.tokensEarned) || claim.tokensEarned > objective.reward.amount)
        return blocked('MIGRATION_INVALID_RECEIPT', receiptId);
    } else {
      if (!validIntent(claim.intent, receiptId, objective.reward) ||
          own(claim, 'tokensEarned'))
        return blocked('MIGRATION_INVALID_RECEIPT', receiptId);
      if (allKeys.has(claim.intent.idempotencyKey))
        return blocked('MIGRATION_INVALID_RECEIPT', 'duplicate idempotencyKey');
      allKeys.add(claim.intent.idempotencyKey);
    }
  }

  for (const [receiptId, purchase] of Object.entries(raw.purchases)) {
    const split = receiptId.lastIndexOf('#shop_');
    if (split <= 0) return blocked('MIGRATION_INVALID_RECEIPT', receiptId);
    const period = receiptId.slice(0, split), offerId = receiptId.slice(split + 6);
    const record = progress.get(period);
    if (!record) return blocked('INCOMPLETE_PROGRESS', receiptId);
    const offers = record.definition.event_shop;
    const offer = Array.isArray(offers) && offers.find(v => v?.id === offerId);
    if (!offer || !positive(offer.cost) || !validReward(offer.reward) ||
        !plain(purchase) || purchase.cost !== offer.cost || !utc(purchase.at) ||
        typeof purchase.delivered !== 'boolean' ||
        !validIntent(purchase.intent, receiptId, offer.reward) ||
        allKeys.has(purchase.intent.idempotencyKey))
      return blocked('MIGRATION_INVALID_RECEIPT', receiptId);
    allKeys.add(purchase.intent.idempotencyKey);
  }

  // Even a current zero balance cannot prove that token history was not spent,
  // pruned or lost. No reconstruction of minted or spent tokens is attempted.
  if (hasTokenClaim || Object.keys(raw.tokens).length ||
      Object.keys(raw.purchases).length ||
      (raw.schemaVersion === 2 && Object.keys(raw.mintedTokens).length))
    return blocked('LEGACY_TOKEN_HISTORY_UNKNOWN');

  // Structural checks and embedded JSON are self-reported by localStorage.
  // There is no independent trusted historical receipt/provenance witness.
  return blocked('LEGACY_PROVENANCE_UNKNOWN',
    'structural checks passed; historical origin and prior grants are unverified');
}

/** @param {unknown} raw a parsed legacy Events JSON snapshot (no IO) */
export function validateLegacyEventSnapshot(raw) {
  try { return validate(raw); }
  catch { return blocked('INVALID_SAVE'); }
}
