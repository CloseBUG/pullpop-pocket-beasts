/* analytics.js — event taxonomy (blueprint §27). Privacy-first: local only.
   No raw touch coordinates are logged; no personal data collected.
   Events aggregate in localStorage; a debug log is emitted to console.
   The prototype has no backend — this is the instrumentation surface that a
   real backend would subscribe to (§26 backend responsibilities). */
(function (global) {
  'use strict';

  const KEY = 'pullpop_analytics';
  const enabled = true;
  let buffer = [];

  // Session-scoped counters (reset each session)
  let session = { startTime: Date.now(), shots: 0, runs: 0 };

  function loadAgg() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { totals: {}, lastEvents: [] };
  }
  function saveAgg(agg) {
    try { localStorage.setItem(KEY, JSON.stringify(agg)); } catch (e) {}
  }

  // Core event emission (§27 taxonomy). name + properties object.
  function track(eventName, props) {
    if (!enabled) return;
    const ev = {
      event: eventName,
      ts: Date.now(),
      sessionAge: Math.round((Date.now() - session.startTime) / 1000),
      props: props || {},
    };
    buffer.push(ev);
    // Aggregate counters
    const agg = loadAgg();
    agg.totals[eventName] = (agg.totals[eventName] || 0) + 1;
    agg.lastEvents = (agg.lastEvents || []).concat([ev]).slice(-50);
    saveAgg(agg);
    // Debug log (viewable in browser console)
    if (global.console && console.debug) {
      console.debug('[analytics]', eventName, ev.props);
    }
  }

  // Flush buffer (would POST to a backend in production §26)
  function flush() {
    if (!buffer.length) return;
    buffer = [];
  }

  // ---- Typed event helpers (§27 taxonomy) ----
  const Events = {
    tutorialStep: (step, attempt, duration, success) => track('tutorial_step', { step, attempt, duration, success }),
    runStart: (mode, world, seed, squad, progressionBand) => track('run_start', { mode, world, seed, squad, progressionBand }),
    roomStart: (roomId, enemySet, courage, augmentTags) => track('room_start', { roomId, enemySet, courage, augmentTags }),
    shotRelease: (popling, angleBucket, forceBucket, predictedFirstContact) => track('shot_release', { popling, angleBucket, forceBucket, predictedFirstContact }),
    shotEnd: (duration, collisions, combo, damage, popTiming, resultingPos) => track('shot_end', { duration, collisions, combo, damage, popTiming, resultingPos }),
    intentDamage: (enemy, intentType, affectedUnits, avoidable) => track('intent_damage', { enemy, intentType, affectedUnits, avoidable }),
    augmentOffer: (threeIds, buildTags, reroll) => track('augment_offer', { threeIds, buildTags, reroll }),
    augmentPick: (chosenId, decisionTime) => track('augment_pick', { chosenId, decisionTime }),
    runEnd: (result, room, duration, courage, build, failureCause) => track('run_end', { result, room, duration, courage, build, failureCause }),
    replayExport: (trigger, clipDuration, shareDestination) => track('replay_export', { trigger, clipDuration, shareDestination }),
    storeView: (entrySurface, itemSet) => track('store_view', { entrySurface, itemSet }),
    purchaseStart: (product, displayedPrice, entrySurface) => track('purchase_start', { product, displayedPrice, entrySurface }),
    purchaseResult: (product, successCategory) => track('purchase_result', { product, successCategory }),
    returnSession: (timeSinceLastPlay, returnSource) => track('return_session', { timeSinceLastPlay, returnSource }),
  };

  // Aggregated dashboard readout (§27 product dashboard, local version)
  function dashboard() {
    return loadAgg().totals;
  }

  function resetSession() { session = { startTime: Date.now(), shots: 0, runs: 0 }; }

  global.PP_Analytics = { track, flush, Events, dashboard, resetSession };
})(typeof window !== 'undefined' ? window : globalThis);
