/**
 * Durable local-demo delivery coordinator for pending Event/Season outbox rewards.
 *
 * Commit order: event/season pending record already persisted -> wallet WRITE ->
 * outbox ACK WRITE. On reboot replay still-pending intents; the wallet's idempotency
 * ledger prevents double awards. Never trust a caller-supplied reward intent.
 *
 * Stores are synchronous adapters with read(): state and write(state): true|false.
 * For localStorage, write must return true ONLY after setItem succeeds.
 * Never use this for paid entitlements / real-money currency / server grants.
 */
import {applyEarnedRewardIntent} from './rewardBridge.js';

const isFn = value => typeof value === 'function';
const hasStore = store => store && isFn(store.read) && isFn(store.write);

export function settlePersistedGrant({
  idempotencyKey, walletStore, outboxStore,
  listPending, acknowledge, checkpoint
}) {
  if(typeof idempotencyKey!=='string'||!idempotencyKey||!hasStore(walletStore)||
      !hasStore(outboxStore)||!isFn(listPending)||!isFn(acknowledge)||
      (checkpoint!==undefined&&!isFn(checkpoint))) {
    return {status:'INVALID_ARGUMENTS',acknowledged:false};
  }
  // Load the *persisted* event/season outbox before granting. A transient claim
  // must first be durably stored by its caller, or it cannot authorize a grant.
  const savedOutbox=outboxStore.read();
  const pending=listPending(savedOutbox);
  if(!Array.isArray(pending)) return {status:'INVALID_OUTBOX',acknowledged:false};
  const matching=pending.filter(entry=>entry?.idempotencyKey===idempotencyKey);
  if(matching.length===0)return {status:'NOT_PENDING',acknowledged:false};
  if(matching.length!==1)return {status:'DUPLICATE_PENDING',acknowledged:false};
  const wallet=walletStore.read();
  const granted=applyEarnedRewardIntent(wallet,matching[0]);
  if(!granted.ackReady)return {status:granted.status,acknowledged:false};
  // In particular: do NOT acknowledge based on "ackReady" alone. That only
  // means the pure reducer applied to an in-memory copy.
  checkpoint?.('before_wallet_write');
  if(walletStore.write(granted.state)!==true)
    return {status:'WALLET_SAVE_FAILED',acknowledged:false};
  checkpoint?.('after_wallet_write');
  const receipt=acknowledge(savedOutbox,idempotencyKey);
  if(receipt?.status!=='ACKNOWLEDGED'||!receipt?.state)
    return {status:'ACK_FAILED',acknowledged:false};
  if(outboxStore.write(receipt.state)!==true)
    return {status:'OUTBOX_SAVE_FAILED',acknowledged:false};
  checkpoint?.('after_outbox_write');
  return {status:granted.status,acknowledged:true};
}

/**
 * Reconcile after a fresh app load: settle only what the persisted outbox says
 * is still owed. Unsupported cosmetics and non-wallet XP/token intents remain
 * pending until their dedicated authority is available; never drop them.
 */
export function recoverPersistedGrants(options){
  const {outboxStore,listPending}=options||{};
  if(!hasStore(outboxStore)||!isFn(listPending))return [{status:'INVALID_ARGUMENTS'}];
  const pending=listPending(outboxStore.read());
  if(!Array.isArray(pending))return [{status:'INVALID_OUTBOX'}];
  const ids=[...new Set(pending.map(x=>x?.idempotencyKey).filter(x=>typeof x==='string'))];
  return ids.map(idempotencyKey=>({
    idempotencyKey,
    ...settlePersistedGrant({...options,idempotencyKey})
  }));
}
