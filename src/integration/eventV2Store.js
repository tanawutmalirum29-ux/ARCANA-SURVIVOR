/**
 * CEO-owned offline Event v2 snapshot boundary, NOT wired into player UI.
 *
 * Stores use synchronous read(): object|null and write(object): true|false.
 * Return true only after a successful durable single-key write. Never call
 * live event reducers, wallet grants or ACKs until this boundary says READY.
 * No real-money rights and no permission to activate simulated 2030 Events.
 */
import {
  createEventState, migrateEventStateV1, listPendingEventGrantIntents
} from '../events/core.js';

const isFn=value=>typeof value==='function';
const validStore=s=>s&&isFn(s.read)&&isFn(s.write);
const copy=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const blocked=(status,error)=>({ok:false,status,...(error?{reason:String(error.message||error)}:{})});

function validated(value) {
  // Events reducer refuses missing global replay history and inconsistent
  // cumulative minted-token ledgers. Do not repair corrupt saves silently.
  listPendingEventGrantIntents(value);
  return copy(value);
}
function saveVerified(store,value,checkpoint){
  checkpoint?.('before_event_write');
  let persisted;
  try {
    if(store.write(copy(value))!==true)return blocked('WRITE_FAILED');
    checkpoint?.('after_event_write');
    persisted=store.read();
  } catch(e){
    // A callback may intentionally throw to simulate power loss; preserve it
    // for integration fault-injection. Store failures are safe activation HOLDs.
    if(e?.message==='SIMULATED_POWER_LOSS')throw e;
    return blocked('STORAGE_ERROR',e);
  }
  try {
    if(!same(validated(persisted),value))return blocked('VERIFY_FAILED');
  } catch(e){return blocked('VERIFY_FAILED',e)}
  return {ok:true,status:'READY',state:copy(persisted)};
}

/**
 * Load a durable Event v2 snapshot, explicitly migrating only safe old v1
 * snapshots. Unknown / ambiguous v1 data is preserved byte-for-byte.
 * Initial new save is persisted before accepting a signal.
 */
export function prepareStoredEventState({store,checkpoint}={}){
  if(!validStore(store)||(checkpoint!==undefined&&!isFn(checkpoint)))
    return blocked('INVALID_ARGUMENTS');
  let raw;
  try{raw=store.read()}catch(e){return blocked('READ_FAILED',e)}
  // ONLY a trusted null means that the key is genuinely absent. An undefined
  // read is a malformed or interrupted adapter response, never an empty save.
  // Reject it before writing so an existing replay/claim ledger cannot be lost.
  if(raw===undefined)return blocked('READ_FAILED',new TypeError('Event store read returned undefined'));
  if(raw===null){
    const saved=saveVerified(store,createEventState(),checkpoint);
    return saved.ok?{...saved,status:'INITIALIZED'}:saved;
  }
  if(typeof raw!=='object'||Array.isArray(raw))return blocked('INVALID_SAVE');
  if(raw.schemaVersion===2){
    try{return {ok:true,status:'LOADED',state:validated(raw)}}catch(e){return blocked('INVALID_SAVE',e)}
  }
  if(raw.schemaVersion!==1)return blocked('UNSUPPORTED_VERSION');
  let migrated;
  try{migrated=migrateEventStateV1(raw)}
  catch(e){
    return blocked(String(e?.message||'').includes('LEGACY_TOKEN_HISTORY_UNKNOWN')?
      'LEGACY_TOKEN_HISTORY_UNKNOWN':'MIGRATION_REFUSED',e);
  }
  const saved=saveVerified(store,migrated,checkpoint);
  return saved.ok?{...saved,status:'MIGRATED_V1'}:saved;
}

/**
 * Persist an Events reducer result before exposing new claims or delivering
 * its outbox. The callback receives a detached *persisted* snapshot; the
 * returned 'result' must not be interpreted as a wallet grant or an ACK.
 */
export function commitStoredEventTransition({store,transition,checkpoint}={}){
  if(!isFn(transition))return blocked('INVALID_ARGUMENTS');
  const ready=prepareStoredEventState({store,checkpoint});
  if(!ready.ok)return ready;
  let operation,next;
  try{
    operation=transition(copy(ready.state));
    next=validated(operation?.state);
  }catch(e){return blocked('TRANSITION_REFUSED',e)}
  const saved=saveVerified(store,next,checkpoint);
  return saved.ok?{...saved,status:'COMMITTED',result:operation.result??null}:saved;
}
