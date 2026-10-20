/** ARCANA SURVIVOR events: pure offline simulation, never authoritative paid rewards. */
const DAY=86400000;
const PERIOD={daily:DAY,weekly:7*DAY};
const SIGNALS=new Set(['RUN_STARTED','RUN_FINISHED','ENEMY_KILLED','SKILL_UPGRADED','BOSS_DEFEATED']);
const KINDS=new Set(['GOLD','DUST','SEASON_XP','EVENT_TOKEN','COSMETIC']);
const POWER=['attack','damage','hp','crit','cooldown','speed','power','buff'];
const ID=/^[a-z][a-z0-9_]*$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ident=x=>typeof x==='string'&&ID.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const nonnegative=x=>Number.isSafeInteger(x)&&x>=0;
const clone=x=>JSON.parse(JSON.stringify(x));
export function parseUtc(v){
  if(typeof v!=='string')return NaN;
  const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?Z$/.exec(v);
  if(!m)return NaN;
  const [y,mo,d,h,mi,s]=m.slice(1,7).map(Number), milli=Number((m[7]||'').padEnd(3,'0'));
  const time=Date.UTC(y,mo-1,d,h,mi,s,milli), date=new Date(time);
  if(y<100||!Number.isFinite(time)||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||
     date.getUTCHours()!==h||date.getUTCMinutes()!==mi||date.getUTCSeconds()!==s)return NaN;
  return time;
}
function validateReward(reward,label,errors,known){
  if(!obj(reward)||!KINDS.has(reward.kind)){errors.push(label+': invalid reward kind');return;}
  if(POWER.some(k=>Object.hasOwn(reward,k)))errors.push(label+': power reward forbidden');
  if(reward.kind==='COSMETIC'){
    if(!ident(reward.item_id)||!known.has(reward.item_id))errors.push(label+': unresolved cosmetic id');
    if(reward.amount!==undefined&&reward.amount!==1)errors.push(label+': invalid quantity');
  }else if(!positive(reward.amount)||reward.item_id!==undefined)errors.push(label+': positive amount required');
}
export function validateEventCatalog(catalog){
  const errors=[];
  if(!obj(catalog)||catalog.schema_version!==1||catalog.demo_only!==true||!Array.isArray(catalog.events))
    return {valid:false,errors:['catalog: offline demo schema_version=1 and events[] required']};
  const known=new Set(Array.isArray(catalog.cosmetic_ids)?catalog.cosmetic_ids:[]);
  const ids=new Set();
  for(const e of catalog.events){
    if(!obj(e)){errors.push('event must be object');continue;}
    const label='event '+String(e.id);
    if(!ident(e.id)||ids.has(e.id))errors.push(label+': invalid/duplicate id');ids.add(e.id);
    if(!['once','daily','weekly'].includes(e.type))errors.push(label+': invalid type');
    if(!positive(e.revision))errors.push(label+': revision required');
    const a=parseUtc(e.start_at),b=parseUtc(e.end_at),c=parseUtc(e.claim_until);
    if(![a,b,c].every(Number.isFinite)||!(a<b&&b<=c))errors.push(label+': UTC window invalid');
    if(!nonnegative(e.grace_hours)||(Number.isFinite(b)&&Number.isFinite(c)&&c<b+e.grace_hours*3600000))
      errors.push(label+': claim grace invalid');
    if(Object.hasOwn(PERIOD,e.type)&&Number.isFinite(a)&&Number.isFinite(b)){
      const date=new Date(a);
      if(date.getUTCHours()||date.getUTCMinutes()||date.getUTCSeconds()||(b-a)%PERIOD[e.type]||
         (e.type==='weekly'&&date.getUTCDay()!==1))errors.push(label+': recurrence must start at aligned UTC boundary');
    }
    if(!nonnegative(e.earning_cap))errors.push(label+': token cap invalid');
    if(!Array.isArray(e.objectives)||e.objectives.length===0){errors.push(label+': objectives required');continue;}
    const objectives=new Set();
    for(const o of e.objectives){
      const k=label+' objective '+String(o?.id);
      if(!obj(o)||!ident(o.id)||objectives.has(o.id)){errors.push(k+': invalid/duplicate id');continue;}
      objectives.add(o.id);
      if(!SIGNALS.has(o.signal)||!positive(o.goal))errors.push(k+': invalid goal/signal');
      if(o.when!==undefined&&(!obj(o.when)||Object.values(o.when).some(v=>!['string','number','boolean'].includes(typeof v))))
        errors.push(k+': invalid payload condition');
      validateReward(o.reward,k,errors,known);
      if(o.reward?.kind==='EVENT_TOKEN'&&(e.type!=='once'||!positive(e.earning_cap)))errors.push(k+': token cap required');
    }
    const shop=Array.isArray(e.event_shop)?e.event_shop:[];
    if(e.event_shop!==undefined&&!Array.isArray(e.event_shop))errors.push(label+': shop invalid');
    const offers=new Set();
    for(const offer of shop){
      const k=label+' offer '+String(offer?.id);
      if(!obj(offer)||!ident(offer.id)||offers.has(offer.id)){errors.push(k+': invalid/duplicate id');continue;}
      offers.add(offer.id);
      if(!positive(offer.cost)||offer.limit!==1||offer.reward?.kind!=='COSMETIC')errors.push(k+': shop is cosmetic-only, cost>0, limit=1');
      validateReward(offer.reward,k,errors,known);
    }
    if(shop.length&&(!positive(e.earning_cap)||e.type!=='once'))errors.push(label+': capped one-off token shop required');
  }
  return {valid:errors.length===0,errors};
}
/** v2 stores durable global replay ids and cumulative minted event tokens (offline only). */
export function createEventState(){
  return {schemaVersion:2,progress:{},claims:{},tokens:{},purchases:{},
    seenEventIds:[],mintedTokens:{}};
}
/**
 * Explicit v1 -> v2 migration. Only no-token-history v1 snapshots are provably safe:
 * old v1 claims did not record token quantities, so even a zero current balance
 * might conceal spent tokens. Never infer a historic mint balance from remaining cash.
 * Returns a new object; the caller must persist it before processing new events.
 */
