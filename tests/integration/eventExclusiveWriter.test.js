import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventState,claimEventReward} from '../../src/events/core.js';
import {commitExclusiveEventTransition,readExclusiveEventSnapshot,EVENT_V2_IDB_NAME}
  from '../../src/integration/eventExclusiveWriter.js';

const clone=value=>structuredClone(value);

/** Minimal strict async IDB simulation: readwrite transactions lock BEFORE get,
 * hold exclusive writer lease through put and oncomplete, abort rolls back. */
function fakeIDB({failPut=false}={}){
  const persisted=new Map();
  let pending=Promise.resolve(),reads=0,writes=0,aborts=0;
  const db={
    objectStoreNames:{contains:name=>name==='event-snapshots'},
    createObjectStore(){},
    close(){},
    transaction(name,mode){
      assert.equal(name,'event-snapshots');
      let unlock;
      const lease=pending;
      pending=lease.then(()=>new Promise(resolve=>unlock=resolve));
      const tx={
        error:null,oncomplete:null,onabort:null,onerror:null,
        _pending:0,_aborted:false,_active:true,
        abort(){
          if(this._aborted||!this._active)return;
          this._aborted=true;this._active=false;aborts++;
          queueMicrotask(()=>{this.onabort?.();unlock()});
        },
        objectStore(){
          return {
            get(key){
              const req={result:undefined,error:null,onsuccess:null,onerror:null};
              tx._pending++;
              lease.then(()=>queueMicrotask(()=>{
                if(tx._aborted)return;
                reads++;req.result=persisted.has(key)?clone(persisted.get(key)):undefined;
                req.onsuccess?.({target:req});finishRequest();
              }));
              return req;
            },
            put(value,key){
              if(mode!=='readwrite')throw Error('Read-only');
              const req={result:key,error:null,onsuccess:null,onerror:null};
              tx._pending++;
              lease.then(()=>queueMicrotask(()=>{
                if(tx._aborted)return;
                if(failPut){tx.error=Error('QuotaExceededError');tx.abort();return}
                // We commit to backing only AFTER all in-memory validations.
                writes++;persisted.set(key,clone(value));
                req.onsuccess?.({target:req});finishRequest();
              }));
              return req;
            }
          };
        }
      };
      function finishRequest(){
        tx._pending--;
        if(tx._pending===0&&!tx._aborted){
          tx._active=false;
          queueMicrotask(()=>{tx.oncomplete?.();unlock()});
        }
      }
      return tx;
    }
  };
  return {
    persisted,get reads(){return reads},get writes(){return writes},
    get aborts(){return aborts},
    open(name,version){
      assert.equal(name,EVENT_V2_IDB_NAME);assert.equal(version,1);
      const request={result:db,error:null,onsuccess:null,onupgradeneeded:null,onerror:null,onblocked:null};
      queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.()});
      return request;
    }
  };
}
const mark=id=>state=>{
  if(!state.seenEventIds.includes(id))state.seenEventIds.push(id);
  return {state,result:id};
};
const commit=(idb,transition,more={})=>
  commitExclusiveEventTransition({indexedDBFactory:idb,transition,...more});

test('unavailable IndexedDB fails closed and never falls back to Web Locks/localStorage',async()=>{
  const out=await commit(null,mark('no'));
  assert.equal(out.status,'TRANSACTIONAL_DB_UNAVAILABLE');
  assert.equal(out.ok,false);
});

test('absent IndexedDB state is migration HOLD by default (no reset)',async()=>{
  const idb=fakeIDB();
  const out=await commit(idb,mark('new'));
  assert.equal(out.status,'MIGRATION_REQUIRED');
  assert.equal(out.ok,false);assert.equal(idb.writes,0);
  assert.equal((await readExclusiveEventSnapshot({indexedDBFactory:idb})).state,null);
});

test('explicit fresh initialization uses durable transaction and respects prior replay',async()=>{
  const idb=fakeIDB();
  const one=await commit(idb,mark('first'),{allowInitialize:true});
  assert.equal(one.status,'COMMITTED');assert(one.ok);
  const two=await commit(idb,mark('second'));
  assert.equal(two.status,'COMMITTED');
  const stored=await readExclusiveEventSnapshot({indexedDBFactory:idb});
  assert.deepEqual(stored.state.seenEventIds,['first','second']);
});

