/* audio.js — procedural WebAudio sound. No asset files.
   Implements blueprint §20 audio identity: organic percussion, toy instruments,
   soft electronic bass, combo layers entering at milestones, pitch by speed. */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let started = false;
  let settings = { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.9, reducedMotion: false };
  let muted = false;

  // Combo scale (pentatonic) — hits climb a constrained musical scale (§20).
  const SCALE = [0, 2, 4, 7, 9]; // C major pentatonic offsets
  const BASE_NOTE = 261.63;     // C4

  function noteFreq(semis) {
    return BASE_NOTE * Math.pow(2, semis / 12);
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings.masterVolume;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = settings.musicVolume;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.sfxVolume;
    sfxGain.connect(master);
    return ctx;
  }

  // Resume on first user gesture (mobile autoplay policy).
  function unlock() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
    started = true;
  }

  function applySettings(s) {
    settings = Object.assign(settings, s);
    if (master) master.gain.value = muted ? 0 : settings.masterVolume;
    if (musicGain) musicGain.gain.value = settings.musicVolume;
    if (sfxGain) sfxGain.gain.value = settings.sfxVolume;
  }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : settings.masterVolume; }

  // ---- One-shot tone helper ----
  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.4, attack = 0.005, decay = 0.1, dest = null, slideTo = null, when = 0 }) {
    if (!started) return;
    const c = ensureCtx(); if (!c) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    osc.connect(g); g.connect(dest || sfxGain);
    osc.start(t0); osc.stop(t0 + attack + decay + 0.02);
  }

  // Noise burst (for impact "air"/texture).
  function noise({ dur = 0.08, gain = 0.3, lp = 1800, when = 0 }) {
    if (!started) return;
    const c = ensureCtx(); if (!c) return;
    const t0 = c.currentTime + when;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = lp;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  // ---- Game SFX ----
  // Bassy "pop" — short sine drop + click. Pitch rises with force (§6 Pull/Release).
  function pop(opts = {}) {
    const { force = 0.5, crit = false } = opts;
    const base = 90 + force * 120;             // bass region
    tone({ freq: base * 2.0, slideTo: base, type: 'sine', dur: 0.16, gain: crit ? 0.6 : 0.45, attack: 0.004, decay: 0.14 });
    tone({ freq: base * 3.1, slideTo: base * 1.5, type: 'triangle', dur: 0.1, gain: 0.18, attack: 0.003, decay: 0.09 });
    noise({ dur: 0.05, gain: crit ? 0.25 : 0.12, lp: crit ? 3200 : 2000 });
  }

  // Combo hit — climbs pentatonic scale by combo index (§20). Distinct timbres per contact type.
  function comboHit(comboIndex, kind = 'enemy') {
    const step = SCALE[comboIndex % SCALE.length] + 12 * Math.floor(comboIndex / SCALE.length);
    const f = noteFreq(step + 12); // up an octave for sparkle
    const type = kind === 'wall' ? 'triangle' : kind === 'buddy' ? 'square' : kind === 'object' ? 'sawtooth' : 'sine';
    tone({ freq: f, type, dur: 0.14, gain: 0.22, attack: 0.003, decay: 0.12 });
  }

  // Elastic pull — pitch rises with force (§6 Pull).
  function pullCharge(force) {
    const f = 200 + force * 500;
    tone({ freq: f, type: 'sine', dur: 0.06, gain: 0.06, attack: 0.005, decay: 0.05 });
  }

  // Air-cut release (§6 Release): pitch depends on speed.
  function release(speed) {
    const f = 320 + Math.min(speed, 1600) * 0.4;
    tone({ freq: f, slideTo: f * 0.6, type: 'triangle', dur: 0.12, gain: 0.22, attack: 0.003, decay: 0.1 });
    noise({ dur: 0.06, gain: 0.1, lp: 2600 });
  }

  // POP ability — bright zing.
  function popAbility() {
    tone({ freq: 520, slideTo: 1200, type: 'square', dur: 0.18, gain: 0.22, attack: 0.004, decay: 0.16 });
    tone({ freq: 780, type: 'sine', dur: 0.2, gain: 0.16, attack: 0.004, decay: 0.18 });
  }

  function uiClick() { tone({ freq: 600, type: 'square', dur: 0.05, gain: 0.12, attack: 0.002, decay: 0.04 }); }
  function uiBack() { tone({ freq: 360, slideTo: 240, type: 'square', dur: 0.08, gain: 0.12, attack: 0.002, decay: 0.07 }); }
  function good() {
    tone({ freq: noteFreq(4), type: 'triangle', dur: 0.14, gain: 0.2, attack: 0.004, decay: 0.12 });
    tone({ freq: noteFreq(7), type: 'triangle', dur: 0.18, gain: 0.2, attack: 0.004, decay: 0.16, when: 0.08 });
  }
  function bad() {
    tone({ freq: 200, slideTo: 120, type: 'sawtooth', dur: 0.3, gain: 0.22, attack: 0.004, decay: 0.28 });
  }
  function fanfare() {
    const seq = [0, 4, 7, 12];
    seq.forEach((s, i) => tone({ freq: noteFreq(s), type: 'triangle', dur: 0.22, gain: 0.2, attack: 0.004, decay: 0.2, when: i * 0.12 }));
  }

  // ---- Ambient music loop (gentle, toy-instrument) ----
  let musicTimer = null;
  function startMusic() {
    if (!started) return;
    stopMusic();
    const c = ensureCtx(); if (!c) return;
    const root = 130.81; // C3
    const bassline = [0, 0, 7, 0, 5, 5, 7, 7];
    let step = 0;
    const tick = () => {
      if (!musicGain) return;
      const off = bassline[step % bassline.length];
      // soft bass
      tone({ freq: root * Math.pow(2, off / 12), type: 'sine', dur: 0.5, gain: 0.12, attack: 0.02, decay: 0.46, dest: musicGain });
      // shimmer chord occasionally
      if (step % 4 === 0) {
        [12, 16, 19].forEach((s) => tone({ freq: root * Math.pow(2, (s + off) / 12), type: 'triangle', dur: 0.8, gain: 0.04, attack: 0.1, decay: 0.7, dest: musicGain }));
      }
      step++;
    };
    tick();
    musicTimer = setInterval(tick, 600);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  global.PP_Audio = {
    unlock, applySettings, setMuted,
    pop, comboHit, pullCharge, release, popAbility,
    uiClick, uiBack, good, bad, fanfare,
    startMusic, stopMusic,
  };
})(typeof window !== 'undefined' ? window : globalThis);
