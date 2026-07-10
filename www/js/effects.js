/* effects.js — juice: particles, hit-stop, camera shake, floating text, slow-mo.
   Blueprint §6 "juice specification". Visual effects degrade before framerate (§6 Performance). */
(function (global) {
  'use strict';

  const { clamp, lerp, TAU, vnorm } = PP_Util;

  // ---- Particles ----
  // Pooled, simple. Each particle: {x,y,vx,vy,life,maxLife,size,color,kind,rot,vr,gravity}
  const particles = [];
  const MAX_PARTICLES = 380;

  function spawn(opts) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
      size: 6, color: '#fff', kind: 'dot', rot: 0, vr: 0, drag: 0.9, grav: 0,
    }, opts, { maxLife: opts.life || 0.5 }));
  }

  // Burst aligned to surface normal (§6 Impact).
  function burst(x, y, nx, ny, opts = {}) {
    const { count = 10, color = '#ffd166', speed = 360, size = 6, life = 0.5, kind = 'dot', spread = 1 } = opts;
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < count; i++) {
      const ang = base + (Math.random() - 0.5) * Math.PI * spread;
      const sp = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: life * (0.6 + Math.random() * 0.6), maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color, kind, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
        drag: 0.9, grav: 0,
      });
    }
  }

  function ring(x, y, opts = {}) {
    const { color = '#fff6e8', radius = 40, life = 0.35, width = 6 } = opts;
    spawn({ x, y, life, maxLife: life, kind: 'ring', size: radius, color, vr: 0, rot: 0, drag: 1, grow: radius / life });
  }

  function spark(x, y, color = '#fff') {
    burst(x, y, 0, -1, { count: 5, color, speed: 240, size: 4, life: 0.3, kind: 'spark' });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'ring') p.size += (p.grow || 0) * dt;
      p.rot += (p.vr || 0) * dt;
    }
  }

  function render(ctx) {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = (p.width || 4) * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * a;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function clearParticles() { particles.length = 0; }

  // ---- Floating combo / damage text ----
  const texts = [];
  function floatText(x, y, str, opts = {}) {
    texts.push({
      x, y, str,
      life: opts.life || 0.9, maxLife: opts.life || 0.9,
      color: opts.color || '#fff6e8',
      size: opts.size || 22,
      vy: opts.vy != null ? opts.vy : -60,
      big: opts.big || false,
      scale: opts.big ? 0 : 1,
    });
  }
  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 0.92;
      if (t.big) t.scale = PP_Util.ease.outBack(clamp(1 - t.life / t.maxLife * 1.4, 0, 1));
    }
  }
  function renderTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of texts) {
      const a = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${t.size * (t.big ? t.scale : 1)}px -apple-system, system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }
  function clearTexts() { texts.length = 0; }

  // ---- Hit stop (§6 Impact: 35–65ms) ----
  let hitStopTime = 0;
  function hitStop(seconds) { hitStopTime = Math.max(hitStopTime, seconds); }
  function consumeHitStop(dt) {
    if (hitStopTime > 0) {
      hitStopTime -= dt;
      return true; // frozen
    }
    return false;
  }

  // ---- Slow-mo (§6 Final enemy: time slows briefly on decisive impact) ----
  let timeScale = 1;
  let slowTimer = 0;
  function slowmo(scale, seconds) { timeScale = scale; slowTimer = seconds; }
  function updateTimeScale(dt) {
    if (slowTimer > 0) {
      slowTimer -= dt;
      timeScale = lerp(timeScale, 1, dt * 1.2);
    } else {
      timeScale = lerp(timeScale, 1, dt * 4);
    }
    return timeScale;
  }
  function getTimeScale() { return timeScale; }

  // ---- Camera shake (capped, disable-able §6 Impact / §21 reduced motion) ----
  let shakeAmp = 0;
  let shakeOff = { x: 0, y: 0 };
  let shakeScale = 0.7;
  function shake(amount) {
    if (shakeScale <= 0) return;
    shakeAmp = Math.min(shakeAmp + amount, 26) * shakeScale;
  }
  function setShakeScale(s) { shakeScale = clamp(s, 0, 1); }
  function updateShake(dt) {
    if (shakeAmp > 0.1) {
      shakeOff.x = (Math.random() * 2 - 1) * shakeAmp;
      shakeOff.y = (Math.random() * 2 - 1) * shakeAmp;
      shakeAmp *= Math.pow(0.001, dt); // fast decay
    } else {
      shakeOff.x = 0; shakeOff.y = 0; shakeAmp = 0;
    }
  }
  function shakeOffset() { return shakeOff; }

  // ---- Screen flash (§21 reduced flashes => outline instead) ----
  let flashAmt = 0;
  function flash(amt) { flashAmt = clamp(Math.max(flashAmt, amt), 0, 1); }
  function updateFlash(dt) { flashAmt = Math.max(0, flashAmt - dt * 4); return flashAmt; }
  function getFlash() { return flashAmt; }

  function clearAll() {
    clearParticles(); clearTexts();
    hitStopTime = 0; slowTimer = 0; timeScale = 1;
    shakeAmp = 0; flashAmt = 0;
  }

  global.PP_Effects = {
    spawn, burst, ring, spark, update, render,
    floatText, updateTexts, renderTexts,
    hitStop, consumeHitStop,
    slowmo, updateTimeScale, getTimeScale,
    shake, setShakeScale, updateShake, shakeOffset,
    flash, updateFlash, getFlash,
    clearAll,
  };
})(typeof window !== 'undefined' ? window : globalThis);
