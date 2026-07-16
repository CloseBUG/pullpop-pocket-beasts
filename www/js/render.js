/* render.js — all canvas drawing. Blueprint §19 art direction:
   "premium animated sticker world with physical comedy of a rubber toy."
   Soft shapes, strong silhouettes, squash-and-stretch, high readability. */
(function (global) {
  'use strict';

  const { TAU, clamp, clamp01, lerp, ease } = PP_Util;
  const V = PP_Config.VIEW;
  const A = PP_Config.ARENA;

  let ctx;
  function setContext(c) { ctx = c; }

  // ---- Background / arena ----
  function drawArena(game) {
    const a = A;
    // Arena floor
    roundRect(ctx, a.x, a.y, a.w, a.h, 28);
    const g = ctx.createLinearGradient(0, a.y, 0, a.y + a.h);
    g.addColorStop(0, '#1a2238');
    g.addColorStop(1, '#121a2c');
    ctx.fillStyle = g; ctx.fill();

    // subtle grid
    ctx.save();
    ctx.beginPath(); roundRectPath(ctx, a.x, a.y, a.w, a.h, 28); ctx.clip();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#fff6e8'; ctx.lineWidth = 1;
    for (let x = a.x; x < a.x + a.w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, a.y); ctx.lineTo(x, a.y + a.h); ctx.stroke();
    }
    for (let y = a.y; y < a.y + a.h; y += 48) {
      ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(a.x + a.w, y); ctx.stroke();
    }
    ctx.restore();

    // border frame (walls)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#3a4768';
    roundRect(ctx, a.x, a.y, a.w, a.h, 28);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,246,232,0.10)';
    roundRect(ctx, a.x + 3, a.y + 3, a.w - 6, a.h - 6, 25);
    ctx.stroke();

    // Locked-zone hazards drawn here (per enemy intents)
    if (game && game.room) drawIntents(game);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    roundRectPath(c, x, y, w, h, r);
  }
  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---- Intents (§5.4) — readable before the player commits ----
  function drawIntents(game) {
    const t = PP_Util.now() / 1000;
    for (const e of game.room.enemies) {
      if (e.dead) continue;
      drawEnemyIntent(e, game, t);
    }
    // locked zones
    for (const z of (game.room.lockedZones || [])) {
      drawLockedZone(z, t);
    }
    // charge arrows
    for (const c of (game.room.chargeArrows || [])) {
      drawChargeArrow(c, t);
    }
    // tracking lines
    for (const tl of (game.room.trackingLines || [])) {
      drawTrackingLine(tl, t);
    }
  }

  function drawLockedZone(z, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.fillStyle = `rgba(255,90,90,${0.12 + pulse * 0.1})`;
    ctx.strokeStyle = `rgba(255,120,120,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    if (z.shape === 'rect') {
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      // hatch pattern for color-blind (§5.4)
      ctx.beginPath();
      for (let i = -z.h; i < z.w; i += 14) {
        ctx.moveTo(z.x + i, z.y + z.h); ctx.lineTo(z.x + i + z.h, z.y);
      }
      ctx.strokeStyle = `rgba(255,120,120,${0.12 + pulse * 0.08})`; ctx.lineWidth = 2; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawChargeArrow(c, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.strokeStyle = `rgba(255,150,90,${0.6 + pulse * 0.3})`;
    ctx.fillStyle = `rgba(255,150,90,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-c.len / 2, 0); ctx.lineTo(c.len / 2 - 24, 0); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.len / 2, 0); ctx.lineTo(c.len / 2 - 22, -14); ctx.lineTo(c.len / 2 - 22, 14);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawTrackingLine(tl, t) {
    const dash = (t * 30) % 12;
    ctx.save();
    ctx.setLineDash([8, 6]); ctx.lineDashOffset = -dash;
    ctx.strokeStyle = 'rgba(255,90,120,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tl.x1, tl.y1); ctx.lineTo(tl.x2, tl.y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEnemyIntent(e, game, t) {
    // Countdown number above enemy (§5.4)
    if (e.intent === 'countdown') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 26px system-ui';
      const turns = Math.max(0, Math.ceil(e.countdownLeft || 0));
      ctx.fillStyle = turns <= 1 ? '#ff6b6b' : '#ffd166';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5;
      ctx.strokeText(turns, e.x, e.y - e.r - 16);
      ctx.fillText(turns, e.x, e.y - e.r - 16);
      ctx.restore();
    }
    // Guard arc (§5.4) — shield arc covering allies
    if (e.intent === 'guard') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.facing || 0);
      ctx.fillStyle = 'rgba(127,199,255,0.18)';
      ctx.strokeStyle = 'rgba(127,199,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, e.guardRadius, -e.guardArc / 2, e.guardArc / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- Boss: Grumble Hoover (blueprint §11) ----
  function drawBoss(e) {
    const t = PP_Util.now() / 1000;
    const exposed = e.bossPhase === 'exposed';
    const r = e.r;
    ctx.save();
    ctx.translate(e.x, e.y);

    // Mouth cone (vacuum pull direction) — visible when shielding
    if (!exposed) {
      ctx.save();
      ctx.rotate(e.facing);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const coneLen = 300;
      const grad = ctx.createLinearGradient(0, 0, coneLen, 0);
      grad.addColorStop(0, `rgba(139,111,192,${0.35 + pulse * 0.15})`);
      grad.addColorStop(1, 'rgba(139,111,192,0.02)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, coneLen, -e.mouthCone / 2, e.mouthCone / 2);
      ctx.closePath();
      ctx.fill();
      // swirling arrows indicating pull
      ctx.strokeStyle = `rgba(212,191,255,${0.4 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = r + 40 + i * 50 + pulse * 20;
        ctx.beginPath();
        ctx.arc(0, 0, rr, -e.mouthCone / 3, e.mouthCone / 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.3, 0, 0, TAU); ctx.fill();

    // body — pulsing red when exposed
    const pulse2 = 0.5 + 0.5 * Math.sin(t * 6);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
    if (exposed) {
      grad.addColorStop(0, '#ffb0b0');
      grad.addColorStop(1, '#d44040');
    } else {
      grad.addColorStop(0, e.def.color2);
      grad.addColorStop(1, e.def.color);
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

    // mouth (open when exposed = vulnerable target)
    ctx.save();
    ctx.rotate(e.facing);
    ctx.fillStyle = exposed ? `rgba(255,80,80,${0.7 + pulse2 * 0.3})` : '#2a1a4a';
    ctx.beginPath();
    ctx.ellipse(r * 0.5, 0, r * 0.35, r * (exposed ? 0.45 : 0.2), 0, 0, TAU);
    ctx.fill();
    // teeth
    ctx.fillStyle = '#fff6e8';
    for (let i = 0; i < 5; i++) {
      const ang = -0.6 + (i / 4) * 1.2;
      const tx = r * 0.5 + Math.cos(ang) * r * 0.3;
      const ty = Math.sin(ang) * r * (exposed ? 0.4 : 0.18);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(ang) * 8, ty + Math.sin(ang) * 8);
      ctx.lineTo(tx + Math.cos(ang + 0.3) * 4, ty + Math.sin(ang + 0.3) * 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // eyes (angry)
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.22, r * 0.16, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.12, -r * 0.22, r * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1426';
    const lookX = exposed ? 0 : Math.sin(t * 2) * 3;
    ctx.beginPath(); ctx.arc(-r * 0.28 + lookX, -r * 0.22, r * 0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.12 + lookX, -r * 0.22, r * 0.08, 0, TAU); ctx.fill();

    // boss HP bar (big, at top of arena)
    ctx.restore();

    // Boss HP bar drawn at arena top
    const a = PP_Config.ARENA;
    const bw = a.w * 0.7, bh = 14;
    const bx = a.x + (a.w - bw) / 2;
    const by = a.y + 8;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    const hpFrac = PP_Util.clamp01(e.hp / e.maxHp);
    ctx.fillStyle = exposed ? '#ff7b6b' : '#8b6fc0';
    ctx.fillRect(bx, by, bw * hpFrac, bh);
    ctx.strokeStyle = 'rgba(255,246,232,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    // label
    ctx.fillStyle = '#fff6e8'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('GRUMBLE HOOVER ' + (exposed ? '— MOUTH OPEN!' : '— SHIELDED'), a.x + a.w / 2, by + bh + 14);
    ctx.restore();
  }

  // ---- Enemies ----
  function drawEnemy(e) {
    if (e.dead) return;
    if (e.isBoss) { drawBoss(e); return; }
    ctx.save();
    ctx.translate(e.x, e.y);
    // squash from recent hit
    const sx = e.sx || 1, sy = e.sy || 1;
    ctx.scale(sx, sy);
    const r = e.r;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.32, 0, 0, TAU); ctx.fill();
    // body
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
    grad.addColorStop(0, e.def.color2);
    grad.addColorStop(1, e.def.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // armor ring if armored
    if (e.armor > 0 || e.elite) {
      ctx.strokeStyle = '#cfd6e6'; ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // eyes (menacing little dots)
    ctx.fillStyle = '#1a1426';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.1, r * 0.13, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.32, -r * 0.1, r * 0.13, 0, TAU); ctx.fill();
    // mouth (intent-ish)
    ctx.strokeStyle = '#1a1426'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    // status pips
    drawStatusPips(e, r);
    // hp bar
    if (e.hp < e.maxHp) {
      const w = r * 1.8, h = 5;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-w / 2, -r - 12, w, h);
      ctx.fillStyle = '#7be0a8';
      ctx.fillRect(-w / 2, -r - 12, w * clamp01(e.hp / e.maxHp), h);
    }
    ctx.restore();
  }

  function drawStatusPips(e, r) {
    const s = e.status || {};
    let i = 0;
    const order = ['burn', 'chill', 'shock', 'bloom', 'brk', 'mark'];
    for (const k of order) {
      if (!s[k]) continue;
      const stacks = typeof s[k] === 'number' ? s[k] : 1;
      ctx.font = '900 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = PP_Content.STATUSES[k].color;
      const x = -r + i * 14 + 8;
      ctx.fillText(PP_Content.STATUSES[k].icon, x, -r - 4 + (i % 2) * 2);
      if (stacks > 1) {
        ctx.fillStyle = '#fff'; ctx.font = '900 10px system-ui';
        ctx.fillText(stacks, x + 5, -r - 8);
      }
      i++;
    }
  }

  // ---- Poplings (with squash & stretch) ----
  function drawPopling(p, game) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // facing/velocity stretch
    const sp = Math.hypot(p.vx, p.vy);
    let stretch = 1, squish = 1, rot = 0;
    if (sp > 40) {
      rot = Math.atan2(p.vy, p.vx);
      stretch = 1 + clamp(sp / 1600, 0, 0.5);
      squish = 1 / stretch;
    }
    // aim stretch override when aiming
    if (p._aimStretch != null) { stretch = p._aimStretch; squish = 1 / stretch; }
    ctx.rotate(rot);
    ctx.scale(stretch * (p.sx || 1), squish * (p.sy || 1));
    const r = p.r;
    const def = p.def;
    // shadow
    ctx.save();
    ctx.rotate(-rot);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // body gradient
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
    grad.addColorStop(0, def.color2);
    grad.addColorStop(1, def.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.28, r * 0.18, -0.5, 0, TAU); ctx.fill();
    // eyes (look toward velocity / aim dir) — undo rotation for face
    ctx.save();
    ctx.rotate(-rot);
    const lookX = sp > 40 ? clamp(p.vx / 600, -1, 1) * r * 0.18 : 0;
    const lookY = sp > 40 ? clamp(p.vy / 600, -1, 1) * r * 0.18 : 0;
    if (p._aimLook) { /* set by aim */ }
    const lx = (p._eyeX || lookX), ly = (p._eyeY || lookY);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.12, r * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.12, r * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1426';
    ctx.beginPath(); ctx.arc(-r * 0.3 + lx, -r * 0.12 + ly, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3 + lx, -r * 0.12 + ly, r * 0.1, 0, TAU); ctx.fill();
    // smile
    ctx.strokeStyle = '#1a1426'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Ready / Resting / POP ring
    drawPoplingState(p);
  }

  function drawPoplingState(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'resting') {
      ctx.strokeStyle = 'rgba(180,180,200,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(0, 0, p.r + 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // Z's for "resting"
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('z', p.r + 8, -p.r - 6);
    } else if (p.state === 'ready' || p.state == null) {
      const t = PP_Util.now() / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + (p.uid || 0));
      ctx.strokeStyle = `rgba(255,209,102,${0.4 + pulse * 0.3})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, p.r + 8 + pulse * 3, 0, TAU); ctx.stroke();
    }
    // POP-ready chevron
    if (p.popReady) {
      ctx.fillStyle = PP_Config.POP.flashColor;
      ctx.font = '900 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('POP', 0, -p.r - 14);
    }
    ctx.restore();
  }

  // ---- Aim preview: dotted ricochet line (§5.3 step 4) ----
  function drawAimPreview(aim, game) {
    if (!aim) return;
    const { pivot, dir, forceFrac, cancel, validShot } = aim;
    if (!dir || Math.hypot(dir.x, dir.y) < 0.01) return;
    const ndir = PP_Util.vnorm(dir);
    // pull-back rubber band
    ctx.save();
    ctx.strokeStyle = `rgba(255,246,232,${validShot ? 0.5 : 0.25})`;
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x - ndir.x * (aim.d || 0), pivot.y - ndir.y * (aim.d || 0));
    ctx.stroke();
    ctx.restore();

    if (cancel) {
      // cancel circle (§5.3 step 6)
      ctx.save();
      ctx.strokeStyle = 'rgba(255,107,107,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(pivot.x, pivot.y, PP_Config.AIM.cancelRadius, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff6b6b'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('CANCEL', pivot.x, pivot.y + 4);
      ctx.restore();
      return;
    }

    if (!validShot) return;

    // Simulate preview trajectory (first collision + N bounces).
    const preview = game.simulatePreview(pivot, ndir, forceFrac);
    // dotted line
    ctx.save();
    ctx.fillStyle = `rgba(255,209,102,0.9)`;
    for (const pt of preview.points) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, TAU); ctx.fill();
    }
    // bounce markers
    for (const b of preview.bounces) {
      ctx.strokeStyle = 'rgba(255,209,102,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, TAU); ctx.stroke();
    }
    // charge ring around pivot
    const t = PP_Util.now() / 1000;
    ctx.strokeStyle = forceFrac >= 1 ? '#ff7b9c' : '#ffd166';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(pivot.x, pivot.y, game.activePopling().r + 16, -Math.PI / 2, -Math.PI / 2 + TAU * forceFrac); ctx.stroke();
    ctx.restore();
  }

  // ---- HUD (top) ----
  function drawHUD(game) {
    const top = 0, hh = PP_Config.HUD_H;
    ctx.save();
    // top bar bg
    ctx.fillStyle = 'rgba(10,8,22,0.55)';
    ctx.fillRect(0, 0, V.w, hh);

    // Courage (top-left)
    const cur = game.courage, max = game.maxCourage, shield = game.shield;
    ctx.fillStyle = '#fff6e8'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('COURAGE', 22, 30);
    // bar
    const bx = 22, by = 38, bw = 180, bh = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
    const cg = clamp01(cur / max);
    ctx.fillStyle = cg > 0.3 ? '#7be0a8' : '#ff6b6b';
    roundRect(ctx, bx, by, bw * cg, bh, 8); ctx.fill();
    // shield overlay
    if (shield > 0) {
      ctx.fillStyle = 'rgba(127,199,255,0.85)';
      roundRect(ctx, bx, by, Math.min(bw, bw * shield / max), bh, 8); ctx.fill();
    }
    ctx.fillStyle = '#fff6e8'; ctx.font = '900 16px system-ui';
    ctx.fillText(`${Math.max(0, Math.ceil(cur))}/${max}` + (shield > 0 ? ` +${Math.ceil(shield)}` : ''), bx, by + bh + 18);

    // Room goal (top-center)
    ctx.textAlign = 'center';
    ctx.font = '900 16px system-ui'; ctx.fillStyle = '#fff6e8';
    const enemiesLeft = game.room ? game.room.enemies.filter(e => !e.dead).length : 0;
    ctx.fillText(`ROOM ${game.roomIndex + 1}/${game.totalRooms}`, V.w / 2, 28);
    ctx.font = '700 12px system-ui'; ctx.fillStyle = '#b9b0d6';
    ctx.fillText(`${enemiesLeft} enemy${enemiesLeft === 1 ? '' : 'ies'} left`, V.w / 2, 48);
    // combo big number center (during flight)
    if (game.shotState && game.shotState.combo >= 2) {
      const c = game.shotState.combo;
      const milestone = PP_Config.TIMING.comboMilestones.includes(c);
      const scale = milestone ? 1.4 : 1;
      ctx.save();
      ctx.font = `900 ${28 * scale}px system-ui`;
      ctx.fillStyle = milestone ? '#ffd166' : '#fff6e8';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5;
      ctx.strokeText(`${c}x COMBO`, V.w / 2, 76);
      ctx.fillText(`${c}x COMBO`, V.w / 2, 76);
      ctx.restore();
    }

    // Buttons (top-right): pause
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff6e8'; ctx.font = '900 13px system-ui';
    ctx.fillText('Buttons: ' + game.buttons, V.w - 22, 30);
    ctx.restore();
  }

  // ---- Bottom control band: squad portraits ----
  function drawBand(game) {
    const by = V.h - PP_Config.BAND_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,22,0.6)';
    ctx.fillRect(0, by, V.w, PP_Config.BAND_H);
    // portraits
    const n = game.squad.length;
    const slotW = V.w / n;
    for (let i = 0; i < n; i++) {
      const p = game.squad[i];
      const cx = slotW * i + slotW / 2;
      const cy = by + PP_Config.BAND_H / 2 + 6;
      // slot bg
      ctx.fillStyle = p.state === 'resting' ? 'rgba(60,55,90,0.5)' : 'rgba(50,45,80,0.7)';
      roundRect(ctx, cx - 64, cy - 56, 128, 112, 18); ctx.fill();
      // mini popling circle
      const r = 30;
      const grad = ctx.createRadialGradient(cx - 8, cy - 12, 6, cx, cy, r);
      grad.addColorStop(0, p.def.color2); grad.addColorStop(1, p.def.color);
      ctx.fillStyle = p.state === 'resting' ? 'rgba(120,120,140,0.5)' : grad;
      ctx.beginPath(); ctx.arc(cx, cy - 4, r, 0, TAU); ctx.fill();
      // name + state
      ctx.textAlign = 'center';
      ctx.font = '900 14px system-ui'; ctx.fillStyle = p.state === 'resting' ? '#9b96b6' : '#fff6e8';
      ctx.fillText(p.def.name, cx, cy + 36);
      ctx.font = '700 10px system-ui'; ctx.fillStyle = p.state === 'resting' ? '#9b96b6' : '#ffd166';
      ctx.fillText((p.state || 'ready').toUpperCase(), cx, cy + 50);
      if (p.popReady) {
        ctx.fillStyle = PP_Config.POP.flashColor; ctx.font = '900 11px system-ui';
        ctx.fillText('POP', cx, cy - 34);
      }
    }
    ctx.restore();
  }

  // ---- Result thumbnail (mini scene) ----
  function drawThumbnail(thumb) {
    if (!thumb) return;
    // simple: draw a tiny representation
    ctx.save();
    const w = 110, h = 70;
    const x = (V.w - w) / 2, y = V.h / 2 - 200;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = '#241d44'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    // a dot for the popling + sparkles
    ctx.fillStyle = thumb.color || '#ffd166';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6e8';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ctx.beginPath(); ctx.arc(x + w / 2 + Math.cos(a) * 20, y + h / 2 + Math.sin(a) * 14, 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  global.PP_Render = {
    setContext, drawArena, drawEnemy, drawPopling, drawAimPreview,
    drawHUD, drawBand, drawThumbnail,
    roundRect,
  };
})(typeof window !== 'undefined' ? window : globalThis);
