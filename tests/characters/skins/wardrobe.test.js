import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../../../src/storage.js';
import {
  HERO_IDS, SKIN_CATALOG, getSkinDefinition, listSkinsForHero, getEquippedSkin,
  createCampaign, validateCampaign, applyCommand, deriveLoadout,
} from '../../../src/progression/index.js';

const dispatch = (state, command) => {
  const out = applyCommand(state, command);
  assert.equal(out.ok, true, `${command.type}: ${out.code}`);
  assert.equal(validateCampaign(out.state), true);
  return out.state;
};
const failure = (state, command, code) => {
  const snapshot = structuredClone(state);
  const result = applyCommand(state, command);
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.equal(result.state, state);
  assert.deepEqual(state, snapshot);
};
test('catalog is immutable, cosmetics contain no combat power, preview is not a grant', () => {
  assert.equal(SKIN_CATALOG.length, HERO_IDS.length * 8);
  for (const heroId of HERO_IDS) {
    const entries = listSkinsForHero(heroId);
    assert.equal(entries.length, 8);
    assert.ok(entries.every(skin => skin.heroId === heroId && Object.isFrozen(skin)));
    assert.equal(getSkinDefinition(`${heroId}:base`).unlockMode, 'base');
    for (const blocked of ['lantern','verdant','aurora','crimson','celestial'])
      assert.equal(getSkinDefinition(`${heroId}:${blocked}`).unlockMode, 'preview');
  }
  for (const skin of SKIN_CATALOG)
    for (const stat of ['attack', 'speed', 'damage', 'fireDelay', 'maxHp', 'critChance'])
      assert.equal(Object.hasOwn(skin, stat), false);
  assert.equal(getSkinDefinition('fake:base'), null);
  assert.deepEqual(listSkinsForHero('fake'), []);
});
test('fresh v1 entitlements transfer globally but equipment becomes hero-specific', () => {
  const p = defaultProfile(); p.owned.push('ember', 'moon'); p.skin='moon';
  const campaign = createCampaign(p);
  assert.equal(campaign.schemaVersion, 3);
  assert.equal(validateCampaign(campaign), true);
  for (const heroId of HERO_IDS) {
    assert.deepEqual(campaign.progression.wardrobe[heroId].owned,
      [`${heroId}:base`, `${heroId}:ember`, `${heroId}:moon`]);
    assert.equal(getEquippedSkin(campaign, heroId), `${heroId}:moon`);
  }
  assert.equal(getEquippedSkin(campaign, 'unknown'), null);
  const inMemory = structuredClone(campaign);
  inMemory.progression.wardrobe.mage.equipped = 'ranger:moon';
  assert.equal(getEquippedSkin(inMemory, 'mage'), 'mage:base');
  assert.equal(validateCampaign(inMemory), false);
});
test('a 120-GOLD ember grant is an atomic three-hero bundle', () => {
  const p = defaultProfile(); p.gold = 150;
  let state = createCampaign(p);
  failure(state, {type:'UNLOCK_COSMETIC', heroId:'mage', cosmeticId:'ranger:ember'}, 'INVALID_COMMAND');
  state = dispatch(state, {type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'});
  assert.equal(state.profile.gold, 30);
  assert.ok(state.profile.owned.includes('ember'));
  for (const heroId of HERO_IDS) assert.ok(state.progression.wardrobe[heroId].owned.includes(`${heroId}:ember`));
  failure(state, {type:'UNLOCK_COSMETIC',heroId:'ranger',cosmeticId:'ranger:ember'}, 'ALREADY_OWNED');
  failure(state, {type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:crimson'}, 'LOCKED');
  failure(state, {type:'EQUIP_COSMETIC',heroId:'mage',cosmeticId:'ranger:ember'}, 'INVALID_COMMAND');
  failure(state, {type:'EQUIP_COSMETIC',heroId:'mage',cosmeticId:'mage:celestial'}, 'LOCKED');
});
test('equip, hero switch, presets and active run never mix hero wardrobe or combat stats', () => {
  const p=defaultProfile();p.gold=220;
  let state=createCampaign(p);
  // Test fixture unlocks two heroes without altering cosmetic entitlement.
  state.progression.heroes.guardian.level=1;
  state.progression.heroes.ranger.level=1;
  state=dispatch(state,{type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'});
  const baseline=deriveLoadout(state);
  state=dispatch(state,{type:'EQUIP_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'});
  state=dispatch(state,{type:'SAVE_PRESET',index:0});
  state=dispatch(state,{type:'START_RUN',day:'2026-10-22'});
  const frozenAppearance=structuredClone(state.progression.activeRun.appearance);
  const combatConfig=structuredClone(state.progression.activeRun.runConfig);
  state=dispatch(state,{type:'EQUIP_COSMETIC',heroId:'mage',cosmeticId:'mage:base'});
  state=dispatch(state,{type:'SELECT_HERO',heroId:'guardian'});
  assert.equal(getEquippedSkin(state,'guardian'),'guardian:base');
  state=dispatch(state,{type:'EQUIP_COSMETIC',heroId:'guardian',cosmeticId:'guardian:ember'});
  state=dispatch(state,{type:'LOAD_PRESET',index:0});
  assert.equal(state.progression.heroId,'mage');
  assert.equal(getEquippedSkin(state,'mage'),'mage:ember');
  assert.equal(getEquippedSkin(state,'guardian'),'guardian:ember');
  assert.deepEqual(state.progression.activeRun.appearance,frozenAppearance);
  assert.deepEqual(state.progression.activeRun.runConfig,combatConfig);
  assert.deepEqual(deriveLoadout(state),baseline);
});
test('30 total kills grants moon to all three, never preview premium', () => {
  let state=createCampaign();
  state=dispatch(state,{type:'START_RUN',day:'2026-10-22'});
  const id=state.progression.activeRun.id;
  state=dispatch(state,{type:'FINISH_RUN',runId:id,stats:{kills:30,seconds:65,won:false}});
  assert.ok(state.profile.owned.includes('moon'));
  for (const heroId of HERO_IDS) {
    assert.ok(state.progression.wardrobe[heroId].owned.includes(`${heroId}:moon`));
    assert.ok(!state.progression.wardrobe[heroId].owned.some(id=>id.includes('crimson')||id.includes('celestial')));
  }
  failure(state,{type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:moon'},'ALREADY_OWNED');
});
test('malformed/preview/cross-hero persistent wardrobes are invalid, never auto-sanitized', () => {
  const base=createCampaign();
  for (const tamper of [
    s=>{delete s.progression.wardrobe.guardian;},
    s=>{s.progression.wardrobe.mage.owned.push('mage:crimson');},
    s=>{s.progression.wardrobe.mage.owned.push('ranger:base');},
    s=>{s.progression.wardrobe.mage.equipped='mage:moon';},
    s=>{s.schemaVersion=4;},
    s=>{s.progression.wardrobe.ranger.extra=true;},
  ]) {const bad=structuredClone(base);tamper(bad);assert.equal(validateCampaign(bad),false);}
});
