/**
 * DORMANT Event v2 cross-tab transactional state boundary.
 *
 * Web Locks + localStorage is not safe: WebKit has lost replay IDs and
 * accepted duplicate claims when tabs see stale localStorage snapshots,
 * EVEN when each lock holder reported success. Never use that design.
 *
 * A single IndexedDB readwrite transaction on one object store performs
 * read -> synchronous reducer -> put. A result is COMMITTED only after
 * the real database transaction completes. Other origin tabs' readwrite
 * transactions on the same store serialize. No unlocked/localStorage fallback.
 *
 * New databases require explicit caller opt-in for initialization. Existing
 * legacy localStorage saves are never silently migrated or erased.
 * This module is not mounted to game UI, wallet, or payment systems.
 */
import {commitStoredEventTransition} from './eventV2Store.js';

export const EVENT_V2_IDB_NAME = 'arcana-survivor-event-v2-transactional';
export const EVENT_V2_IDB_STORE = 'event-snapshots';
export const EVENT_V2_IDB_KEY = 'v2';
const copy=value=>JSON.parse(JSON.stringify(value));
const deny=(status,error)=>({ok:false,status,...(error?{reason:String(error?.message||error)}:{})});

function factoryFrom(factory){
  try{return factory===undefined?globalThis.indexedDB:factory}
  catch{return null}
}
function openDatabase(factory){
  return new Promise((resolve,reject)=>{
    let request;
    try{request=factory.open(EVENT_V2_IDB_NAME,1)}
    catch(e){reject(e);return}
    let blocked=false;
    request.onblocked=()=>{blocked=true;reject(new Error('IndexedDB open blocked by existing connection'))};
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
    request.onupgradeneeded=()=>{
      try{
        const db=request.result;
        if(!db.objectStoreNames.contains(EVENT_V2_IDB_STORE))
          db.createObjectStore(EVENT_V2_IDB_STORE);
      }catch(e){reject(e);try{request.transaction?.abort()}catch{}}
    };
    request.onsuccess=()=>{
      if(blocked){request.result.close();return}
      resolve(request.result);
    };
  });
}

/**
 * A transaction is rejected if the origin's DB is not available. The reducer
 * must be synchronous; IndexedDB transactions cannot be held open while
 * awaiting arbitrary promises. This entire callback runs synchronously in
 * the successful IDB get request before its transaction goes idle.
 */
export async function commitExclusiveEventTransition({
  indexedDBFactory,transition,allowInitialize=false,checkpoint
}={}){
  if(typeof transition!=='function'||(checkpoint!==undefined&&typeof checkpoint!=='function')||
     typeof allowInitialize!=='boolean')return deny('INVALID_ARGUMENTS');
  const factory=factoryFrom(indexedDBFactory);
  if(!factory||typeof factory.open!=='function')return deny('TRANSACTIONAL_DB_UNAVAILABLE');
  let db;
  try{db=await openDatabase(factory)}
  catch(e){return deny('TRANSACTIONAL_DB_UNAVAILABLE',e)}
  return new Promise(resolve=>{
    let transaction,planned=null,blocked=null,finished=false;
    const finish=result=>{
      if(finished)return;finished=true;
      try{db.close()}catch{}
      resolve(result);
    };
    const abort=(status,error)=>{
      blocked=deny(status,error);
      try{transaction.abort()}catch{finish(blocked)}
    };
    try{
      transaction=db.transaction(EVENT_V2_IDB_STORE,'readwrite');
      const objectStore=transaction.objectStore(EVENT_V2_IDB_STORE);
      transaction.oncomplete=()=>finish(planned||deny('TRANSACTION_NO_COMMIT'));
      transaction.onabort=()=>finish(blocked||deny('TRANSACTION_ABORTED',transaction.error));
      transaction.onerror=()=>{}; // Aborted transaction is reported by onabort.
      const req=objectStore.get(EVENT_V2_IDB_KEY);
      req.onerror=()=>abort('DB_READ_FAILED',req.error);
      req.onsuccess=()=>{
        try{
          // IndexedDB get returns undefined for an absent key. A present,
          // corrupt value must never be treated as fresh initialization.
          const persisted=req.result;
          if(persisted===undefined&&!allowInitialize){
            abort('MIGRATION_REQUIRED');return;
          }
          if(persisted===null){
            abort('INVALID_SAVE');return;
          }
          let staged=persisted===undefined?null:copy(persisted);
          let didWrite=false;
          const store={
            read(){return staged===null?null:copy(staged)},
            write(next){staged=copy(next);didWrite=true;return true}
          };
          // Existing synchronous validation/migration/claim logic runs
          // while the DB readwrite transaction remains active.
          const result=commitStoredEventTransition({store,transition,checkpoint});
          if(!result.ok){abort(result.status,result.reason);return}
          if(!didWrite){abort('TRANSACTION_NO_WRITE');return}
          planned={...result,state:copy(staged)};
          // Queue real persistent write BEFORE leaving the read success
          // callback. Another tab cannot start its readwrite transaction
          // until ours finishes/aborts.
          objectStore.put(copy(staged),EVENT_V2_IDB_KEY);
        }catch(e){abort('TRANSACTION_FAILED',e)}
      };
    }catch(e){
      if(transaction)abort('TRANSACTION_FAILED',e);
      else finish(deny('TRANSACTION_FAILED',e));
    }
  });
}

/** Test/diagnostic reader only; never authorizes wallet delivery. */
export async function readExclusiveEventSnapshot({indexedDBFactory}={}){
  const factory=factoryFrom(indexedDBFactory);
  if(!factory||typeof factory.open!=='function')return deny('TRANSACTIONAL_DB_UNAVAILABLE');
  let db;
  try{db=await openDatabase(factory)}
  catch(e){return deny('TRANSACTIONAL_DB_UNAVAILABLE',e)}
  return new Promise(resolve=>{
    let tx,finished=false,value=null;
    const done=res=>{if(finished)return;finished=true;try{db.close()}catch{}resolve(res)};
    try{
      tx=db.transaction(EVENT_V2_IDB_STORE,'readonly');
      tx.oncomplete=()=>done({ok:true,status:'READ',state:value===undefined?null:copy(value)});
      tx.onabort=()=>done(deny('DB_READ_FAILED',tx.error));
      const req=tx.objectStore(EVENT_V2_IDB_STORE).get(EVENT_V2_IDB_KEY);
      req.onsuccess=()=>{value=req.result};
      req.onerror=()=>{try{tx.abort()}catch{done(deny('DB_READ_FAILED',req.error))}};
    }catch(e){done(deny('DB_READ_FAILED',e))}
  });
}
