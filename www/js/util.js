/* util.js — small math + helper library (no deps). */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));
  const mix = lerp;
  const smoothstep = (e0, e1, x) => {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  const approach = (a, b, delta) => {
    if (a < b) return Math.min(a + delta, b);
    return Math.max(a - delta, b);
  };
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;

  const len = (x, y) => Math.hypot(x, y);
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };

  // 2D vector helpers (plain {x,y} objects)
  const v = (x = 0, y = 0) => ({ x, y });
  const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const vscale = (a, s) => ({ x: a.x * s, y: a.y * s });
  const vlen = (a) => Math.hypot(a.x, a.y);
  const vnorm = (a) => {
    const l = Math.hypot(a.x, a.y);
    return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
  };
  const vdot = (a, b) => a.x * b.x + a.y * b.y;
  const vangle = (a) => Math.atan2(a.y, a.x);
  const vfromAngle = (ang, mag = 1) => ({ x: Math.cos(ang) * mag, y: Math.sin(ang) * mag });

  // Reflection of vector v about unit normal n: v' = v - 2(v·n)n
  const reflect = (vx, vy, nx, ny) => {
    const d = vx * nx + vy * ny;
    return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
  };

  // Seeded RNG (mulberry32) — deterministic seeds, blueprint §9/§26.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const makeRng = (seed) => {
    const r = mulberry32(seed);
    const next = () => r();
    const range = (lo, hi) => lo + (hi - lo) * r();
    const int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const chance = (p) => r() < p;
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };
    return { next, range, int, pick, chance, shuffle, state: () => a };
  };

  // Circle vs circle collision: returns {hit, nx, ny, pen} or null.
  const circleCircle = (ax, ay, ar, bx, by, br) => {
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    const min = ar + br;
    if (d >= min || d === 0) return null;
    const nx = dx / d, ny = dy / d;
    return { nx, ny, pen: min - d };
  };

  // Closest point on segment AB to point P.
  const closestOnSeg = (ax, ay, bx, by, px, py) => {
    const abx = bx - ax, aby = by - ay;
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
    return { x: ax + abx * t, y: ay + aby * t, t };
  };

  // Circle vs segment (wall as line from a->b). Returns contact or null.
  const circleSeg = (cx, cy, cr, ax, ay, bx, by) => {
    const p = closestOnSeg(ax, ay, bx, by, cx, cy);
    const dx = cx - p.x, dy = cy - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= cr) return null;
    const nx = d > 1e-9 ? dx / d : 0;
    const ny = d > 1e-9 ? dy / d : 1;
    return { nx, ny, pen: cr - d, px: p.x, py: p.y };
  };

  // Easing
  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  // Format helpers
  const fmtTime = (s) => {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  // Deep clone via JSON (content data is plain JSON-safe).
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  global.PP_Util = {
    TAU, clamp, clamp01, lerp, mix, smoothstep, approach, deg, rad,
    len, dist, dist2,
    v, vadd, vsub, vscale, vlen, vnorm, vdot, vangle, vfromAngle, reflect,
    makeRng, mulberry32,
    circleCircle, closestOnSeg, circleSeg,
    ease, fmtTime, clone, now,
  };
})(typeof window !== 'undefined' ? window : globalThis);
