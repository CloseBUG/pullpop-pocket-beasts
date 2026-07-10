/* haptics.js — haptic language per blueprint §20.
   Uses navigator.vibrate where available. Gracefully no-ops elsewhere.
   Globally capped so long combos don't become uncomfortable. */
(function (global) {
  'use strict';

  let enabled = true;
  let lastFire = 0;
  const MIN_GAP = 40; // ms global cap for very light events

  function can() {
    return enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function applySettings(s) { enabled = !!s.haptics; }

  // Patterns by category (§20 Haptic language).
  const PATTERNS = {
    chargeTick: 8,          // light tick (aim 75/90/100%)
    release: 18,            // medium impact
    normal: 6,              // very light, rate-limited
    buddy: [10, 30, 10],    // double light pulse
    crit: 26,               // heavy short impact
    cancel: [8, 24, 4],     // soft downward pulse
    pop: 14,                // POP ability
  };

  function fire(pattern) {
    if (!can()) return;
    const t = PP_Util.now();
    // Rate-limit very light collisions.
    if (pattern === PATTERNS.normal && t - lastFire < MIN_GAP) return;
    lastFire = t;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  global.PP_Haptics = {
    applySettings,
    charge: () => fire(PATTERNS.chargeTick),
    release: () => fire(PATTERNS.release),
    normal: () => fire(PATTERNS.normal),
    buddy: () => fire(PATTERNS.buddy),
    crit: () => fire(PATTERNS.crit),
    cancel: () => fire(PATTERNS.cancel),
    pop: () => fire(PATTERNS.pop),
  };
})(typeof window !== 'undefined' ? window : globalThis);
