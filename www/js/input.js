/* input.js — one-finger pull, aim, release; tap-to-POP; cancel circle.
   Blueprint §5.3 player turn & §21 accessibility. Translates pointer events
   into game-space coordinates and feeds an aim-state machine. */
(function (global) {
  'use strict';

  const { clamp, dist, vnorm } = PP_Util;
  const A = PP_Config.AIM;
  const V = PP_Config.VIEW;

  // Pointer -> game-space. Canvas is CSS-scaled; we map via bounding rect.
  let canvas, ctx;
  function attach(cv) {
    canvas = cv;
    // pointer events unify mouse + touch.
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onCancel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function toGame(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = V.w / rect.width;
    const sy = V.h / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  // Aim state machine.
  // states: idle | aiming | dragging | released
  let state = {
    mode: 'idle',
    popling: null,       // popling being aimed
    down: null,          // {x,y} press pos in game space
    cur: null,           // current pointer pos in game space
    pointerId: null,
    popAvailable: false, // can pop during flight (tap)
    popped: false,
    startFlightPos: null,
  };

  let gameRef = null;
  function setGame(g) { gameRef = g; }

  function onDown(e) {
    if (!gameRef) return;
    if (state.mode === 'flying') {
      // Tap during flight = POP (§5.3 step 8).
      if (state.popAvailable && !state.popped) {
        gameRef.tryPop();
        state.popped = true;
      }
      return;
    }
    if (state.mode !== 'idle') return;
    const g = toGame(e);
    // Find a Ready popling under (or near) the press.
    const target = gameRef.findReadyPoplingAt(g.x, g.y);
    if (!target) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    state.mode = 'aiming';
    state.popling = target;
    state.pointerId = e.pointerId;
    state.down = { x: target.x, y: target.y }; // pivot is the popling, not press point
    state.cur = g;
    state.popped = false;
    state.startFlightPos = null;
    gameRef.onAimStart(target);
    e.preventDefault();
  }

  function onMove(e) {
    if (!gameRef) return;
    if (state.mode !== 'aiming' && state.mode !== 'dragging') return;
    if (e.pointerId !== state.pointerId) return;
    state.cur = toGame(e);
    const dx = state.cur.x - state.down.x;
    const dy = state.cur.y - state.down.y;
    const d = Math.hypot(dx, dy);
    if (state.mode === 'aiming' && d > 6) state.mode = 'dragging';
    // Charge fraction (pull back: distance dragged from pivot).
    const frac = clamp((d - A.minDrag * 0.3) / (A.fullDrag - A.minDrag * 0.3), 0, 1);
    const forceFrac = A.minForceFrac + frac * (A.maxForceFrac - A.minForceFrac);
    // Cancel if dragged back into cancel circle near pivot.
    const cancel = d < A.cancelRadius && d > 4;
    gameRef.onAimMove({
      pivot: state.down,
      pointer: state.cur,
      dx, dy, d,
      forceFrac, frac,
      // Launch direction is opposite of drag (sling).
      dir: { x: -dx, y: -dy },
      cancel,
      validShot: d >= A.minDrag,
    });
    e.preventDefault();
  }

  function onUp(e) {
    if (!gameRef) return;
    if (e.pointerId !== state.pointerId) return;
    if (state.mode === 'dragging' || state.mode === 'aiming') {
      const dx = state.cur.x - state.down.x;
      const dy = state.cur.y - state.down.y;
      const d = Math.hypot(dx, dy);
      if (d < A.minDrag || d < A.cancelRadius) {
        // Cancel safely (§5.3 step 6).
        gameRef.onAimCancel();
        PP_Audio.uiBack();
        PP_Haptics.cancel();
      } else {
        const frac = clamp((d - A.minDrag * 0.3) / (A.fullDrag - A.minDrag * 0.3), 0, 1);
        const forceFrac = A.minForceFrac + frac * (A.maxForceFrac - A.minForceFrac);
        const dir = vnorm({ x: -dx, y: -dy });
        gameRef.onAimRelease({ dir, forceFrac, frac, pivot: state.down });
        state.mode = 'flying';
        state.startFlightPos = { x: state.popling.x, y: state.popling.y };
        state.popAvailable = gameRef.isPopReady(state.popling);
        state.popped = false;
      }
    }
    if (state.mode !== 'flying') {
      state.mode = 'idle';
      state.popling = null;
      state.pointerId = null;
    }
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  function onCancel(e) {
    if (state.mode === 'aiming' || state.mode === 'dragging') {
      gameRef && gameRef.onAimCancel();
    }
    state.mode = 'idle';
    state.popling = null;
    state.pointerId = null;
  }

  // Called by game when a shot resolves (ends).
  function notifyShotEnd() {
    state.mode = 'idle';
    state.popling = null;
    state.pointerId = null;
    state.popAvailable = false;
    state.popped = false;
  }

  function isFlying() { return state.mode === 'flying'; }
  function isAiming() { return state.mode === 'aiming' || state.mode === 'dragging'; }
  function getState() { return state; }

  global.PP_Input = {
    attach, setGame,
    notifyShotEnd,
    isFlying, isAiming, getState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
