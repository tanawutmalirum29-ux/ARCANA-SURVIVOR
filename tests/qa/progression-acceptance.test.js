// Independent adversarial acceptance; direct rich fixtures isolate invariants
// from tuning costs and do not stand in for browser/storage or playtest evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, chooseUpgrade } from '../../src/engine.js';
import { defaultProfile } from '../../src/storage.js';
import {
  createCampaign, validateCampaign, applyCommand, deriveLoadout,
  EQUIPMENT, RELICS, TALENTS, ARTIFACTS, HEROES, CHAPTERS,
} from '../../src/progression/index.js';

const clone = value => structuredClone(value);
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function fixture() {
  const state = createCampaign({...defaultProfile(), gold:800000, runs:30});
  state.progression.materials = {essence:800000, research:800000, dust:800000};
  assert.equal(validateCampaign(state), true, 'QA fixture must satisfy actual schema');
  return state;
}
function command(state, input) {
  const before = clone(state);
  const result = applyCommand(freeze(state), input);
  assert.deepEqual(state, before, `input mutated by ${input.type}`);
  assert.equal(result.ok, true, `${input.type}: ${result.code}`);
  assert.equal(validateCampaign(result.state), true, `${input.type} produced invalid state`);
  assert.equal(result.state.revision, state.revision+1);
  return result.state;
}
function reject(state, input) {
  const before = clone(state);
  const result = applyCommand(freeze(state), input);
  assert.equal(result.ok, false, `accepted ${JSON.stringify(input)}`);
  assert.strictEqual(result.state, state, `${input.type} rejected with replacement state`);
  assert.deepEqual(state, before, `${input.type} mutated input on rejection`);
  return result;
}
function crafted(state, definitionId='star_wand', count=1) {
  const ids=[];
  for(let n=0;n<count;n++) {
    const previous=new Set(state.progression.inventory.map(item=>item.id));
    state=command(state,{type:'CRAFT_ITEM',definitionId});
    ids.push(state.progression.inventory.find(item=>!previous.has(item.id)).id);
  }
  return {state,ids};
}

test('migration preserves the single wallet, history, settings and earned cosmetics', () => {
  const profile={...defaultProfile(),gold:877,runs:12,totalKills:99,bestSeconds:600,
    skin:'moon',owned:['apprentice','ember','moon'],settings:{vfx:'low',reduceMotion:true}};
  const state=createCampaign(freeze(profile));
  assert.deepEqual(state.profile,profile);
  assert.equal(validateCampaign(state),true);
  assert.equal(state.progression.inventory.length,2);
  assert.equal(new Set(state.progression.inventory.map(item=>item.id)).size,2);
  assert.deepEqual(state.progression.materials,{essence:0,research:0,dust:0});
  assert.equal(Object.hasOwn(state.progression,'gold'),false,'parallel gold wallet');
  assert.equal(Object.hasOwn(state.progression,'wallet'),false,'parallel wallet');
});

test('content scope includes three distinct heroes/chapters and progression collections', () => {
  assert.equal(HEROES.length,3);
  assert.equal(CHAPTERS.length,3);
  assert.ok(EQUIPMENT.length>=12);
  assert.equal(RELICS.length,12);
  assert.equal(TALENTS.length,12);
  assert.equal(ARTIFACTS.length,3);
  for(const catalog of [HEROES,CHAPTERS,EQUIPMENT,RELICS,TALENTS,ARTIFACTS]) {
    assert.equal(new Set(catalog.map(item=>item.id)).size,catalog.length);
    for(const item of catalog) assert.ok(item.name && item.description, item.id);
  }
});

test('invalid future/schema/counter/instance/reference states fail closed', () => {
  const valid=fixture();
  for(const mutate of [
    state=>{state.schemaVersion=999;},
    state=>{state.revision=-1;},
    state=>{state.profile.gold=NaN;},
    state=>{state.profile.gold=Infinity;},
    state=>{state.progression.materials.essence=-1;},
    state=>{state.progression.inventory[0].level=0;},
    state=>{state.progression.inventory[0].rarity=6;},
    state=>{state.progression.inventory[0].definitionId='unknown';},
    state=>{state.progression.inventory[1].id=state.progression.inventory[0].id;},
    state=>{state.progression.equipment.weapon='nonexistent';},
    state=>{state.progression.equipment.weapon=state.progression.inventory[1].id;},
    state=>{state.progression.runes.equipped.attack='not-owned';},
  ]) {
    const invalid=clone(valid); mutate(invalid);
    assert.equal(validateCampaign(invalid),false,JSON.stringify(invalid));
    const result=applyCommand(invalid,{type:'PROFILE_SETTINGS',settings:{vfx:'low'}});
    assert.equal(result.ok,false,'invalid state was used as a mutation source');
    assert.strictEqual(result.state,invalid);
  }
});

