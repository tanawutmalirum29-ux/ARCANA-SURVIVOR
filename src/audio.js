// ARCANA SURVIVOR's original procedural audio: no samples, downloads or external services.
// AudioContext is created only after a user gesture (required by mobile browsers).
const SOUND_KEY = 'arcana-survivor-sound-v1';

// Side-effect-free hooks, derived only from the current deterministic simulation.
// Effects intentionally remain outside engine.js so the gameplay state never changes.
export function captureAudioState(game) {
  return {
    hp: game.player.hp, maxHp: game.player.maxHp,
    kills: game.kills, pickups: game.pickups.length,
    nextId: game.nextId, bossSpawned: game.bossSpawned
  };
}

export function getStepSounds(before, game) {
  const sounds = [];
  const freshFlashes = new Set(game.flashes.filter(f => f.id > before.nextId).map(f => f.type));
  const newKills = Math.max(0, game.kills - before.kills);
  const newlyCollected = before.pickups + newKills - game.pickups.length;
  const newPlayerShots = game.shots.some(s => s.id > before.nextId);
  const newHostileShots = game.hostileShots.filter(s => s.id > before.nextId).length;

  if (!before.bossSpawned && game.bossSpawned) sounds.push('boss');
  if (freshFlashes.has('warning')) sounds.push('bossWarning');
  if (freshFlashes.has('nova')) sounds.push('nova');
  if (freshFlashes.has('chain')) sounds.push('chain');
  if (newHostileShots >= 5) sounds.push('bossAttack');
  else if (newHostileShots > 0) sounds.push('enemyCast');

  const closeHit = game.skills.orbit > 0 && game.tick % 22 === 0 &&
    game.enemies.some(e => e.flash === 8 && e.hp > 0 &&
      Math.hypot(e.x - game.player.x, e.y - game.player.y) <= 92 + game.skills.orbit * 7);
  if (closeHit) sounds.push('orbit');
  else if (!freshFlashes.has('nova') && !freshFlashes.has('chain') &&
    game.enemies.some(e => e.flash === 8 && e.hp > 0)) sounds.push('impact');

  if (newPlayerShots) sounds.push('cast');
  if (newKills > 0) sounds.push('kill');
  if (newlyCollected > 0) sounds.push('pickup');
  if (game.player.hp < before.hp) {
    sounds.push('hurt');
    if (before.hp > before.maxHp * .3 && game.player.hp <= game.player.maxHp * .3 &&
      game.player.hp > 0) sounds.push('lowHealth');
  }
  return sounds;
}

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

  // Rapid automatic attacks and overlapping powers must not swamp phone speakers.
  const cooldown = {
    cast: .18, kill: .16, pickup: .18, hurt: .35,
    impact: .24, nova: 1.25, chain: .38, orbit: .45,
    bossWarning: 1.1, bossAttack: .8, enemyCast: 1.2, lowHealth: 4,
    upgradeSelect: .13, heal: .2, equip: .2, unlock: .8,
    menuOpen: .12, menuBack: .12, switch: .12
  };
  function play(type) {
    if (!enabled || !context || context.state !== 'running') return false;
    const at = context.currentTime + .005;
    const minimumGap = cooldown[type] ?? .025;
    if (at - (lastPlayed.get(type) ?? -100) < minimumGap) return false;
    lastPlayed.set(type, at);

    switch (type) {
      case 'impact':
        tone(at, 440, 110, .085, .036, 'triangle');
        break;
      case 'nova':
        tone(at, 880, 210, .48, .085, 'sine');
        tone(at + .035, 1230, 390, .37, .045, 'triangle');
        break;
      case 'chain':
        tone(at, 1550, 390, .18, .067, 'sawtooth');
        tone(at + .045, 830, 210, .16, .032, 'triangle');
        break;
      case 'orbit':
        tone(at, 360, 540, .15, .042, 'triangle');
        break;
      case 'bossWarning':
        tone(at, 340, 115, .48, .11, 'triangle');
        tone(at + .18, 520, 190, .35, .065, 'sawtooth');
        break;
      case 'bossAttack':
        tone(at, 105, 52, .48, .095, 'sawtooth');
        tone(at + .07, 460, 92, .33, .045, 'triangle');
        break;
      case 'enemyCast':
        tone(at, 520, 240, .16, .038, 'triangle');
        break;
      case 'lowHealth':
        [330, 260, 330].forEach((n, i) => tone(at + i * .18, n, n * .95, .15, .09, 'sine'));
        break;
      case 'upgradeSelect':
        [523, 784].forEach((n, i) => chime(at + i * .065, n, .07, .24));
        break;
      case 'heal':
        [392, 523, 659, 784].forEach((n, i) => chime(at + i * .07, n, .052, .30));
        break;
      case 'equip':
        chime(at, 540, .07, .16);
        chime(at + .065, 810, .05, .20);
        break;
      case 'unlock':
        [392, 494, 587, 784, 988].forEach((n, i) => chime(at + i * .10, n, .080, .47));
        break;
      case 'menuOpen':
        chime(at, 620, .058, .14);
        break;
      case 'menuBack':
        tone(at, 510, 350, .13, .044);
        break;
      case 'switch':
        tone(at, 400, 580, .09, .044);
        break;
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
