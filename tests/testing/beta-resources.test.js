import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign, validateCampaign, applyCommand, EQUIPMENT, HEROES, RELICS, MAX_VALUE} from '../../src/progression/index.js';
import {defaultProfile} from '../../src/storage.js';
import {BETA_TEST_MODE,BETA_TEST_WALLET_FLOOR,BETA_TEST_RUN_ACCESS,BETA_TEST_SHARD_FLOOR,BETA_TEST_FRAGMENT_FLOOR} from '../../src/testing/beta-resources.js';
const grant={type:'BETA_TEST_REFILL'};
const snapshot=state=>structuredClone(state);

test('beta resource refill is an explicit valid campaign transaction and not a paid entitlement',()=>{
  const starting=createCampaign();
  const unchanged=snapshot(starting);
  const res=applyCommand(Object.freeze(starting),grant);
  if(!BETA_TEST_MODE){
    assert.equal(res.ok,false);
    assert.equal(res.code,'LOCKED');
    assert.deepEqual(starting,unchanged);
    return;
  }
  assert.equal(res.ok,true,res.code);
  const state=res.state,p=state.progression;
  assert.deepEqual(starting,unchanged,'source save mutated');
  assert.equal(state.revision,starting.revision+1);
  assert.equal(validateCampaign(state),true);
  assert.equal(state.profile.gold,BETA_TEST_WALLET_FLOOR.gold);
  for(const key of ['essence','research','dust'])assert.equal(p.materials[key],BETA_TEST_WALLET_FLOOR[key]);
  assert.equal(state.profile.runs,BETA_TEST_RUN_ACCESS);
  assert.equal(state.profile.totalKills,0);
  assert.equal(p.missions.stats.runs,0);
  assert.deepEqual(p.missions.claimed,[]);
  assert.deepEqual(p.claimed,[]);
  assert.deepEqual(state.profile.owned,starting.profile.owned,'beta pack created premium or earned cosmetics');
  assert.deepEqual(p.wardrobe,starting.progression.wardrobe);
  assert.equal(p.activeRun,null);
  for(const h of HEROES)assert.equal(p.heroes[h.id].shards,BETA_TEST_SHARD_FLOOR);
  for(const rel of RELICS)assert.equal(p.relics[rel.id].fragments,BETA_TEST_FRAGMENT_FLOOR);
  for(const itemDef of EQUIPMENT)for(const rarity of [0,4]){
    assert.equal(p.inventory.filter(i=>i.definitionId===itemDef.id&&i.rarity===rarity).length,1,itemDef.id+':'+rarity);
  }
  assert.equal(new Set(p.inventory.map(i=>i.id)).size,p.inventory.length);
  assert.equal(p.nextItem,p.inventory.length+1);
});

test('refill preserves existing player items and wallets, avoids duplicate kit and refills after spending',()=>{
  if(!BETA_TEST_MODE)return;
  const original=createCampaign({...defaultProfile(),gold:MAX_VALUE,runs:14});
  original.progression.materials.essence=MAX_VALUE;
  original.progression.heroes.mage.shards=MAX_VALUE;
  const first=applyCommand(original,grant);
  assert.equal(first.ok,true,first.code);
  const x=first.state;
  assert.equal(x.profile.gold,MAX_VALUE,'top-up cannot lower existing balance');
  assert.equal(x.progression.materials.essence,MAX_VALUE);
  assert.equal(x.progression.heroes.mage.shards,MAX_VALUE);
  assert.equal(x.profile.runs,14);
  const second=applyCommand(x,grant);
  assert.equal(second.ok,false);
  assert.equal(second.code,'NO_CHANGE');
  assert.strictEqual(second.state,x);
  const after=snapshot(x);
  after.profile.gold=1000;
  after.progression.materials.dust=200;
  const restored=applyCommand(after,grant);
  assert.equal(restored.ok,true);
  assert.equal(restored.state.profile.gold,BETA_TEST_WALLET_FLOOR.gold);
  assert.equal(restored.state.progression.materials.dust,BETA_TEST_WALLET_FLOOR.dust);
  assert.equal(restored.state.progression.inventory.length,x.progression.inventory.length,'duplicate equipment generated');
  assert.equal(restored.state.progression.nextItem,x.progression.nextItem);
  assert.equal(validateCampaign(restored.state),true);
});

test('test kit fails closed on active runs, invalid payload, corrupt records and filled inventory',()=>{
  const start=createCampaign();
  const invalid=applyCommand(start,{type:'BETA_TEST_REFILL',gold:MAX_VALUE});
  assert.equal(invalid.ok,false);
  assert.equal(invalid.code,'INVALID_COMMAND');
  assert.strictEqual(invalid.state,start);
  if(!BETA_TEST_MODE)return;
  const loaded=applyCommand(start,{type:'START_RUN',day:'2026-10-23'});
  assert.equal(loaded.ok,true);
  const during=applyCommand(loaded.state,grant);
  assert.equal(during.ok,false);
  assert.equal(during.code,'RUN_ACTIVE');
  assert.strictEqual(during.state,loaded.state);
  const bad=snapshot(start);bad.profile.gold=-1;
  const invalidSave=applyCommand(bad,grant);
  assert.equal(invalidSave.ok,false);
  assert.equal(invalidSave.code,'INVALID_STATE');
  const full=snapshot(start);
  for(let i=3;i<=1000;i++)full.progression.inventory.push({
    id:'item-'+i, definitionId:'star_wand',rarity:0,level:1,locked:false,
    refinement:0,glyph:null,invested:{gold:0,essence:0},
  });
  full.progression.nextItem=1001;
  assert.equal(validateCampaign(full),true);
  const blocked=applyCommand(full,grant);
  assert.equal(blocked.ok,false);
  assert.equal(blocked.code,'INVENTORY_FULL');
  assert.strictEqual(blocked.state,full);
});

test('beta grant does not bypass normal purchase/entitlement rules',()=>{
  if(!BETA_TEST_MODE)return;
  let s=applyCommand(createCampaign(),grant).state;
  let result=applyCommand(s,{type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:crimson'});
  assert.equal(result.ok,false);
  assert.equal(result.code,'LOCKED');
  assert.deepEqual(s.profile.owned,['apprentice']);
  assert.equal(s.progression.wardrobe.guardian.owned.includes('guardian:crimson'),false);
  result=applyCommand(s,{type:'BUY_OFFER',offerId:'essence_bundle'});
  assert.equal(result.ok,true,'normal gold purchasing must still function');
  assert.equal(result.state.profile.gold,s.profile.gold-60);
  assert.equal(result.state.progression.materials.essence,s.progression.materials.essence+12);
});
