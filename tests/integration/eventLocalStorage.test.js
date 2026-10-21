import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventState} from '../../src/events/core.js';
import {createEventLocalStorage,EVENT_V2_LOCAL_KEY} from '../../src/integration/eventLocalStorage.js';
import {prepareStoredEventState,commitStoredEventTransition} from '../../src/integration/eventV2Store.js';

const clone=x=>JSON.parse(JSON.stringify(x));
const backend=()=>({
 items:new Map(),getItem(k){return this.items.has(k)?this.items.get(k):null},
 setItem(k,v){this.items.set(k,v)},
});
test('separate versioned Event key and honest absence init, never change legacy profile',()=>{
 const b=backend();b.setItem('arcana-survivor-v1','{"gold":100}');
 const store=createEventLocalStorage({storage:b});
 assert.equal(store.read(),null);
 const res=prepareStoredEventState({store});
 assert.equal(res.status,'INITIALIZED');
 assert.equal(res.ok,true);assert.equal(store.read().schemaVersion,2);
 assert.deepEqual(store.read().seenEventIds,[]);
 assert.equal(b.getItem('arcana-survivor-v1'),'{"gold":100}');
 assert.equal(typeof b.getItem(EVENT_V2_LOCAL_KEY),'string');
 assert.equal(prepareStoredEventState({store}).status,'LOADED');
});
test('saved replay and pending claim survive reload without replacement',()=>{
 const b=backend(),a=createEventLocalStorage({storage:b});
 const old=createEventState();
 old.seenEventIds.push('stable:run');
 old.progress['test@2030-01-01T00:00:00.000Z']={eventId:'test',revision:1,definition:'{}',earningCap:0,
   from:0,end:1,claimUntil:2,seen:['stable:run'],objectives:{}};
 old.claims['test@2030-01-01T00:00:00.000Z#r']={
   kind:'GOLD',claimedAt:'2030-01-01T00:00:00.000Z',intent:{
     idempotencyKey:'arcana:demo:test@2030-01-01T00:00:00.000Z#r',rewardType:'GOLD',amount:100,
     sourceRef:'test@2030-01-01T00:00:00.000Z#r'
   },delivered:false
 };
 assert.equal(a.write(old),true);
 const bReload=createEventLocalStorage({storage:b});
 const found=prepareStoredEventState({store:bReload});
 assert.equal(found.status,'LOADED');
 assert.deepEqual(found.state.seenEventIds,['stable:run']);
 assert.deepEqual(found.state.claims,old.claims);
});
test('malformed JSON and existing JSON null never initialize or mutate',()=>{
 for(const raw of ['{','null','false','42','[]','"text"']){
  const b=backend();b.setItem(EVENT_V2_LOCAL_KEY,raw);
  const s=createEventLocalStorage({storage:b});
  const result=prepareStoredEventState({store:s});
  assert.equal(result.ok,false);
  assert.equal(result.status,'READ_FAILED');
  assert.equal(b.getItem(EVENT_V2_LOCAL_KEY),raw);
 }
});
test('getItem throws Access Denied; no writes, no reset, no transition',()=>{
 const b=backend();let writes=0;
 b.getItem=()=>{throw new Error('Access denied')};
 b.setItem=()=>writes++;
 const s=createEventLocalStorage({storage:b});
 let ran=0;
 const got=commitStoredEventTransition({store:s,transition:()=>{ran++;return {state:createEventState()}}});
 assert.equal(got.status,'READ_FAILED');assert.equal(ran,0);
 assert.equal(writes,0);
});
test('getItem transient undefined fails closed without overwriting prior data',()=>{
 const b=backend(),existing=createEventState();
 existing.seenEventIds.push('prior');
 b.setItem(EVENT_V2_LOCAL_KEY,JSON.stringify(existing));
 let reads=0,writes=0;
 const g=b.getItem.bind(b),p=b.setItem.bind(b);
 b.getItem=k=>(++reads===1?undefined:g(k));
 b.setItem=(k,v)=>{writes++;p(k,v)};
 const s=createEventLocalStorage({storage:b});
 assert.equal(prepareStoredEventState({store:s}).status,'READ_FAILED');
 assert.equal(writes,0);
 assert.deepEqual(prepareStoredEventState({store:s}).state.seenEventIds,['prior']);
});
test('false null once, then valid saved data, blocks even with plausible subsequent read',()=>{
 const b=backend(),existing=createEventState();
 existing.seenEventIds.push('prior');
 b.setItem(EVENT_V2_LOCAL_KEY,JSON.stringify(existing));
 let count=0,writes=0;const original=b.getItem.bind(b);
 b.getItem=k=>(++count===1?null:original(k));
 b.setItem=()=>{writes++};
 const result=prepareStoredEventState({store:createEventLocalStorage({storage:b})});
 assert.equal(result.status,'READ_FAILED');assert.equal(writes,0);
 assert.deepEqual(JSON.parse(original(EVENT_V2_LOCAL_KEY)).seenEventIds,['prior']);
});
test('quota errors return write failure; saved old value stays unchanged',()=>{
 const b=backend(),old=createEventState();b.setItem(EVENT_V2_LOCAL_KEY,JSON.stringify(old));
 b.setItem=()=>{throw new Error('Quota exceeded')};
 const s=createEventLocalStorage({storage:b});
 const out=commitStoredEventTransition({store:s,transition:x=>{
   x.seenEventIds.push('new');return {state:x};
 }});
 assert.equal(out.status,'WRITE_FAILED');
 assert.deepEqual(s.read(),old);
});
test('lying setItem no-op gets caught by coordinator re-read',()=>{
 const b=backend(),old=createEventState();b.setItem(EVENT_V2_LOCAL_KEY,JSON.stringify(old));
 b.setItem=()=>{};
 const s=createEventLocalStorage({storage:b});
 const out=commitStoredEventTransition({store:s,transition:x=>{
  x.seenEventIds.push('not-saved');return {state:x};
 }});
 assert.equal(out.status,'VERIFY_FAILED');assert.deepEqual(s.read(),old);
});
test('invalid keys and invalid write payload are refused, not saved',()=>{
 const b=backend();
 for(const key of ['', 'arcana-survivor-v1',null,12])
  assert.throws(()=>createEventLocalStorage({storage:b,key}),/Invalid dedicated/);
 const s=createEventLocalStorage({storage:b});
 assert.equal(s.write(null),false);
 assert.equal(s.write({big:1n}),false);
 assert.equal(s.read(),null);
});
test('invalid backend contract or getter throwing is not converted to a new profile',()=>{
 assert.throws(()=>createEventLocalStorage({storage:{}}),/Unavailable/);
 const source={getItem(){throw Error('private mode')},setItem(){}};
 const s=createEventLocalStorage({storage:source});
 assert.throws(()=>s.read(),/private mode/);
});
