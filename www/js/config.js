/* config.js — central tuning values & fixed render resolution.
   Numbers follow blueprint §5.3 (prototype tuning) and §5.5 (damage model),
   adapted from "screen points" to our fixed canvas space. */
(function (global) {
  'use strict';

  // Fixed internal render resolution (portrait). Canvas is CSS-scaled to fit.
  const VIEW = { w: 720, h: 1280 };

  // Arena occupies the upper ~78% of the combat screen (blueprint §5.1).
  const HUD_H = 96;            // top HUD
  const BAND_H = 200;          // bottom control band
  const ARENA = {
    x: 24,
    y: HUD_H + 12,
    w: VIEW.w - 48,
    h: VIEW.h - HUD_H - BAND_H - 24,
  };

  // Physics (canvas units; 1 unit ~ 1 px). tuned for feel.
  const PHYS = {
    gravity: 0,                 // top-down, no gravity
    wallRestitution: 0.92,      // energy kept on wall bounce
    enemyRestitution: 0.86,
    buddyRestitution: 0.9,
    friction: 0.992,            // per-step velocity damping
    stopSpeed: 26,              // below this => shot ends (blueprint "stop threshold")
    maxSpeed: 2600,             // hard cap (blueprint §26 "hard speed caps")
    substeps: 4,                // collision substeps per frame for stability
    collisionBudget: 16,        // meaningful collisions per shot (§5.3)
    sameTargetCooldown: 0.14,   // s (§5.3 / §5.5)
    repeatFloorHits: 4,         // after this many same-target hits, damage floors (§5.5)
    repeatFloorStep: 0.15,      // -15% per extra hit
    repeatFloorMin: 0.40,       // to 40% floor
    maxResolveSeconds: 4.5,     // hard shot timeout (§5.3)
    minResolveSeconds: 2.0,     // normal shot duration lower (§5.3)
  };

  // Aim / pull (blueprint §5.3). Screen points scaled into canvas units.
  // The doc uses "screen points"; we map full-force (110pt) to ~ (110/390)*~ full drag.
  const AIM = {
    minDrag: 32 * 1.6,          // px in canvas space to register a shot
    fullDrag: 110 * 1.6,        // px for full force
    minForceFrac: 0.75,         // charge from 75% (§5.3)
    maxForceFrac: 1.00,
    launchSpeedMin: 1180,       // canvas u/s at 75% charge -> "normalLaunchSpeed"
    launchSpeedMax: 1570,       // canvas u/s at 100% charge
    previewSegments: 22,        // dotted preview dots
    previewMaxBounces: 1,       // first collision only (§5.3)
    cancelRadius: 46,           // cancel circle radius
    chargeTickFracs: [0.75, 0.9, 1.0], // haptic ticks (§6 Pull)
  };

  // Shot resolution timing (§5.3)
  const TIMING = {
    enemyActionDelay: 0.35,     // s after shot before enemies act (§5.3)
    hitStopMin: 0.035,          // 35 ms (§6 Impact)
    hitStopMax: 0.065,          // 65 ms
    finalEnemySlow: 0.35,       // time slows on decisive impact (§6 Final enemy)
    finalCamTrack: 1.2,         // s max camera track (§6)
    comboMilestones: [5, 10, 20, 35, 50], // §6 Impact typography
  };

  // Damage / combo (§5.5)
  const COMBAT = {
    basePower: 10,              // Pogo base impact damage
    velocityFloor: 0.65,
    velocityCeil: 1.30,
    comboPerHit: 0.04,
    comboMaxCount: 15,          // cap contribution: 1 + 0.04*min(c-1,15)
    critChanceBase: 0.0,
    critMult: 1.6,
  };

  // Squad (§5.2)
  const SQUAD = {
    size: 3,
    startCourage: 100,
    poplingRadius: 26,
    restTurns: 1,               // Resting for one player turn (§5.2)
    popEveryShots: 3,           // POP availability once per Popling per 3 squad shots (§5.3)
  };

  // POP ability tuning (Pogo: Second Wind — instant mid-flight impulse) (§7)
  const POP = {
    impulseFrac: 0.6,           // adds ~60% of current launch speed toward facing
    minSpeedForPop: 120,        // can only pop if still moving
    flashColor: '#ffd166',
  };

  // Defaults persisted settings
  const DEFAULT_SETTINGS = {
    masterVolume: 0.8,
    musicVolume: 0.5,
    sfxVolume: 0.9,
    haptics: true,
    screenShake: 0.7,
    reducedFlashes: false,
    reducedMotion: false,
    colorBlind: 'off',          // off | patterns
    leftHanded: false,
    aimAssist: true,            // extended preview (accessibility mode, §5.3)
    batterySaver: false,        // 30 FPS mode (§18)
  };

  global.PP_Config = {
    VIEW, ARENA, HUD_H, BAND_H,
    PHYS, AIM, TIMING, COMBAT, SQUAD, POP,
    DEFAULT_SETTINGS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
