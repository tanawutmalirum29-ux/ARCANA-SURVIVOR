import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEconomyState} from '../../src/economy/index.js';
import {createSeasonState,advanceSeasonXp,claimSeasonTier,acknowledgeSeasonGrant,listPendingSeasonGrantIntents} from '../../src/events/season.js';
import {createEventState,advanceEventProgress,claimEventReward,acknowledgeEventGrant,listPendingEventGrantIntents} from '../../src/events/core.js';
import {settlePersistedGrant,recoverPersistedGrants} from '../../src/integration/persistedRewards.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const fixture=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const season=fixture('../../src/content/seasons/season_s01.json');
const events=fixture('../../src/content/events/s01_events.json');
const at='2030-01-07T10:00:00.000Z';
const storage=initial=>({
  persisted:copy(initial),attempts:0,fail:false,
  read(){return copy(this.persisted)},
  write(value){this.attempts++;if(this.fail)return false;this.persisted=copy(value);return true}
});
function seasonClaim(level=2){
  let state=createSeasonState();
  state=advanceSeasonXp(state,level*100,season,at,'run:one').state;
  const claimed=claimSeasonTier(state,level,'free',season,at);
  assert.equal(claimed.status,'CLAIMED');
  return {claimed,stores:{walletStore:storage(createEconomyState()),outboxStore:storage(claimed.state)},
    listPending:x=>listPendingSeasonGrantIntents(x,season),
    acknowledge:(x,id)=>acknowledgeSeasonGrant(x,season,id),
    idempotencyKey:claimed.rewardIntent.idempotencyKey};
}
const options=()=>{
  const s=seasonClaim();
  return {...s.stores,listPending:s.listPending,acknowledge:s.acknowledge,idempotencyKey:s.idempotencyKey};
};
const boom=()=>{throw new Error('SIMULATED_POWER_LOSS')};
test('normal settled S01 +120 Gold: wallet saved then outbox ACK saved',()=>{
 const o=options(),writes=[];
 const walletSave=o.walletStore.write.bind(o.walletStore),outboxSave=o.outboxStore.write.bind(o.outboxStore);
 o.walletStore.write=x=>{writes.push('wallet');return walletSave(x)};
 o.outboxStore.write=x=>{writes.push('outbox');return outboxSave(x)};
 const result=settlePersistedGrant(o);
 assert.equal(result.status,'APPLIED');assert.equal(result.acknowledged,true);
 assert.deepEqual(writes,['wallet','outbox']);
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,0);
 assert.equal(settlePersistedGrant(o).status,'NOT_PENDING');
});
test('fault before wallet write: persisted outbox retries exactly once',()=>{
 const o=options();
 assert.throws(()=>settlePersistedGrant({...o,checkpoint:at=>at==='before_wallet_write'&&boom()}),/SIMULATED_POWER_LOSS/);
 assert.equal(o.walletStore.read().balances.gold,0);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 assert.equal(recoverPersistedGrants(o)[0].status,'APPLIED');
 assert.equal(o.walletStore.read().balances.gold,120);
});
test('fault after wallet commit before ACK: recover returns ALREADY_APPLIED, no double Gold',()=>{
 const o=options();
 assert.throws(()=>settlePersistedGrant({...o,checkpoint:at=>at==='after_wallet_write'&&boom()}),/SIMULATED_POWER_LOSS/);
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 const r=recoverPersistedGrants(o);
 assert.equal(r.length,1);assert.equal(r[0].status,'ALREADY_APPLIED');
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.walletStore.read().ledger.length,1);
 assert.equal(o.listPending(o.outboxStore.read()).length,0);
});
test('fault after outbox ACK saved: fully delivered after restart',()=>{
 const o=options();
 assert.throws(()=>settlePersistedGrant({...o,checkpoint:at=>at==='after_outbox_write'&&boom()}),/SIMULATED_POWER_LOSS/);
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,0);
 assert.deepEqual(recoverPersistedGrants(o),[]);
});
test('wallet storage failure never ACKs; later retry delivers',()=>{
 const o=options();o.walletStore.fail=true;
 const result=settlePersistedGrant(o);
 assert.equal(result.status,'WALLET_SAVE_FAILED');assert.equal(result.acknowledged,false);
 assert.equal(o.walletStore.read().balances.gold,0);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 assert.equal(o.outboxStore.attempts,0);
 o.walletStore.fail=false;
 assert.equal(recoverPersistedGrants(o)[0].status,'APPLIED');
});
test('outbox ACK storage fails: wallet committed and pending grant replayed without duplication',()=>{
 const o=options();o.outboxStore.fail=true;
 const result=settlePersistedGrant(o);
 assert.equal(result.status,'OUTBOX_SAVE_FAILED');assert.equal(result.acknowledged,false);
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 o.outboxStore.fail=false;
 assert.equal(recoverPersistedGrants(o)[0].status,'ALREADY_APPLIED');
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,0);
});
test('in-memory unsaved claim cannot grant because it is absent from persisted outbox',()=>{
 const o=options();o.outboxStore.persisted=createSeasonState();
 assert.equal(settlePersistedGrant(o).status,'NOT_PENDING');
 assert.equal(o.walletStore.read().balances.gold,0);
});
test('unknown Season cosmetic cannot be ACKed or silently replaced by Gold',()=>{
 const c=seasonClaim(1);
 const o={...c.stores,listPending:c.listPending,acknowledge:c.acknowledge,idempotencyKey:c.idempotencyKey};
 assert.equal(settlePersistedGrant(o).status,'CONTENT_NOT_AVAILABLE');
 assert.equal(o.walletStore.attempts,0);assert.equal(o.outboxStore.attempts,0);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
});
test('local-only event SEASON_XP intent cannot be wallet-granted/ACKed',()=>{
 let s=createEventState();
 s=advanceEventProgress(s,{eventId:'r1:finish',runId:'r1',type:'RUN_FINISHED',tick:600,payload:{}},events,at).state;
 const key='event_arcane_orders@2030-01-07T00:00:00.000Z#finish_run';
 const claimed=claimEventReward(s,key,at);
 assert.equal(claimed.status,'CLAIMED');
 const o={walletStore:storage(createEconomyState()),outboxStore:storage(claimed.state),
   listPending:listPendingEventGrantIntents,acknowledge:acknowledgeEventGrant,
   idempotencyKey:claimed.rewardIntent.idempotencyKey};
 assert.equal(settlePersistedGrant(o).status,'LOCAL_ENGINE_ONLY');
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
});
test('daily Event GOLD reward survives post-wallet crash with original event ACK key',()=>{
 let state=createEventState();
 for(let i=0;i<2;i++) {
   state=advanceEventProgress(state,{eventId:'run:event:skill:'+i,runId:'run:event',type:'SKILL_UPGRADED',tick:300+i,payload:{}},events,at).state;
 }
 const rewardId='event_arcane_orders@2030-01-07T00:00:00.000Z#upgrade_skill';
 const claim=claimEventReward(state,rewardId,at);
 assert.equal(claim.status,'CLAIMED');
 const o={walletStore:storage(createEconomyState()),outboxStore:storage(claim.state),
   listPending:listPendingEventGrantIntents,acknowledge:acknowledgeEventGrant,
   idempotencyKey:claim.rewardIntent.idempotencyKey};
 assert.throws(()=>settlePersistedGrant({...o,checkpoint:phase=>phase==='after_wallet_write'&&boom()}),/SIMULATED_POWER_LOSS/);
 assert.equal(o.walletStore.read().balances.gold,100);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 const recovered=recoverPersistedGrants(o);
 assert.equal(recovered[0].status,'ALREADY_APPLIED');assert.equal(recovered[0].acknowledged,true);
 assert.equal(o.walletStore.read().balances.gold,100);
 assert.equal(o.listPending(o.outboxStore.read()).length,0);
});
test('malformed store contract or injected ACK failure does not falsely mark delivered',()=>{
 assert.equal(settlePersistedGrant({}).status,'INVALID_ARGUMENTS');
 const o=options();
 const failed=settlePersistedGrant({...o,acknowledge:()=>({status:'UNKNOWN'})});
 assert.equal(failed.status,'ACK_FAILED');assert.equal(failed.acknowledged,false);
 assert.equal(o.walletStore.read().balances.gold,120);
 assert.equal(o.listPending(o.outboxStore.read()).length,1);
 assert.equal(recoverPersistedGrants(o)[0].status,'ALREADY_APPLIED');
});
