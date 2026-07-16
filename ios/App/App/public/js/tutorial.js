/* tutorial.js — first-time user experience coach marks (blueprint §17).
   Gentle, auto-dismiss after correct input, only on the very first room,
   skippable on repeat (§17: "Any forced gesture tutorial disappears
   immediately after correct input"). */
(function (global) {
  'use strict';

  // Step sequence (blueprint §17 minute-by-minute flow, condensed).
  const STEPS = [
    {
      id: 'welcome',
      icon: '👋',
      text: 'Meet Pogo. Drag back from a glowing Popling to aim — like a slingshot.',
      hint: 'DRAG BACKWARD FROM POGO',
      waitFor: 'aim-start',
    },
    {
      id: 'aim',
      icon: '🎯',
      text: 'The dotted line previews your ricochet. Drag farther for more power.',
      hint: 'DRAG UNTIL THE LINE POINTS AT AN ENEMY',
      waitFor: 'release',
    },
    {
      id: 'release',
      icon: '✋',
      text: 'Release to launch! Watch Pogo ricochet off walls and enemies.',
      hint: 'WAIT FOR THE SHOT TO RESOLVE',
      waitFor: 'shot-end',
    },
    {
      id: 'combo',
      icon: '💥',
      text: 'Bounces build COMBOS — chain off walls, allies, and bumpers for big damage!',
      hint: 'TAKE ANOTHER SHOT',
      waitFor: 'second-shot',
    },
    {
      id: 'intent',
      icon: '⚠️',
      text: 'Red zones show where enemies attack next. Move Poplings out of danger!',
      hint: 'YOU\u2019VE GOT THIS',
      waitFor: 'dismiss',
    },
  ];

  let active = false;
  let stepIdx = 0;
  let shotsSeen = 0;
  let game = null;

  function init(g) {
    game = g;
    // Only show tutorial for fresh expeditions (not daily), and only first room.
    // Persist "seen" so repeat players don't get nagged (§17: skippable on repeat).
  }

  function isActive() { return active; }

  function start() {
    // Don't start if the player has already seen the tutorial this device.
    let seen = false;
    try { seen = localStorage.getItem('pullpop_tutorial_done') === '1'; } catch (e) {}
    if (seen) { active = false; return; }
    active = true;
    stepIdx = 0;
    shotsSeen = 0;
    showStep();
  }

  function showStep() {
    if (!active || stepIdx >= STEPS.length) { hide(); return; }
    const step = STEPS[stepIdx];
    const coach = document.getElementById('tutorial-coach');
    if (!coach) return;
    coach.classList.remove('hidden');
    document.getElementById('coach-icon').textContent = step.icon;
    document.getElementById('coach-text').textContent = step.text;
    document.getElementById('coach-hint').textContent = step.hint;
    // Pulse on the active popling for the first few steps
    const pulse = document.getElementById('tutorial-pulse');
    if (stepIdx <= 1 && pulse && game && game.activePopling) {
      positionPulse();
      pulse.classList.remove('hidden');
    } else if (pulse) {
      pulse.classList.add('hidden');
    }
  }

  function positionPulse() {
    const pulse = document.getElementById('tutorial-pulse');
    if (!pulse || !game || !game.activePopling) return;
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const stage = document.getElementById('stage');
    const sRect = stage.getBoundingClientRect();
    const p = game.activePopling();
    if (!p) return;
    const V = PP_Config.VIEW;
    // map game coords -> stage pixel coords
    const px = (p.x / V.w) * rect.width + (rect.left - sRect.left);
    const py = (p.y / V.h) * rect.height + (rect.top - sRect.top);
    pulse.style.left = px + 'px';
    pulse.style.top = py + 'px';
  }

  function next() {
    stepIdx++;
    if (stepIdx >= STEPS.length) { complete(); }
    else { showStep(); }
  }

  function complete() {
    active = false;
    hide();
    try { localStorage.setItem('pullpop_tutorial_done', '1'); } catch (e) {}
  }

  function hide() {
    const coach = document.getElementById('tutorial-coach');
    const pulse = document.getElementById('tutorial-pulse');
    if (coach) coach.classList.add('hidden');
    if (pulse) pulse.classList.add('hidden');
  }

  // Event hook: called by the game when notable things happen.
  function onEvent(eventId) {
    if (!active) return;
    const step = STEPS[stepIdx];
    if (!step) return;

    if (eventId === 'aim-start') {
      // Player started dragging — advance past the welcome prompt.
      if (step.waitFor === 'aim-start') next();
    } else if (eventId === 'release') {
      if (step.waitFor === 'release') next();
    } else if (eventId === 'shot-end') {
      shotsSeen++;
      if (step.waitFor === 'shot-end') { next(); }
      else if (step.waitFor === 'second-shot' && shotsSeen >= 2) { next(); }
    } else if (eventId === 'dismiss') {
      if (step.waitFor === 'dismiss') next();
    }
  }

  // Allow manual skip (tap the coach to dismiss current step).
  function skip() {
    if (!active) return;
    next();
  }

  // Per-frame update (positions the pulse ring over the active popling).
  function update() {
    if (!active) return;
    if (stepIdx <= 1) positionPulse();
  }

  // Reset for a new run (only activates on first-ever play).
  function resetForRun(isDaily) {
    if (isDaily) { active = false; hide(); return; }
    // Tutorial only triggers on room 0; the game calls start() when room 0 builds.
  }

  global.PP_Tutorial = { init, isActive, start, onEvent, skip, update, resetForRun, complete, hide };
})(typeof window !== 'undefined' ? window : globalThis);
