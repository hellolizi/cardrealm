let context;
let muted = false;
let master;
let sfxBus;
let musicBus;
let reverbIn;
let noiseBuffer;
let pumpTimer = null;
let scene = null;
let pendingScene = 'menu';
let arpStep = 0;
let gestureSeen = false;
let musicVolume = 0.8;
let sfxVolume = 0.9;
const customSfxBlobs = new Map();
const customSfxBuffers = new Map();
const customSfxFailed = new Set();
const customMusicUrls = new Map();
const sfxDecoding = new Set();
let customMusic = null;
let activeMusicName = null;
let musicPreview = null;

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

const THEMES = {
  menu: {
    bpm: 52,
    volume: 0.72,
    filter: 4600,
    wet: 0.55,
    chordBars: 2,
    chords: [
      { bass: 45, notes: [57, 60, 64, 67, 71] },
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 38, notes: [50, 53, 57, 60, 64] },
      { bass: 40, notes: [52, 56, 59, 62, 67] },
    ],
    padVol: 0.013,
    padAttack: 2.4,
    padRelease: 3.2,
    bassSteps: [0],
    bassVol: 0.028,
    arpSteps: [2, 5, 7],
    arpChance: 0.5,
    arpVol: 0.023,
    arpOct: 12,
    bellChance: 0.08,
    bellVol: 0.011,
    perc: 'air',
  },
  online: {
    bpm: 56,
    volume: 0.7,
    filter: 5000,
    wet: 0.65,
    chordBars: 2,
    chords: [
      { bass: 45, notes: [57, 60, 64, 67, 71] },
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 48, notes: [55, 59, 62, 64, 67] },
      { bass: 43, notes: [50, 55, 59, 62, 67] },
    ],
    padVol: 0.013,
    padAttack: 2.2,
    padRelease: 3.4,
    bassSteps: [0],
    bassVol: 0.027,
    arpSteps: [1, 3, 5, 7],
    arpChance: 0.5,
    arpVol: 0.022,
    arpOct: 12,
    bellChance: 0.13,
    bellVol: 0.012,
    perc: 'air',
  },
  world: {
    bpm: 64,
    volume: 0.7,
    filter: 5600,
    wet: 0.6,
    chordBars: 2,
    chords: [
      { bass: 38, notes: [57, 60, 64, 65, 69] },
      { bass: 34, notes: [53, 58, 62, 65, 69] },
      { bass: 41, notes: [55, 60, 64, 67, 72] },
      { bass: 36, notes: [52, 55, 59, 62, 64] },
    ],
    padVol: 0.012,
    padAttack: 2,
    padRelease: 3,
    bassSteps: [0, 4],
    bassVol: 0.026,
    arpSteps: [1, 2, 3, 5, 6, 7],
    arpChance: 0.42,
    arpVol: 0.021,
    arpOct: 12,
    bellChance: 0.05,
    bellVol: 0.01,
    perc: 'air',
  },
  battle: {
    bpm: 92,
    volume: 0.62,
    filter: 8200,
    wet: 0.35,
    chordBars: 2,
    chords: [
      { bass: 40, notes: [52, 55, 59, 62, 66] },
      { bass: 36, notes: [48, 52, 55, 59, 64] },
      { bass: 43, notes: [50, 55, 59, 62, 64] },
      { bass: 38, notes: [50, 54, 57, 62, 66] },
    ],
    padVol: 0.009,
    padAttack: 0.9,
    padRelease: 1.6,
    bassSteps: [0, 2, 4, 6],
    bassAlt: true,
    bassVol: 0.03,
    arpSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    arpChance: 0.72,
    arpVol: 0.014,
    arpOct: 12,
    bellChance: 0.02,
    bellVol: 0.008,
    perc: 'battle',
  },
  boss: {
    bpm: 74,
    volume: 0.68,
    filter: 7600,
    wet: 0.5,
    chordBars: 2,
    chords: [
      { bass: 38, notes: [50, 53, 57, 62, 65] },
      { bass: 34, notes: [46, 50, 53, 58, 62] },
      { bass: 36, notes: [48, 51, 55, 60, 64] },
      { bass: 33, notes: [45, 48, 52, 57, 60] },
    ],
    padVol: 0.015,
    padAttack: 1.6,
    padRelease: 2.8,
    bassSteps: [0, 2, 4, 6],
    bassAlt: true,
    bassVol: 0.036,
    arpSteps: [0, 2, 3, 5, 6, 7],
    arpChance: 0.45,
    arpVol: 0.012,
    arpOct: 12,
    bellChance: 0.18,
    bellVol: 0.016,
    leadChance: 0.22,
    leadVol: 0.011,
    perc: 'boss',
  },
  bossPhase2: {
    bpm: 116,
    volume: 0.7,
    filter: 9800,
    wet: 0.36,
    chordBars: 1,
    chords: [
      { bass: 38, notes: [50, 53, 57, 62, 65] },
      { bass: 34, notes: [46, 50, 53, 58, 62] },
      { bass: 31, notes: [43, 46, 50, 55, 58] },
      { bass: 33, notes: [45, 49, 52, 57, 61] },
    ],
    padVol: 0.017,
    padAttack: 0.7,
    padRelease: 1.4,
    bassSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    bassAlt: true,
    bassVol: 0.045,
    arpSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    arpChance: 0.86,
    arpVol: 0.017,
    arpOct: 12,
    bellChance: 0.08,
    bellVol: 0.01,
    leadChance: 0.5,
    leadVol: 0.014,
    perc: 'bossPhase2',
  },
  onlineBattle: {
    bpm: 98,
    volume: 0.63,
    filter: 8600,
    wet: 0.55,
    chordBars: 2,
    chords: [
      { bass: 45, notes: [57, 60, 64, 67, 71] },
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 38, notes: [50, 53, 57, 60, 64] },
      { bass: 40, notes: [52, 56, 59, 62, 67] },
    ],
    padVol: 0.011,
    padAttack: 1,
    padRelease: 1.8,
    bassSteps: [0, 2, 4, 6],
    bassAlt: true,
    bassVol: 0.031,
    arpSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    arpChance: 0.8,
    arpVol: 0.015,
    arpOct: 12,
    bellChance: 0.06,
    bellVol: 0.009,
    perc: 'battle',
  },
  studio: {
    bpm: 48,
    volume: 0.62,
    filter: 4500,
    wet: 0.6,
    chordBars: 2,
    chords: [
      { bass: 36, notes: [55, 59, 62, 64, 67] },
      { bass: 45, notes: [57, 60, 64, 67, 71] },
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 43, notes: [50, 55, 59, 62, 67] },
    ],
    padVol: 0.013,
    padAttack: 2.2,
    padRelease: 3,
    bassSteps: [0],
    bassVol: 0.025,
    arpSteps: [2, 4, 6],
    arpChance: 0.52,
    arpVol: 0.022,
    arpOct: 12,
    bellChance: 0.12,
    bellVol: 0.011,
    perc: 'none',
  },
  result: {
    bpm: 42,
    volume: 0.74,
    filter: 4200,
    wet: 0.75,
    chordBars: 2,
    chords: [
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 36, notes: [52, 55, 59, 64, 67] },
      { bass: 38, notes: [50, 53, 57, 60, 64] },
      { bass: 45, notes: [57, 60, 64, 67, 71] },
    ],
    padVol: 0.017,
    padAttack: 2.8,
    padRelease: 4,
    bassSteps: [0],
    bassVol: 0.027,
    arpSteps: [4],
    arpChance: 0.35,
    arpVol: 0.02,
    arpOct: 12,
    bellChance: 0.1,
    bellVol: 0.012,
    leadChance: 0.5,
    leadVol: 0.012,
    perc: 'none',
  },
  ending: {
    bpm: 46,
    volume: 0.76,
    filter: 5200,
    wet: 0.8,
    chordBars: 2,
    chords: [
      { bass: 45, notes: [57, 60, 64, 67, 71] },
      { bass: 41, notes: [53, 57, 60, 64, 67] },
      { bass: 36, notes: [52, 55, 59, 64, 67] },
      { bass: 43, notes: [50, 55, 59, 62, 67] },
    ],
    padVol: 0.018,
    padAttack: 2.6,
    padRelease: 4.5,
    bassSteps: [0, 4],
    bassVol: 0.027,
    arpSteps: [1, 3, 5, 7],
    arpChance: 0.4,
    arpVol: 0.021,
    arpOct: 12,
    bellChance: 0.12,
    bellVol: 0.013,
    leadChance: 0.45,
    leadVol: 0.013,
    perc: 'air',
  },
};

