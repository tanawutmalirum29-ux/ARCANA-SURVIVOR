import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS } from '../../src/storage.js';
import { mountSkinShowcase } from '../../src/visual/showcase.js';

function fakeHost() {
  const listeners = new Map();
  const host = {
    innerHTML: '',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    querySelector() { return null; }, // no Canvas in fake DOM
    contains() { return true; },
    dispatch(attribute, value = '') {
      const attrs = {[attribute]: value};
      const target = {
        hasAttribute(name) { return name in attrs; },
        getAttribute(name) { return attrs[name]; },
      };
      listeners.get('click')?.({ target: { closest() { return target; } } });
    },
    get mounted() { return listeners.has('click'); },
  };
  return host;
}

test('no locked skins can be equipped by spoofed DOM requests', () => {
  const profile = { skin: 'apprentice', owned: ['apprentice'], settings: {vfx:'low', reduceMotion:true} };
  let equipping = [];
  const host = fakeHost();
  const controller = mountSkinShowcase({host, profile, initialSkinId:'crimson', onEquip: id => equipping.push(id)});
  for(const skin of COSMETICS.filter(s => !profile.owned.includes(s.id))) {
    host.dispatch('data-vfx-equip', skin.id);
  }
  assert.deepEqual(equipping, []);
  assert.equal(profile.skin, 'apprentice');
  assert.deepEqual(profile.owned, ['apprentice']);
  controller.dispose();
  assert.equal(host.mounted, false);
});

test('forged premium ownership cannot trigger equip request', () => {
  const profile = {skin:'apprentice', owned:['apprentice','crimson','celestial'], settings:{vfx:'low',reduceMotion:true}};
  const host=fakeHost(); const requested=[];
  const controller=mountSkinShowcase({host, profile, initialSkinId:'celestial', onEquip:id => requested.push(id)});
  host.dispatch('data-vfx-equip','crimson');
  host.dispatch('data-vfx-equip','celestial');
  assert.deepEqual(requested,[]);
  assert.match(host.innerHTML,/PREVIEW DOES NOT UNLOCK OR EQUIP/);
  controller.dispose();
});

test('only already-owned unequipped IDs send a request to caller; no persistence', () => {
  const profile = {skin:'apprentice', owned:['apprentice','moon'], settings:{vfx:'medium', reduceMotion:false}};
  const host = fakeHost();
  const requested = [];
  const controller = mountSkinShowcase({host, profile, onEquip: id => requested.push(id)});
  host.dispatch('data-vfx-equip','moon');
  host.dispatch('data-vfx-equip','celestial');
  host.dispatch('data-vfx-equip','apprentice');
  assert.deepEqual(requested,['moon']);
  assert.equal(profile.skin,'apprentice');
  controller.dispose();
});

test('quality controls only request external persistence and never alter caller profile', () => {
  const profile = {skin:'apprentice', owned:['apprentice'], settings:{vfx:'high',reduceMotion:false}};
  const host = fakeHost();
  const changed = [];
  const before = JSON.stringify(profile);
  const controller = mountSkinShowcase({host, profile, onSettingsChange: v => changed.push(v)});
  host.dispatch('data-vfx-quality','low');
  assert.equal(controller.getQuality(),'low');
  host.dispatch('data-vfx-motion');
  assert.deepEqual(changed,[{vfx:'low',reduceMotion:false},{vfx:'low',reduceMotion:true}]);
  assert.equal(JSON.stringify(profile),before);
  controller.dispose();
});

test('close disposes listeners and triggers one navigation request', () => {
  const host = fakeHost(); let closed = 0;
  mountSkinShowcase({host, onClose: () => closed++});
  assert.equal(host.mounted, true);
  host.dispatch('data-vfx-close');
  assert.equal(closed, 1);
  assert.equal(host.mounted, false);
});
