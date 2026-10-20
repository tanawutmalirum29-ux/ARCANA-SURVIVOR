import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createEventState, advanceEventProgress, claimEventReward,
 listClaimableEventRewards, listPendingEventGrantIntents
} from '../../src/events/core.js';
import {prepareStoredEventState,commitStoredEventTransition} from '../../src/integration/eventV2Store.js';
const catalog=JSON.parse(readFileSync(new URL('../../src/content/events/s01_events.json',import.meta.url),'utf8'));
const at='2030-01-13T23:59:59.999Z',after='2030-01-14T00:00:00.000Z';
const copy=x=>JSON.parse(JSON.stringify(x));
function store(initial=null){
 return {persisted:initial===null?null:copy(initial),writes:0,fail:false,lie:false,
   read(){return this.persisted===null?null:copy(this.persisted)},
   write(next){this.writes++;if(this.fail)return false;
     if(!this.lie)this.persisted=copy(next);return true}};
}
const event=id=>({eventId:id,runId:'demo-run',tick:600,type:'RUN_FINISHED',payload:{}});
const step=(s,id,when=at)=>advanceEventProgress(s,event(id),catalog,when);
const throwPowerLoss=()=>{throw new Error('SIMULATED_POWER_LOSS')};
test('no persisted snapshot: initialize and verify v2 before allowing use',()=>{
 const s=store();
 const r=prepareStoredEventState({store:s});
 assert.equal(r.status,'INITIALIZED');assert.equal(r.ok,true);
 assert.equal(r.state.schemaVersion,2);assert.equal(s.read().schemaVersion,2);
 assert.equal(s.writes,1);
 assert.equal(prepareStoredEventState({store:s}).status,'LOADED');
 assert.equal(s.writes,1);
});
test('clean v1 migrated explicitly and replay guard survives UTC boundary and reload',()=>{
 const legacy=step(createEventState(),'stable-id').state;
 legacy.schemaVersion=1;delete legacy.seenEventIds;delete legacy.mintedTokens;
 const s=store(legacy);
 const r=prepareStoredEventState({store:s});
 assert.equal(r.status,'MIGRATED_V1');assert.equal(s.read().schemaVersion,2);
 const duplicate=commitStoredEventTransition({store:s,transition:x=>step(x,'stable-id',after)});
 assert.equal(duplicate.status,'COMMITTED');
 assert.deepEqual(duplicate.state.seenEventIds,['stable-id']);
 assert.equal(Object.keys(duplicate.state.progress).filter(x=>x.startsWith('event_arcane_orders@')).length,1);
 const unique=commitStoredEventTransition({store:s,transition:x=>step(x,'new-unique',after)});
 assert.equal(unique.status,'COMMITTED');
 assert.equal(unique.state.seenEventIds.length,2);
});
test('v1 token claim, zero-balance spent purchase and positive balance all block without mutating previous save',()=>{
 let original=step(createEventState(),'once').state;
 original.schemaVersion=1;delete original.seenEventIds;delete original.mintedTokens;
 const changes=[
   x=>{x.tokens['campaign@2030-01-14']=1},
   x=>{x.claims['token#reward']={kind:'EVENT_TOKEN',delivered:true}},
   x=>{x.purchases['campaign#shop_1']={cost:10}}
 ];
 for(const change of changes){
   const v=copy(original);change(v);const s=store(v);const before=JSON.stringify(s.read());
   const got=prepareStoredEventState({store:s});
   assert.equal(got.status,'LEGACY_TOKEN_HISTORY_UNKNOWN');
   assert.equal(got.ok,false);assert.equal(s.writes,0);
   assert.equal(JSON.stringify(s.read()),before);
 }
});
test('unsupported versions and corrupt global replay or token ledger never reset or overwrite',()=>{
 const old=step(createEventState(),'once').state;
 for(const change of [
  x=>{x.schemaVersion=77},
  x=>{x.seenEventIds=[]},
  x=>{x.mintedTokens['made-up-period']=100},
  x=>{x.seenEventIds.push('once')}
 ]){
  const x=copy(old);change(x);const s=store(x);
  const got=prepareStoredEventState({store:s});
  assert.equal(got.ok,false);assert.equal(s.writes,0);
  assert.deepEqual(s.read(),x);
 }
});
test('failed migration write preserves the legacy input, refuses transition',()=>{
 const v=step(createEventState(),'once').state;
 v.schemaVersion=1;delete v.seenEventIds;delete v.mintedTokens;
 const s=store(v);s.fail=true;let called=0;
 const out=commitStoredEventTransition({store:s,transition:x=>{called++;return step(x,'new',after)}});
 assert.equal(out.status,'WRITE_FAILED');assert.equal(called,0);
 assert.deepEqual(s.read(),v);assert.equal(s.writes,1);
});
test('store saying write succeeded without committing is detected on reread',()=>{
 const s=store();s.lie=true;
 assert.equal(prepareStoredEventState({store:s}).status,'VERIFY_FAILED');
 assert.equal(s.read(),null);
});
test('simulated crash before v1 migration commit leaves original v1 untouched',()=>{
 const v=step(createEventState(),'before-crash').state;
 v.schemaVersion=1;delete v.seenEventIds;delete v.mintedTokens;
 const s=store(v);
 assert.throws(()=>prepareStoredEventState({store:s,checkpoint:x=>x==='before_event_write'&&throwPowerLoss()}),
   /SIMULATED_POWER_LOSS/);
 assert.deepEqual(s.read(),v);assert.equal(s.writes,0);
});
test('simulated crash after successful v1 migration write recovers verified v2 with same receipts',()=>{
 const v=step(createEventState(),'before-crash').state;
 v.schemaVersion=1;delete v.seenEventIds;delete v.mintedTokens;
 const s=store(v);
 assert.throws(()=>prepareStoredEventState({store:s,checkpoint:x=>x==='after_event_write'&&throwPowerLoss()}),
   /SIMULATED_POWER_LOSS/);
 assert.equal(s.read().schemaVersion,2);
 assert.deepEqual(s.read().seenEventIds,['before-crash']);
 assert.equal(prepareStoredEventState({store:s}).status,'LOADED');
});
test('transition state is not exposed as committed when write fails; retry is idempotent',()=>{
 const s=store(createEventState());
 s.fail=true;
 const first=commitStoredEventTransition({store:s,transition:x=>step(x,'run:1')});
 assert.equal(first.status,'WRITE_FAILED');assert.equal(s.read().seenEventIds.length,0);
 s.fail=false;
 const second=commitStoredEventTransition({store:s,transition:x=>step(x,'run:1')});
 assert.equal(second.status,'COMMITTED');assert.deepEqual(s.read().seenEventIds,['run:1']);
 const again=commitStoredEventTransition({store:s,transition:x=>step(x,'run:1',after)});
 assert.equal(again.status,'COMMITTED');assert.deepEqual(s.read().seenEventIds,['run:1']);
});
test('outbox claim is persisted before wallet delivery and remains pending after restart',()=>{
 const s=store(createEventState());
 assert.equal(commitStoredEventTransition({store:s,transition:x=>step(x,'finish1')}).status,'COMMITTED');
 const key=listClaimableEventRewards(s.read(),at).find(x=>x.rewardId.includes('#finish_run')).rewardId;
 const claimed=commitStoredEventTransition({store:s,transition:x=>claimEventReward(x,key,at)});
 assert.equal(claimed.status,'COMMITTED');assert.equal(s.read().schemaVersion,2);
 const pending=listPendingEventGrantIntents(s.read());
 assert.equal(pending.length,1);assert.equal(pending[0].rewardType,'SEASON_XP');
 assert.equal(prepareStoredEventState({store:s}).status,'LOADED');
 assert.equal(listPendingEventGrantIntents(s.read()).length,1);
});
test('invalid reducer state or throwing callback never overwrites persisted state',()=>{
 const s=store(createEventState());
 const before=s.read();
 assert.equal(commitStoredEventTransition({store:s,transition:()=>({state:{schemaVersion:2}})}).status,'TRANSITION_REFUSED');
 assert.equal(commitStoredEventTransition({store:s,transition:()=>{throw Error('boom')}}).status,'TRANSITION_REFUSED');
 assert.deepEqual(s.read(),before);
 assert.equal(s.writes,0);
});
test('invalid store contract must fail closed without throwing or writing',()=>{
 assert.equal(prepareStoredEventState({}).status,'INVALID_ARGUMENTS');
 assert.equal(commitStoredEventTransition({store:{},transition:()=>({})}).status,'INVALID_ARGUMENTS');
});

