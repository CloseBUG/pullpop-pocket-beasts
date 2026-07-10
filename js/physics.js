/* physics.js — motion, collision resolution, deterministic damage.
   Blueprint §26 Physics rule: engine-style motion + a game-owned collision
   event queue, rate-limited and ordered deterministically.
   §5.5 damage/combo model with repeated-hit protection. */
(function (global) {
  'use strict';

  const { clamp, clamp01, dist, circleSeg, circleCircle, reflect, vlen } = PP_Util;
  const P = PP_Config.PHYS;
  const C = PP_Config.COMBAT;

  // Build arena wall segments (rectangle boundary) given an arena rect.
  function arenaWalls(a) {
    const { x, y, w, h } = a;
    return [
      { ax: x, ay: y, bx: x + w, by: y },        // top
      { ax: x + w, ay: y, bx: x + w, by: y + h }, // right
      { ax: x + w, ay: y + h, bx: x, by: y + h }, // bottom
      { ax: x, ay: y + h, bx: x, by: y },         // left
    ];
  }

  // The collision event queue for the current shot.
  // Each meaningful contact becomes an event processed via applyDamage etc.
  let queue = [];
  function clearQueue() { queue = []; }

  // Shot-scoped state for damage rules.
  let shotState = null;
  function beginShot(state) {
    shotState = state; // { combo:0, collisions:0, wallHitsThisShot:0, wallsHit:Set, enemiesHit:Set, firstEnemyDone:false, buddyHitsThisShot:0, buddiesHit:Set, distBeforeFirstEnemy, startPos }
    clearQueue();
  }

  // Resolve a moving popling against arena walls. Mutates popling pos/vel.
  // Returns the wall segment hit (or null) for preview/hook logic.
  function resolveWalls(p, walls) {
    let hitWall = null;
    for (const w of walls) {
      const c = circleSeg(p.x, p.y, p.r, w.ax, w.ay, w.bx, w.by);
      if (c) {
        // positional correction
        p.x += c.nx * c.pen; p.y += c.ny * c.pen;
        // reflect velocity if moving into wall
        const vn = p.vx * c.nx + p.vy * c.ny;
        if (vn < 0) {
          const r = reflect(p.vx, p.vy, c.nx, c.ny);
          p.vx = r.x * P.wallRestitution; p.vy = r.y * P.wallRestitution;
          hitWall = { wall: w, nx: c.nx, ny: c.ny, px: c.px, py: c.py, point: { x: c.px, y: c.py } };
        }
      }
    }
    return hitWall;
  }

  // Resolve popling vs body (enemy/buddy/object). Elastic-ish separation + impulse.
  // Returns contact info or null.
  function resolveBody(p, b) {
    const c = circleCircle(p.x, p.y, p.r, b.x, b.y, b.r);
    if (!c) return null;
    // separate popling out (enemies are mostly static; buddies static-ish)
    p.x += c.nx * c.pen; p.y += c.ny * c.pen;
    const restitution = b.kind === 'buddy' ? P.buddyRestitution : P.enemyRestitution;
    const vn = p.vx * c.nx + p.vy * c.ny;
    if (vn < 0) {
      const r = reflect(p.vx, p.vy, c.nx, c.ny);
      p.vx = r.x * restitution; p.vy = r.y * restitution;
    }
    return { nx: c.nx, ny: c.ny, pen: c.pen, point: { x: b.x - c.nx * b.r, y: b.y - c.ny * b.r } };
  }

  // ---- Damage model (§5.5) ----
  // impactDamage = Power * velocityFactor * comboFactor * armorFactor * effectMods
  function computeDamage(opts) {
    const { power, speed, normalLaunchSpeed, comboCount, armor, marked, crit } = opts;
    const velocityFactor = clamp(speed / normalLaunchSpeed, C.velocityFloor, C.velocityCeil);
    const comboFactor = 1 + C.comboPerHit * Math.min(comboCount - 1, C.comboMaxCount);
    let armorFactor = 1;
    if (armor > 0) armorFactor = Math.max(0.3, 1 - armor * 0.05);
    let dmg = power * velocityFactor * comboFactor * armorFactor;
    if (marked) dmg *= 1.0; // mark handled via crit/score bonus
    let isCrit = crit;
    if (isCrit) dmg *= C.critMult;
    return { dmg, velocityFactor, comboFactor, armorFactor, isCrit };
  }

  // Repeated-hit protection (§5.5): same target, 0.14s cooldown; after 4 hits, floor damage.
  function canDamage(target, poplingId, now) {
    const key = poplingId + '->' + (target.uid != null ? target.uid : target.id);
    const last = target._lastHitBy && target._lastHitBy[poplingId];
    if (last != null && now - last < P.sameTargetCooldown) return false;
    target._hitCount = target._hitCount || {};
    target._hitCount[poplingId] = (target._hitCount[poplingId] || 0) + 1;
    target._lastHitBy = target._lastHitBy || {};
    target._lastHitBy[poplingId] = now;
    return true;
  }
  function repeatFloorMult(target, poplingId) {
    const count = (target._hitCount && target._hitCount[poplingId]) || 0;
    if (count <= P.repeatFloorHits) return 1;
    const over = count - P.repeatFloorHits;
    return Math.max(P.repeatFloorMin, 1 - over * P.repeatFloorStep);
  }

  // Record a meaningful contact event. The game applies side-effects.
  function enqueue(ev) { queue.push(ev); }

  // Process the ordered queue: sort by a deterministic order (insertion order is fine
  // since substeps are small and we enqueue within a single substep), then apply.
  function flushQueue(game) {
    if (!queue.length) return;
    // Stable: already in substep order.
    for (const ev of queue) game.onCollision(ev);
    queue.length = 0;
  }

  // Advance a single popling's physics for dt seconds against the world.
  // game: object with onCollision callback and accessors.
  function stepPopling(p, dt, game) {
    const walls = game.walls;
    const bodies = game.bodies; // enemies + buddies + objects, with .kind
    const sub = P.substeps;
    const sdt = dt / sub;
    for (let s = 0; s < sub; s++) {
      // friction (damping)
      p.vx *= Math.pow(P.friction, sdt * 60);
      p.vy *= Math.pow(P.friction, sdt * 60);
      // integrate
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      // speed cap
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > P.maxSpeed) {
        const k = P.maxSpeed / sp;
        p.vx *= k; p.vy *= k;
      }
      // walls
      const wh = resolveWalls(p, walls);
      if (wh) {
        shotState.wallHitsThisShot++;
        const id = wh.wall._id != null ? wh.wall._id : `${wh.wall.ax.toFixed(0)},${wh.wall.ay.toFixed(0)}`;
        shotState.wallsHit = shotState.wallsHit || new Set();
        const isNewWall = !shotState.wallsHit.has(id);
        shotState.wallsHit.add(id);
        enqueue({ kind: 'wall', point: wh.point, nx: wh.nx, ny: wh.ny, isNewWall, wallId: id, popling: p });
      }
      // bodies
      for (const b of bodies) {
        if (b === p) continue;
        if (b.dead) continue;
        const c = resolveBody(p, b);
        if (!c) continue;
        if (b.kind === 'enemy') {
          shotState.enemiesHit = shotState.enemiesHit || new Set();
          shotState.enemiesHit.add(b.uid);
          enqueue({ kind: 'enemy', target: b, point: c.point, nx: c.nx, ny: c.ny, popling: p });
        } else if (b.kind === 'buddy') {
          shotState.buddyHitsThisShot++;
          shotState.buddiesHit = shotState.buddiesHit || new Set();
          shotState.buddiesHit.add(b.uid);
          enqueue({ kind: 'buddy', target: b, point: c.point, nx: c.nx, ny: c.ny, popling: p });
        } else if (b.kind === 'object') {
          enqueue({ kind: 'object', target: b, point: c.point, nx: c.nx, ny: c.ny, popling: p });
        }
      }
    }
    // distance traveled before first enemy (for long_distance augment)
    if (!shotState.firstEnemyDone) {
      shotState.distBeforeFirstEnemy += Math.hypot(p.x - (shotState._lastX != null ? shotState._lastX : p.x), p.y - (shotState._lastY != null ? shotState._lastY : p.y));
      shotState._lastX = p.x; shotState._lastY = p.y;
    }
    flushQueue(game);
  }

  function getShotState() { return shotState; }
  function endShot() { /* keep state for post-shot analysis */ }

  global.PP_Physics = {
    arenaWalls, resolveWalls, resolveBody,
    computeDamage, canDamage, repeatFloorMult,
    beginShot, stepPopling, endShot, getShotState,
    enqueue, flushQueue, clearQueue,
  };
})(typeof window !== 'undefined' ? window : globalThis);
