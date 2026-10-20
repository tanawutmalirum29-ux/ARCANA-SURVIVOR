import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEconomyState,hydrateEconomyState} from '../../src/economy/index.js';
import {applyEarnedRewardIntent,stableEconomyKey,toEconomyCommand} from '../../src/integration/rewardBridge.js';
import {createEventState,advanceEventProgress,claimEventReward,acknowledgeEventGrant,listPendingEventGrantIntents} from '../../src/events/core.js';
import {createSeasonState,advanceSeasonXp,claimSeasonTier,acknowledgeSeasonGrant,listPendingSeasonGrantIntents} from '../../src/events/season.js';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const eventCatalog=load('../../src/content/events/s01_events.json');
const season=load('../../src/content/seasons/season_s01.json');
const now='2030-01-07T10:00:00.000Z';
const skill=n=>({eventId:'run-1:skill-'+n,runId:'run-1',type:'SKILL_UPGRADED',tick:10+n,payload:{}});
test('ASCII references encode uniquely without truncation or collisions',()=>{
 const values=['foo#bar','foo@bar','foo_bar','arcana:demo:event_arcane_orders@2030-01-07T00:00:00.000Z#upgrade_skill'];
 assert.equal(new Set(values.map(x=>stableEconomyKey(x))).size,values.length);
 assert.ok(values.every(x=>stableEconomyKey(x)!==null));
 assert.equal(stableEconomyKey('a'.repeat(150)),null);
 assert.equal(stableEconomyKey('bad\ud800'),null);
 assert.equal(stableEconomyKey('hello','invalid'),null);
});
test('daily GOLD event claim can be granted once across save/restore/ack',()=>{
 let eventState=createEventState();
 for(let n=1;n<=2;n++)eventState=advanceEventProgress(eventState,skill(n),eventCatalog,now).state;
 const claimable='event_arcane_orders@2030-01-07T00:00:00.000Z#upgrade_skill';
 const claimed=claimEventReward(eventState,claimable,now);
 assert.equal(claimed.status,'CLAIMED');
 const intent=claimed.rewardIntent;
 assert.equal(intent.rewardType,'GOLD');
 let earned=createEconomyState();
 const first=applyEarnedRewardIntent(earned,intent);
 assert.equal(first.status,'APPLIED');assert.equal(first.state.balances.gold,100);
 assert.equal(first.ackReady,true);
 earned=hydrateEconomyState(JSON.stringify(first.state)).state;
 const again=applyEarnedRewardIntent(earned,intent);
 assert.equal(again.status,'ALREADY_APPLIED');
 assert.equal(again.state.balances.gold,100);
 assert.equal(listPendingEventGrantIntents(claimed.state).length>0,true);
 const ack=acknowledgeEventGrant(claimed.state,intent.idempotencyKey);
 assert.equal(ack.status,'ACKNOWLEDGED');
 assert.equal(listPendingEventGrantIntents(ack.state).some(x=>x.idempotencyKey===intent.idempotencyKey),false);
});
test('season free GOLD tier maps but free cosmetic stays pending until catalog exists',()=>{
 let state=createSeasonState();
 state=advanceSeasonXp(state,200,season,now,'run-1:season-xp').state;
 const first=claimSeasonTier(state,1,'free',season,now);
 assert.equal(first.status,'CLAIMED');
 const missing=applyEarnedRewardIntent(createEconomyState(),first.rewardIntent);
 assert.equal(missing.status,'CONTENT_NOT_AVAILABLE');assert.equal(missing.ackReady,false);
 assert.equal(listPendingSeasonGrantIntents(first.state,season).length,1);
 const second=claimSeasonTier(first.state,2,'free',season,now);
 assert.equal(second.status,'CLAIMED');
 const accepted=applyEarnedRewardIntent(createEconomyState(),second.rewardIntent);
 assert.equal(accepted.status,'APPLIED');
 assert.equal(accepted.state.balances.gold,120);
 const ack=acknowledgeSeasonGrant(second.state,season,second.rewardIntent.idempotencyKey);
 assert.equal(ack.status,'ACKNOWLEDGED');
});
test('local-only season XP and event token never become paid or wallet grants',()=>{
 const st=createEconomyState();
 for(const type of ['SEASON_XP','EVENT_TOKEN']){
   const result=applyEarnedRewardIntent(st,{rewardType:type,idempotencyKey:'x',sourceRef:'x',amount:10});
   assert.equal(result.status,'LOCAL_ENGINE_ONLY');assert.strictEqual(result.state,st);
 }
 assert.equal(toEconomyCommand({rewardType:'PAID_GEMS',amount:1}).status,'INVALID_INTENT');
});
test('reject malformed IDs, unknown cosmetics and invalid amounts without mutation',()=>{
 const initial=createEconomyState();
 const base={rewardType:'GOLD',idempotencyKey:'a',sourceRef:'event:1',amount:100};
 for(const changes of [
  {idempotencyKey:'x'.repeat(160)}, {sourceRef:'bad\nnewline'}, {amount:0},
  {rewardType:'COSMETIC',itemId:'cosmetic_does_not_exist'}
 ]){
  const result=applyEarnedRewardIntent(initial,{...base,...changes});
  assert.equal(result.ackReady,false);assert.strictEqual(result.state,initial);
 }
});
