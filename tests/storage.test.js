import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile, sanitizeProfile, loadProfile, saveProfile, awardRun, unlockGoldCosmetic, COSMETICS, SAVE_KEY} from '../src/storage.js';

test('save load roundtrip in local stub storage',()=>{
 const state=new Map();const storage={getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v)};
 const profile=defaultProfile();profile.gold=42;profile.skin='apprentice';
 assert.equal(saveProfile(profile,storage),true);assert.equal(loadProfile(storage).gold,42);
 assert.ok(state.get(SAVE_KEY).includes('"version":1'));
});
test('invalid profile cannot inject unknown cosmetic or negative coins',()=>{
 const profile=sanitizeProfile({version:1,gold:-999,skin:'admin_god',owned:['admin_god','apprentice','apprentice'],totalKills:'hack'});
 assert.equal(profile.gold,0);assert.equal(profile.skin,'apprentice');assert.deepEqual(profile.owned,['apprentice']);
});
test('free achievement at 30 kills; gold skin cost not purchasable with insufficient balance',()=>{
 let p=defaultProfile();p=awardRun(p,{kills:30,gold:100,seconds:25});
 assert.ok(p.owned.includes('moon'));assert.equal(unlockGoldCosmetic(p,'ember',120),null);
 p=awardRun(p,{kills:0,gold:25,seconds:12});
 let bought=unlockGoldCosmetic(p,'ember',120);assert.ok(bought.owned.includes('ember'));assert.equal(bought.gold,5);
 assert.equal(unlockGoldCosmetic(bought,'ember',120),null);
});
test('storage access is gracefully denied',()=>{
 const broken={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.deepEqual(loadProfile(broken),defaultProfile());assert.equal(saveProfile(defaultProfile(),broken),false);
});

test('catalog separates visual cosmetics from power and locks unreleased premium demo content',()=>{
 assert.equal(COSMETICS.length,8);
 const ids=new Set(COSMETICS.map(s=>s.id));assert.equal(ids.size,8);
 for(const item of COSMETICS){
  assert.ok(item.vfx&&item.projectile&&item.source&&item.rarity);
  for(const powerStat of ['attack','hp','maxHp','speed','damage','cooldown','fireDelay','crit']) assert.ok(!Object.hasOwn(item,powerStat));
 }
 const injected=sanitizeProfile({version:1,owned:['apprentice','crimson','celestial','lantern'],skin:'crimson'});
 assert.deepEqual(injected.owned,['apprentice']);assert.equal(injected.skin,'apprentice');
});