function makeNoiseBuffer(audio, seconds = 2) {
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makeImpulse(audio, seconds, decay) {
  const length = Math.floor(audio.sampleRate * seconds);
  const impulse = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay;
    }
  }
  return impulse;
}

function ensureGraph() {
  if (!context || master) return;
  master = context.createGain();
  master.gain.value = muted ? 0 : 1;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 16;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;
  master.connect(limiter);
  limiter.connect(context.destination);

  sfxBus = context.createGain();
  sfxBus.gain.value = sfxVolume;
  sfxBus.connect(master);

  musicBus = context.createGain();
  musicBus.gain.value = musicVolume;
  musicBus.connect(master);

  reverbIn = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = makeImpulse(context, 3.4, 2.6);
  const wet = context.createGain();
  wet.gain.value = 0.55;
  reverbIn.connect(convolver);
  convolver.connect(wet);
  wet.connect(musicBus);
  noiseBuffer = makeNoiseBuffer(context, 2);
}

function ensureContext() {
  if (muted) return null;
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      context = new AudioContextClass();
    } catch {
      return null;
    }
    ensureGraph();
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function stopPump() {
  if (pumpTimer) {
    clearInterval(pumpTimer);
    pumpTimer = null;
  }
}

function ensurePump() {
  if (pumpTimer || !context || muted) return;
  pump();
  pumpTimer = setInterval(pump, 90);
}