test('invalid operations cannot spend, grant, consume or mutate caller state', () => {
  const state=fixture();
  const item=state.progression.inventory[0];
  for(const input of [
    {type:'EQUIP_ITEM',itemId:item.id,slot:'armor'},
    {type:'EQUIP_ITEM',itemId:'not-owned',slot:'weapon'},
    {type:'UPGRADE_ITEM',itemId:'not-owned'},
    {type:'FUSE_ITEMS',itemIds:[item.id,item.id,item.id]},
    {type:'CRAFT_ITEM',definitionId:'__proto__'},
    {type:'BUY_OFFER',offerId:'unknown'},
    {type:'CLAIM_MISSION',missionId:'unknown'},
    {type:'CLAIM_SEASON',tier:-1},
    {type:'CLAIM_SEASON',tier:1.5},
    {type:'SAVE_PRESET',index:3},
    {type:'SAVE_PRESET',index:-1},
    {type:'UPGRADE_RELIC',relicId:'__proto__'},
    {type:'EQUIP_COSMETIC',cosmeticId:'crimson'},
    {type:'UNLOCK_COSMETIC',cosmeticId:'celestial'},
    {type:'not-a-command'},
  ]) reject(state,input);
});

test('zero-wallet upgrade and forged caller costs cannot create currency', () => {
  const starter=createCampaign(defaultProfile());
  reject(starter,{type:'UPGRADE_ITEM',itemId:starter.progression.inventory[0].id,
    cost:{gold:-999999,essence:-999999},gold:999999});
  const rich=fixture();
  reject(rich,{type:'CRAFT_ITEM',definitionId:'star_wand',
    cost:{gold:-999999,essence:-999999},reward:{gold:999999}});
  const next=command(rich,{type:'CRAFT_ITEM',definitionId:'star_wand'});
  assert.ok(next.profile.gold<rich.profile.gold);
  assert.ok(next.progression.materials.essence<rich.progression.materials.essence);
});

test('ring identity cannot occupy both slots and wrong categories stay rejected', () => {
  const result=crafted(fixture(),'orbit_ring',2);
  const first=command(result.state,{type:'EQUIP_ITEM',itemId:result.ids[0],slot:'ring1'});
  const second=applyCommand(first,{type:'EQUIP_ITEM',itemId:result.ids[0],slot:'ring2'});
  assert.equal(validateCampaign(second.state),true);
  assert.equal(Object.values(second.state.progression.equipment).filter(id=>id===result.ids[0]).length,1);
  reject(first,{type:'EQUIP_ITEM',itemId:result.ids[0],slot:'book'});
});

test('fusion preserves main identity/level and removes exactly two eligible materials', () => {
  let {state,ids}=crafted(fixture(),'star_wand',3);
  state=command(state,{type:'UPGRADE_ITEM',itemId:ids[0]});
  state=command(state,{type:'UPGRADE_ITEM',itemId:ids[0]});
  const before=state.progression.inventory.find(item=>item.id===ids[0]);
  const next=command(state,{type:'FUSE_ITEMS',itemIds:ids});
  const main=next.progression.inventory.find(item=>item.id===ids[0]);
  assert.equal(main.level,before.level);
  assert.equal(main.rarity,before.rarity+1);
  assert.equal(next.progression.inventory.length,state.progression.inventory.length-2);
  for(const id of ids.slice(1)) assert.equal(next.progression.inventory.some(item=>item.id===id),false);
  assert.ok(next.profile.gold>=0);
  assert.ok(Object.values(next.progression.materials).every(amount=>amount>=0));
});

test('locked, equipped and preset-linked fusion materials cannot be consumed', () => {
  const {state,ids}=crafted(fixture(),'star_wand',3);
  const locked=command(state,{type:'LOCK_ITEM',itemId:ids[1],locked:true});
  reject(locked,{type:'FUSE_ITEMS',itemIds:ids});
  reject(locked,{type:'DISMANTLE_ITEM',itemId:ids[1]});
  const equipped=command(state,{type:'EQUIP_ITEM',itemId:ids[1],slot:'weapon'});
  reject(equipped,{type:'FUSE_ITEMS',itemIds:ids});
  reject(equipped,{type:'DISMANTLE_ITEM',itemId:ids[1]});
  let preset=command(equipped,{type:'SAVE_PRESET',index:0});
  preset=command(preset,{type:'UNEQUIP_ITEM',slot:'weapon'});
  reject(preset,{type:'FUSE_ITEMS',itemIds:ids});
  reject(preset,{type:'DISMANTLE_ITEM',itemId:ids[1]});
});

