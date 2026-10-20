import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSeasonEventContent} from '../../src/events/contentAudit.js';
import {validateEventCatalog} from '../../src/events/core.js';
import {validateSeasonCatalog} from '../../src/events/season.js';

const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const baseSeason = read('../../src/content/seasons/season_s01.json');
const baseCatalog = read('../../src/content/events/s01_events.json');
const copy = x => JSON.parse(JSON.stringify(x));
const audit = (changeSeason=()=>{},changeCatalog=()=>{}) => {
  const season=copy(baseSeason),catalog=copy(baseCatalog);
  changeSeason(season);changeCatalog(catalog);
  return auditSeasonEventContent(season,catalog);
};
const has = (result,phrase) => {
  assert.equal(result.valid,false,JSON.stringify(result));
  assert.ok(result.errors.some(error=>error.includes(phrase)),JSON.stringify(result.errors));
};

test('S01 simulated 12-week calendar, free reward plan and safe token budget pass cross-catalog audit',()=>{
  assert.deepEqual(audit(),{valid:true,errors:[]});
  const season=baseSeason,events=baseCatalog.events;
  assert.equal(season.start_at,'2030-01-07T00:00:00.000Z');
  assert.equal(season.end_at,'2030-04-01T00:00:00.000Z');
  assert.deepEqual(events.filter(e=>e.type==='once').map(e=>[e.start_at,e.end_at]),[
    ['2030-01-14T00:00:00.000Z','2030-01-28T00:00:00.000Z'],
    ['2030-02-04T00:00:00.000Z','2030-02-18T00:00:00.000Z'],
    ['2030-02-25T00:00:00.000Z','2030-03-11T00:00:00.000Z'],
  ]);
  assert.equal(season.reward_levels.length,50);
  assert.equal(season.reward_levels[41].free_reward.item_id,'cosmetic_starbound_adept');
});

test('campaign must start at the correct relative UTC week, even if dates are individually valid',()=>{
  const result=audit(undefined,c=>{
    c.events.find(e=>e.id==='event_astral_lantern').start_at='2030-01-15T00:00:00.000Z';
  });
  assert.deepEqual(validateEventCatalog({...baseCatalog,events:copy(baseCatalog.events).map(e=>(
    e.id==='event_astral_lantern'?{...e,start_at:'2030-01-15T00:00:00.000Z'}:e))}),{valid:true,errors:[]});
  has(result,'campaign start/end mismatch');
});

test('recurring missions must retain the season UTC range',()=>{
  has(audit(undefined,c=>{c.events.find(e=>e.type==='daily').start_at='2030-01-08T00:00:00.000Z';}),
    'recurring event dates');
});

test('missing or duplicated two-week campaign slots are rejected',()=>{
  has(audit(s=>{s.event_slots.pop();}), 'expected three');
  has(audit(s=>{s.event_slots[1].event_id=s.event_slots[0].event_id;}), 'repeated event reference');
  has(audit(s=>{s.event_slots[2].weeks=[9,10];}), 'expected weeks');
});

test('campaign claim grace cannot extend beyond season claim cutoff',()=>{
  has(audit(undefined,c=>{c.events.find(e=>e.id==='event_comet_trials').claim_until='2030-04-03T00:00:00.000Z';}),
    'after season claim cutoff');
});

test('token reward sums exceeding earning cap are unsafe until cumulative-spend accounting is available',()=>{
  const result=audit(undefined,c=>{
    c.events.find(e=>e.id==='event_astral_lantern').objectives.push({
      id:'extra_token_bonus',signal:'RUN_FINISHED',goal:1,reward:{kind:'EVENT_TOKEN',amount:1},
    });
  });
  has(result,'exceed safe cumulative earning cap');
});

test('campaign shop requires at least one earned token path and attainable offer',()=>{
  has(audit(undefined,c=>{
    const e=c.events.find(e=>e.id==='event_astral_lantern');
    for(const offer of e.event_shop)offer.cost=999;
  }), 'no accessible offer');
});

test('offline free budget must still illustrate tier-50 and free featured milestone',()=>{
  has(audit(s=>{s.xp_playtest_budget.xp_per_run=10;s.xp_playtest_budget.weekly_missions_xp=0;}),
    'cannot reach tier 50');
  has(audit(s=>{s.free_featured_cosmetic_id='cosmetic_nonexistent';}),
    'featured free cosmetic');
});

test('content ID uniqueness and missing free catch-up rules are validated',()=>{
  has(audit(undefined,c=>{c.cosmetic_ids.push(c.cosmetic_ids[0]);}), 'unique stable identifiers');
  has(audit(s=>{s.catchup_rules.no_login_streak_required=false;}), 'consecutive daily logins');
});

test('invalid intrinsic season/event configs fail audit rather than bypassing validators',()=>{
  has(audit(s=>{s.reward_levels[0].premium_preview.damage=999;}), 'stats forbidden');
  has(audit(undefined,c=>{c.events[2].objectives[0].reward.amount=-1;}), 'positive amount required');
});

test('auditor is pure and does not mutate catalogs or create player entitlements',()=>{
  const season=copy(baseSeason),events=copy(baseCatalog);
  const a=auditSeasonEventContent(season,events);
  assert.equal(a.valid,true);
  assert.deepEqual(season,baseSeason);
  assert.deepEqual(events,baseCatalog);
  assert.equal(Object.hasOwn(season,'paid_owned'),false);
  assert.equal(Object.hasOwn(events,'grant'),false);
});

test('base independent schema validation remains valid with the review in place',()=>{
  assert.equal(validateSeasonCatalog(baseSeason).valid,true);
  assert.equal(validateEventCatalog(baseCatalog).valid,true);
});