function pump() {
  if (!context || !scene || muted || context.state !== 'running') return;
  const now = context.currentTime;
  if (scene.nextTime < now - 0.5) scene.nextTime = now + 0.06;
  const horizon = now + 0.45;
  let guard = 0;
  while (scene.nextTime < horizon && guard < 64) {
    scheduleStep(scene, scene.nextTime);
    scene.nextTime += scene.stepDur;
    scene.step += 1;
    guard += 1;
  }
}

function fadeOutProcedural(previous, seconds = 1.8) {
  if (!previous || !context) return;
  const now = context.currentTime;
  try {
    previous.bus.gain.cancelScheduledValues(now);
    previous.bus.gain.setValueAtTime(Math.max(previous.bus.gain.value, 0.0001), now);
    previous.bus.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    previous.wet.gain.cancelScheduledValues(now);
    previous.wet.gain.setValueAtTime(Math.max(previous.wet.gain.value, 0.0001), now);
    previous.wet.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  } catch {
    // A previous scene may already be fading out.
  }
  setTimeout(() => {
    try {
      previous.bus.disconnect();
      previous.wet.disconnect();
    } catch {
      // The old scene may already be detached.
    }
  }, seconds * 1000 + 500);
}

function stopProcedural(seconds = 1.6) {
  const previous = scene;
  scene = null;
  stopPump();
  fadeOutProcedural(previous, seconds);
}

function startProcedural(name, theme) {
  const now = context.currentTime;
  const bus = context.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  const wet = context.createGain();
  wet.gain.setValueAtTime(0.0001, now);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = theme.filter;
  filter.Q.value = 0.4;
  bus.connect(filter);
  filter.connect(musicBus);
  wet.connect(reverbIn);
  bus.gain.linearRampToValueAtTime(theme.volume, now + 2.2);
  wet.gain.linearRampToValueAtTime(theme.wet, now + 2.2);

  const previous = scene;
  scene = {
    name,
    theme,
    bus,
    wet,
    step: 0,
    chordBars: theme.chordBars || 2,
    stepDur: 30 / theme.bpm,
    nextTime: now + 0.12,
  };
  fadeOutProcedural(previous, 2);
  arpStep = 0;
  ensurePump();
}

function stopCustomMusic(seconds = 1.5) {
  const previous = customMusic;
  customMusic = null;
  if (!previous) return;
  if (!context) {
    try {
      previous.el.pause();
    } catch {
      // The media element may already be closed.
    }
    return;
  }
  const now = context.currentTime;
  try {
    previous.gain.gain.cancelScheduledValues(now);
    previous.gain.gain.setValueAtTime(Math.max(previous.gain.gain.value, 0.0001), now);
    previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  } catch {
    // The gain node may already be detached.
  }
  setTimeout(() => {
    try {
      previous.el.pause();
      previous.source.disconnect();
      previous.gain.disconnect();
    } catch {
      // The old track may already be detached.
    }
  }, seconds * 1000 + 120);
}

function startCustomMusic(name, url) {
  if (!context) return;
  const element = new Audio();
  element.src = url;
  element.loop = true;
  element.preload = 'auto';
  element.volume = 1;
  let source;
  try {
    source = context.createMediaElementSource(element);
  } catch (error) {
    console.warn('无法连接自定义背景音乐。', error);
    return;
  }
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  source.connect(gain);
  gain.connect(musicBus);
  customMusic = { name, url, el: element, source, gain };
  element.play()
    .then(() => {
      if (!context || customMusic?.el !== element) return;
      const at = context.currentTime;
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(gain.gain.value, at);
      gain.gain.linearRampToValueAtTime(1, at + 1.8);
    })
    .catch(() => {
      // Autoplay must wait for a trusted gesture; the next prime will retry.
    });
}

function stopMusicPreview(resume = true) {
  const previous = musicPreview;
  if (!previous) return;
  musicPreview = null;
  clearTimeout(previous.timer);
  if (context) {
    const now = context.currentTime;
    try {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(Math.max(previous.gain.gain.value, 0.0001), now);
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    } catch {
      // The preview may already be fading.
    }
  }
  setTimeout(() => {
    try {
      previous.el.pause();
      previous.source.disconnect();
      previous.gain.disconnect();
    } catch {
      // The preview may already be detached.
    }
  }, 500);
  if (resume && gestureSeen && !muted) startScene(previous.returnScene || pendingScene, true);
}

