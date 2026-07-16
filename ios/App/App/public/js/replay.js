/* replay.js — rolling replay buffer (blueprint §24/§26).
   Records discrete snapshots of gameplay state. Last ~8-12s can be reconstructed.
   Also used to reconstruct the "best moment" thumbnail for result screens. */
(function (global) {
  'use strict';

  const MAX_SECONDS = 11;
  const HZ = 30; // 30 fps snapshots is plenty for replay reconstruction
  const MAX_FRAMES = Math.ceil(MAX_SECONDS * HZ);

  let frames = [];
  let acc = 0;
  let recording = false;
  let playing = false;
  let playIndex = 0;
  let playSpeed = 1;
  let onComplete = null;

  function reset() { frames = []; acc = 0; recording = false; playing = false; playIndex = 0; }

  function startRecording() { frames = []; acc = 0; recording = true; }

  // Capture a snapshot. The game provides a serializable snapshot of {poplings,enemies,particles?...}.
  function capture(snapshot, dt) {
    if (!recording) return;
    acc += dt;
    if (acc >= 1 / HZ) {
      acc -= 1 / HZ;
      frames.push(snapshot);
      if (frames.length > MAX_FRAMES) frames.shift();
    }
  }

  function stopRecording() { recording = false; }

  function getBuffer() { return frames; }
  function lengthSeconds() { return frames.length / HZ; }

  // Playback control
  function play(opts = {}) {
    if (!frames.length) { if (opts.onComplete) opts.onComplete(); return; }
    playing = true; playIndex = 0; playSpeed = opts.speed || 1; onComplete = opts.onComplete || null;
  }
  function stop() { playing = false; }
  function isPlaying() { return playing; }

  // Advance playback: returns a frame to render, or null when done.
  function next(dt) {
    if (!playing) return null;
    playIndex += playSpeed * dt * HZ;
    if (playIndex >= frames.length) {
      playing = false;
      if (onComplete) onComplete();
      return null;
    }
    return frames[Math.floor(playIndex)] || null;
  }

  // Reconstruct a "best moment" thumbnail description for result screens.
  // We pick the frame with highest combo.
  function bestMoment(evalFn) {
    if (!frames.length) return null;
    let best = frames[0], bestScore = -Infinity;
    for (const f of frames) {
      const sc = evalFn ? evalFn(f) : (f.combo || 0);
      if (sc > bestScore) { bestScore = sc; best = f; }
    }
    return best;
  }

  global.PP_Replay = {
    reset, startRecording, capture, stopRecording,
    getBuffer, lengthSeconds,
    play, stop, isPlaying, next,
    bestMoment,
  };
})(typeof window !== 'undefined' ? window : globalThis);
