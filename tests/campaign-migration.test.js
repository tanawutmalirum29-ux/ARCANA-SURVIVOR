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
