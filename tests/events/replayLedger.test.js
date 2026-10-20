import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createEventState, migrateEventStateV1, advanceEventProgress, claimEventReward,
  redeemEventOffer, listClaimableEventRewards, listPendingEventGrantIntents,
  acknowledgeEventGrant, validateEventCatalog
} from '../../src/events/core.js';

const original=JSON.parse(readFileSync(new URL('../../src/content/events/s01_events.json',import.meta.url),'utf8'));
const copy=x=>JSON.parse(JSON.stringify(x));
const run=(id,type='RUN_FINISHED')=>({eventId:id,runId:'replay-run',tick:1,type,payload:{}});
const progress=(s,ev,at,cat=original)=>advanceEventProgress(s,ev,cat,at).state;
const PRE='2030-01-13T23:59:59.999Z',POST='2030-01-14T00:00:00.000Z';
const claimId=(s,prefix,at)=>listClaimableEventRewards(s,at).find(x=>x.rewardId.startsWith(prefix)).rewardId;

test('new event state is v2 with explicit, independent cumulative token ledger and global replay IDs',()=>{
 const s=createEventState();
 assert.equal(s.schemaVersion,2);
 assert.deepEqual(s.seenEventIds,[]);
 assert.deepEqual(s.mintedTokens,{});
 assert.deepEqual(s.tokens,{});
});
test('same eventId across daily and Monday weekly UTC rollover cannot earn twice',()=>{
 let s=progress(createEventState(),run('run:001'),PRE);
 assert.equal(s.seenEventIds.length,1);
 const frozen=copy(s);
 s=progress(s,run('run:001'),POST);
 assert.deepEqual(s,frozen);
 assert.equal(Object.keys(s.progress).filter(k=>k.startsWith('event_arcane_orders@')).length,1);
 assert.equal(Object.keys(s.progress).filter(k=>k.startsWith('event_weekly_trials@')).length,1);
 s=progress(s,run('run:002'),POST);
 assert.equal(Object.keys(s.progress).filter(k=>k.startsWith('event_arcane_orders@')).length,2);
 assert.equal(Object.keys(s.progress).filter(k=>k.startsWith('event_weekly_trials@')).length,2);
 assert.equal(s.seenEventIds.length,2);
});
test('one new unique signal can count in daily plus weekly at once; same signal cannot later count twice',()=>{
 let s=progress(createEventState(),run('one-signal'),PRE);
 const daily=Object.values(s.progress).find(p=>p.eventId==='event_arcane_orders');
 const weekly=Object.values(s.progress).find(p=>p.eventId==='event_weekly_trials');
 assert.equal(daily.objectives.finish_run.count,1);
 assert.equal(weekly.objectives.finish_five.count,1);
 assert.deepEqual(s.seenEventIds,['one-signal']);
 s=progress(s,run('one-signal'),POST);
 assert.equal(s.seenEventIds.length,1);
});
test('JSON reload keeps UTC global dedup and preserves existing claimed reward intents',()=>{
 let s=progress(createEventState(),run('prior'),PRE);
 const id=claimId(s,'event_arcane_orders',PRE);
 const granted=claimEventReward(s,id,PRE);
 assert.equal(granted.status,'CLAIMED');
 const key=granted.rewardIntent.idempotencyKey;
 s=copy(granted.state);
 assert.deepEqual(listPendingEventGrantIntents(s).map(x=>x.idempotencyKey),[key]);
 s=progress(s,run('prior'),POST);
 assert.equal(s.seenEventIds.length,1);
 assert.equal(Object.keys(s.progress).filter(x=>x.startsWith('event_arcane_orders')).length,1);
 s=acknowledgeEventGrant(s,key).state;
 assert.equal(listPendingEventGrantIntents(s).length,0);
});
test('token ledger never mints over lifetime cap after spending before subsequent claim',()=>{
 const cat=copy(original);
 const lantern=cat.events.find(e=>e.id==='event_astral_lantern');
 lantern.earning_cap=100;
 lantern.event_shop=[{id:'single',cost:100,limit:1,reward:{kind:'COSMETIC',item_id:'cosmetic_star_lantern_trail'}}];
 lantern.objectives.find(o=>o.id==='gather_sparks').reward.amount=100;
 lantern.objectives.find(o=>o.id==='complete_five_runs').reward.amount=100;
 lantern.objectives.find(o=>o.id==='constellation_quests').reward.amount=100;
 assert.equal(validateEventCatalog(cat).valid,true); // valid generic config; audit blocks over-budget fixture
 let s=createEventState();
 const at='2030-01-15T12:00:00.000Z';
 for(let i=0;i<60;i++)s=progress(s,run('kill:'+i,'ENEMY_KILLED'),at,cat);
 const first=claimEventReward(s,claimId(s,'event_astral_lantern',at),at);
 assert.equal(first.tokensEarned,100);
 s=first.state;
 const period=Object.keys(s.tokens)[0];
 assert.equal(s.tokens[period],100);
 assert.equal(s.mintedTokens[period],100);
 const buy=redeemEventOffer(s,'single',cat,at);
 assert.equal(buy.status,'REDEEMED');
 s=copy(buy.state);
 assert.equal(s.tokens[period],0);
 assert.equal(s.mintedTokens[period],100);
 for(let i=0;i<5;i++)s=progress(s,run('win:'+i),at,cat);
 const secondId=claimId(s,'event_astral_lantern',at);
 const second=claimEventReward(s,secondId,at);
 assert.equal(second.status,'CLAIMED');
 assert.equal(second.tokensEarned,0);
 assert.equal(second.rewardIntent,null);
 s=copy(second.state);
 assert.equal(s.mintedTokens[period],100);
 assert.equal(s.tokens[period],0);
 assert.equal(claimEventReward(s,secondId,at).status,'DUPLICATE');
 assert.equal(redeemEventOffer(s,'single',cat,at).status,'DUPLICATE');
});
test('v1 clean progress migrates explicitly, preserving all seen IDs across previous UTC periods',()=>{
 let modern=progress(createEventState(),run('legacy-read'),PRE);
 const legacy=copy(modern);
 legacy.schemaVersion=1;delete legacy.seenEventIds;delete legacy.mintedTokens;
 assert.throws(()=>progress(legacy,run('legacy-read'),POST),/explicit migration/i);
 const migrated=migrateEventStateV1(legacy);
 assert.equal(migrated.schemaVersion,2);
 assert.deepEqual(migrated.seenEventIds,['legacy-read']);
 assert.deepEqual(progress(migrated,run('legacy-read'),POST),migrated);
 const next=progress(migrated,run('new-run'),POST);
 assert.equal(next.seenEventIds.length,2);
 assert.equal(legacy.schemaVersion,1); // no mutation
});
test('migration retains ordinary existing claims and their pending grant intents without duplicates',()=>{
 let modern=progress(createEventState(),run('pre'),PRE);
 const claimed=claimEventReward(modern,claimId(modern,'event_arcane_orders',PRE),PRE);
 modern=claimed.state;
 const legacy=copy(modern);
 legacy.schemaVersion=1;delete legacy.seenEventIds;delete legacy.mintedTokens;
 const migrated=migrateEventStateV1(legacy);
 assert.equal(listPendingEventGrantIntents(migrated).length,1);
 assert.equal(claimEventReward(migrated,Object.keys(migrated.claims)[0],PRE).status,'DUPLICATE');
});
test('migration rejects legacy token history even with zero remaining balance: never mint guessed currency',()=>{
 let base=progress(createEventState(),run('a'),PRE);
 base.schemaVersion=1;delete base.seenEventIds;delete base.mintedTokens;
 for(const change of [
  s=>{s.tokens['event_astral_lantern@2030-01-14T00:00:00.000Z']=100;},
  s=>{s.claims['event_astral_lantern@2030-01-14T00:00:00.000Z#gather_sparks']={kind:'EVENT_TOKEN',delivered:true};},
  s=>{s.purchases['event_astral_lantern@2030-01-14T00:00:00.000Z#shop_trail']={cost:100};}
 ]){const snapshot=copy(base);change(snapshot);
   assert.throws(()=>migrateEventStateV1(snapshot),/LEGACY_TOKEN_HISTORY_UNKNOWN/);}
});
test('corrupt/missing replay records and malformed version do not silently reset protections',()=>{
 const base=progress(createEventState(),run('a'),PRE);
 const cases=[
  s=>{s.schemaVersion=9;},
  s=>{delete s.seenEventIds;},
  s=>{s.seenEventIds=[];},
  s=>{s.seenEventIds.push('a');},
  s=>{s.progress[Object.keys(s.progress)[0]].seen=['forged'];},
  s=>{s.mintedTokens=[];},
 ];
 for(const mutate of cases){const broken=copy(base);mutate(broken);
   assert.throws(()=>progress(broken,run('new'),PRE),/Invalid|Missing|migration/);}
});
test('v2 token balances, claimed mint sum, and purchase-spend equality are checked on reload',()=>{
 let s=createEventState(),at='2030-01-15T12:00:00.000Z';
 for(let i=0;i<60;i++)s=progress(s,run('kill:'+i,'ENEMY_KILLED'),at);
 s=claimEventReward(s,claimId(s,'event_astral_lantern',at),at).state;
 const key=Object.keys(s.mintedTokens)[0];
 for(const tamper of [
  v=>{v.tokens[key]++;},
  v=>{v.mintedTokens[key]++;},
  v=>{v.claims[Object.keys(v.claims)[0]].tokensEarned=999;},
  v=>{v.tokens[key]=-1;},
 ]){const invalid=copy(s);tamper(invalid);
   assert.throws(()=>listPendingEventGrantIntents(invalid),/Inconsistent/);}
});
test('grace and revision checks hold with new v2 global replay bookkeeping',()=>{
 let s=progress(createEventState(),run('a'),PRE);
 const cat=copy(original);cat.events[0].revision++;
 assert.throws(()=>progress(s,run('other'),PRE,cat),/migration required/);
 const bad=copy(original);bad.events[0].objectives[0].goal=99;
 assert.throws(()=>progress(s,run('other'),PRE,bad),/without a revision/);
 // Existing reward remains claimable at exactly the 24h recurring grace boundary.
 const id=claimId(s,'event_arcane_orders',PRE);
 const onTime=claimEventReward(s,id,'2030-01-15T00:00:00.000Z');
 assert.equal(onTime.status,'CLAIMED');
 assert.equal(claimEventReward(s,id,'2030-01-15T00:00:00.001Z').status,'EXPIRED');
});