function startMusicPreview(url, seconds = 12) {
  const audio = ensureContext();
  if (!audio) return false;
  stopMusicPreview(false);
  stopCustomMusic(0.4);
  stopProcedural(0.4);
  const element = new Audio();
  element.src = url;
  element.loop = true;
  element.preload = 'auto';
  element.volume = 1;
  let source;
  try {
    source = audio.createMediaElementSource(element);
  } catch (error) {
    console.warn('无法试听这段背景音乐。', error);
    if (!muted) startScene(activeMusicName || pendingScene, true);
    return false;
  }
  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  source.connect(gain);
  gain.connect(musicBus);
  const returnScene = activeMusicName || pendingScene;
  musicPreview = {
    el: element,
    source,
    gain,
    url,
    timer: setTimeout(() => stopMusicPreview(true), Math.max(3, seconds) * 1000),
    returnScene,
  };
  element.play()
    .then(() => {
      if (!context || musicPreview?.el !== element) return;
      const at = context.currentTime;
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), at);
      gain.gain.linearRampToValueAtTime(1, at + 0.7);
    })
    .catch(() => {
      stopMusicPreview(true);
    });
  return true;
}

function startScene(name, force = false) {
  if (!context) {
    pendingScene = name;
    return;
  }
  const theme = THEMES[name];
  if (!theme) return;
  if (musicPreview) stopMusicPreview(false);
  activeMusicName = name;
  pendingScene = name;
  const customUrl = customMusicUrls.get(name) || null;
  if (!force) {
    if (customUrl) {
      if (customMusic?.name === name && customMusic.url === customUrl) {
        if (customMusic.el.paused) customMusic.el.play().catch(() => {});
        return;
      }
    } else if (!customMusic && scene?.name === name) {
      ensurePump();
      return;
    }
  }
  stopCustomMusic(1.4);
  if (customUrl) {
    stopProcedural(1.4);
    startCustomMusic(name, customUrl);
    return;
  }
  startProcedural(name, theme);
}

function playPad(time, frequency, duration, volume, attack, release, state) {
  const audio = context;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(520, time);
  filter.frequency.linearRampToValueAtTime(1250, time + Math.max(2, attack));
  filter.Q.value = 0.6;
  const gain = audio.createGain();
  const attackTime = Math.max(0.2, attack);
  const releaseTime = Math.max(1, release);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + attackTime);
  gain.gain.setValueAtTime(volume, time + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + releaseTime);
  filter.connect(gain);
  gain.connect(state.bus);
  gain.connect(state.wet);
  [-4, 4].forEach((detune) => {
    const oscillator = audio.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    oscillator.connect(filter);
    oscillator.start(time);
    oscillator.stop(time + duration + releaseTime + 0.05);
  });
}

function playBass(time, frequency, duration, volume, state) {
  const audio = context;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 340;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.045);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  const body = audio.createOscillator();
  body.type = 'triangle';
  body.frequency.value = frequency;
  const sub = audio.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = frequency / 2;
  const subGain = audio.createGain();
  subGain.gain.value = 0.35;
  body.connect(filter);
  sub.connect(subGain);
  subGain.connect(filter);
  filter.connect(gain);
  gain.connect(state.bus);
  body.start(time);
  sub.start(time);
  body.stop(time + duration + 0.05);
  sub.stop(time + duration + 0.05);
}

function panned(audio, node, pan) {
  if (!audio.createStereoPanner) return node;
  const panner = audio.createStereoPanner();
  panner.pan.value = pan;
  node.connect(panner);
  return panner;
}

function playPluck(time, frequency, volume, state, pan = 0) {
  const audio = context;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;
  filter.Q.value = 0.5;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6);
  const body = audio.createOscillator();
  body.type = 'triangle';
  body.frequency.value = frequency;
  const shine = audio.createOscillator();
  shine.type = 'sine';
  shine.frequency.value = frequency * 2;
  const shineGain = audio.createGain();
  shineGain.gain.value = 0.25;
  body.connect(filter);
  shine.connect(shineGain);
  shineGain.connect(filter);
  filter.connect(gain);
  const output = panned(audio, gain, pan);
  output.connect(state.bus);
  output.connect(state.wet);
  body.start(time);
  shine.start(time);
  body.stop(time + 1.65);
  shine.stop(time + 1.65);
}

function playBell(time, frequency, volume, state, pan = 0) {
  const audio = context;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 4.4);
  const output = panned(audio, gain, pan);
  output.connect(state.bus);
  output.connect(state.wet);
  [[1, 1], [2.01, 0.32], [3.98, 0.14]].forEach(([ratio, level], index) => {
    const partial = audio.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = frequency * ratio;
    const partialGain = audio.createGain();
    partialGain.gain.value = level;
    partial.connect(partialGain);
    partialGain.connect(gain);
    partial.start(time + index * 0.004);
    partial.stop(time + 4.5);
  });
}

function playLead(time, frequency, volume, state) {
  const audio = context;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.45);
  gain.gain.setValueAtTime(volume, time + 1.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 4.6);
  const oscillator = audio.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency;
  const vibrato = audio.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 4.2;
  const vibratoDepth = audio.createGain();
  vibratoDepth.gain.value = 5;
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(oscillator.detune);
  oscillator.connect(filter);
  filter.connect(gain);
  const output = panned(audio, gain, 0.18);
  output.connect(state.bus);
  output.connect(state.wet);
  oscillator.start(time);
  vibrato.start(time);
  oscillator.stop(time + 4.7);
  vibrato.stop(time + 4.7);
}

