/** Free 50-tier Season 01 engine; preview does not grant paid entitlements. */
import {parseUtc} from './core.js';
const DAY=86400000, ID=/^[a-z][a-z0-9_]*$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ident=x=>typeof x==='string'&&ID.test(x);
const power=['attack','damage','hp','crit','cooldown','speed','power','buff'];
const copy=x=>JSON.parse(JSON.stringify(x));
export function validateSeasonCatalog(s){
  const errors=[];
  if(!object(s)||s.schema_version!==1||s.demo_only!==true)
    return {valid:false,errors:['season: offline demo schema_version=1 required']};
  if(!ident(s.season_id))errors.push('season: invalid season_id');
  const a=parseUtc(s.start_at),b=parseUtc(s.end_at),c=parseUtc(s.claim_until);
  if(![a,b,c].every(Number.isFinite)||b-a!==84*DAY||c<b)errors.push('season: 12-week UTC dates/claim grace invalid');
  if(!Number.isSafeInteger(s.xp_per_tier)||s.xp_per_tier<=0)errors.push('season: XP threshold invalid');
  if(!Array.isArray(s.reward_levels)||s.reward_levels.length!==50)errors.push('season: exactly 50 tiers required');
  const known=new Set(Array.isArray(s.cosmetic_ids)?s.cosmetic_ids:[]);
  for(let i=0;i<(s.reward_levels?.length||0);i++){
    const tier=s.reward_levels[i];
    if(!object(tier)||tier.level!==i+1||tier.xp_required!==(i+1)*s.xp_per_tier){
      errors.push('tier '+(i+1)+': non-monotonic XP');continue;
    }
    for(const track of ['free_reward','premium_preview']){
      const reward=tier[track];
      if(!object(reward)||!['GOLD','DUST','COSMETIC'].includes(reward.kind)){
        errors.push('tier '+(i+1)+': invalid '+track);continue;
      }
      if(power.some(k=>Object.hasOwn(reward,k)))errors.push('tier '+(i+1)+': stats forbidden');
      if(reward.kind==='COSMETIC'){
        if(!ident(reward.item_id)||!known.has(reward.item_id))
          errors.push('tier '+(i+1)+': unknown cosmetic');
        if(reward.amount!==undefined&&reward.amount!==1)
          errors.push('tier '+(i+1)+': cosmetic quantity must equal 1');
      }
      if(reward.kind!=='COSMETIC'&&(!Number.isSafeInteger(reward.amount)||reward.amount<=0||reward.item_id!==undefined))
        errors.push('tier '+(i+1)+': invalid amount');
    }
  }
  if(!Array.isArray(s.acts)||s.acts.length!==4||s.acts.some((act,i)=>act.act!==i+1||act.start_week!==1+3*i||act.end_week!==3+3*i))
    errors.push('season: four 3-week acts required');
  if(s.paid_owned!==undefined||s.premium_owned!==undefined||s.checkout_url!==undefined)
    errors.push('season: client entitlement/checkout forbidden');
  return {valid:errors.length===0,errors};
}
export function createSeasonState(){return {schemaVersion:1,seasonId:null,xp:0,seenSources:[],claims:{}};}
function stateCopy(state,season){
  if(!object(state)||state.schemaVersion!==1||!Number.isSafeInteger(state.xp)||state.xp<0||
    !Array.isArray(state.seenSources)||!object(state.claims)||
    (state.seasonId&&state.seasonId!==season.season_id))throw new TypeError('Invalid or mismatched season save');
  return {...copy(state),seasonId:season.season_id};
}
function at(utc){const n=parseUtc(utc);if(!Number.isFinite(n))throw new TypeError('Explicit UTC required');return n;}
export function advanceSeasonXp(state,amount,season,nowUtc,sourceKey){
  if(!validateSeasonCatalog(season).valid)throw new TypeError('Invalid season catalog');
  const next=stateCopy(state,season),now=at(nowUtc);
  if(now<parseUtc(season.start_at)||now>=parseUtc(season.end_at))return {state:next,status:'INACTIVE'};
  if(!Number.isSafeInteger(amount)||amount<=0||typeof sourceKey!=='string'||!sourceKey)
    throw new TypeError('Positive XP and stable sourceKey required');
  if(next.seenSources.includes(sourceKey))return {state:next,status:'DUPLICATE'};
  next.seenSources.push(sourceKey);
  next.xp=Math.min(season.reward_levels[49].xp_required,next.xp+amount);
  return {state:next,status:'EARNED',unlockedLevel:Math.min(50,Math.floor(next.xp/season.xp_per_tier))};
}
export function claimSeasonTier(state,level,track,season,nowUtc){
  if(!validateSeasonCatalog(season).valid)throw new TypeError('Invalid season catalog');
  const next=stateCopy(state,season),now=at(nowUtc);
  const tier=season.reward_levels[level-1];
  if(!Number.isInteger(level)||!tier)return {state:next,rewardIntent:null,status:'INVALID_TIER'};
  if(track==='premium'||track==='premium_preview')return {state:next,rewardIntent:null,status:'PREVIEW_ONLY'};
  if(track!=='free')return {state:next,rewardIntent:null,status:'INVALID_TRACK'};
  const key=season.season_id+':free:'+level;
  if(next.claims[key])return {state:next,rewardIntent:null,status:'DUPLICATE'};
  if(next.xp<tier.xp_required)return {state:next,rewardIntent:null,status:'LOCKED'};
  if(now<parseUtc(season.start_at)||now>parseUtc(season.claim_until))
    return {state:next,rewardIntent:null,status:'EXPIRED'};
  const reward=tier.free_reward;
  const rewardIntent={idempotencyKey:'arcana:demo:season:'+key,rewardType:reward.kind,
    amount:reward.amount??1,sourceRef:key,...(reward.item_id?{itemId:reward.item_id}:{})};
  next.claims[key]={at:new Date(now).toISOString(),intent:rewardIntent,delivered:false};
  return {state:next,status:'CLAIMED',rewardIntent};
}
export function getSeasonView(state,season,nowUtc){
  if(!validateSeasonCatalog(season).valid)throw new TypeError('Invalid season catalog');
  const s=stateCopy(state,season),now=at(nowUtc),start=parseUtc(season.start_at),end=parseUtc(season.end_at);
  const level=Math.min(50,Math.floor(s.xp/season.xp_per_tier));
  return {week:Math.max(0,Math.min(12,Math.floor((now-start)/(7*DAY))+1)),
    active:now>=start&&now<end,inClaimGrace:now>=end&&now<=parseUtc(season.claim_until),
    earnedLevel:level,premiumStatus:'PREVIEW_ONLY',
    nextXp:Math.min(season.reward_levels[49].xp_required,(level+1)*season.xp_per_tier)};
}
export function listPendingSeasonGrantIntents(state,season){
  const next=stateCopy(state,season);
  return Object.values(next.claims).filter(x=>x.intent&&!x.delivered).map(x=>x.intent);
}
export function acknowledgeSeasonGrant(state,season,idempotencyKey){
  const next=stateCopy(state,season);
  for(const entry of Object.values(next.claims)){
    if(entry.intent?.idempotencyKey===idempotencyKey){
      entry.delivered=true;return {state:next,status:'ACKNOWLEDGED'};
    }
  }
  return {state:next,status:'UNKNOWN'};
}
