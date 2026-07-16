/* main.js — entry point. Wires canvas scaling, game loop, and UI.
   Runs from file:// by double-click (classic scripts, no modules). */
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const V = PP_Config.VIEW;

  // Register the service worker for offline support (only on http/https, not file://).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---- Canvas DPR-aware backing store, CSS-scaled by layout ----
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(V.w * dpr);
    canvas.height = Math.round(V.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));

  // ---- Create & wire the game ----
  const game = new PP_Game.Game();
  game.attach(canvas);
  PP_UI.init(game);
  PP_UI.bindAugmentUI();
  PP_Tutorial.init(game);
  // Expose for debugging/testing
  window.__PP_GAME = game;

  // ---- Pause button (top-right) — drawn as a DOM button overlay ----
  const stage = document.getElementById('stage');
  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'pause-btn';
  pauseBtn.innerHTML = '❚❚';
  pauseBtn.setAttribute('aria-label', 'Pause');
  pauseBtn.style.cssText = [
    'position:absolute', 'top:calc(env(safe-area-inset-top,0px) + 16px)', 'right:16px',
    'width:44px', 'height:44px', 'border-radius:12px',
    'background:rgba(22,20,42,0.6)', 'border:1px solid rgba(255,246,232,0.16)',
    'color:#fff6e8', 'font-size:14px', 'cursor:pointer', 'pointer-events:auto',
    'display:none', 'z-index:4',
  ].join(';');
  pauseBtn.addEventListener('click', () => { PP_Audio.uiClick(); PP_UI.togglePause(); });
  stage.appendChild(pauseBtn);

  // Resume button on end screen & watch replay
  document.getElementById('btn-continue').addEventListener('click', () => {
    PP_Audio.uiClick();
    // result screen isn't used in the current flow (augment gate covers it); kept for completeness
    PP_UI.hideAll && PP_UI.hideAll();
    document.getElementById('screen-result').classList.add('hidden');
    game.continueAfterAugment && game.continueAfterAugment();
  });
  document.getElementById('btn-again').addEventListener('click', () => {
    PP_Audio.uiClick();
    PP_UI.hideAll();
    game.startRun();
  });
  document.getElementById('btn-watch').addEventListener('click', () => {
    PP_Audio.uiClick();
    playReplay();
  });

  // Override hideAll to exist on PP_UI safely
  if (!PP_UI.hideAll) {
    PP_UI.hideAll = function () {
      ['screen-title', 'screen-howto', 'screen-pause', 'screen-settings', 'screen-augment', 'screen-result', 'screen-end']
        .forEach((id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    };
  }

  // Tap a tutorial coach-mark to skip it (§17: skippable).
  const coachEl = document.getElementById('tutorial-coach');
  if (coachEl) {
    coachEl.addEventListener('click', () => { PP_Tutorial.skip(); });
  }

  // Keyboard: ESC/P pause, Space POP
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (game.state === PP_Game.States.PLAYING || game.state === PP_Game.States.PAUSE) PP_UI.togglePause();
    }
    if (e.key === ' ') { e.preventDefault(); game.tryPop(); }
  });

  // ---- App lifecycle (blueprint §12: save at room boundary + on app background) ----
  // The iOS AppDelegate dispatches 'appbackground'/'appforeground' into the WKWebView.
  // On a plain browser, the standard 'visibilitychange' / 'pagehide' events cover it.
  window.addEventListener('appbackground', () => { game.onAppBackground(); });
  window.addEventListener('appforeground', () => { game.onAppForeground(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.onAppBackground();
  });
  window.addEventListener('pagehide', () => { game.onAppBackground(); });

  // ---- Replay playback rendering (simple reconstruction) ----
  let replayMode = false;
  function playReplay() {
    const buf = PP_Replay.getBuffer();
    if (!buf.length) { PP_UI.toast('No replay available'); return; }
    replayMode = true;
    PP_Replay.play({ speed: 0.8, onComplete: () => { replayMode = false; } });
  }

  // ---- The main loop ----
  let last = PP_Util.now();
  let fpsAcc = 0, fpsFrames = 0, fps = 60;
  let settingsApplied = false;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // avoid huge jumps after tab switch

    // battery saver: target 30 FPS
    const targetDt = game.settings.batterySaver ? 1 / 30 : 1 / 60;

    // update
    game.update(dt);
    // tutorial coach-mark follow (§17)
    PP_Tutorial.update();

    // augment screen sync (if game entered AUGMENT state, show the UI)
    if (game.state === PP_Game.States.AUGMENT && game._pendingAugmentOffer) {
      PP_UI.showAugment(game._pendingAugmentOffer, game._rerollsLeft);
      game._pendingAugmentShown = true;
    }

    // show pause button only while playing
    pauseBtn.style.display = (game.state === PP_Game.States.PLAYING) ? 'block' : 'none';

    // ---- render ----
    ctx.save();
    ctx.clearRect(0, 0, V.w, V.h);

    // background fill
    ctx.fillStyle = '#16142a';
    ctx.fillRect(0, 0, V.w, V.h);

    // camera shake offset
    const off = PP_Effects.shakeOffset();
    ctx.translate(off.x, off.y);

    if (game.state === PP_Game.States.PLAYING || game.state === PP_Game.States.AUGMENT || replayMode) {
      renderGame();
    }

    ctx.restore();

    // flash overlay (DOM)
    const fl = document.getElementById('flash');
    if (fl) {
      const fa = PP_Effects.getFlash() * (game.settings.reducedFlashes ? 0.3 : 1);
      fl.style.opacity = fa.toFixed(3);
    }

    // fps tracking (light)
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }

    requestAnimationFrame(frame);
  }

  function renderGame() {
    // replay playback overrides live scene
    if (replayMode) {
      const frameData = PP_Replay.next(1 / 60);
      if (!frameData) { replayMode = false; return; }
      PP_Render.drawArena(game);
      // draw snapshot
      for (const o of frameData.objects || []) {
        ctx.save();
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r + (o.hit ? 6 : 0), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (const e of frameData.enemies || []) {
        ctx.save();
        const grad = ctx.createRadialGradient(e.x - e.r * 0.3, e.y - e.r * 0.4, e.r * 0.2, e.x, e.y, e.r);
        grad.addColorStop(0, '#c9c0ff'); grad.addColorStop(1, e.color);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (const p of frameData.squad || []) {
        ctx.save();
        ctx.translate(p.x, p.y);
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 40) ctx.rotate(Math.atan2(p.vy, p.vx));
        const st = sp > 40 ? 1 + Math.min(sp / 1600, 0.4) : 1;
        ctx.scale(st, 1 / st);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // replay label
      ctx.fillStyle = 'rgba(255,209,102,0.9)'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('REPLAY', V.w / 2, 120);
      return;
    }

    PP_Render.drawArena(game);

    // objects (bumpers)
    for (const o of game.room.objects) {
      ctx.save();
      const r = o.r + (o._hit ? 6 : 0);
      const grad = ctx.createRadialGradient(o.x - r * 0.3, o.y - r * 0.4, r * 0.2, o.x, o.y, r);
      grad.addColorStop(0, o.def.color2); grad.addColorStop(1, o.def.color);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    // enemies
    for (const e of game.room.enemies) PP_Render.drawEnemy(e);

    // resting poplings (buddies) draw as full poplings
    for (const p of game.squad) {
      if (p === game.activePopling() && (game.phase === PP_Game.Phases.FLY)) continue; // active drawn on top while flying
      PP_Render.drawPopling(p, game);
    }

    // effects behind active popling
    PP_Effects.render(ctx);

    // active popling on top while flying
    if (game.phase === PP_Game.Phases.FLY) {
      PP_Render.drawPopling(game.activePopling(), game);
    }

    // floating text
    PP_Effects.renderTexts(ctx);

    // aim preview on very top
    if (game.aim && (game.phase === PP_Game.Phases.AIM)) {
      PP_Render.drawAimPreview(game.aim, game);
    }

    // HUD + band
    PP_Render.drawHUD(game);
    PP_Render.drawBand(game);
  }

  // ---- Show title on load ----
  PP_UI.showTitle();

  // Start the loop
  requestAnimationFrame(frame);
})();
