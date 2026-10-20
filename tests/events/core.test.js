import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseUtc,createEventState,validateEventCatalog,advanceEventProgress,claimEventReward,
  listClaimableEventRewards,redeemEventOffer,listPendingEventGrantIntents,acknowledgeEventGrant} from '../../src/events/core.js';
import {createSeasonState,validateSeasonCatalog,advanceSeasonXp,claimSeasonTier,getSeasonView,
  listPendingSeasonGrantIntents,acknowledgeSeasonGrant} from '../../src/events/season.js';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=load('../../src/content/events/s01_events.json');
const season=load('../../src/content/seasons/season_s01.json');
const copy=v=>JSON.parse(JSON.stringify(v));
const signal=(id,type,payload={})=>({eventId:id,runId:'run-001',tick:1,type,payload});
const send=(st,ev,at,cat=catalog)=>advanceEventProgress(st,ev,cat,at).state;
const S='2030-01-07T00:00:00.000Z',E='2030-04-01T00:00:00.000Z';
test('strict UTC detects leap, invalid days and local offsets',()=>{
 assert.ok(Number.isFinite(parseUtc('2032-02-29T23:59:59.999Z')));
 for(const d of ['2031-02-29T00:00:00Z','2030-04-31T00:00:00Z','2030-01-07T07:00:00+07:00','2030-01-07','2030-01-07T24:00:00Z'])
  assert.ok(Number.isNaN(parseUtc(d)),d);
});
test('season and event configurations valid; 50 tiers, 4 acts, 3 campaigns',()=>{
 assert.deepEqual(validateEventCatalog(catalog),{valid:true,errors:[]});
 assert.deepEqual(validateSeasonCatalog(season),{valid:true,errors:[]});
 assert.equal(catalog.events.length,5);
 assert.equal(season.reward_levels.length,50);
 assert.equal(season.acts.length,4);
 assert.equal(season.event_slots.length,3);
 assert.equal(season.reward_levels[41].free_reward.item_id,'cosmetic_starbound_adept');
});
test('invalid objective, reward, grace, recurring start are rejected',()=>{
 for(const mutate of [
  c=>{c.events[0].objectives[1].id=c.events[0].objectives[0].id;},
  c=>{c.events[2].event_shop[0].reward.item_id='cosmetic_unknown';},
  c=>{c.events[2].claim_until='2030-01-20T00:00:00.000Z';},
  c=>{c.events[1].objectives[0].reward.attack=10;},
  c=>{c.events[1].start_at='2030-01-08T00:00:00.000Z';}
 ]){const bad=copy(catalog);mutate(bad);assert.equal(validateEventCatalog(bad).valid,false);}
});
test('before season nothing earns; first UTC midnight starts; signal IDs deduplicate',()=>{
 const initial=advanceEventProgress(createEventState(),signal('a','RUN_FINISHED'),catalog,'2030-01-06T23:59:59.999Z');
 assert.equal(Object.keys(initial.state.progress).length,0);
 const first=advanceEventProgress(initial.state,signal('a','RUN_FINISHED'),catalog,S);
 const key=Object.keys(first.state.progress)[0];
 assert.equal(first.state.progress[key].objectives.finish_run.count,1);
 assert.ok(first.claimable.some(v=>v.rewardId.endsWith('#finish_run')));
 assert.deepEqual(advanceEventProgress(first.state,signal('a','RUN_FINISHED'),catalog,S).state,first.state);
});
test('UTC daily/weekly recurring period rollover',()=>{
 let st=createEventState();
 st=send(st,signal('a','RUN_FINISHED'),'2030-01-13T23:59:59.999Z');
 st=send(st,signal('a','RUN_FINISHED'),'2030-01-14T00:00:00.000Z');
 assert.equal(Object.keys(st.progress).filter(k=>k.startsWith('event_arcane_orders')).length,2);
 assert.equal(Object.keys(st.progress).filter(k=>k.startsWith('event_weekly_trials')).length,2);
});
test('claim grace inclusive, expiration exclusive, same claim cannot grant twice',()=>{
 const cat=copy(catalog);cat.events=[cat.events[0]];
 const st=send(createEventState(),signal('e','RUN_FINISHED'),'2030-01-07T23:59:59.999Z',cat);
 const id=listClaimableEventRewards(st,'2030-01-08T00:00:00.000Z')[0].rewardId;
 const one=claimEventReward(st,id,'2030-01-09T00:00:00.000Z');
 assert.equal(one.status,'CLAIMED');
 assert.equal(one.rewardIntent.rewardType,'SEASON_XP');
 assert.equal(claimEventReward(one.state,id,'2030-01-09T00:00:00.000Z').status,'DUPLICATE');
 assert.equal(claimEventReward(st,id,'2030-01-09T00:00:00.001Z').status,'EXPIRED');
});
test('Astral Lantern 250 earnable tokens, free shop purchase and replay guard',()=>{
 let st=createEventState();const at='2030-01-15T12:00:00.000Z';
 for(let i=0;i<60;i++)st=send(st,signal('k'+i,'ENEMY_KILLED'),at);
 for(let i=0;i<5;i++)st=send(st,signal('r'+i,'RUN_FINISHED'),at);
 for(let i=0;i<5;i++)st=send(st,signal('u'+i,'SKILL_UPGRADED'),at);
 const ids=listClaimableEventRewards(st,at).filter(x=>x.rewardId.startsWith('event_astral_lantern'));
 assert.equal(ids.length,3);
 for(const x of ids){const cl=claimEventReward(st,x.rewardId,at);assert.equal(cl.status,'CLAIMED');assert.equal(cl.rewardIntent,null);st=cl.state;}
 const key=Object.keys(st.tokens)[0];
 assert.equal(st.tokens[key],250);
 const first=redeemEventOffer(st,'trail',catalog,at);
 assert.equal(first.status,'REDEEMED');
 assert.equal(first.rewardIntent.itemId,'cosmetic_star_lantern_trail');
 assert.equal(first.state.tokens[key],70);
 assert.equal(redeemEventOffer(first.state,'trail',catalog,at).status,'DUPLICATE');
 assert.equal(redeemEventOffer(first.state,'aura',catalog,at).status,'REDEEMED');
 assert.equal(redeemEventOffer(st,'trail',catalog,'2030-01-28T00:00:00.000Z').status,'OFFER_UNAVAILABLE');
});
test('event revision requires explicit migration',()=>{
 const st=send(createEventState(),signal('a','RUN_FINISHED'),S);
 const bad=copy(catalog);bad.events[0].revision++;
 assert.throws(()=>send(st,signal('b','RUN_FINISHED'),S,bad),/migration required/);
});
test('changing a live definition without revision is refused',()=>{
 const st=send(createEventState(),signal('a','RUN_FINISHED'),S);
 const bad=copy(catalog);bad.events[0].objectives[0].goal=99;
 assert.throws(()=>send(st,signal('b','RUN_FINISHED'),S,bad),/without a revision/);
 assert.doesNotThrow(()=>send(st,signal('b','RUN_FINISHED'),S));
});
test('ten casual weeks earn free Starbound Adept tier 42, premium stays preview',()=>{
 let st=createSeasonState();
 for(let w=0;w<10;w++){
  const now=new Date(parseUtc(S)+w*7*86400000).toISOString();
  for(let i=0;i<3;i++)st=advanceSeasonXp(st,80,season,now,'week'+w+':run'+i).state;
  st=advanceSeasonXp(st,180,season,now,'week'+w+':weekly').state;
 }
 assert.equal(st.xp,4200);
 assert.equal(getSeasonView(st,season,'2030-03-11T00:00:00.000Z').earnedLevel,42);
 const first=claimSeasonTier(st,42,'free',season,'2030-03-11T00:00:00.000Z');
 assert.equal(first.rewardIntent.itemId,'cosmetic_starbound_adept');
 assert.equal(claimSeasonTier(first.state,42,'free',season,'2030-03-11T00:00:00.000Z').status,'DUPLICATE');
 assert.equal(claimSeasonTier(st,42,'premium',season,S).status,'PREVIEW_ONLY');
});
test('late-join source IDs idempotent; season rollover claim grace',()=>{
 let st=advanceSeasonXp(createSeasonState(),300,season,'2030-03-20T00:00:00.000Z','catchup:once').state;
 assert.equal(advanceSeasonXp(st,300,season,'2030-03-20T00:00:00.000Z','catchup:once').status,'DUPLICATE');
 assert.equal(claimSeasonTier(st,3,'free',season,E).status,'CLAIMED');
 assert.equal(claimSeasonTier(st,3,'free',season,'2030-04-02T00:00:00.001Z').status,'EXPIRED');
 assert.equal(advanceSeasonXp(st,30,season,E,'after').status,'INACTIVE');
});
test('premium cannot set client ownership or power modifiers',()=>{
 const broken=copy(season);broken.reward_levels[0].premium_preview.attack=100;
 assert.equal(validateSeasonCatalog(broken).valid,false);
 const fake=copy(season);fake.premium_owned=true;
 assert.equal(validateSeasonCatalog(fake).valid,false);
 assert.equal(claimSeasonTier(createSeasonState(),1,'premium_preview',season,S).rewardIntent,null);
});
test('grant outbox preserves stable idempotency keys across demo save/reload',()=>{
 let ev=send(createEventState(),signal('run-claim','RUN_FINISHED'),S);
 const id=listClaimableEventRewards(ev,S)[0].rewardId,cl=claimEventReward(ev,id,S);
 ev=JSON.parse(JSON.stringify(cl.state));
 assert.equal(claimEventReward(ev,id,S).status,'DUPLICATE');
 const pending=listPendingEventGrantIntents(ev);
 assert.equal(pending.length,1);
 assert.equal(pending[0].idempotencyKey,cl.rewardIntent.idempotencyKey);
 ev=acknowledgeEventGrant(ev,pending[0].idempotencyKey).state;
 assert.equal(listPendingEventGrantIntents(ev).length,0);
 let st=advanceSeasonXp(createSeasonState(),100,season,S,'start').state;
 const tier=claimSeasonTier(st,1,'free',season,S),intents=listPendingSeasonGrantIntents(tier.state,season);
 assert.equal(intents.length,1);
 st=acknowledgeSeasonGrant(tier.state,season,intents[0].idempotencyKey).state;
 assert.equal(listPendingSeasonGrantIntents(st,season).length,0);
});
