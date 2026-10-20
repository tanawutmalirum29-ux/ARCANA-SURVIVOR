// ARCANA SURVIVOR's original procedural audio: no samples, downloads or external services.
// AudioContext is created only after a user gesture (required by mobile browsers).
const SOUND_KEY = 'arcana-survivor-sound-v1';

export function createGameAudio({ storage, ContextClass } = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  let enabled = true;
  try { enabled = storage?.getItem(SOUND_KEY) !== 'off'; } catch { /* private mode */ }

  const AudioCtor = ContextClass === undefined
    ? globalThis.AudioContext || globalThis.webkitAudioContext
    : ContextClass;
  let context = null, master = null, effects = null, music = null;
  let isPlaying = false, nextNoteAt = 0, noteIndex = 0;
  const lastPlayed = new Map();
  const notes = [
    [146.83, 174.61, 220, 293.66],   // D minor
    [116.54, 146.83, 174.61, 233.08], // B-flat major
    [98.00, 146.83, 196, 246.94],    // G minor
    [110.00, 164.81, 207.65, 277.18] // A7
  ];
  const pattern = [0, 2, 1, 3, 2, 1, 0, 2];

  function ensureContext() {
    if (context || !AudioCtor) return context;
    try {
      context = new AudioCtor();
      master = context.createGain();
      effects = context.createGain();
      music = context.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      effects.gain.value = 0.42;
      music.gain.value = 0;
      effects.connect(master);
      music.connect(master);
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function unlock() {
    if (!enabled) return false;
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      try { Promise.resolve(ctx.resume()).catch(() => {}); } catch { return false; }
    }
    return true;
  }

  function tone(start, frequency, endFrequency, duration, volume, wave = 'sine', channel = effects) {
    if (!context || !channel) return;
    try {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
      if (endFrequency !== frequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration * .9);
      }
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + Math.min(.016, duration * .2));
      envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(channel);
      oscillator.start(start);
      oscillator.stop(start + duration + .025);
    } catch { /* audio unavailable should never interrupt combat */ }
  }

  function chime(start, frequency, volume = .07, duration = .22) {
    tone(start, frequency, frequency * 1.015, duration, volume, 'sine');
    tone(start, frequency * 2, frequency * 1.96, duration * .61, volume * .21, 'triangle');
  }

  const cooldown = { cast: .13, kill: .10, pickup: .13, hurt: .26 };
  function play(type) {
    if (!enabled || !context || context.state !== 'running') return false;
    const at = context.currentTime + .005;
    const minimumGap = cooldown[type] ?? .025;
    if (at - (lastPlayed.get(type) ?? -100) < minimumGap) return false;
    lastPlayed.set(type, at);

    switch (type) {
      case 'cast':
        tone(at, 790, 310, .145, .095, 'triangle');
        tone(at, 1270, 680, .095, .032);
        break;
      case 'kill':
        tone(at, 300, 115, .12, .082, 'triangle');
        break;
      case 'pickup':
        chime(at, 820, .066, .15);
        break;
      case 'hurt':
        tone(at, 165, 74, .24, .11, 'sawtooth');
        tone(at, 82, 58, .22, .045);
        break;
      case 'level':
        [523, 659, 784, 1047].forEach((n, i) => chime(at + i * .085, n, .095, .32));
        break;
      case 'boss':
        tone(at, 133, 63, 1.0, .125, 'sawtooth');
        chime(at + .24, 220, .055, .45);
        chime(at + .51, 196, .065, .46);
        break;
      case 'victory':
        [294, 370, 440, 587, 880].forEach((n, i) => chime(at + i * .115, n, .075, .56));
        break;
      case 'defeat':
        [440, 349, 262, 196].forEach((n, i) => tone(at + i * .16, n, n * .91, .43, .075, 'triangle'));
        break;
      case 'start':
        [392, 523, 659].forEach((n, i) => chime(at + i * .105, n, .065, .35));
        break;
      case 'pause':
        tone(at, 460, 230, .16, .06, 'sine');
        break;
      case 'resume':
        tone(at, 280, 430, .16, .06, 'sine');
        break;
      case 'menu':
        chime(at, 620, .048, .10);
        break;
      default: return false;
    }
    return true;
  }

  function update(playing) {
    if (!context || !enabled) return;
    const active = Boolean(playing) && context.state === 'running';
    if (active !== isPlaying) {
      isPlaying = active;
      music.gain.setTargetAtTime(active ? .23 : 0, context.currentTime, .065);
      nextNoteAt = 0;
    }
    if (!active) return;
    if (!nextNoteAt) nextNoteAt = context.currentTime + .045;
    // Schedule a short lookahead, not an unbounded timer or busy loop.
    while (nextNoteAt < context.currentTime + .12) {
      const chord = notes[Math.floor(noteIndex / 8) % notes.length];
      const frequency = chord[pattern[noteIndex % pattern.length]] * 2;
      tone(nextNoteAt, frequency, frequency, .46, .045, 'sine', music);
      if (noteIndex % 8 === 0) tone(nextNoteAt, chord[0], chord[0], 2.0, .026, 'triangle', music);
      noteIndex++;
      nextNoteAt += .55;
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    try { storage?.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* private mode */ }
    if (context) {
      master.gain.setTargetAtTime(enabled ? .55 : 0, context.currentTime, .025);
      if (!enabled) {
        isPlaying = false;
        nextNoteAt = 0;
        music.gain.setTargetAtTime(0, context.currentTime, .025);
      }
    }
    return enabled;
  }

  return { unlock, play, update, setEnabled, isEnabled: () => enabled };
}