function playKick(time, theme, state, weight = 1) {
  const audio = context;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.045 * weight, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  const oscillator = audio.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(108, time);
  oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.2);
  oscillator.connect(gain);
  gain.connect(state.bus);
  oscillator.start(time);
  oscillator.stop(time + 0.32);
}

function playBrush(time, theme, state) {
  const audio = context;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.7;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.012, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(state.bus);
  gain.connect(state.wet);
  source.start(time);
  source.stop(time + 0.24);
}

function playAir(time, theme, state) {
  const audio = context;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 460;
  filter.Q.value = 0.45;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.007, time + 4);
  gain.gain.linearRampToValueAtTime(0.0001, time + 10);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(state.bus);
  gain.connect(state.wet);
  source.start(time);
  source.stop(time + 10.2);
}

function scheduleStep(state, time) {
  const theme = state.theme;
  const position = state.step % 8;
  const bar = Math.floor(state.step / 8);
  const span = state.chordBars * 8;
  const chord = theme.chords[Math.floor(state.step / span) % theme.chords.length];
  const chordStart = state.step % span === 0;

  if (chordStart) {
    const attack = theme.padAttack ?? 1.8;
    const release = theme.padRelease ?? 3;
    const duration = Math.max(1, state.stepDur * span - release * 0.5);
    chord.notes.forEach((note, index) => {
      playPad(time + index * 0.03, midiToHz(note), duration, theme.padVol, attack, release, state);
    });
    if (Math.random() < (theme.bellChance ?? 0)) {
      const note = chord.notes[chord.notes.length - 1] + 24;
      playBell(time + 0.3, midiToHz(note), theme.bellVol, state, Math.random() * 1.2 - 0.6);
    }
  }

  if ((theme.bassSteps || []).includes(position)) {
    const octave = theme.bassAlt && Math.floor(state.step / 2) % 2 ? 12 : 0;
    playBass(time, midiToHz(chord.bass + octave), state.stepDur * 1.7, theme.bassVol, state);
  }

  if ((theme.arpSteps || []).includes(position) && Math.random() < (theme.arpChance ?? 0)) {
    const notes = chord.notes;
    const note = notes[(arpStep + position) % notes.length] + (theme.arpOct ?? 12);
    arpStep += 1;
    const pan = ((arpStep + bar) % 2 ? 0.34 : -0.34);
    playPluck(time, midiToHz(note), theme.arpVol, state, pan);
  }

  if (theme.leadChance && position === 4 && Math.random() < theme.leadChance) {
    const note = chord.notes[(bar + 2) % chord.notes.length] + 24;
    playLead(time, midiToHz(note), theme.leadVol, state);
  }

  if (theme.perc === 'battle') {
    if (position === 0 || position === 4) {
      playKick(time, theme, state, position === 0 ? 1 : 0.72);
    }
    if (position === 2 || position === 6) playBrush(time, theme, state);
  } else if (theme.perc === 'boss') {
    if (position === 0 || position === 3 || position === 4 || position === 6) {
      playKick(time, theme, state, position === 0 ? 1.18 : 0.74);
    }
    if (position === 2 || position === 6) playBrush(time, theme, state);
    if (position === 0 && bar % 2 === 0) {
      playBell(time + 0.04, midiToHz(chord.bass + 12), 0.010, state, -0.24);
    }
  } else if (theme.perc === 'bossPhase2') {
    if (position % 2 === 0) {
      playKick(time, theme, state, position === 0 || position === 4 ? 1.2 : 0.82);
    } else {
      playBrush(time, theme, state);
    }
    if (position === 0 || position === 3 || position === 5) {
      playBell(time + 0.03, midiToHz(chord.bass + 24), 0.008, state, position === 0 ? 0.3 : -0.26);
    }
  } else if (theme.perc === 'air' && position === 0 && bar % 6 === 4) {
    playAir(time, theme, state);
  }
}

function prime() {
  if (muted) return;
  const audio = ensureContext();
  if (!audio) return;
  const start = () => {
    decodePendingSfx();
    if (musicPreview) {
      if (musicPreview.el.paused) musicPreview.el.play().catch(() => {});
      return;
    }
    startScene(pendingScene);
    if (customMusic?.el.paused) customMusic.el.play().catch(() => {});
    if (scene) {
      if (!pumpTimer) scene.nextTime = Math.max(scene.nextTime, audio.currentTime + 0.08);
      ensurePump();
    }
  };
  if (audio.state === 'suspended') {
    audio.resume().then(start).catch(() => {});
  } else {
    start();
  }
}

function setMuteGain() {
  if (!master || !context) return;
  const now = context.currentTime;
  const current = master.gain.value;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(current, now);
  master.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, now + 0.35);
}

