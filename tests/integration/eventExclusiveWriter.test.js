import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventState} from '../../src/events/core.js';
import {createEventLocalStorage} from '../../src/integration/eventLocalStorage.js';
import {commitExclusiveEventTransition,EVENT_V2_EXCLUSIVE_LOCK}
  from '../../src/integration/eventExclusiveWriter.js';

const deep=x=>JSON.parse(JSON.stringify(x));
const database=()=>{
 const entries=new Map();
 return {entries,getItem(key){return entries.has(key)?entries.get(key):null},
   setItem(key,value){entries.set(key,value)}};
};
const store=source=>createEventLocalStorage({storage:source});
const mark=id=>s=>{s.seenEventIds.push(id);return {state:s,result:id}};

function lockQueue(){
 let tail=Promise.resolve(),calls=[];
 return {calls,request(name,opts,fn){
   calls.push({name,opts});
   const next=tail.then(()=>fn({name,mode:opts.mode}));
   tail=next.then(()=>undefined,()=>undefined);
   return next;
 }};
}

test('refuses unavailable lock manager before reading or writing a stored event',async()=>{
 let reads=0,writes=0;
 const s={read(){reads++;return null},write(){writes++;return true}};
 const out=await commitExclusiveEventTransition({locks:null,store:s,transition:mark('never')});
 assert.equal(out.status,'CROSS_TAB_LOCK_UNAVAILABLE');
 assert.equal(reads,0);assert.equal(writes,0);
});

test('refuses shared/nonexclusive lock grant; never mutates saved state',async()=>{
 const b=database(),s=store(b);s.write(createEventState());
 const prior=b.getItem('arcana-survivor-events-v2');
 const locks={request:async(name,opts,callback)=>callback({name,mode:'shared'})};
 const out=await commitExclusiveEventTransition({locks,store:s,transition:mark('illegal')});
 assert.equal(out.status,'LOCK_NOT_EXCLUSIVE');
 assert.equal(b.getItem('arcana-survivor-events-v2'),prior);
});

test('queued concurrent tab-like writers re-read only inside exclusive lock',async()=>{
 const b=database(),locks=lockQueue(),a=store(b),c=store(b);
 const tasks=Array.from({length:30},(_,i)=>commitExclusiveEventTransition({
   locks,store:i%2===0?a:c,transition:mark('tab:'+i),
 }));
 const results=await Promise.all(tasks);
 assert(results.every(x=>x.ok&&x.status==='COMMITTED'));
 const final=a.read();
 assert.equal(final.seenEventIds.length,30);
 assert.deepEqual(final.seenEventIds,Array.from({length:30},(_,i)=>'tab:'+i));
 assert.equal(locks.calls.length,30);
 assert(locks.calls.every(x=>x.name===EVENT_V2_EXCLUSIVE_LOCK&&x.opts.mode==='exclusive'));
});

test('serial writer reload prevents stale overwrite across two independent holders',async()=>{
 const b=database(),locks=lockQueue(),a=store(b),c=store(b);
 const first=await commitExclusiveEventTransition({locks,store:a,transition:mark('a')});
 const second=await commitExclusiveEventTransition({locks,store:c,transition:mark('b')});
 assert.equal(first.status,'COMMITTED');assert.equal(second.status,'COMMITTED');
 assert.deepEqual(store(b).read().seenEventIds,['a','b']);
});

test('lock rejected or callback never executed fails closed with zero writes',async()=>{
 const b=database(),s=store(b);
 for(const locks of [
  {request:async()=>{throw Error('SecurityError')}},
  {request:async()=>({ok:true,status:'COMMITTED'})},
  {request:async()=>undefined},
 ]){
  const out=await commitExclusiveEventTransition({locks,store:s,transition:mark('never')});
  assert.equal(out.ok,false);
  assert(['LOCK_REQUEST_FAILED','LOCK_PROTOCOL_ERROR'].includes(out.status));
  assert.equal(s.read(),null);
 }
});

test('read corruption inside lock blocks transition without overwriting bytes',async()=>{
 const b=database(),locks=lockQueue(),s=store(b);
 b.setItem('arcana-survivor-events-v2','null');
 let called=0;
 const out=await commitExclusiveEventTransition({locks,store:s,transition:x=>{
  called++;return mark('no')(x);
 }});
 assert.equal(out.status,'READ_FAILED');assert.equal(called,0);
 assert.equal(b.getItem('arcana-survivor-events-v2'),'null');
});

test('write quota failure inside lock preserves previous replay ledger',async()=>{
 const b=database(),locks=lockQueue(),s=store(b);
 const old=createEventState();old.seenEventIds=['existing'];
 s.write(old);
 const before=deep(s.read());
 const blocked=createEventLocalStorage({storage:{
  getItem:key=>b.getItem(key),
  setItem:()=>{throw Error('QuotaExceededError')},
 }});
 const out=await commitExclusiveEventTransition({locks,store:blocked,transition:mark('new')});
 assert.equal(out.status,'WRITE_FAILED');assert.deepEqual(s.read(),before);
});

test('crash after durable commit returns HOLD, reload still sees prior replay ID',async()=>{
 const b=database(),locks=lockQueue(),s=store(b);
 const one=await commitExclusiveEventTransition({
  locks,store:s,transition:mark('durable:first'),
  checkpoint:phase=>{if(phase==='after_event_write')throw Error('SIMULATED_POWER_LOSS')}
 });
 assert.equal(one.ok,false);assert.equal(one.status,'LOCK_REQUEST_FAILED');
 assert.deepEqual(s.read().seenEventIds,['durable:first']);
 const retry=await commitExclusiveEventTransition({
  locks,store:s,transition:state=>({state,
     result:state.seenEventIds.includes('durable:first')?'DUPLICATE':'BAD'})
 });
 assert.equal(retry.status,'COMMITTED');assert.equal(retry.result,'DUPLICATE');
 assert.deepEqual(s.read().seenEventIds,['durable:first']);
});

test('one tab may be blocked awaiting exclusive lock; no unlocked fallback occurs',async()=>{
 let unlock;
 const locked=new Promise(resolve=>unlock=resolve);
 let releaseStart;
 const started=new Promise(resolve=>releaseStart=resolve);
 let current=Promise.resolve();
 const locks={request(name,opts,fn){
   const next=current.then(async()=>{
     if(name!==EVENT_V2_EXCLUSIVE_LOCK||opts.mode!=='exclusive')throw Error('bad options');
     if(!releaseStart._called){releaseStart._called=true;releaseStart();}
     await locked;
     return fn({name,mode:'exclusive'});
   });
   current=next.catch(()=>{});
   return next;
 }};
 const b=database(),s=store(b);
 let count=0;
 const pending=commitExclusiveEventTransition({locks,store:s,transition:x=>{
   count++;return mark('after:lock')(x);
 }});
 await started;
 assert.equal(count,0);
 assert.equal(s.read(),null);
 unlock();
 assert.equal((await pending).status,'COMMITTED');
 assert.deepEqual(s.read().seenEventIds,['after:lock']);
});
