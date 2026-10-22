import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile} from '../src/storage.js';
import {migrateLegacyBytes, createCampaignStore} from '../src/campaignStore.js';

test('only a genuinely missing legacy key initializes a new campaign', () => {
  assert.equal(migrateLegacyBytes(null).ok, true);
  for (const value of [undefined, '', 'null', '[]', '{broken', '{"version":42}']) {
    assert.equal(migrateLegacyBytes(value).ok, false);
  }
});

test('migration preserves every owned legacy skin, wallet, record and setting', () => {
  const profile={...defaultProfile(),gold:1234,runs:18,totalKills:1200,bestSeconds:901,
    owned:['apprentice','ember','moon'],skin:'moon',settings:{vfx:'low',reduceMotion:true}};
  assert.deepEqual(migrateLegacyBytes(JSON.stringify(profile)).profile,profile);
});

test('malformed counts, false ownership, paid previews and invalid settings never silently reset', () => {
  const base=defaultProfile();
  for (const patch of [
    {gold:-1},{runs:1.5},{bestSeconds:null},{totalKills:'10'},
    {skin:'moon'}, {owned:['apprentice','crimson']},
    {settings:{vfx:'ultra',reduceMotion:false}}, {settings:{vfx:'low',reduceMotion:'yes'}},
  ]) assert.equal(migrateLegacyBytes(JSON.stringify({...base,...patch})).ok,false);
});

test('unavailable durable storage returns failure, never an in-memory successful grant', async () => {
  const store=createCampaignStore({indexedDB:{},legacyStorage:{getItem:()=>null}});
  const result=await store.dispatch({type:'START_RUN'});
  assert.equal(result.ok,false);
  assert.equal(result.state,null);
  assert.equal(result.code,'STORAGE_UNAVAILABLE');
});

import {createCampaign, validateCampaign, validateCampaignV2, migrateCampaignV2ToV3, applyCommand} from '../src/progression/index.js';