function tone({ frequency, duration = 0.12, type = 'sine', volume = 0.035, slide = 1, delay = 0 }) {
  const audio = ensureContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slide !== 1) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * slide), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(sfxBus);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise({ duration = 0.16, volume = 0.035, lowpass = 1200, delay = 0 }) {
  const audio = ensureContext();
  if (!audio) return;
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);
  source.start(audio.currentTime + delay);
}

function playCustomSfx(buffer) {
  if (!context || !sfxBus || !buffer) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(sfxBus);
  source.start();
}

async function decodeCustomSfx(slot, blob) {
  if (!context || sfxDecoding.has(slot)) return;
  sfxDecoding.add(slot);
  try {
    const data = await blob.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    if (customSfxBlobs.get(slot) === blob) {
      customSfxBuffers.set(slot, buffer);
      customSfxFailed.delete(slot);
    }
  } catch (error) {
    if (customSfxBlobs.get(slot) === blob) customSfxFailed.add(slot);
    console.warn(`无法解码自定义音效「${slot}」，将使用内置音效。`, error);
  } finally {
    sfxDecoding.delete(slot);
  }
}

function decodePendingSfx() {
  if (!context) return;
  for (const [slot, blob] of customSfxBlobs) {
    if (!customSfxBuffers.has(slot) && !customSfxFailed.has(slot)) decodeCustomSfx(slot, blob);
  }
}

function playSfx(slot, fallback) {
  if (muted) return;
  const active = ensureContext();
  if (!active) return;
  const buffer = customSfxBuffers.get(slot);
  if (buffer) {
    playCustomSfx(buffer);
    return;
  }
  const blob = customSfxBlobs.get(slot);
  if (blob && !customSfxFailed.has(slot)) {
    decodeCustomSfx(slot, blob);
  }
  fallback();
}

