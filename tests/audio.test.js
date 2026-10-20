import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAudio } from '../src/audio.js';

class FakeParam {
  value = 0;
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  connect() {}
  start() {}
  stop() {}
}
class FakeAudioContext {
  static created = 0;
  constructor() { FakeAudioContext.created++; this.state = 'suspended'; this.currentTime = 10; this.destination = {}; this.tones = 0; FakeAudioContext.last = this; }
  createGain() { return new FakeNode(); }
  createOscillator() { this.tones++; return new FakeNode(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
function fakeStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test('no audio context is created on page load or disabled toggle', () => {
  FakeAudioContext.created = 0;
  const sound = createGameAudio({ ContextClass: FakeAudioContext, storage: fakeStorage('off') });
  assert.equal(sound.isEnabled(), false);
  assert.equal(sound.unlock(), false);
  sound.play('cast');
  sound.update(true);
  assert.equal(FakeAudioContext.created, 0);
  sound.setEnabled(true);
  assert.equal(FakeAudioContext.created, 0);
});

test('gesture unlock plays designed effect voices and schedules ambient notes', () => {
  const sound = createGameAudio({ ContextClass: FakeAudioContext, storage: fakeStorage() });
  assert.equal(sound.play('cast'), false);
  assert.equal(sound.unlock(), true);
  const ctx = FakeAudioContext.last;
  assert.equal(ctx.state, 'running');
  assert.equal(sound.play('cast'), true);
  const afterCast = ctx.tones;
  assert.ok(afterCast >= 2);
  sound.update(true);
  assert.ok(ctx.tones > afterCast);
  sound.update(false);
  assert.equal(sound.play('unlisted'), false);
});

test('mute is persisted and silently suppresses sound until reenabled', () => {
  const storage = fakeStorage();
  const sound = createGameAudio({ ContextClass: FakeAudioContext, storage });
  sound.unlock();
  const ctx = FakeAudioContext.last;
  sound.setEnabled(false);
  assert.equal(storage.getItem(), 'off');
  const count = ctx.tones;
  sound.play('level');
  sound.update(true);
  assert.equal(ctx.tones, count);
  sound.setEnabled(true);
  assert.equal(storage.getItem(), 'on');
  ctx.currentTime++;
  assert.equal(sound.play('level'), true);
  assert.ok(ctx.tones > count);
});

test('unsupported audio and denied persistence never break the game', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const sound = createGameAudio({ ContextClass: null, storage });
  assert.equal(sound.unlock(), false);
  assert.equal(sound.play('boss'), false);
  assert.equal(sound.setEnabled(false), false);
  sound.update(true);
});
