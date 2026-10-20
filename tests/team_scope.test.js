import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_PATHS, outOfScopePaths } from '../scripts/check-team-scope.mjs';

test('parallel team scope rules are defined', () => {
  assert.equal(Object.keys(ROLE_PATHS).length, 5);
});

test('game engineer cannot touch CEO wiring or VFX', () => {
  assert.deepEqual(outOfScopePaths('feat/team-gameplay-balance', [
    'src/engine.js', 'src/gameplay/boss.js', 'tests/engine.test.js', 'src/main.js', 'src/render.js',
  ]), ['src/main.js', 'src/render.js']);
});

test('VFX engineer cannot change combat', () => {
  assert.deepEqual(outOfScopePaths('feat/team-visual-skins', [
    'src/render.js', 'assets/skin-a.svg', 'src/visual/preview.js', 'src/engine.js',
  ]), ['src/engine.js']);
});

test('economy and events files stay isolated', () => {
  assert.deepEqual(outOfScopePaths('feat/team-economy-free', [
    'src/economy/core.js', 'src/content/economy/catalog.json', 'src/events/events.js',
  ]), ['src/events/events.js']);
  assert.deepEqual(outOfScopePaths('feat/team-events-season', [
    'src/content/seasons/s01.json', 'tests/events/time.test.js', 'src/economy/core.js',
  ]), ['src/economy/core.js']);
});

test('QA engineer cannot rewrite product code', () => {
  assert.deepEqual(outOfScopePaths('test/team-qa-regression', [
    'scripts/browser_qa.py', 'tests/qa/responsive.test.js', 'src/main.js',
  ]), ['src/main.js']);
});

test('unknown CEO/integration branches are not falsely rejected', () => {
  assert.deepEqual(outOfScopePaths('chore/ceo-team-scope-guard', ['.github/workflows/ci.yml']), []);
});