test('active run snapshots survive lobby upgrades and completion is replay safe', () => {
  let state=fixture();
  const start=applyCommand(state,{type:'START_RUN',day:'2030-05-01'});
  assert.equal(start.ok,true,start.code);
  const snapshot=clone(start.state.progression.activeRun);
  reject(start.state,{type:'START_RUN',day:'2030-05-01'});
  state=command(start.state,{type:'UPGRADE_ITEM',itemId:state.progression.inventory[0].id});
  assert.deepEqual(state.progression.activeRun,snapshot);
  reject(state,{type:'FINISH_RUN',runId:'some-other-run',stats:{kills:200,seconds:600,won:true}});
  reject(state,{type:'FINISH_RUN',runId:start.details.runId,
    stats:{kills:200,seconds:600,won:true,gold:999999}});
  const finish={type:'FINISH_RUN',runId:start.details.runId,stats:{kills:200,seconds:600,won:true}};
  const next=command(state,finish);
  assert.equal(next.profile.runs,state.profile.runs+1);
  assert.equal(next.progression.activeRun,null);
  assert.ok(next.profile.gold-state.profile.gold<999999);
  const repeated=reject(next,finish);
  assert.equal(repeated.code,'ALREADY_CLAIMED');
});

test('run and mission replay ledgers survive structured serialization', () => {
  let state=createCampaign(defaultProfile());
  const start=applyCommand(state,{type:'START_RUN',day:'2030-05-01'});
  assert.equal(start.ok,true,start.code);
  state=command(start.state,{type:'FINISH_RUN',runId:start.details.runId,
    stats:{kills:150,seconds:600,won:true}});
  state=command(state,{type:'CLAIM_MISSION',missionId:'first_run'});
  const restored=JSON.parse(JSON.stringify(state));
  assert.equal(validateCampaign(restored),true);
  reject(restored,{type:'CLAIM_MISSION',missionId:'first_run'});
  reject(restored,{type:'FINISH_RUN',runId:start.details.runId,
    stats:{kills:150,seconds:600,won:true}});
});

test('cosmetic ownership, equipped look and settings never alter loadout or seeded battle', () => {
  const base=fixture();
  const decorated=clone(base);
  decorated.profile.owned=['apprentice','ember','moon'];
  decorated.profile.skin='moon';
  decorated.profile.settings={vfx:'low',reduceMotion:true};
  assert.equal(validateCampaign(decorated),true);
  assert.deepEqual(deriveLoadout(decorated),deriveLoadout(base));
  const games=[base,decorated].map(state=>createGame(6712,deriveLoadout(state)));
  for(let tick=0;tick<600;tick++) for(const game of games) {
    step(game,{x:Math.sin(tick/17),y:Math.cos(tick/21)});
    if(game.phase==='upgrade')chooseUpgrade(game,game.upgrades[0]);
  }
  assert.deepEqual(games[0],games[1]);
});

test('daily challenge standardizes earned power and rejects moving the local date backwards', () => {
  const basic=createCampaign({...defaultProfile(),runs:5});
  let rich=fixture();
  rich=command(rich,{type:'UPGRADE_ITEM',itemId:rich.progression.inventory[0].id});
  rich=command(rich,{type:'UPGRADE_HERO',heroId:'mage'});
  rich=command(rich,{type:'UPGRADE_TALENT',talentId:'power'});
  const a=command(basic,{type:'SELECT_MODE',mode:'daily'});
  const b=command(rich,{type:'SELECT_MODE',mode:'daily'});
  assert.deepEqual(deriveLoadout(a),deriveLoadout(b),'daily power depends on account inventory');
  const first=applyCommand(a,{type:'START_RUN',day:'2030-05-02'});
  const second=applyCommand(b,{type:'START_RUN',day:'2030-05-02'});
  assert.equal(first.ok,true,first.code);
  assert.equal(second.ok,true,second.code);
  assert.equal(first.details.seed,second.details.seed,'daily seed differs across accounts');
  const finished=command(first.state,{type:'ABANDON_RUN',runId:first.details.runId});
  reject(finished,{type:'START_RUN',day:'2030-05-01'});
});