const SFX_FALLBACKS = {
  click() {
    tone({ frequency: 440, duration: 0.045, type: 'triangle', volume: 0.018, slide: 0.85 });
  },
  hover() {
    tone({ frequency: 660, duration: 0.03, type: 'sine', volume: 0.008 });
  },
  card() {
    noise({ duration: 0.09, volume: 0.018, lowpass: 2200 });
    tone({ frequency: 260, duration: 0.08, type: 'triangle', volume: 0.016, slide: 1.3 });
  },
  attack() {
    noise({ duration: 0.18, volume: 0.04, lowpass: 900 });
    tone({ frequency: 120, duration: 0.16, type: 'sawtooth', volume: 0.03, slide: 0.55 });
  },
  enemyAttack() {
    noise({ duration: 0.24, volume: 0.05, lowpass: 600 });
    tone({ frequency: 90, duration: 0.22, type: 'sawtooth', volume: 0.038, slide: 0.5 });
  },
  hit() {
    noise({ duration: 0.12, volume: 0.032, lowpass: 1500 });
    tone({ frequency: 168, duration: 0.11, type: 'square', volume: 0.021, slide: 0.6 });
    tone({ frequency: 92, duration: 0.16, type: 'sine', volume: 0.026, slide: 0.72, delay: 0.012 });
  },
  // 重击：瞬态更锐、body 更低、尾巴更长。
  // 跟 hit 叠在一起时，耳朵读到的不是「更响」，而是「更沉」。
  hitHeavy() {
    noise({ duration: 0.09, volume: 0.05, lowpass: 3200 });
    noise({ duration: 0.34, volume: 0.036, lowpass: 380, delay: 0.02 });
    tone({ frequency: 62, duration: 0.4, type: 'sine', volume: 0.055, slide: 0.55 });
    tone({ frequency: 124, duration: 0.16, type: 'square', volume: 0.024, slide: 0.5, delay: 0.006 });
  },
  hurt() {
    noise({ duration: 0.16, volume: 0.024, lowpass: 520 });
    tone({ frequency: 104, duration: 0.19, type: 'sawtooth', volume: 0.028, slide: 0.55 });
    tone({ frequency: 58, duration: 0.24, type: 'sine', volume: 0.018, delay: 0.02 });
  },
  block() {
    tone({ frequency: 320, duration: 0.12, type: 'square', volume: 0.018, slide: 1.1 });
    tone({ frequency: 640, duration: 0.08, type: 'sine', volume: 0.02, delay: 0.03 });
  },
  heal() {
    tone({ frequency: 523, duration: 0.18, type: 'sine', volume: 0.025 });
    tone({ frequency: 784, duration: 0.22, type: 'sine', volume: 0.02, delay: 0.08 });
  },
  draw() {
    tone({ frequency: 520, duration: 0.05, type: 'triangle', volume: 0.014, slide: 1.4 });
  },
  energy() {
    tone({ frequency: 480, duration: 0.22, type: 'sine', volume: 0.018, slide: 2.2 });
    tone({ frequency: 720, duration: 0.16, type: 'triangle', volume: 0.013, slide: 1.6, delay: 0.06 });
    tone({ frequency: 1080, duration: 0.12, type: 'sine', volume: 0.01, delay: 0.12 });
  },
  burn() {
    noise({ duration: 0.3, volume: 0.03, lowpass: 1800 });
    noise({ duration: 0.18, volume: 0.02, lowpass: 900, delay: 0.09 });
    tone({ frequency: 190, duration: 0.26, type: 'sawtooth', volume: 0.016, slide: 0.5 });
    tone({ frequency: 620, duration: 0.08, type: 'triangle', volume: 0.012, slide: 0.7, delay: 0.03 });
  },
  poison() {
    noise({ duration: 0.2, volume: 0.012, lowpass: 700 });
    tone({ frequency: 180, duration: 0.12, type: 'sine', volume: 0.02, slide: 0.55 });
    tone({ frequency: 240, duration: 0.09, type: 'sine', volume: 0.015, slide: 0.7, delay: 0.1 });
    tone({ frequency: 320, duration: 0.08, type: 'triangle', volume: 0.012, slide: 0.8, delay: 0.18 });
  },
  thorns() {
    noise({ duration: 0.1, volume: 0.02, lowpass: 2600 });
    tone({ frequency: 1180, duration: 0.1, type: 'square', volume: 0.014, slide: 1.4 });
    tone({ frequency: 640, duration: 0.16, type: 'triangle', volume: 0.02, slide: 0.6, delay: 0.01 });
  },
  debuff() {
    tone({ frequency: 300, duration: 0.22, type: 'sawtooth', volume: 0.016, slide: 0.45 });
    tone({ frequency: 214, duration: 0.26, type: 'sine', volume: 0.014, slide: 0.5, delay: 0.03 });
  },
  coin() {
    tone({ frequency: 880, duration: 0.08, type: 'triangle', volume: 0.02 });
    tone({ frequency: 1320, duration: 0.16, type: 'triangle', volume: 0.018, delay: 0.06 });
  },
  buff() {
    tone({ frequency: 280, duration: 0.2, type: 'sine', volume: 0.025, slide: 1.8 });
  },
  relic() {
    tone({ frequency: 392, duration: 0.18, type: 'triangle', volume: 0.022, slide: 1.25 });
    tone({ frequency: 587, duration: 0.26, type: 'sine', volume: 0.019, delay: 0.05, slide: 1.12 });
    tone({ frequency: 880, duration: 0.34, type: 'sine', volume: 0.013, delay: 0.12 });
    noise({ duration: 0.14, volume: 0.008, lowpass: 3200, delay: 0.02 });
  },
  phase() {
    noise({ duration: 0.7, volume: 0.05, lowpass: 420 });
    tone({ frequency: 58, duration: 0.9, type: 'sawtooth', volume: 0.042, slide: 0.62 });
    tone({ frequency: 116, duration: 0.7, type: 'triangle', volume: 0.028, slide: 0.75 });
    tone({ frequency: 196, duration: 1.1, type: 'sine', volume: 0.024, delay: 0.12 });
    tone({ frequency: 294, duration: 0.9, type: 'sine', volume: 0.016, delay: 0.24, slide: 1.04 });
    noise({ duration: 0.35, volume: 0.022, lowpass: 2200, delay: 0.1 });
  },
  lastStand() {
    // 两次心跳，中间留一段太长的安静；玩家会先听见自己。
    tone({ frequency: 52, duration: 0.24, type: 'sine', volume: 0.058, slide: 0.9 });
    tone({ frequency: 48, duration: 0.2, type: 'sine', volume: 0.044, slide: 0.86, delay: 0.24 });
    tone({ frequency: 44, duration: 0.3, type: 'sine', volume: 0.052, slide: 0.82, delay: 0.94 });
    tone({ frequency: 40, duration: 0.24, type: 'sine', volume: 0.038, slide: 0.8, delay: 1.18 });
    noise({ duration: 0.5, volume: 0.012, lowpass: 240, delay: 0.04 });
  },
  victory() {
    [392, 523, 659, 784].forEach((frequency, index) => {
      tone({ frequency, duration: 0.34, type: 'triangle', volume: 0.022, delay: index * 0.09 });
    });
  },
  defeat() {
    [330, 262, 196, 147].forEach((frequency, index) => {
      tone({ frequency, duration: 0.4, type: 'sine', volume: 0.025, delay: index * 0.13, slide: 0.85 });
    });
  },
};