test('transient undefined read must not reset an existing replay ledger or pending claim',()=>{
 const prior=step(createEventState(),'important:run').state;
 const rewardId=listClaimableEventRewards(prior,at).find(x=>x.rewardId.includes('#finish_run')).rewardId;
 const claimed=claimEventReward(prior,rewardId,at).state;
 const s=store(claimed),initial=copy(s.read());
 let reads=0;
 const originalRead=s.read.bind(s);
 s.read=()=>++reads===1?undefined:originalRead();
 const outcome=prepareStoredEventState({store:s});
 assert.equal(outcome.ok,false);
 assert.equal(outcome.status,'READ_FAILED');
 assert.equal(s.writes,0);
 assert.deepEqual(s.persisted,initial);
 assert.deepEqual(s.read().seenEventIds,['important:run']);
 assert.equal(listPendingEventGrantIntents(s.read()).length,1);
 const retried=prepareStoredEventState({store:s});
 assert.equal(retried.status,'LOADED');
 assert.deepEqual(retried.state,initial);
});
test('repeated undefined reads are errors, never a reason to create a new snapshot',()=>{
 const prior=step(createEventState(),'idempotent:run').state;
 const s=store(prior);
 s.read=()=>undefined;
 for(let i=0;i<3;i++){
  const out=prepareStoredEventState({store:s});
  assert.equal(out.ok,false);
  assert.equal(out.status,'READ_FAILED');
 }
 assert.equal(s.writes,0);
 assert.deepEqual(s.persisted,prior);
});
test('undefined read prevents transition callback and saves zero bytes',()=>{
 const s=store(step(createEventState(),'important:run').state);
 s.read=()=>undefined;
 let transitioned=0;
 const outcome=commitStoredEventTransition({store:s,transition:state=>{
  transitioned++;
  return step(state,'untrusted:run',after);
 }});
 assert.equal(outcome.status,'READ_FAILED');
 assert.equal(transitioned,0);
 assert.equal(s.writes,0);
});
test('thrown/parse read errors and unexpected primitive save types fail closed',()=>{
 const saved=step(createEventState(),'guarded:run').state;
 for(const exception of [new Error('decode error'),new Error('quota blocked')]){
  const s=store(saved);
  s.read=()=>{throw exception};
  const out=prepareStoredEventState({store:s});
  assert.equal(out.status,'READ_FAILED');
  assert.equal(s.writes,0);
  assert.deepEqual(s.persisted,saved);
 }
 for(const response of ['null',0,false,[],42]){
  const s=store(saved);
  s.read=()=>response;
  const out=prepareStoredEventState({store:s});
  assert.equal(out.ok,false);
  assert.equal(out.status,'INVALID_SAVE');
  assert.equal(s.writes,0);
  assert.deepEqual(s.persisted,saved);
 }
});
test('trusted null is exclusively verified absence and can initialize safely',()=>{
 const s=store();
 const out=prepareStoredEventState({store:s});
 assert.equal(out.ok,true);
 assert.equal(out.status,'INITIALIZED');
 assert.equal(s.writes,1);
 assert.deepEqual(s.read(),createEventState());
});

