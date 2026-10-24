import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, defaultProfile, sanitizeProfile, saveProfile, loadProfile } from '../../src/storage.js';
import {
  createFrameProfiler, getSkinGallery, getSkinPreview, normalizeQuality, visualBudget, resolveReducedMotion,
} from '../../src/visual/presentation.js';
import { showcaseMarkup } from '../../src/visual/showcase.js';
import { resolveHeroPose } from '../../src/characters/motion/index.js';

const basic = {
  version: 1, gold: 0, skin: 'apprentice', owned: ['apprentice'],
  settings: { vfx: 'high', reduceMotion: false },
};

test('gallery preview includes all eight routes without mutating inventory', () => {
  const before = JSON.stringify(basic);
  const gallery = getSkinGallery(basic);
  assert.equal(gallery.length, 8);
  assert.equal(new Set(gallery.map(s => s.id)).size, 8);
  assert.equal(JSON.stringify(basic), before);
  assert.deepEqual(gallery.map(s => s.id), COSMETICS.map(s => s.id));
  for (const skin of gallery) {
    assert.equal(typeof skin.sourceDetail, 'string');
    assert.equal(typeof skin.availability, 'string');
    assert.equal('hp' in skin || 'damage' in skin || 'hitbox' in skin || 'dps' in skin, false);
  }
});

test('locked premium, event, season and craft skins cannot equip or claim', () => {
  for (const id of ['lantern', 'verdant', 'aurora', 'crimson', 'celestial']) {
    const item = getSkinPreview(id, basic);
    assert.equal(item.owned, false);
    assert.equal(item.canEquip, false);
    assert.notEqual(item.availability, 'Available');
  }
  assert.equal(getSkinPreview('crimson', basic).premiumPreview, true);
  assert.equal(getSkinPreview('celestial', basic).premiumPreview, true);
  assert.equal(getSkinPreview('apprentice', basic).equipped, true);
  assert.equal(getSkinPreview('apprentice', basic).canEquip, false);
});

test('forged premium ownership remains locked with no purchase or equip', () => {
  const forged = { ...basic, skin: 'crimson', owned: ['apprentice','crimson','celestial'] };
  for (const id of ['crimson','celestial']) {
    const item = getSkinPreview(id, forged);
    assert.equal(item.owned, false);
    assert.equal(item.equipped, false);
    assert.equal(item.canEquip, false);
    assert.equal(item.premiumPreview, true);
  }
});

test('only inventory ownership determines equip eligibility', () => {
  const inconsistentProfile = { ...basic, skin: 'crimson', owned: ['apprentice'] };
  const locked = getSkinPreview('crimson', inconsistentProfile);
  assert.equal(locked.equipped, false);
  assert.equal(locked.canEquip, false);
  const ownedProfile = { ...basic, owned: ['apprentice', 'moon'] };
  assert.equal(getSkinPreview('moon', ownedProfile).canEquip, true);
});

test('quality budgets are bounded and reduced motion disables moving adornments', () => {
  assert.deepEqual(['low','medium','high'].map(normalizeQuality), ['low','medium','high']);
  assert.equal(normalizeQuality('impossibly-expensive'), 'low');
  assert.equal(visualBudget('low').dprCap, 1);
  assert.equal(visualBudget('medium').dprCap, 1.5);
  assert.equal(visualBudget('high').dprCap, 2);
  assert.ok(visualBudget('low').particles < visualBudget('medium').particles);
  assert.ok(visualBudget('medium').particles < visualBudget('high').particles);
  assert.equal(visualBudget('high', true).particles, 0);
  assert.equal(visualBudget('high', true).trails, 0);
});

