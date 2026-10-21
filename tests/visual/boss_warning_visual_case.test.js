import test from 'node:test';
import assert from 'node:assert/strict';
import { createBossWarningVisualCase } from './boss_warning_visual_case.js';
import { warningGeometry } from '../../src/visual/warnings.js';

const SIZES = [[320, 568], [844, 390]];
const EDGES = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'];

test('browser fixture is reproducible, mirrors actual RING/FAN/STAR and hits screen edges', () => {
  for (const [width, height] of SIZES) {
    for (const pattern of [0, 1, 2]) {
      for (const edge of EDGES) {
        const a = createBossWarningVisualCase(width, height, pattern, edge);
        const b = createBossWarningVisualCase(width, height, pattern, edge);
        assert.deepEqual(a, b);
        assert.equal(a.game.tick, 0); // never steps game/combat
        assert.equal(a.game.flashes.length, 1);
        assert.equal(a.game.enemies[0].type, 'boss');
        assert.equal(a.warning.type, 'warning');
        assert.equal(a.warning.pattern, pattern);
        assert.equal(a.warning.radius, pattern === 1 ? 200 : 170);
        const shape = warningGeometry(a.warning);
        assert.equal(shape.angles.length, [12, 5, 8][pattern]);
        assert.equal(a.warning.x - a.camera.x, a.screenX);
        assert.equal(a.warning.y - a.camera.y, a.screenY);
        assert.equal(a.screenY, edge.startsWith('top') ? 58 : height - 58);
        assert.ok(a.screenX >= 54 && a.screenX <= width - 54);
      }
    }
  }
});

test('browser fixture refuses invalid scene requests without mutating any profile', () => {
  assert.throws(() => createBossWarningVisualCase(0, 568), RangeError);
  assert.throws(() => createBossWarningVisualCase(320, 120), RangeError);
  assert.throws(() => createBossWarningVisualCase(320, 568, 3), RangeError);
  assert.throws(() => createBossWarningVisualCase(320, 568, 0, 'center'), RangeError);
});
