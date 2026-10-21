/**
 * CEO-owned offline Event v2 exclusive-writer boundary, NOT mounted in gameplay.
 *
 * Web Locks serializes participating same-origin tabs across the *entire*
 * read -> reducer -> durable write -> readback critical section.
 * localStorage alone has no CAS. Never fall back to unlocked mutation.
 * Non-participating legacy tabs and malicious clients are NOT protected.
 */
import {commitStoredEventTransition} from './eventV2Store.js';

export const EVENT_V2_EXCLUSIVE_LOCK = 'arcana-survivor:event-v2:exclusive-writer';

const reject=(status,error)=>({
  ok:false,status,...(error?{reason:String(error.message||error)}:{})
});

export async function commitExclusiveEventTransition({locks,store,transition,checkpoint}={}){
  if(typeof transition!=='function'||!store||
    typeof store.read!=='function'||typeof store.write!=='function')
    return reject('INVALID_ARGUMENTS');

  // Access to navigator.locks can throw under restricted browser environments.
  let manager;
  try { manager=locks===undefined?globalThis.navigator?.locks:locks; }
  catch(error){return reject('CROSS_TAB_LOCK_UNAVAILABLE',error);}
  if(!manager||typeof manager.request!=='function')
    return reject('CROSS_TAB_LOCK_UNAVAILABLE');

  let invoked=false;
  try {
    const result=await manager.request(
      EVENT_V2_EXCLUSIVE_LOCK,{mode:'exclusive'},lock=>{
        if(invoked)return reject('LOCK_PROTOCOL_ERROR');
        invoked=true;
        if(!lock||lock.name!==EVENT_V2_EXCLUSIVE_LOCK||lock.mode!=='exclusive')
          return reject('LOCK_NOT_EXCLUSIVE');
        // Crucially load the snapshot INSIDE the lock. Do not use a snapshot
        // previously prepared while another tab may have been writing.
        return commitStoredEventTransition({store,transition,checkpoint});
      }
    );
    if(!invoked||!result||typeof result.ok!=='boolean')
      return reject('LOCK_PROTOCOL_ERROR');
    return result;
  }catch(error){
    // Missing permission, browser lock rejection/abort and any compromised
    // lock manager must never trigger an unlocked retry.
    return reject('LOCK_REQUEST_FAILED',error);
  }
}