test('motion OFF in game keeps all three walk animations even when OS prefers reduced motion', () => {
  // The game's default is OFF, intentionally independent of the OS setting.
  assert.equal(resolveReducedMotion(defaultProfile().settings),false);
  assert.equal(resolveReducedMotion(sanitizeProfile({version:1,settings:{}}).settings),false);
  assert.equal(resolveReducedMotion({reduceMotion:false}),false);
  assert.equal(resolveReducedMotion({reduceMotion:true}),true);
  const bytes=new Map();
  const storage={getItem:key=>bytes.get(key)??null,setItem:(key,value)=>bytes.set(key,value)};
  const explicitOff=defaultProfile();
  explicitOff.settings.reduceMotion=false;
  assert.equal(saveProfile(explicitOff,storage),true);
  assert.equal(resolveReducedMotion(loadProfile(storage).settings),false);
  for (const heroId of ['mage','guardian','ranger']) {
    const pose = (tick, reducedMotion) => resolveHeroPose({
      heroId, tick, moving:true, moveVector:{x:1,y:0}, reducedMotion,
    });
    const animatedA = pose(10,resolveReducedMotion({reduceMotion:false}));
    const animatedB = pose(17,resolveReducedMotion({reduceMotion:false}));
    assert.equal(animatedA.locomotion,'walk');
    assert.notDeepEqual(animatedA.joints.leftLeg,animatedB.joints.leftLeg,heroId+' walk gait must animate');
    const stillA=pose(10,resolveReducedMotion({reduceMotion:true}));
    const stillB=pose(17,resolveReducedMotion({reduceMotion:true}));
    assert.deepEqual(stillA.joints.leftLeg,stillB.joints.leftLeg);
  }
});


test('fresh and migrated motion preferences preserve unset OS fallback without corrupting saves', () => {
  const fresh=defaultProfile();
  assert.equal(fresh.settings.reduceMotion,null);
  assert.equal(resolveReducedMotion(fresh.settings,true),true);
  assert.equal(resolveReducedMotion(fresh.settings,false),false);
  const campaign=createCampaign(fresh);
  assert.ok(validateCampaign(campaign));
  const vfxOnly=applyCommand(campaign,{type:'PROFILE_SETTINGS',settings:{vfx:'medium'}});
  assert.ok(vfxOnly.ok);
  assert.equal(vfxOnly.state.profile.settings.reduceMotion,null);
  const explicitOff=applyCommand(vfxOnly.state,{type:'PROFILE_SETTINGS',settings:{reduceMotion:false}});
  assert.ok(explicitOff.ok);
  assert.equal(resolveReducedMotion(explicitOff.state.profile.settings,true),false);
  assert.ok(validateCampaign(structuredClone(explicitOff.state)));
  const explicitOn=applyCommand(explicitOff.state,{type:'PROFILE_SETTINGS',settings:{reduceMotion:true}});
  assert.ok(explicitOn.ok);
  assert.equal(resolveReducedMotion(explicitOn.state.profile.settings,false),true);
  assert.equal(resolveReducedMotion(sanitizeProfile({version:1,settings:{}}).settings,true),true);
  const legacy={...defaultProfile(),settings:{vfx:'high',reduceMotion:false}};
  assert.equal(migrateLegacyBytes(JSON.stringify(legacy)).profile.settings.reduceMotion,false);
});

test('all locked skins have Preview controls but no Equip or Checkout affordance', () => {
  const html = showcaseMarkup({ profile: basic, selectedId: 'crimson', quality: 'low', reducedMotion: true });
  assert.equal((html.match(/data-vfx-skin=/g) || []).length, 8);
  assert.match(html, /CRIMSON REGENT/);
  assert.match(html, /PREMIUM CONCEPT — NOT FOR SALE/);
  assert.match(html, /PREVIEW DOES NOT UNLOCK OR EQUIP/);
  assert.doesNotMatch(html, /data-vfx-equip=/);
  assert.doesNotMatch(html, /data-action="unlock"/);
  assert.match(html, /data-vfx-quality="medium"/);
  assert.match(html, /Reduced motion \/ flash/);
});

test('owned non-equipped skin can show Equip while source remains cosmetic-only', () => {
  const html = showcaseMarkup({
    profile: { ...basic, owned: ['apprentice', 'moon'] }, selectedId: 'moon',
  });
  assert.match(html, /data-vfx-equip="moon"/);
  assert.match(html, /COSMETIC ONLY · NO STAT ADVANTAGE/);
});

test('profiler ignores invalid frames and reports an actual sample p95', () => {
  const meter = createFrameProfiler(20);
  meter.add(-1); meter.add(NaN);
  assert.deepEqual(meter.snapshot(), {count: 0, p95: null});
  for (let i = 1; i <= 20; i++) meter.add(i);
  assert.deepEqual(meter.snapshot(), {count: 20, p95: 19});
  meter.add(200);
  assert.deepEqual(meter.snapshot(), {count: 20, p95: 20});
});