function makeLegacyV2(profile=defaultProfile()) {
  const v2=createCampaign(profile);v2.schemaVersion=2;
  delete v2.progression.wardrobe;
  for(const preset of v2.progression.presets)if(preset)delete preset.appearance;
  if(v2.progression.activeRun)delete v2.progression.activeRun.appearance;
  assert.equal(validateCampaignV2(v2),true);
  return v2;
}
// Minimal async IDB transaction harness, zero dependency. Test implementation
// serializes each read+write callback; only the real IndexedDB remains authoritative.
function fakeIndexedDb(initial) {
  const records=new Map();
  if(initial!==undefined)records.set('profile',structuredClone(initial));
  const db={
    objectStoreNames:{contains:()=>true},
    close(){},
    transaction(){
      const tx={onabort:null,oncomplete:null,onerror:null,aborted:false,
        abort(){this.aborted=true;queueMicrotask(()=>this.onabort?.());},
        objectStore:()=>({
          get(key){
            const req={result:undefined,onsuccess:null};
            queueMicrotask(()=>{
              req.result=records.has(key)?structuredClone(records.get(key)):undefined;
              req.onsuccess?.();
              queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});
            });
            return req;
          },
          put(value,key){records.set(key,structuredClone(value));},
        }),
      };
      return tx;
    },
  };
  return {
    records,
    factory:{open(){
      const req={result:db,onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null};
      queueMicrotask(()=>req.onsuccess?.());
      return req;
    }},
  };
}
test('strict v2 migrates losslessly to v3, exactly once, with revision bump and frozen active appearance', async()=>{
  const profile={...defaultProfile(),gold:411,totalKills:55,runs:9,bestSeconds:222,
    skin:'ember',owned:['apprentice','ember','moon'],settings:{vfx:'low',reduceMotion:true}};
  let modern=createCampaign(profile);
  modern=applyCommand(modern,{type:'SAVE_PRESET',index:0}).state;
  modern=applyCommand(modern,{type:'START_RUN',day:'2026-10-22'}).state;
  const legacy=structuredClone(modern);
  legacy.schemaVersion=2;delete legacy.progression.wardrobe;
  delete legacy.progression.presets[0].appearance;delete legacy.progression.activeRun.appearance;
  assert.equal(validateCampaignV2(legacy),true);
  const snapshot=structuredClone(legacy), fake=fakeIndexedDb(legacy);
  const store=createCampaignStore({indexedDB:fake.factory,legacyStorage:{getItem:()=>null}});
  const result=await store.load();
  assert.equal(result.ok,true);assert.equal(result.code,'MIGRATED');
  assert.equal(result.state.schemaVersion,3);
  assert.equal(result.state.revision,legacy.revision+1);
  assert.deepEqual(legacy,snapshot);
  assert.deepEqual(result.state.profile,legacy.profile);
  assert.deepEqual(result.state.progression.activeRun.runConfig,legacy.progression.activeRun.runConfig);
  assert.deepEqual(result.state.progression.inventory,legacy.progression.inventory);
  assert.deepEqual(result.state.progression.claimed,legacy.progression.claimed);
  for(const heroId of ['mage','guardian','ranger']){
    assert.equal(result.state.progression.wardrobe[heroId].equipped,`${heroId}:ember`);
    assert.ok(result.state.progression.wardrobe[heroId].owned.includes(`${heroId}:moon`));
  }
  assert.deepEqual(result.state.progression.activeRun.appearance,{heroId:'mage',skinId:'mage:ember'});
  assert.deepEqual(result.state.progression.presets[0].appearance,{heroId:'mage',skinId:'mage:ember'});
  const again=await store.load();
  assert.equal(again.code,'LOADED');assert.deepEqual(again.state,result.state);
  assert.deepEqual(fake.records.get('profile'),result.state);
  store.close();
});
test('stale dispatch during v2 upgrade migrates but cannot spend or replay a command',async()=>{
  const profile=defaultProfile();profile.gold=200;
  const before=makeLegacyV2(profile);const fake=fakeIndexedDb(before);
  const store=createCampaignStore({indexedDB:fake.factory,legacyStorage:{getItem:()=>null}});
  const attempted=await store.dispatch({type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'},{expectedRevision:before.revision});
  assert.equal(attempted.ok,false);assert.equal(attempted.code,'STALE_STATE');
  assert.equal(attempted.state.revision,before.revision+1);
  assert.equal(fake.records.get('profile').profile.gold,200);
  const loaded=await store.load();assert.equal(loaded.code,'LOADED');
  const spent=await store.dispatch({type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'},{expectedRevision:loaded.state.revision});
  assert.equal(spent.ok,true);assert.equal(spent.state.profile.gold,80);
  const replay=await store.dispatch({type:'UNLOCK_COSMETIC',heroId:'guardian',cosmeticId:'guardian:ember'},{expectedRevision:spent.state.revision});
  assert.equal(replay.ok,false);assert.equal(replay.code,'ALREADY_OWNED');
  assert.equal(fake.records.get('profile').profile.gold,80);
  store.close();
});
test('two tabs must use fresh revision and may not lose prior cosmetic purchase',async()=>{
  const profile=defaultProfile();profile.gold=150;
  const fake=fakeIndexedDb(createCampaign(profile));
  const a=createCampaignStore({indexedDB:fake.factory}),b=createCampaignStore({indexedDB:fake.factory});
  const first=await a.load(),second=await b.load();
  assert.equal(first.state.revision,second.state.revision);
  const buy=await a.dispatch({type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'},{expectedRevision:first.state.revision});
  assert.equal(buy.ok,true);
  const stale=await b.dispatch({type:'PROFILE_SETTINGS',settings:{vfx:'low'}},{expectedRevision:second.state.revision});
  assert.equal(stale.ok,false);assert.equal(stale.code,'STALE_STATE');
  assert.equal(stale.state.profile.gold,30);
  assert.ok(fake.records.get('profile').progression.wardrobe.guardian.owned.includes('guardian:ember'));
  a.close();b.close();
});
test('future/corrupt v2/v3 IndexedDB values remain unmodified',async()=>{
  const future={schemaVersion:99,privatePayload:{entitlements:['held']}};
  const corrupt=makeLegacyV2();corrupt.profile.owned.push('crimson');
  const invalid3=createCampaign();invalid3.progression.wardrobe.mage.equipped='ranger:base';
  for(const bad of [future,corrupt,invalid3]) {
    const fake=fakeIndexedDb(bad), store=createCampaignStore({indexedDB:fake.factory});
    const snapshot=structuredClone(bad);
    const result=await store.load();
    assert.equal(result.ok,false);
    assert.deepEqual(fake.records.get('profile'),snapshot);
    store.close();
  }
});
test('pure v2 migrator never silently coerces invalid data',()=>{
  const bad=makeLegacyV2();bad.profile.owned.push('celestial');
  assert.equal(migrateCampaignV2ToV3(bad),null);
  const good=makeLegacyV2();const before=structuredClone(good);
  const migrated=migrateCampaignV2ToV3(good);
  assert.equal(validateCampaign(migrated),true);
  assert.deepEqual(good,before);
  assert.equal(migrated.revision,good.revision);
});
