import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_PATHS, allowedRolePaths, outOfScopePaths } from '../scripts/check-team-scope.mjs';

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

test('all new test/qa-* branches enforce QA-only scope (no integration exemption)', () => {
  for (const branch of [
    'test/qa-webkit-hit-test-and-event-race',
    'test/qa-cases',
    'test/qa-a',
  ]) {
    assert.equal(allowedRolePaths(branch), ROLE_PATHS['test/team-qa-regression']);
    assert.deepEqual(outOfScopePaths(branch, [
      'scripts/browser_qa.py',
      'docs/QA_TEAM_REPORT.md',
      'tests/qa/event_storage_race.test.js',
      'src/main.js',
      'src/content/economy/catalog.js',
      '.github/workflows/ci.yml',
    ]), ['src/main.js', 'src/content/economy/catalog.js', '.github/workflows/ci.yml']);
  }
});

test('CEO and unrelated branches retain explicit manual-review exemption', () => {
  assert.equal(allowedRolePaths('integration/ceo-event-storage'), null);
  assert.equal(allowedRolePaths('chore/ceo-qa-branch-scope-gate'), null);
  assert.deepEqual(outOfScopePaths('integration/ceo-event-storage', [
    '.github/workflows/ci.yml', 'src/integration/eventLocalStorage.js'
  ]), []);
});

test('QA-prefixed names do not accidentally qualify as integration branches', () => {
  assert.deepEqual(outOfScopePaths('test/qa-override', [
    'src/events/core.js', 'src/main.js', 'tests/qa/migration.test.js'
  ]), ['src/events/core.js', 'src/main.js']);
});
