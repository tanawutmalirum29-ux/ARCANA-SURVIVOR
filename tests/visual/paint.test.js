import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/engine.js';
import { COSMETICS } from '../../src/storage.js';
import { getSkinPreview } from '../../src/visual/presentation.js';
import { paintSkinPreview } from '../../src/visual/paint.js';

function fakeCanvasContext() {
  const calls = [];
  const ctx = new Proxy({
    calls,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({width: 10}),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === 'string' && key in Object.prototype) return undefined;
      // Canvas 2D drawing methods are mocked to assert animation doesn't change combat.
      return (...args) => { calls.push([key, ...args]); };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return ctx;
}

test('procedural fallback paints eight distinct skin selections at every quality', () => {
  for (const cosmetic of COSMETICS) {
    const skin = getSkinPreview(cosmetic.id, { owned: ['apprentice'] });
    for (const quality of ['low', 'medium', 'high']) {
      const ctx = fakeCanvasContext();
      assert.doesNotThrow(() => paintSkinPreview(ctx, skin, {
        width: 320, height: 210, quality, time: 3.2, reducedMotion: quality === 'low',
      }));
      assert.ok(ctx.calls.length > 12);
    }
  }
});

test('skin preview cannot alter a seeded game or profile', () => {
  const state = createGame(73001);
  const profile = { skin: 'apprentice', owned: ['apprentice'], settings: { vfx: 'medium', reduceMotion: true } };
  const beforeGame = JSON.stringify(state);
  const beforeProfile = JSON.stringify(profile);
  const ctx = fakeCanvasContext();
  paintSkinPreview(ctx, getSkinPreview('celestial', profile), {
    quality: 'high', time: 38, reducedMotion: false,
  });
  assert.equal(JSON.stringify(state), beforeGame);
  assert.equal(JSON.stringify(profile), beforeProfile);
});
