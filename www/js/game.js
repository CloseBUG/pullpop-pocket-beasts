/* game.js — core game logic: state machine, squad, shot loop, enemy turn,
   augment hooks, combo, room generation, win/lose. Blueprint §5 core loop. */
(function (global) {
  'use strict';

  const { clamp, clamp01, dist, vnorm, vlen, makeRng } = PP_Util;
  const Cfg = PP_Config;
  const A = Cfg.ARENA;
  const P = Cfg.PHYS;
  const T = Cfg.TIMING;

  // Game states
  const S = {
    TITLE: 'title', HOWTO: 'howto', PLAYING: 'playing',
    PAUSE: 'pause', SETTINGS: 'settings',
    AUGMENT: 'augment', RESULT: 'result', END: 'end',
  };

  // Shot phase (sub-states of PLAYING)
  const PH = { AIM: 'aim', FLY: 'fly', ENEMY: 'enemy', BETWEEN: 'between' };

  class Game {
    constructor() {
      this.state = S.TITLE;
      this.phase = PH.AIM;
      this.canvas = null; this.ctx = null;
      this.dt = 0; this.lastTime = 0;
      this.settings = PP_Util.clone(Cfg.DEFAULT_SETTINGS);
      this.loadSettings();

      this.rng = makeRng((Math.random() * 1e9) | 0);
      this.runSeed = 0;

      this.squad = [];
      this.courage = Cfg.SQUAD.startCourage;
      this.maxCourage = Cfg.SQUAD.startCourage;
      this.shield = 0;
      this.buttons = 0;
      this.augments = []; // owned augment defs
      this.roomIndex = 0;
      this.totalRooms = 5;
      this.room = null;
      this.walls = [];
      this.shotState = null;
      this.activePoplingIdx = 0;
      this.shotTimer = 0;
      this.resolveTimer = 0;
      this.enemyActTimer = 0;
      this.squadShotsTaken = 0; // for POP availability (§5.3)
      this.bestCombo = 0;
      this.roomBestCombo = 0;
      this.roomClearTime = 0;
      this.runStats = { roomsCleared: 0, bestCombo: 0, shotsFired: 0, damageDealt: 0, enemiesDefeated: 0 };

      this.aim = null; // current aim info for preview
      this._pendingAugmentOffer = null;
      this._rerollsLeft = 1;
    }

    // ---- persistence ----
    loadSettings() {
      try {
        const raw = localStorage.getItem('pullpop_settings');
        if (raw) this.settings = Object.assign(this.settings, JSON.parse(raw));
      } catch (e) {}
      this.applySettingsToSystems();
    }
    saveSettings() {
      try { localStorage.setItem('pullpop_settings', JSON.stringify(this.settings)); } catch (e) {}
      this.applySettingsToSystems();
    }

    // ---- run save/resume (blueprint §12: save at room boundary + app background) ----
    saveRun() {
      if (this.state !== S.PLAYING && this.state !== S.PAUSE) return;
      try {
        const data = {
          rev: Date.now(),
          runSeed: this.runSeed,
          roomIndex: this.roomIndex,
          totalRooms: this.totalRooms,
          courage: this.courage,
          maxCourage: this.maxCourage,
          shield: this.shield,
          buttons: this.buttons,
          augments: this.augments.map((a) => a.id),
          squadIds: this.squad.map((p) => p.id),
          rerollsLeft: this._rerollsLeft,
          runStats: this.runStats,
        };
        localStorage.setItem('pullpop_run', JSON.stringify(data));
      } catch (e) {}
    }
    hasSavedRun() {
      try { return !!localStorage.getItem('pullpop_run'); } catch (e) { return false; }
    }
    clearSavedRun() {
      try { localStorage.removeItem('pullpop_run'); } catch (e) {}
    }
    onAppBackground() {
      // Blueprint §12: Save at every room boundary and on app background.
      this.saveRun();
    }
    onAppForeground() {
      // A resumed run is summarized on the title screen; no forced reload here.
    }
    applySettingsToSystems() {
      PP_Audio.applySettings(this.settings);
      PP_Haptics.applySettings(this.settings);
      PP_Effects.setShakeScale(this.settings.reducedMotion ? 0 : this.settings.screenShake);
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.toggle('reduce-motion', !!this.settings.reducedMotion);
      }
    }

    attach(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      PP_Render.setContext(this.ctx);
      PP_Input.attach(canvas);
      PP_Input.setGame(this);
    }

    // ---- run lifecycle ----
    startRun() {
      this.runSeed = ((Math.random() * 1e9) | 0) || 12345;
      this.rng = makeRng(this.runSeed);
      this.squad = this.buildStartingSquad();
      this.courage = Cfg.SQUAD.startCourage;
      this.maxCourage = Cfg.SQUAD.startCourage;
      this.shield = 0;
      this.buttons = 0;
      this.augments = [];
      this.roomIndex = 0;
      this.totalRooms = 5;
      this._rerollsLeft = 1;
      this.runStats = { roomsCleared: 0, bestCombo: 0, shotsFired: 0, damageDealt: 0, enemiesDefeated: 0 };
      this.buildRoom(0);
      this.setState(S.PLAYING);
      this.phase = PH.AIM;
      PP_Replay.reset();
      PP_Replay.startRecording();
      PP_Effects.clearAll();
    }

    buildStartingSquad() {
      const ids = ['pogo', 'cinder', 'mosslug'];
      const defs = ids.map((id) => PP_Content.POPLINGS[id]);
      const positions = this.startingSquadPositions();
      return defs.map((def, i) => ({
        uid: 'p' + i,
        id: def.id, def, name: def.name,
        x: positions[i].x, y: positions[i].y,
        vx: 0, vy: 0, r: Cfg.SQUAD.poplingRadius,
        state: 'ready', restTurnsLeft: 0,
        popReady: true, shotsSincePop: 0,
        sx: 1, sy: 1, _eyeX: 0, _eyeY: 0, _aimStretch: null,
        statuses: {},
      }));
    }

    startingSquadPositions() {
      // place squad in a row near the bottom of the arena
      const a = A;
      const y = a.y + a.h - 70;
      const cx = a.x + a.w / 2;
      return [
        { x: cx - 90, y }, { x: cx, y }, { x: cx + 90, y },
      ];
    }

    // ---- room generation (data-driven, seeded) ----
    buildRoom(idx) {
      const world = PP_Content.WORLDS.jellyyard;
      const a = A;
      this.walls = PP_Physics.arenaWalls(a).map((w, i) => Object.assign({ _id: 'wall' + i }, w));

      const room = {
        idx, world, enemies: [], objects: [], lockedZones: [], chargeArrows: [], trackingLines: [],
      };
      const count = clamp(3 + Math.floor(idx * 0.7), 3, 7); // 3–7 enemies (§5.1)
      const enemyKinds = Object.keys(PP_Content.ENEMIES);
      // bias early rooms to dumpling, later rooms add variety
      let uid = 0;
      for (let i = 0; i < count; i++) {
        let kind;
        if (idx === 0) kind = 'dumpling';
        else if (idx <= 1) kind = this.rng.pick(['dumpling', 'dumpling', 'pinprick']);
        else kind = this.rng.pick(enemyKinds);
        const def = PP_Content.ENEMIES[kind];
        const elite = idx >= 3 && i === 0 ? this.rng.pick(['armored', 'restless', 'unstable', null]) : null;
        const e = this.makeEnemy(def, a, uid++, elite, idx);
        room.enemies.push(e);
      }
      // Add a spring bumper object for "surprise high combo" (tutorial §17 1:20–2:00)
      if (idx >= 0) {
        room.objects.push({
          uid: 'obj0', kind: 'object', id: 'bumper',
          x: a.x + a.w / 2, y: a.y + a.h / 2,
          r: 22, bumper: true, restitution: 1.15, def: { color: '#7be0a8', color2: '#c6f5d8' },
          sx: 1, sy: 1, _hit: 0,
        });
      }
      // Reset squad positions for the room
      const pos = this.startingSquadPositions();
      this.squad.forEach((p, i) => {
        p.x = pos[i].x; p.y = pos[i].y; p.vx = 0; p.vy = 0;
        p.state = 'ready'; p.restTurnsLeft = 0;
      });
      this.activePoplingIdx = 0;
      this.roomBestCombo = 0;
      this.roomClearTime = 0;
      this.room = room;
      this.computeIntents();
      this.phase = PH.AIM;
    }

    makeEnemy(def, a, uid, elite, roomIdx) {
      const margin = 80;
      const x = this.rng.range(a.x + margin, a.x + a.w - margin);
      const y = this.rng.range(a.y + margin, a.y + a.h - 180); // keep clear of squad start
      let e = {
        uid: 'e' + uid, id: def.id, def, kind: 'enemy',
        x, y, vx: 0, vy: 0, r: def.radius,
        hp: def.hp + roomIdx * 1, maxHp: def.hp + roomIdx * 1,
        armor: def.armor || 0,
        intent: def.intent,
        intentRange: def.intentRange,
        intentDamage: def.intentDamage,
        guardArc: def.guardArc || 0, guardRadius: def.guardRadius || 0,
        facing: 0,
        countdown: def.countdown || 0, countdownLeft: def.countdown || 0,
        weaken: def.weaken || 0,
        moveAfter: def.moveAfter || false,
        statuses: {}, sx: 1, sy: 1, dead: false, elite: null,
      };
      if (elite && PP_Content.ELITE_MODS[elite]) {
        const m = PP_Content.ELITE_MODS[elite];
        e.elite = elite;
        e.armor += m.armor || 0;
        e.moveAfter = m.moveAfter || e.moveAfter;
        e.explodeOnDeath = m.explodeOnDeath || 0;
        e.maxHp = Math.round(e.maxHp * 1.3); e.hp = e.maxHp;
      }
      return e;
    }

    // ---- enemy intents (§5.4) ----
    computeIntents() {
      const room = this.room;
      room.lockedZones = []; room.chargeArrows = []; room.trackingLines = [];
      for (const e of room.enemies) {
        if (e.dead) continue;
        if (e.intent === 'locked') {
          // a red zone near the squad
          const target = this.rng.pick(this.squad.filter(s => s.state !== 'dead'));
          if (target) {
            room.lockedZones.push({
              shape: 'circle', x: target.x, y: target.y - 60, r: e.intentRange * 0.7,
              source: e.uid, damage: e.intentDamage,
            });
          }
        } else if (e.intent === 'tracking') {
          const target = this.rng.pick(this.squad.filter(s => s.state !== 'dead'));
          if (target) room.trackingLines.push({ x1: e.x, y1: e.y, x2: target.x, y2: target.y, source: e.uid, damage: e.intentDamage });
        } else if (e.intent === 'charge') {
          const target = this.rng.pick(this.squad.filter(s => s.state !== 'dead'));
          if (target) {
            const ang = Math.atan2(target.y - e.y, target.x - e.x);
            room.chargeArrows.push({ x: e.x, y: e.y, angle: ang, len: 220, source: e.uid, damage: e.intentDamage });
          }
        } else if (e.intent === 'guard') {
          e.facing = this.rng.range(0, Math.PI * 2);
        }
      }
    }

    // ---- active popling ----
    activePopling() { return this.squad[this.activePoplingIdx]; }

    findReadyPoplingAt(x, y) {
      // pick the nearest ready popling within a generous radius
      let best = null, bd = 80;
      for (const p of this.squad) {
        if (p.state !== 'ready') continue;
        const d = dist(p.x, p.y, x, y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    isPopReady(p) {
      // POP once per Popling every three squad shots (§5.3)
      if (!p) return false;
      return p.shotsSincePop >= Cfg.SQUAD.popEveryShots;
    }

    // ---- aim handling (from input.js) ----
    onAimStart(p) {
      this.activePoplingIdx = this.squad.indexOf(p);
      this.aim = { pivot: { x: p.x, y: p.y }, dir: { x: 0, y: 0 }, forceFrac: 0, d: 0, cancel: false, validShot: false };
      p._aimStretch = 0.85; // pre-stretch anticipation (§6 Pull: body stretches toward finger)
    }
    onAimMove(aim) {
      this.aim = aim;
      const p = this.activePopling();
      if (!p) return;
      // stretch toward finger + eyes toward projected path (§6 Pull)
      const f = aim.frac;
      p._aimStretch = 0.85 + f * 0.5;
      const dir = vnorm(aim.dir);
      p._eyeX = dir.x * p.r * 0.12; p._eyeY = dir.y * p.r * 0.12;
      // charge ticks at 75/90/100% (§6 Pull)
      const ticks = Cfg.AIM.chargeTickFracs;
      for (const tk of ticks) {
        if (f >= tk && (p._lastTick == null || f > p._lastTick + 0.001 && tk > (p._lastTickMark || 0))) {
          if ((p._lastTickMark || 0) < tk) {
            PP_Haptics.charge(); PP_Audio.pullCharge(f);
            p._lastTickMark = tk;
          }
        }
      }
    }
    onAimCancel() {
      this.aim = null;
      const p = this.activePopling();
      if (p) { p._aimStretch = null; p._eyeX = 0; p._eyeY = 0; p._lastTickMark = 0; }
    }
    onAimRelease(info) {
      const p = this.activePopling();
      if (!p) return;
      p._aimStretch = null; p._eyeX = 0; p._eyeY = 0; p._lastTickMark = 0;
      // launch (§6 Release: one-frame compression then stretch)
      const speed = Cfg.AIM.launchSpeedMin + (Cfg.AIM.launchSpeedMax - Cfg.AIM.launchSpeedMin) * info.frac;
      p.vx = info.dir.x * speed; p.vy = info.dir.y * speed;
      // release squash: compress then snap (handled via _releaseFlash timer)
      p._releaseFlash = 0.12;
      p.sy = 0.7; p.sx = 1.3; // one-frame compression
      PP_Audio.release(speed);
      PP_Haptics.release();
      PP_Effects.burst(p.x, p.y, -info.dir.x, -info.dir.y, { count: 8, color: p.def.color2, speed: 280, size: 5, life: 0.35 });

      this.beginShot(p, info);
      this.aim = null;
    }

    beginShot(p, info) {
      this.squadShotsTaken++;
      this.runStats.shotsFired++;
      p.shotsSincePop++;
      // Pogo passive "springy": tracked via flag for first wall rebound.
      this.shotState = {
        combo: 0,
        collisions: 0,
        wallHitsThisShot: 0,
        wallsHit: new Set(),
        enemiesHit: new Set(),
        firstEnemyDone: false,
        firstWallDone: false,
        buddyHitsThisShot: 0,
        buddiesHit: new Set(),
        distBeforeFirstEnemy: 0,
        _lastX: p.x, _lastY: p.y,
        startTime: PP_Util.now() / 1000,
        damageThisShot: 0,
        targetPopling: p,
        launchSpeed: Math.hypot(p.vx, p.vy),
        previewFirstTarget: info.previewFirstTarget,
        popped: false,
        pogoUsedRebound: false,
      };
      PP_Physics.beginShot(this.shotState);
      // Reset per-shot hit tracking so the repeated-hit cooldown (§5.5) is
      // measured within THIS shot, not against the previous shot's timestamps.
      if (this.room) {
        for (const e of this.room.enemies) {
          if (e._lastHitBy) e._lastHitBy = {};
          e._hitCount = {};
        }
      }
      this.phase = PH.FLY;
      this.shotTimer = 0;
      this.resolveTimer = 0;
    }

    tryPop() {
      if (this.phase !== PH.FLY) return;
      const p = this.activePopling();
      if (!p || !this.isPopReady(p)) return;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < Cfg.POP.minSpeedForPop) return;
      // Second Wind: instant mid-flight impulse toward current direction (§7)
      const dir = vnorm({ x: p.vx, y: p.vy });
      const boost = this.shotState.launchSpeed * Cfg.POP.impulseFrac;
      p.vx += dir.x * boost; p.vy += dir.y * boost;
      p.shotsSincePop = 0;
      p.popReady = false;
      this.shotState.popped = true;
      PP_Audio.popAbility();
      PP_Haptics.pop();
      PP_Effects.burst(p.x, p.y, dir.x, dir.y, { count: 16, color: Cfg.POP.flashColor, speed: 500, size: 6, life: 0.5 });
      PP_Effects.ring(p.x, p.y, { color: Cfg.POP.flashColor, radius: 30, life: 0.4, width: 6 });
      PP_Effects.flash(0.3);
      PP_Effects.hitStop(0.04);
    }

    // ---- preview simulation (dotted line) §5.3 ----
    simulatePreview(pivot, dir, forceFrac) {
      const speed = Cfg.AIM.launchSpeedMin + (Cfg.AIM.launchSpeedMax - Cfg.AIM.launchSpeedMin) * (forceFrac - Cfg.AIM.minForceFrac) / (Cfg.AIM.maxForceFrac - Cfg.AIM.minForceFrac);
      let x = pivot.x, y = pivot.y, vx = dir.x * speed, vy = dir.y * speed;
      const points = [];
      const bounces = [];
      const maxBounces = this.settings.aimAssist ? Cfg.AIM.previewMaxBounces + 1 : Cfg.AIM.previewMaxBounces;
      let bounceCount = 0;
      const stepDt = 1 / 120;
      const maxSteps = 240;
      let firstEnemy = null;
      for (let s = 0; s < maxSteps; s++) {
        if (s % 5 === 0) points.push({ x, y });
        x += vx * stepDt; y += vy * stepDt;
        vx *= Math.pow(P.friction, stepDt * 60); vy *= Math.pow(P.friction, stepDt * 60);
        // walls
        for (const w of this.walls) {
          const c = PP_Util.circleSeg(x, y, this.activePopling().r, w.ax, w.ay, w.bx, w.by);
          if (c) {
            x += c.nx * c.pen; y += c.ny * c.pen;
            const vn = vx * c.nx + vy * c.ny;
            if (vn < 0) {
              const r = PP_Util.reflect(vx, vy, c.nx, c.ny);
              vx = r.x * P.wallRestitution; vy = r.y * P.wallRestitution;
              bounceCount++;
              bounces.push({ x: c.px, y: c.py });
              if (bounceCount >= maxBounces) { points.push({ x, y }); return { points, bounces, firstEnemy }; }
            }
          }
        }
        // enemies (first collision stops preview)
        for (const e of this.room.enemies) {
          if (e.dead) continue;
          if (dist(x, y, e.x, e.y) < e.r + this.activePopling().r) {
            firstEnemy = e; points.push({ x: e.x, y: e.y });
            return { points, bounces, firstEnemy };
          }
        }
        // stop if too slow
        if (Math.hypot(vx, vy) < P.stopSpeed * 0.5) { points.push({ x, y }); return { points, bounces, firstEnemy }; }
      }
      points.push({ x, y });
      return { points, bounces, firstEnemy };
    }

    // ---- collision event handler (from physics queue) ----
    get bodies() {
      // enemies + resting poplings (buddies) + objects
      const out = [];
      for (const e of this.room.enemies) { if (!e.dead) out.push(e); }
      for (const p of this.squad) {
        if (p === this.activePopling()) continue;
        out.push(Object.assign({}, p, { kind: 'buddy', uid: p.uid, r: p.r }));
        // we use a shallow clone so physics doesn't move the real popling
      }
      for (const o of this.room.objects) out.push(o);
      return out;
    }

    onCollision(ev) {
      const ss = this.shotState;
      if (!ss) return;
      ss.collisions++;
      if (ss.collisions > P.collisionBudget + 4) return; // soft cap (§5.3)

      const ap = this.activePopling();
      const sp = Math.hypot(ap.vx, ap.vy);

      if (ev.kind === 'wall') {
        ss.wallHitsThisShot++;
        // Pogo passive: first wall rebound preserves extra speed (+8%)
        if (ap.def.passiveId === 'springy' && !ss.pogoUsedRebound) {
          ap.vx *= 1.08; ap.vy *= 1.08; ss.pogoUsedRebound = true;
          PP_Effects.burst(ev.point.x, ev.point.y, ev.nx, ev.ny, { count: 6, color: ap.def.color2, speed: 220, size: 4, life: 0.3 });
        }
        // Fresh Paint augment: first wall rebound +15% speed
        if (this.hasAug('fresh_paint') && !ss.freshPaintUsed) {
          ap.vx *= 1.15; ap.vy *= 1.15; ss.freshPaintUsed = true;
        }
        // Corner Pocket: two different walls before enemy => Mark
        if (this.hasAug('corner_pocket') && ss.wallsHit.size >= 2 && !ss.firstEnemyDone) {
          ss.cornerPocketMark = true;
        }
        // No Brakes: damage up while above launch speed (applied on next enemy)
        ss.aboveLaunch = sp > ss.launchSpeed;
        // wall pop sound (timbre: triangle) — climb scale by combo
        PP_Audio.comboHit(ss.combo, 'wall');
        PP_Effects.burst(ev.point.x, ev.point.y, ev.nx, ev.ny, { count: 5, color: '#cfd6e6', speed: 200, size: 3, life: 0.25 });
        PP_Effects.shake(1.5);
        PP_Haptics.normal();
        this.bumpCombo();
        return;
      }

      if (ev.kind === 'enemy') {
        const e = ev.target;
        const now = (PP_Util.now() / 1000) - ss.startTime;
        // repeated-hit protection (§5.5)
        if (!PP_Physics.canDamage(e, ap.uid, now)) {
          PP_Effects.burst(ev.point.x, ev.point.y, ev.nx, ev.ny, { count: 3, color: '#fff', speed: 140, size: 3, life: 0.2 });
          return;
        }
        // damage
        const critBase = Cfg.COMBAT.critChanceBase;
        let crit = false;
        // Bank Shot: first enemy after a wall => guaranteed crit
        if (this.hasAug('bank_shot') && ss.wallHitsThisShot > 0 && !ss.firstEnemyDone) { crit = true; ss.bankShotUsed = true; }
        // Called Shot: first enemy matches preview +25% dmg
        let calledShotBonus = 1;
        if (this.hasAug('called_shot') && !ss.firstEnemyDone && ss.previewFirstTarget && ss.previewFirstTarget.uid === e.uid) {
          calledShotBonus = 1.25; ss.calledShotUsed = true;
        }
        // Long Distance: dmg scales with travel before first enemy
        let longDistBonus = 1;
        if (this.hasAug('long_distance') && !ss.firstEnemyDone) {
          longDistBonus = 1 + clamp(ss.distBeforeFirstEnemy / 1200, 0, 0.5);
        }
        // No Brakes
        let noBrakes = 1;
        if (this.hasAug('no_brakes') && ss.aboveLaunch) noBrakes = 1.25;
        // Mark (status)
        const marked = !!(e.statuses && e.statuses.mark);
        if (marked && Math.random() < 0.5) crit = true;
        // Corner Pocket mark application
        if (ss.cornerPocketMark && !ss.firstEnemyDone) { this.applyStatus(e, 'mark', 1); }

        const rep = PP_Physics.repeatFloorMult(e, ap.uid);
        const r = PP_Physics.computeDamage({
          power: ap.def.power * calledShotBonus * longDistBonus * noBrakes,
          speed: sp, normalLaunchSpeed: ss.launchSpeed,
          comboCount: ss.combo, armor: e.armor + (e.statuses.brk ? 4 : 0), marked, crit,
        });
        let dmg = r.dmg * rep;
        // Clean Entrance: hitting enemy before wall => shield (rare)
        if (this.hasAug('clean_entrance') && ss.wallHitsThisShot === 0 && !ss.cleanEntranceUsed) {
          this.shield += 8; ss.cleanEntranceUsed = true;
          PP_Effects.floatText(e.x, e.y - e.r - 20, '+8 SHIELD', { color: '#7fc7ff', size: 16 });
        }

        ss.firstEnemyDone = true;
        this.applyDamage(e, dmg, crit, ev.point, ev.nx, ev.ny, ap);
        ss.damageThisShot += dmg;
        this.runStats.damageDealt += dmg;
        this.bumpCombo();
        return;
      }

      if (ev.kind === 'buddy') {
        ss.buddyHitsThisShot++;
        const buddy = ev.target;
        const real = this.squad.find((s) => s.uid === buddy.uid);
        PP_Audio.comboHit(ss.combo, 'buddy');
        PP_Haptics.buddy();
        // Mosslug passive: buddy collisions heal (+3 Courage)
        if (ap.def.passiveId === 'mossy') {
          this.courage = Math.min(this.maxCourage, this.courage + 3);
          PP_Effects.floatText(buddy.x, buddy.y - 30, '+3', { color: '#7be0a8', size: 16 });
        }
        // High Five: first buddy hit each shot => AoE damage
        if (this.hasAug('high_five') && ss.buddyHitsThisShot === 1) {
          for (const e of this.room.enemies) {
            if (e.dead) continue;
            if (dist(e.x, e.y, buddy.x, buddy.y) < 130) {
              this.applyDamage(e, ap.def.power * 0.5, false, { x: e.x, y: e.y }, 0, -1, ap);
            }
          }
          PP_Effects.ring(buddy.x, buddy.y, { color: '#ffd166', radius: 60, life: 0.4, width: 5 });
        }
        // Wake-Up Call: hitting a resting ally makes it Ready next turn
        if (this.hasAug('wake_up') && real && real.state === 'resting') {
          real._wakeNextTurn = true;
          PP_Effects.floatText(real.x, real.y - 30, 'WAKE!', { color: '#ffd166', size: 16 });
        }
        // Three's Company: touching both allies in one shot => heal Courage +10
        if (this.hasAug('threes_company') && ss.buddiesHit.size >= 2 && !ss.threesUsed) {
          this.courage = Math.min(this.maxCourage, this.courage + 10);
          ss.threesUsed = true;
          PP_Effects.floatText(ap.x, ap.y - 30, '+10 COURAGE', { color: '#7be0a8', size: 18 });
          PP_Effects.ring(ap.x, ap.y, { color: '#7be0a8', radius: 70, life: 0.5, width: 6 });
        }
        PP_Effects.burst(ev.point.x, ev.point.y, ev.nx, ev.ny, { count: 6, color: '#ffd166', speed: 200, size: 4, life: 0.3 });
        PP_Effects.shake(1);
        // buddy gives the popling a little kick (keeps chain alive)
        ap.vx *= 1.02; ap.vy *= 1.02;
        this.bumpCombo();
        return;
      }

      if (ev.kind === 'object') {
        const o = ev.target;
        if (o.bumper) {
          // bumper restitution handled in physics; add flair
          PP_Audio.comboHit(ss.combo, 'object');
          PP_Effects.ring(o.x, o.y, { color: '#7be0a8', radius: o.r + 8, life: 0.3, width: 4 });
          PP_Effects.burst(o.x, o.y, ev.nx, ev.ny, { count: 8, color: '#c6f5d8', speed: 320, size: 4, life: 0.35 });
          o._hit = 0.2;
          PP_Haptics.normal();
          this.bumpCombo();
        }
      }
    }

    applyDamage(e, dmg, crit, point, nx, ny, ap) {
      dmg = Math.max(1, dmg);
      e.hp -= dmg;
      // squash enemy
      e.sx = 0.7; e.sy = 1.3;
      // particles aligned to surface normal (§6 Impact)
      PP_Effects.burst(point.x, point.y, nx, ny, {
        count: crit ? 14 : 8,
        color: crit ? '#ff7b9c' : '#fff6e8',
        speed: crit ? 460 : 320, size: crit ? 6 : 4, life: 0.45,
      });
      // damage number
      PP_Effects.floatText(e.x, e.y - e.r - 6, Math.round(dmg) + (crit ? '!' : ''), {
        color: crit ? '#ff7b9c' : '#fff6e8', size: crit ? 26 : 20, big: crit, vy: -80,
      });
      PP_Audio.pop({ force: clamp(Math.hypot(ap.vx, ap.vy) / 1500, 0.2, 1), crit });
      PP_Haptics.normal();
      if (crit) { PP_Haptics.crit(); PP_Effects.shake(4); PP_Effects.flash(0.15); }
      else PP_Effects.shake(2);
      // hit stop (35-65ms scaled by importance) §6 Impact
      PP_Effects.hitStop(crit ? T.hitStopMax : T.hitStopMin);
      // Cinder passive: direct hit adds Burn
      if (ap.def.passiveId === 'ignite') this.applyStatus(e, 'burn', 1);
      if (e.hp <= 0) this.killEnemy(e, ap);
    }

    killEnemy(e, ap) {
      e.dead = true;
      this.runStats.enemiesDefeated++;
      // celebratory burst
      PP_Effects.burst(e.x, e.y, 0, -1, { count: 20, color: e.def.color2, speed: 420, size: 6, life: 0.6, kind: 'dot', spread: 2 });
      PP_Effects.ring(e.x, e.y, { color: e.def.color, radius: e.r, life: 0.4, width: 5 });
      PP_Audio.good();
      PP_Effects.shake(3);
      // elite unstable: explodes
      if (e.explodeOnDeath) {
        for (const other of this.room.enemies) {
          if (other.dead || other === e) continue;
          if (dist(other.x, other.y, e.x, e.y) < e.explodeOnDeath) {
            this.applyDamage(other, ap.def.power * 0.8, false, { x: other.x, y: other.y }, 0, -1, ap);
          }
        }
        PP_Effects.ring(e.x, e.y, { color: '#ff7b6b', radius: e.explodeOnDeath, life: 0.5, width: 8 });
        PP_Effects.shake(6);
      }
      // final enemy: slow-mo + cam track (§6 Final enemy)
      const remaining = this.room.enemies.filter((x) => !x.dead).length;
      if (remaining === 0) {
        PP_Effects.slowmo(0.25, T.finalEnemySlow);
        PP_Effects.hitStop(T.hitStopMax);
      }
    }

    applyStatus(e, key, stacks) {
      const def = PP_Content.STATUSES[key];
      if (!def) return;
      e.statuses = e.statuses || {};
      if (def.maxStacks) {
        const cur = e.statuses[key] || 0;
        e.statuses[key] = Math.min(def.maxStacks, cur + stacks);
      } else {
        e.statuses[key] = (e.statuses[key] || 0) + stacks;
      }
    }

    bumpCombo() {
      this.shotState.combo++;
      if (this.shotState.combo > this.roomBestCombo) this.roomBestCombo = this.shotState.combo;
      if (this.shotState.combo > this.runStats.bestCombo) this.runStats.bestCombo = this.shotState.combo;
      if (this.shotState.combo > this.bestCombo) this.bestCombo = this.shotState.combo;
      // combo milestone typography (§6 Impact): grows only at 5,10,20,35,50
      if (T.comboMilestones.includes(this.shotState.combo)) {
        PP_Effects.floatText(this.activePopling().x, this.activePopling().y - 50, `${this.shotState.combo}x!`, { color: '#ffd166', size: 34, big: true, life: 1.0 });
        PP_Audio.good();
      }
    }

    // ---- update ----
    update(rawDt) {
      // cap dt for stability
      let dt = Math.min(rawDt, 1 / 30);
      // hit stop freezes gameplay sim but not effects
      const frozen = PP_Effects.consumeHitStop(dt);
      // slow-mo time scale
      let simDt = dt;
      if (!frozen) simDt = dt * PP_Effects.updateTimeScale(dt);
      // effects always tick (in real time, lightly)
      PP_Effects.update(dt);
      PP_Effects.updateTexts(dt);
      PP_Effects.updateShake(dt);
      PP_Effects.updateFlash(dt);

      if (this.state !== S.PLAYING) return;

      if (this.phase === PH.FLY) {
        const ap = this.activePopling();
        // record replay
        PP_Replay.capture(this.snapshot(), dt);
        if (ap && !frozen) {
          PP_Physics.stepPopling(ap, simDt, this);
        }
        this.shotTimer += dt;
        // release squash recovery
        for (const p of this.squad) {
          if (p._releaseFlash != null) {
            p._releaseFlash -= dt;
            if (p._releaseFlash <= 0) { p._releaseFlash = null; }
          }
          // squash recovery
          p.sx = PP_Util.approach(p.sx, 1, dt * 6);
          p.sy = PP_Util.approach(p.sy, 1, dt * 6);
          if (p._aimStretch == null) p._aimStretch = null;
        }
        for (const e of this.room.enemies) {
          e.sx = PP_Util.approach(e.sx, 1, dt * 6);
          e.sy = PP_Util.approach(e.sy, 1, dt * 6);
        }
        for (const o of this.room.objects) { if (o._hit != null) o._hit = Math.max(0, o._hit - dt); }

        // shot termination (§5.3 step 9)
        const speed = ap ? Math.hypot(ap.vx, ap.vy) : 0;
        const budgetDone = this.shotState.collisions >= P.collisionBudget;
        const tooLong = this.shotTimer > P.maxResolveSeconds;
        const stopped = speed < P.stopSpeed && this.shotTimer > P.minResolveSeconds * 0.5;
        if (budgetDone || tooLong || stopped) {
          this.endShot();
        }
      } else if (this.phase === PH.ENEMY) {
        this.enemyActTimer += dt;
        if (this.enemyActTimer > 0.9) {
          this.finishEnemyTurn();
        }
      } else if (this.phase === PH.BETWEEN) {
        // small pause between rooms
      }

      // capture replay continuously while playing
      if (this.phase !== PH.FLY) {
        PP_Replay.capture(this.snapshot(), dt);
      }
    }

    endShot() {
      const ap = this.activePopling();
      // settle the active popling to rest
      ap.vx = 0; ap.vy = 0;
      ap.state = 'resting'; ap.restTurnsLeft = Cfg.SQUAD.restTurns;
      // shot end stats
      PP_Physics.endShot();
      // Buttons reward for big combos (§12 run-only currency)
      if (this.roomBestCombo >= 5) this.buttons += Math.floor(this.roomBestCombo / 2);
      PP_Input.notifyShotEnd();
      // burn damage tick (§8): deals damage after enemy acts — we do it during enemy turn
      this.phase = PH.ENEMY;
      this.enemyActTimer = 0;
      // slight delay before enemies act (§5.3 enemy action delay)
      this._enemyDelayLeft = T.enemyActionDelay;
    }

    // ---- enemy turn ----
    finishEnemyTurn() {
      if (this._enemyDelayLeft > 0) { this._enemyDelayLeft -= 0.9; return; }
      // resolve intents
      const room = this.room;
      for (const e of room.enemies) {
        if (e.dead) continue;
        if (e.intent === 'locked') {
          // damage poplings in any locked zone
          for (const z of room.lockedZones) {
            if (z.source !== e.uid) continue;
            for (const p of this.squad) {
              if (dist(p.x, p.y, z.x, z.y) < z.r) this.hurtCourage(z.damage, 'locked zone', p);
            }
          }
        } else if (e.intent === 'tracking') {
          for (const tl of room.trackingLines) {
            if (tl.source !== e.uid) continue;
            // damage poplings near the line
            for (const p of this.squad) {
              const c = PP_Util.closestOnSeg(tl.x1, tl.y1, tl.x2, tl.y2, p.x, p.y);
              if (dist(c.x, c.y, p.x, p.y) < 40) this.hurtCourage(tl.damage, 'tracking strike', p);
            }
          }
        } else if (e.intent === 'charge') {
          for (const ca of room.chargeArrows) {
            if (ca.source !== e.uid) continue;
            // move enemy along arrow and damage poplings in path
            const tx = e.x + Math.cos(ca.angle) * ca.len;
            const ty = e.y + Math.sin(ca.angle) * ca.len;
            for (const p of this.squad) {
              const c = PP_Util.closestOnSeg(e.x, e.y, tx, ty, p.x, p.y);
              if (dist(c.x, c.y, p.x, p.y) < p.r + 20) this.hurtCourage(ca.damage, 'charge', p);
            }
            e.x = clamp(tx, A.x + e.r, A.x + A.w - e.r);
            e.y = clamp(ty, A.y + e.r, A.y + A.h - e.r);
          }
        } else if (e.intent === 'countdown') {
          e.countdownLeft -= 1;
          if (e.countdownLeft <= 0) {
            // weaken all future shots (visual: screen tint)
            this._shotWeaken = (this._shotWeaken || 0) + e.weaken;
            e.countdownLeft = e.countdown;
            this.hurtCourage(e.intentDamage, 'mumbler countdown', null);
          }
        }
        // burn damage (§8): deals damage after enemy acts
        if (e.statuses && e.statuses.burn) {
          const burnDmg = PP_Content.STATUSES.burn.perTurn * e.statuses.burn;
          e.hp -= burnDmg;
          PP_Effects.floatText(e.x, e.y - e.r, `-${Math.round(burnDmg)}`, { color: '#ff7b3a', size: 16 });
          PP_Effects.burst(e.x, e.y, 0, -1, { count: 4, color: '#ff7b3a', speed: 100, size: 3, life: 0.3 });
          if (e.hp <= 0) this.killEnemy(e, this.activePopling());
        }
        // restless: move after squad shot
        if (e.moveAfter) {
          e.x = clamp(e.x + this.rng.range(-60, 60), A.x + e.r, A.x + A.w - e.r);
          e.y = clamp(e.y + this.rng.range(-60, 60), A.y + e.r, A.y + A.h - e.r);
        }
      }
      // advance squad readiness
      for (const p of this.squad) {
        if (p.state === 'resting') {
          p.restTurnsLeft--;
          if (p.restTurnsLeft <= 0 || p._wakeNextTurn) { p.state = 'ready'; p._wakeNextTurn = false; }
        }
        // POP recharge: every 3 squad shots
        if (p.shotsSincePop >= Cfg.SQUAD.popEveryShots) p.popReady = true;
      }
      // choose a ready popling as active
      const readyIdx = this.squad.findIndex((p) => p.state === 'ready');
      this.activePoplingIdx = readyIdx >= 0 ? readyIdx : 0;
      this.computeIntents();

      // check room clear
      const remaining = this.room.enemies.filter((x) => !x.dead).length;
      if (remaining === 0) {
        this.onRoomCleared();
      } else {
        this.phase = PH.AIM;
      }
    }

    hurtCourage(amount, cause, popling) {
      // shield absorbs first (§5.2)
      let dmg = amount;
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, dmg);
        this.shield -= absorbed; dmg -= absorbed;
        if (absorbed > 0) PP_Effects.floatText((popling ? popling.x : A.x + A.w / 2), (popling ? popling.y : A.y + 60), `-${Math.round(absorbed)}🛡`, { color: '#7fc7ff', size: 16 });
      }
      if (dmg > 0) {
        this.courage -= dmg;
        PP_Effects.floatText((popling ? popling.x : A.x + A.w / 2), (popling ? popling.y - 20 : A.y + 60), `-${Math.round(dmg)}`, { color: '#ff6b6b', size: 20 });
        PP_Effects.shake(5); PP_Effects.flash(0.25);
        PP_Audio.bad(); PP_Haptics.crit();
        // hit popling visually
        if (popling) { popling.sx = 1.4; popling.sy = 0.7; }
      }
      this._lastFailCause = cause;
      if (this.courage <= 0) {
        this.courage = 0;
        this.onRunLost();
      }
    }

    onRoomCleared() {
      this.runStats.roomsCleared++;
      this.courage = Math.min(this.maxCourage, this.courage + 12); // partial heal between rooms
      this.buttons += 10;
      // offer augment after some rooms (§9)
      if (this.roomIndex < this.totalRooms - 1) {
        this.offerAugments();
        this.setState(S.AUGMENT);
      } else {
        this.onRunWon();
      }
    }

    offerAugments() {
      // pick 3 distinct augments, bias toward current build tags
      const owned = new Set(this.augments.map((a) => a.id));
      const pool = PP_Content.AUGMENTS.filter((a) => !owned.has(a.id));
      const shuffled = this.rng.shuffle(pool);
      this._pendingAugmentOffer = shuffled.slice(0, 3);
      this._rerollsLeft = Math.max(this._rerollsLeft, 1);
    }

    rerollAugments() {
      if (this._rerollsLeft <= 0) return false;
      this._rerollsLeft--;
      this.offerAugments();
      return true;
    }

    pickAugment(id) {
      const def = PP_Content.AUGMENTS.find((a) => a.id === id);
      if (!def) return;
      this.augments.push(def);
      PP_Audio.good();
      this.continueAfterAugment();
    }

    continueAfterAugment() {
      this._pendingAugmentOffer = null;
      this.roomIndex++;
      if (this.roomIndex >= this.totalRooms) {
        this.onRunWon();
        return;
      }
      this.buildRoom(this.roomIndex);
      this.setState(S.PLAYING);
      this.phase = PH.AIM;
      // show a brief result toast
      PP_UI && PP_UI.toast && PP_UI.toast(`Room ${this.roomIndex + 1}/${this.totalRooms}`);
    }

    onRunWon() {
      this.clearSavedRun();
      PP_Replay.stopRecording();
      PP_Audio.fanfare();
      this.setState(S.END);
      PP_UI.showEnd(true, this);
    }

    onRunLost() {
      this.clearSavedRun();
      PP_Replay.stopRecording();
      PP_Audio.bad();
      this.setState(S.END);
      PP_UI.showEnd(false, this);
    }

    hasAug(id) { return this.augments.some((a) => a.id === id); }

    setState(s) { this.state = s; }

    // ---- snapshot for replay ----
    snapshot() {
      const room = this.room;
      return {
        t: PP_Util.now() / 1000,
        squad: this.squad.map((p) => ({ x: p.x, y: p.y, r: p.r, color: p.def.color, vx: p.vx, vy: p.vy, state: p.state })),
        enemies: room ? room.enemies.filter((e) => !e.dead).map((e) => ({ x: e.x, y: e.y, r: e.r, color: e.def.color, hp: e.hp, maxHp: e.maxHp })) : [],
        objects: room ? room.objects.map((o) => ({ x: o.x, y: o.y, r: o.r, color: o.def.color, hit: o._hit })) : [],
        combo: this.shotState ? this.shotState.combo : 0,
      };
    }
  }

  global.PP_Game = { Game, States: S, Phases: PH };
})(typeof window !== 'undefined' ? window : globalThis);