test('one transient false-null must never reset existing v2 replay and claim state',()=>{
 const old=step(createEventState(),'important:existing').state;
 const claimKey=listClaimableEventRewards(old,at).find(x=>x.rewardId.includes('#finish_run')).rewardId;
 const saved=claimEventReward(old,claimKey,at).state;
 const storeInstance=store(saved);const originalRead=storeInstance.read.bind(storeInstance);
 let calls=0;storeInstance.read=()=>++calls===1?null:originalRead();
 const result=prepareStoredEventState({store:storeInstance});
 assert.equal(result.status,'READ_FAILED');assert.equal(result.ok,false);
 assert.equal(storeInstance.writes,0);
 assert.deepEqual(storeInstance.persisted,saved);
 assert.equal(listPendingEventGrantIntents(originalRead()).length,1);
 assert.equal(prepareStoredEventState({store:storeInstance}).status,'LOADED');
});
test('null first read with an undefined or throwing confirmation cannot initialize',()=>{
 for(const second of [undefined,new Error('decoder failed')]){
  let count=0;const s=store(step(createEventState(),'guarded:1').state);
  s.read=()=>{if(++count===1)return null;if(second instanceof Error)throw second;return second};
  const result=prepareStoredEventState({store:s});
  assert.equal(result.status,'READ_FAILED');assert.equal(result.ok,false);
  assert.equal(s.writes,0);
  assert.deepEqual(s.persisted.seenEventIds,['guarded:1']);
 }
});
