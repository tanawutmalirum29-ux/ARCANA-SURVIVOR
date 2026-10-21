import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {
 defaultProfile, saveProfile, unlockGoldCosmetic, SAVE_KEY
} from '../../src/storage.js';

const source = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
function extract(startText, endText) {
 const start = source.indexOf(startText);
 const end = source.indexOf(endText, start + startText.length);
 assert.ok(start !== -1 && end > start, `expected production code: ${startText}`);
 return source.slice(start, end);
}
const persistSource = extract('function persist(', '\nfunction notify(');
const actionSource = extract('function handleAction(action,id){', '\nfunction showPauseFromSettings()');

// Test the actual application handlers with the actual storage schema. This
// intentionally stubs rendering/audio, not profile grants or persistence.
function setup({profile = defaultProfile(), original = null, denyWrite = false, dropWrite = false} = {}) {
 const saved = new Map();
 if (original !== null) saved.set(SAVE_KEY, original);
 let attemptedWrites = 0;
 const storage = {
  getItem(key) {return saved.get(key) ?? null},
  setItem(key, value) {
   attemptedWrites++;
   if (denyWrite) throw new Error('quota/permission denied');
   if (!dropWrite) saved.set(key, value);
  }
 };
 const toasts = [], sounds = [], wardrobes = [];
 const context = {
  initialProfile: profile,
  saveProfile: candidate => saveProfile(candidate, storage),
  unlockGoldCosmetic,
  notify: message => toasts.push(message),
  sound: {play: id => sounds.push(id)},
  showWardrobe: () => wardrobes.push(JSON.parse(JSON.stringify(context.activeProfile())))
 };
 runInNewContext(`let profile = initialProfile;
${persistSource}
${actionSource}
globalThis.activeProfile = () => profile;
globalThis.performAction = (action,id) => handleAction(action,id);`, context);
 return {
  run: (action,id) => context.performAction(action,id),
  profile: () => JSON.parse(JSON.stringify(context.activeProfile())),
  raw: () => saved.get(SAVE_KEY),
  get attemptedWrites() {return attemptedWrites},
  toasts, sounds, wardrobes
 };
}

function spendable() {
 const profile = defaultProfile();
 profile.gold = 130;
 return profile;
}
function withEmber() {
 const profile = defaultProfile();
 profile.skin = 'apprentice';
 profile.owned.push('ember');
 profile.gold = 40;
 return profile;
}
const saveError = 'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้';

test('confirmed unlock commits only after storage readback and presents success', () => {
 const before = spendable();
 const h = setup({profile: before, original: JSON.stringify(before)});
 h.run('unlock', 'ember');
 assert.equal(h.profile().gold, 10);
 assert.equal(h.profile().owned.includes('ember'), true);
 assert.equal(JSON.parse(h.raw()).gold, 10);
 assert.equal(h.wardrobes.at(-1).owned.includes('ember'), true);
 assert.deepEqual(h.sounds, ['unlock']);
 assert.deepEqual(h.toasts, ['ปลดล็อกสกินสำเร็จ']);
});

test('denied write keeps profile and visible wardrobe unchanged, with save error shown', () => {
 const before = spendable(), bytes = JSON.stringify(before);
 const h = setup({profile: before, original: bytes, denyWrite: true});
 h.run('unlock', 'ember');
 assert.deepEqual(h.profile(), before);
 assert.deepEqual(h.wardrobes.at(-1), before);
 assert.equal(h.raw(), bytes, 'original storage bytes must remain unchanged');
 assert.deepEqual(h.toasts, [saveError]);
 assert.deepEqual(h.sounds, []);
 assert.equal(h.attemptedWrites, 1);
});

test('future-version and malformed existing saves block grants without modifying original bytes', () => {
 for (const bytes of ['{"version":42,"futureInventory":["ember"]}', '{broken']) {
  const before = spendable(), h = setup({profile: before, original: bytes});
  h.run('unlock', 'ember');
  assert.deepEqual(h.profile(), before);
  assert.deepEqual(h.wardrobes.at(-1), before);
  assert.equal(h.raw(), bytes);
  assert.equal(h.attemptedWrites, 0);
  assert.deepEqual(h.toasts, [saveError]);
  assert.deepEqual(h.sounds, []);
 }
});

test('equip does not select cosmetic when persistence fails', () => {
 const before = withEmber(), bytes = JSON.stringify(before);
 const h = setup({profile: before, original: bytes, denyWrite: true});
 h.run('equip', 'ember');
 assert.deepEqual(h.profile(), before);
 assert.deepEqual(h.wardrobes.at(-1), before);
 assert.equal(h.raw(), bytes);
 assert.deepEqual(h.sounds, []);
 assert.deepEqual(h.toasts, [saveError]);
});

test('silently discarded write cannot change active skin or hide failed-save toast', () => {
 const before = withEmber(), bytes = JSON.stringify(before);
 const h = setup({profile: before, original: bytes, dropWrite: true});
 h.run('equip', 'ember');
 assert.deepEqual(h.profile(), before);
 assert.deepEqual(h.wardrobes.at(-1), before);
 assert.equal(h.raw(), bytes);
 assert.deepEqual(h.sounds, []);
 assert.deepEqual(h.toasts, [saveError]);
 assert.equal(h.attemptedWrites, 1);
});

test('confirmed equip updates both UI and durable profile without an unlock toast', () => {
 const before = withEmber(), h = setup({profile: before, original: JSON.stringify(before)});
 h.run('equip', 'ember');
 assert.equal(h.profile().skin, 'ember');
 assert.equal(h.wardrobes.at(-1).skin, 'ember');
 assert.equal(JSON.parse(h.raw()).skin, 'ember');
 assert.deepEqual(h.sounds, ['equip']);
 assert.deepEqual(h.toasts, []);
});
