// CEO-owned offline-only bridge: event/season outbox -> earned-only economy.
// Never claim real paid entitlements or use local state as server authority.
import { applyEconomyCommand } from '../economy/index.js';
import { FREE_COSMETICS } from '../content/economy/catalog.js';

const TYPES = new Set(['GOLD','DUST','COSMETIC','SEASON_XP','EVENT_TOKEN']);
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function urlBase64Ascii(input) {
  // ASCII-only avoids TextEncoder replacing malformed UTF-16 with U+FFFD,
  // which would violate a collision-free mapping requirement.
  if(typeof input!=='string'||!input||!(/^[\x20-\x7e]+$/.test(input)))return null;
  let output='';
  for(let i=0;i<input.length;i+=3){
    const a=input.charCodeAt(i),b=i+1<input.length?input.charCodeAt(i+1):0,c=i+2<input.length?input.charCodeAt(i+2):0;
    output+=ALPHABET[a>>>2]+ALPHABET[((a&3)<<4)|(b>>>4)];
    if(i+1<input.length)output+=ALPHABET[((b&15)<<2)|(c>>>6)];
    if(i+2<input.length)output+=ALPHABET[c&63];
  }
  return output;
}
export function stableEconomyKey(raw,prefix='grant_') {
  if(prefix!=='grant_'&&prefix!=='source_')return null;
  const b64=urlBase64Ascii(raw);
  if(!b64)return null;
  const encoded=prefix+b64;
  return encoded.length<=144?encoded:null; // no lossy hash/truncation
}
export function toEconomyCommand(intent) {
  if(!isObj(intent)||!TYPES.has(intent.rewardType))return {status:'INVALID_INTENT'};
  if(intent.rewardType==='SEASON_XP'||intent.rewardType==='EVENT_TOKEN')
    return {status:'LOCAL_ENGINE_ONLY'}; // advance season XP / event tokens in their own reducer
  const idempotencyKey=stableEconomyKey(intent.idempotencyKey);
  const sourceRef=stableEconomyKey(intent.sourceRef,'source_');
  if(!idempotencyKey||!sourceRef)return {status:'UNSUPPORTED_REFERENCE'};
  const command={type:'GRANT_REWARD',idempotencyKey,sourceRef,rewardType:intent.rewardType.toLowerCase()};
  if(intent.rewardType==='COSMETIC'){
    if(typeof intent.itemId!=='string'||!Object.hasOwn(FREE_COSMETICS,intent.itemId))
      return {status:'CONTENT_NOT_AVAILABLE',itemId:intent.itemId??null};
    command.cosmeticId=intent.itemId;
  }else {
    if(!Number.isSafeInteger(intent.amount)||intent.amount<=0||intent.amount>1_000_000)
      return {status:'INVALID_AMOUNT'};
    command.amount=intent.amount;
  }
  return {status:'READY',command};
}
export function applyEarnedRewardIntent(economyState,intent){
  const mapping=toEconomyCommand(intent);
  if(mapping.status!=='READY')return {status:mapping.status,state:economyState,ackReady:false};
  const {state,result}=applyEconomyCommand(economyState,mapping.command);
  return {status:result.ok?result.code:'REJECTED_'+result.code,state,
    ackReady:result.ok,command:mapping.command,result};
}
// Only after the caller has persistently saved state should it acknowledge
// the matching event/season outbox item with the ORIGINAL idempotencyKey.
// Otherwise it must retry using the same key on next startup.
