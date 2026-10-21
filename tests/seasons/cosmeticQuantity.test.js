import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateSeasonCatalog, createSeasonState, advanceSeasonXp, claimSeasonTier
} from '../../src/events/season.js';

const baseline = JSON.parse(readFileSync(new URL('../../src/content/seasons/season_s01.json', import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const START = '2030-01-07T00:00:00.000Z';

test('S01 cosmetic rewards are single items; omitted or explicit quantity 1 is valid', () => {
  assert.deepEqual(validateSeasonCatalog(baseline), {valid:true, errors:[]});
  const fixture = copy(baseline);
  fixture.reward_levels[0].free_reward.amount = 1;
  fixture.reward_levels[0].premium_preview.amount = 1;
  assert.deepEqual(validateSeasonCatalog(fixture), {valid:true, errors:[]});
  const xp = advanceSeasonXp(createSeasonState(), 100, fixture, START, 'run:1');
  assert.equal(xp.status, 'EARNED');
  const free = claimSeasonTier(xp.state, 1, 'free', fixture, START);
  assert.equal(free.status, 'CLAIMED');
  assert.equal(free.rewardIntent.amount, 1);
  assert.equal(claimSeasonTier(xp.state, 1, 'premium', fixture, START).status, 'PREVIEW_ONLY');
});

test('invalid cosmetic quantities on free and premium preview tracks fail closed', () => {
  for (const track of ['free_reward', 'premium_preview']) {
    for (const amount of [0, -1, 2, 999, '1', null]) {
      const fixture = copy(baseline);
      fixture.reward_levels[0][track].amount = amount;
      const validation = validateSeasonCatalog(fixture);
      assert.equal(validation.valid, false, track + ' ' + String(amount));
      assert.ok(validation.errors.some(message => message.includes('cosmetic quantity must equal 1')), JSON.stringify(validation.errors));
      assert.throws(
        () => claimSeasonTier(createSeasonState(), 1, 'free', fixture, START),
        /Invalid season catalog/
      );
    }
  }
});