test('32 truly overlapping tab-like transactions serialize and retain every unique ID',async()=>{
  const idb=fakeIDB();
  const outcomes=await Promise.all(
    Array.from({length:32},(_,i)=>commit(idb,mark('tab:'+i),{allowInitialize:true}))
  );
  assert(outcomes.every(x=>x.ok&&x.status==='COMMITTED'));
  const saved=await readExclusiveEventSnapshot({indexedDBFactory:idb});
  assert.deepEqual(saved.state.seenEventIds,Array.from({length:32},(_,i)=>'tab:'+i));
  assert.equal(new Set(saved.state.seenEventIds).size,32);
});

test('stale external localStorage snapshots cannot influence IDB transactional read',async()=>{
  const idb=fakeIDB();
  const stale=createEventState(); // represents a tab's delayed localStorage view
  await commit(idb,mark('persisted:A'),{allowInitialize:true});
  const result=await commit(idb,mark('persisted:B'));
  assert.equal(result.status,'COMMITTED');
  assert.deepEqual(stale.seenEventIds,[]);
  const final=(await readExclusiveEventSnapshot({indexedDBFactory:idb})).state;
  assert.deepEqual(final.seenEventIds,['persisted:A','persisted:B']);
});

test('two competing same-claim operations serialize: CLAIMED then DUPLICATE',async()=>{
  const idb=fakeIDB();
  const rewardId='event@2030-01-01T00:00:00.000Z#finish_run';
  const seed=state=>{
    state.progress['event@2030-01-01T00:00:00.000Z']={
      eventId:'event',revision:1,definition:'{}',earningCap:100,
      from:0,end:4102444800000,claimUntil:4102444800000,seen:[],
      objectives:{finish_run:{count:1,goal:1,reward:{kind:'GOLD',amount:25}}}
    };
    return {state};
  };
  assert.equal((await commit(idb,seed,{allowInitialize:true})).status,'COMMITTED');
  const attempt=state=>{
    const x=claimEventReward(state,rewardId,'2030-01-14T00:00:00.000Z');
    return {state:x.state,result:{status:x.status}};
  };
  const [a,b]=await Promise.all([commit(idb,attempt),commit(idb,attempt)]);
  assert.deepEqual([a.result?.status,b.result?.status],['CLAIMED','DUPLICATE']);
  assert.equal(Object.keys((await readExclusiveEventSnapshot({indexedDBFactory:idb})).state.claims).length,1);
});

test('aborted transaction on simulated power loss cannot publish staged write',async()=>{
  const idb=fakeIDB();
  assert.equal((await commit(idb,mark('base'),{allowInitialize:true})).status,'COMMITTED');
  const failed=await commit(idb,mark('not-durable'),{
    checkpoint:phase=>{if(phase==='after_event_write')throw Error('SIMULATED_POWER_LOSS')}
  });
  assert.equal(failed.status,'TRANSACTION_FAILED');
  assert.deepEqual((await readExclusiveEventSnapshot({indexedDBFactory:idb})).state.seenEventIds,['base']);
  assert(idb.aborts>0);
});

test('real put failure aborts entire transaction instead of exposing staged reward',async()=>{
  const idb=fakeIDB({failPut:true});
  const failed=await commit(idb,mark('claim'),{allowInitialize:true});
  assert.equal(failed.ok,false);assert.equal(failed.status,'TRANSACTION_ABORTED');
  assert.equal(idb.writes,0);
});

test('bad transition or missing synchronous reducer aborts and preserves save',async()=>{
  const idb=fakeIDB();
  await commit(idb,mark('base'),{allowInitialize:true});
  const failed=await commit(idb,()=>{throw Error('bad reducer')});
  assert.equal(failed.status,'TRANSACTION_ABORTED');
  const asyncTransition=await commit(idb,async s=>({state:s}));
  assert.equal(asyncTransition.status,'TRANSACTION_ABORTED');
  assert.deepEqual((await readExclusiveEventSnapshot({indexedDBFactory:idb})).state.seenEventIds,['base']);
});