export function migrateEventStateV1(legacy){
  if(!obj(legacy)||legacy.schemaVersion!==1||!['progress','claims','tokens','purchases'].every(k=>obj(legacy[k])))
    throw new TypeError('Invalid legacy event save');
  if(Object.keys(legacy.purchases).length||Object.values(legacy.tokens).some(v=>v!==0)||
    Object.values(legacy.claims).some(c=>!obj(c)||c.kind==='EVENT_TOKEN'))
    throw new Error('LEGACY_TOKEN_HISTORY_UNKNOWN: keep previous save; offline rewards activation blocked');
  const ids=[];
  for(const record of Object.values(legacy.progress)){
    if(!obj(record)||!Array.isArray(record.seen)||record.seen.some(id=>typeof id!=='string'||!id))
      throw new TypeError('Invalid legacy progress: replay history unavailable');
    for(const id of record.seen)if(!ids.includes(id))ids.push(id);
  }
  return stateCopy({...clone(legacy),schemaVersion:2,seenEventIds:ids,mintedTokens:{}});
}
function stateCopy(s){
  if(!obj(s)||s.schemaVersion!==2||!['progress','claims','tokens','purchases','mintedTokens'].every(k=>obj(s[k]))||
    !Array.isArray(s.seenEventIds)||s.seenEventIds.some(id=>typeof id!=='string'||!id)||
    new Set(s.seenEventIds).size!==s.seenEventIds.length)
    throw new TypeError('Invalid event save v2: explicit migration required');
  const spent={},claimed={};
  for(const [key,p] of Object.entries(s.purchases)){
    const split=key.lastIndexOf('#shop_');
    if(split<=0||!obj(p)||!positive(p.cost))throw new TypeError('Invalid event purchase ledger');
    const period=key.slice(0,split);
    spent[period]=(spent[period]||0)+p.cost;
    if(!Number.isSafeInteger(spent[period]))throw new TypeError('Unsafe purchase total');
  }
  for(const [key,c] of Object.entries(s.claims)){
    if(!obj(c))throw new TypeError('Invalid reward claim ledger');
    if(c.kind==='EVENT_TOKEN'){
      const split=key.lastIndexOf('#');
      if(split<=0||!nonnegative(c.tokensEarned))throw new TypeError('Invalid token claim history');
      const period=key.slice(0,split);
      claimed[period]=(claimed[period]||0)+c.tokensEarned;
      if(!Number.isSafeInteger(claimed[period]))throw new TypeError('Unsafe token claim total');
    }
  }
  for(const period of new Set([...Object.keys(s.tokens),...Object.keys(s.mintedTokens),
    ...Object.keys(spent),...Object.keys(claimed)])){
    const balance=s.tokens[period]??0,minted=s.mintedTokens[period]??0;
    if(!nonnegative(balance)||!nonnegative(minted)||!Number.isSafeInteger(balance+(spent[period]||0))||
      minted!==balance+(spent[period]||0)||minted!==(claimed[period]||0))
      throw new TypeError('Inconsistent cumulative event token ledger');
  }
  for(const p of Object.values(s.progress)){
    if(!obj(p)||!Array.isArray(p.seen)||p.seen.some(id=>typeof id!=='string'||!id))
      throw new TypeError('Invalid progress replay history');
    if(p.seen.some(id=>!s.seenEventIds.includes(id)))
      throw new TypeError('Missing global event replay history');
  }
  return clone(s);
}
function at(utc){const n=parseUtc(utc);if(!Number.isFinite(n))throw new TypeError('UTC timestamp required');return n;}
function windowAt(e,now){
  const start=parseUtc(e.start_at),end=parseUtc(e.end_at),until=parseUtc(e.claim_until);
  if(now<start||now>=end)return null;
  const period=PERIOD[e.type],from=period?start+Math.floor((now-start)/period)*period:start;
  const to=period?Math.min(from+period,end):end;
  return {from,to,claimUntil:period?Math.min(to+e.grace_hours*3600000,until):until,key:e.id+'@'+new Date(from).toISOString()};
}
function claimables(st,now){
  const results=[];
  for(const [key,p] of Object.entries(st.progress)){
    if(now>p.claimUntil)continue;
    for(const [id,o] of Object.entries(p.objectives)){
      const rewardId=key+'#'+id;
      if(o.count>=o.goal&&!Object.hasOwn(st.claims,rewardId))results.push({rewardId,reward:clone(o.reward)});
    }
  }
  return results;
}
export function listClaimableEventRewards(state,nowUtc){return claimables(stateCopy(state),at(nowUtc));}
export function advanceEventProgress(state,domainEvent,catalog,nowUtc){
  const next=stateCopy(state),now=at(nowUtc);
  if(!validateEventCatalog(catalog).valid)throw new TypeError('Invalid event catalog');
  if(!obj(domainEvent)||typeof domainEvent.eventId!=='string'||!domainEvent.eventId||
    !SIGNALS.has(domainEvent.type)||!nonnegative(domainEvent.tick)||!obj(domainEvent.payload||{}))
    throw new TypeError('Invalid domain event');
  // A domain event may satisfy several active campaigns in its first occurrence,
  // but must never satisfy *new* daily/weekly periods when replayed later.
  const replay=next.seenEventIds.includes(domainEvent.eventId);
  let matchedAny=false;
  for(const e of catalog.events){
    const w=windowAt(e,now);if(!w)continue;
    let record=next.progress[w.key];
    if(record?.revision!==undefined&&record.revision!==e.revision)
      throw new Error('Event '+e.id+' revision changed mid-instance; migration required');
    if(record?.definition!==undefined&&record.definition!==JSON.stringify(e))
      throw new Error('Event '+e.id+' catalog changed without a revision/migration');
    if(replay)continue; // do not create a new window or award replay progress
    if(!record){
      record={eventId:e.id,revision:e.revision,definition:JSON.stringify(e),earningCap:e.earning_cap,
        from:w.from,end:w.to,claimUntil:w.claimUntil,seen:[],objectives:{}};
      for(const o of e.objectives)record.objectives[o.id]={count:0,goal:o.goal,reward:clone(o.reward)};
    }
    if(record.seen.includes(domainEvent.eventId))continue;
    let matched=false;
    for(const o of e.objectives){
      if(o.signal!==domainEvent.type)continue;
      if(o.when&&Object.entries(o.when).some(([k,v])=>(domainEvent.payload||{})[k]!==v))continue;
      const target=record.objectives[o.id];
      target.count=Math.min(target.goal,target.count+1);matched=true;
    }
    if(matched){record.seen.push(domainEvent.eventId);next.progress[w.key]=record;matchedAny=true;}
  }
  if(matchedAny)next.seenEventIds.push(domainEvent.eventId);
  return {state:next,claimable:claimables(next,now)};
}
function intent(reward,id,amount=reward.amount??1){
  return {idempotencyKey:'arcana:demo:'+id,rewardType:reward.kind,amount,sourceRef:id,
    ...(reward.item_id?{itemId:reward.item_id}:{})};
}
export function claimEventReward(state,rewardId,nowUtc){
  const next=stateCopy(state),now=at(nowUtc);
  if(Object.hasOwn(next.claims,rewardId))return {state:next,rewardIntent:null,status:'DUPLICATE'};
  const split=typeof rewardId==='string'?rewardId.lastIndexOf('#'):-1;
  if(split<0)return {state:next,rewardIntent:null,status:'UNKNOWN'};
  const key=rewardId.slice(0,split),objective=rewardId.slice(split+1);
  const record=next.progress[key],o=record?.objectives?.[objective];
  if(!o)return {state:next,rewardIntent:null,status:'UNKNOWN'};
  if(o.count<o.goal)return {state:next,rewardIntent:null,status:'NOT_EARNED'};
  if(now>record.claimUntil||now<record.from)return {state:next,rewardIntent:null,status:'EXPIRED'};
  let amount=o.reward.amount??1;
  if(o.reward.kind==='EVENT_TOKEN'){
    const current=next.tokens[key]||0,minted=next.mintedTokens[key]||0;
    // Spending reduces current balance, never the lifetime-earning cap.
    amount=Math.max(0,Math.min(amount,record.earningCap-minted));
    next.mintedTokens[key]=minted+amount;
    next.tokens[key]=current+amount;
  }
  const rewardIntent=o.reward.kind==='EVENT_TOKEN'?null:intent(o.reward,rewardId,amount);
  next.claims[rewardId]={claimedAt:new Date(now).toISOString(),kind:o.reward.kind,intent:rewardIntent,
    delivered:rewardIntent===null,...(o.reward.kind==='EVENT_TOKEN'?{tokensEarned:amount}:{})};
  return {state:next,rewardIntent,status:'CLAIMED',...(o.reward.kind==='EVENT_TOKEN'?{tokensEarned:amount}:{})};
}
export function redeemEventOffer(state,offerId,catalog,nowUtc){
  const next=stateCopy(state),now=at(nowUtc);
  if(!validateEventCatalog(catalog).valid)throw new TypeError('Invalid event catalog');
  for(const e of catalog.events){
    const w=windowAt(e,now),offer=w&&(e.event_shop||[]).find(x=>x.id===offerId);
    if(!offer)continue;
    const key=w.key+'#shop_'+offer.id;
    if(next.purchases[key])return {state:next,rewardIntent:null,status:'DUPLICATE'};
    if((next.tokens[w.key]||0)<offer.cost)return {state:next,rewardIntent:null,status:'INSUFFICIENT_TOKENS'};
    next.tokens[w.key]-=offer.cost;
    const rewardIntent=intent(offer.reward,key);
    next.purchases[key]={cost:offer.cost,at:new Date(now).toISOString(),intent:rewardIntent,delivered:false};
    return {state:next,rewardIntent,status:'REDEEMED'};
  }
  return {state:next,rewardIntent:null,status:'OFFER_UNAVAILABLE'};
}
export function listPendingEventGrantIntents(state){
  const next=stateCopy(state);
  return [...Object.values(next.claims),...Object.values(next.purchases)]
    .filter(x=>x.intent&&!x.delivered).map(x=>x.intent);
}
export function acknowledgeEventGrant(state,idempotencyKey){
  const next=stateCopy(state);
  for(const entries of [next.claims,next.purchases]){
    for(const entry of Object.values(entries)){
      if(entry.intent?.idempotencyKey===idempotencyKey){
        entry.delivered=true;return {state:next,status:'ACKNOWLEDGED'};
      }
    }
  }
  return {state:next,status:'UNKNOWN'};
}