export const audio = {
  setMuted(value) {
    muted = Boolean(value);
    setMuteGain();
    if (muted) {
      stopPump();
      customMusic?.el.pause();
      musicPreview?.el.pause();
      return;
    }
    if (gestureSeen) prime();
  },
  setVolumes({ music, sfx } = {}) {
    if (Number.isFinite(Number(music))) musicVolume = Math.min(1, Math.max(0, Number(music)));
    if (Number.isFinite(Number(sfx))) sfxVolume = Math.min(1, Math.max(0, Number(sfx)));
    if (!context) return;
    const now = context.currentTime;
    if (musicBus) {
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(musicVolume, now + 0.18);
    }
    if (sfxBus) {
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.setValueAtTime(sfxBus.gain.value, now);
      sfxBus.gain.linearRampToValueAtTime(sfxVolume, now + 0.18);
    }
  },
  hush(duration = 1.2) {
    if (!context || !musicBus || muted) return;
    const now = context.currentTime;
    const duck = Math.max(0.0001, musicVolume * 0.08);
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), now);
    musicBus.gain.linearRampToValueAtTime(duck, now + 0.16);
    const hold = now + Math.max(0.3, duration - 0.3);
    musicBus.gain.setValueAtTime(duck, hold);
    musicBus.gain.linearRampToValueAtTime(Math.max(0.0001, musicVolume), now + Math.max(0.45, duration));
  },
  setScene(name) {
    const next = THEMES[name] ? name : 'menu';
    pendingScene = next;
    if (!context || muted) return;
    startScene(next);
  },
  setCustomSfx(slot, blob) {
    customSfxBuffers.delete(slot);
    customSfxFailed.delete(slot);
    if (!blob) {
      customSfxBlobs.delete(slot);
      return;
    }
    customSfxBlobs.set(slot, blob);
    if (context) decodeCustomSfx(slot, blob);
  },
  setCustomMusic(slot, url) {
    const previous = customMusicUrls.get(slot) || null;
    if (previous === url) return;
    if (musicPreview?.url === previous) stopMusicPreview(true);
    if (customMusic?.name === slot && customMusic.url === previous) stopCustomMusic(0.9);
    if (url) customMusicUrls.set(slot, url);
    else customMusicUrls.delete(slot);
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1600);
    if (context && !muted && gestureSeen && activeMusicName === slot) {
      startScene(slot, true);
    }
  },
  previewSfx(slot) {
    const fallback = SFX_FALLBACKS[slot];
    if (!fallback) return false;
    decodePendingSfx();
    playSfx(slot, fallback);
    return true;
  },
  previewMusic(url, seconds = 12) {
    if (!url) return false;
    return startMusicPreview(url, seconds);
  },
  stopPreview() {
    stopMusicPreview(true);
  },
  unlock() {
    prime();
  },
  click() {
    playSfx('click', SFX_FALLBACKS.click);
  },
  hover() {
    playSfx('hover', SFX_FALLBACKS.hover);
  },
  card() {
    playSfx('card', SFX_FALLBACKS.card);
  },
  attack() {
    playSfx('attack', SFX_FALLBACKS.attack);
  },
  enemyAttack() {
    playSfx('enemyAttack', SFX_FALLBACKS.enemyAttack);
  },
  hit() {
    playSfx('hit', SFX_FALLBACKS.hit);
  },
  hitHeavy() {
    playSfx('hitHeavy', SFX_FALLBACKS.hitHeavy);
  },
  hurt() {
    playSfx('hurt', SFX_FALLBACKS.hurt);
  },
  block() {
    playSfx('block', SFX_FALLBACKS.block);
  },
  heal() {
    playSfx('heal', SFX_FALLBACKS.heal);
  },
  draw() {
    playSfx('draw', SFX_FALLBACKS.draw);
  },
  energy() {
    playSfx('energy', SFX_FALLBACKS.energy);
  },
  burn() {
    playSfx('burn', SFX_FALLBACKS.burn);
  },
  poison() {
    playSfx('poison', SFX_FALLBACKS.poison);
  },
  thorns() {
    playSfx('thorns', SFX_FALLBACKS.thorns);
  },
  debuff() {
    playSfx('debuff', SFX_FALLBACKS.debuff);
  },
  coin() {
    playSfx('coin', SFX_FALLBACKS.coin);
  },
  buff() {
    playSfx('buff', SFX_FALLBACKS.buff);
  },
  relic() {
    playSfx('relic', SFX_FALLBACKS.relic);
  },
  phase() {
    playSfx('phase', SFX_FALLBACKS.phase);
  },
  lastStand() {
    playSfx('lastStand', SFX_FALLBACKS.lastStand);
  },
  phaseOmen() {
    if (muted) return;
    noise({ duration: 1.05, volume: 0.045, lowpass: 170 });
    tone({ frequency: 46, duration: 1, type: 'sine', volume: 0.05, slide: 0.72 });
    tone({ frequency: 92, duration: 0.7, type: 'triangle', volume: 0.028, slide: 0.8, delay: 0.22 });
    tone({ frequency: 38, duration: 0.42, type: 'sine', volume: 0.042, delay: 0.62, slide: 0.9 });
  },
  victory() {
    playSfx('victory', SFX_FALLBACKS.victory);
  },
  defeat() {
    playSfx('defeat', SFX_FALLBACKS.defeat);
  },
};

function handleGesture() {
  gestureSeen = true;
  prime();
}

window.addEventListener('pointerdown', handleGesture, { passive: true });
window.addEventListener('keydown', handleGesture);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) prime();
});
