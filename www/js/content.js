/* content.js — data-driven content definitions (blueprint §26).
   Poplings (§7), enemies (§10), augments (§9), worlds (§11). Phase-0 scope. */
(function (global) {
  'use strict';

  // ---- Poplings (§7) ----
  // Phase 0 roster scope: Pogo only for feel; we also include Cinder & Mosslug
  // (vertical-slice trio) so the squad + buddy system is demonstrable.
  const POPLINGS = {
    pogo: {
      id: 'pogo', name: 'Pogo', role: 'Combo / control',
      color: '#ffb020', color2: '#ffe08a', accent: '#7a4d00',
      element: 'none',
      passive: 'First wall rebound each shot preserves extra speed (+8% kept).',
      passiveId: 'springy',
      pop: { id: 'second_wind', name: 'Second Wind', desc: 'Instant mid-flight impulse toward current direction.' },
      personality: 'Fearless, fails upward.',
      power: 10,
    },
    cinder: {
      id: 'cinder', name: 'Cinder', role: 'Burn / burst',
      color: '#ff6b4a', color2: '#ffb199', accent: '#7a1f0a',
      element: 'burn',
      passive: 'Direct hits add 1 Burn to the enemy.',
      passiveId: 'ignite',
      pop: { id: 'flash_roast', name: 'Flash Roast', desc: 'Detonate Burn on all enemies (does not consume all stacks).' },
      personality: 'Competitive kitchen gremlin.',
      power: 9,
    },
    mosslug: {
      id: 'mosslug', name: 'Mosslug', role: 'Sustain / terrain',
      color: '#7be0a8', color2: '#c6f5d8', accent: '#1f5e3a',
      element: 'bloom',
      passive: 'Buddy collisions plant healing Moss (+3 Courage).',
      passiveId: 'mossy',
      pop: { id: 'spring_bed', name: 'Spring Bed', desc: 'Create a soft bumper that heals the next ally it touches.' },
      personality: 'Sleepy caretaker.',
      power: 9,
    },
  };

  // ---- Enemies (§10) ----
  // Phase-0 family subset. intent in {locked, tracking, charge, countdown, guard}.
  const ENEMIES = {
    dumpling: {
      id: 'dumpling', name: 'Dumpling Dull',
      color: '#9b8cf0', color2: '#c9c0ff', accent: '#3a2e7a',
      hp: 12, armor: 0, radius: 28,
      intent: 'locked', intentRange: 120, intentDamage: 6, moveAfter: false,
      lesson: 'Read a locked zone.',
    },
    pinprick: {
      id: 'pinprick', name: 'Pinprick',
      color: '#ff9eb0', color2: '#ffd0db', accent: '#7a1f33',
      hp: 10, armor: 0, radius: 22,
      intent: 'tracking', intentRange: 9999, intentDamage: 6, moveAfter: false,
      lesson: 'Break line of sight or interrupt.',
    },
    braceface: {
      id: 'braceface', name: 'Braceface',
      color: '#7fc7ff', color2: '#c6e6ff', accent: '#1f4a7a',
      hp: 20, armor: 4, radius: 32,
      intent: 'guard', intentRange: 0, intentDamage: 0, moveAfter: false, guardArc: 2.4, guardRadius: 160,
      lesson: 'Attack from behind or use Break.',
    },
    shoveler: {
      id: 'shoveler', name: 'Shoveler',
      color: '#c9a26b', color2: '#ecd0a8', accent: '#5e3f1a',
      hp: 16, armor: 2, radius: 28,
      intent: 'charge', intentRange: 0, intentDamage: 8, moveAfter: false,
      lesson: 'Reposition and exploit hazards.',
    },
    mumbler: {
      id: 'mumbler', name: 'Mumbler',
      color: '#b0a26b', color2: '#e3d8a8', accent: '#5e521a',
      hp: 18, armor: 0, radius: 28,
      intent: 'countdown', intentRange: 0, intentDamage: 6, moveAfter: false, countdown: 3, weaken: 0.10,
      lesson: 'Target priority.',
    },
  };

  // Elite modifiers (§10). One used early.
  const ELITE_MODS = {
    armored: { name: 'Armored', armor: 6, color: '#cfd6e6' },
    restless: { name: 'Restless', moveAfter: true, color: '#e67fb0' },
    unstable: { name: 'Unstable', explodeOnDeath: 90, color: '#ff7b6b' },
  };

  // ---- Augments (§9) — Phase 0: 12 across Bounce / Buddy / Precision ----
  // Each: id, name, family, rarity(common/rare), desc, tags (build identity), apply hook name.
  const AUGMENTS = [
    // Bounce
    { id: 'fresh_paint', name: 'Fresh Paint', family: 'Bounce', rarity: 'common', desc: 'First wall rebound adds +15% speed.', icon: '🟠', tags: ['bounce','speed'], hook: 'fresh_paint' },
    { id: 'corner_pocket', name: 'Corner Pocket', family: 'Bounce', rarity: 'common', desc: 'Hitting two different walls before an enemy applies Mark.', icon: '📐', tags: ['bounce','mark'], hook: 'corner_pocket' },
    { id: 'rubber_soul', name: 'Rubber Soul', family: 'Bounce', rarity: 'rare', desc: 'Every 5th collision creates a small shockwave.', icon: '💥', tags: ['bounce','aoe'], hook: 'rubber_soul' },
    { id: 'no_brakes', name: 'No Brakes', family: 'Bounce', rarity: 'common', desc: 'Impact damage gains power while above normal launch speed.', icon: '⚡', tags: ['bounce','speed'], hook: 'no_brakes' },
    // Buddy
    { id: 'high_five', name: 'High Five', family: 'Buddy', rarity: 'common', desc: 'First Buddy hit each shot deals area damage.', icon: '🙌', tags: ['buddy','aoe'], hook: 'high_five' },
    { id: 'pass_it_on', name: 'Pass It On', family: 'Buddy', rarity: 'common', desc: 'Buddy hit transfers one positive status.', icon: '🔄', tags: ['buddy','status'], hook: 'pass_it_on' },
    { id: 'wake_up', name: 'Wake-Up Call', family: 'Buddy', rarity: 'common', desc: 'Hitting a resting ally makes it Ready next turn.', icon: '⏰', tags: ['buddy','ready'], hook: 'wake_up' },
    { id: 'threes_company', name: 'Three\u2019s Company', family: 'Buddy', rarity: 'rare', desc: 'Touching both allies in one shot heals Courage (+10).', icon: '💛', tags: ['buddy','heal'], hook: 'threes_company' },
    // Precision
    { id: 'called_shot', name: 'Called Shot', family: 'Precision', rarity: 'common', desc: 'First enemy hit matches the preview and gains +25% damage.', icon: '🎯', tags: ['precision','damage'], hook: 'called_shot' },
    { id: 'bank_shot', name: 'Bank Shot', family: 'Precision', rarity: 'common', desc: 'First enemy hit after a wall is guaranteed critical.', icon: '🏦', tags: ['precision','crit'], hook: 'bank_shot' },
    { id: 'long_distance', name: 'Long Distance', family: 'Precision', rarity: 'common', desc: 'Damage increases with travel distance before first enemy contact.', icon: '📏', tags: ['precision','damage'], hook: 'long_distance' },
    { id: 'clean_entrance', name: 'Clean Entrance', family: 'Precision', rarity: 'rare', desc: 'Hitting an enemy before touching a wall creates shield (+8).', icon: '🛡️', tags: ['precision','shield'], hook: 'clean_entrance' },
  ];

  // ---- Worlds (§11) — Phase 0 greybox single arena; flavor only. ----
  const WORLDS = {
    jellyyard: { id: 'jellyyard', name: 'Jellyyard', theme: 'garden of lost lunchboxes', color: '#7be0a8', floor: '#23314a' },
  };

  // ---- Status effects (§8) ----
  const STATUSES = {
    burn: { id: 'burn', name: 'Burn', color: '#ff7b3a', icon: '🔥', perTurn: 4, maxStacks: 5 },
    chill: { id: 'chill', name: 'Chill', color: '#7fc7ff', icon: '❄️' },
    shock: { id: 'shock', name: 'Shock', color: '#ffe066', icon: '⚡' },
    bloom: { id: 'bloom', name: 'Bloom', color: '#7be0a8', icon: '🌿' },
    brk: { id: 'brk', name: 'Break', color: '#cfd6e6', icon: '🛡️', armorPen: 4 },
    mark: { id: 'mark', name: 'Mark', color: '#ff7b9c', icon: '◆', critBonus: 1, scoreBonus: 1 },
  };

  global.PP_Content = {
    POPLINGS, ENEMIES, ELITE_MODS, AUGMENTS, WORLDS, STATUSES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
