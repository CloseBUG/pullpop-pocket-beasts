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
    // ---- Extended roster (blueprint §7) ----
    volty: {
      id: 'volty', name: 'Volty', role: 'Chain / multi-target',
      color: '#ffe066', color2: '#fff5b0', accent: '#7a6a1a',
      element: 'shock',
      passive: 'First hit marks an enemy as Conductive.',
      passiveId: 'conductive',
      pop: { id: 'zip_zap', name: 'Zip Zap', desc: 'Lightning chains between nearby marked units.' },
      personality: 'Talks too quickly.',
      power: 8,
    },
    pebblit: {
      id: 'pebblit', name: 'Pebblit', role: 'Armor break / heavy',
      color: '#cfd6e6', color2: '#eef2f8', accent: '#3a4258',
      element: 'brk',
      passive: 'High mass; loses less speed through armored enemies.',
      passiveId: 'heavy',
      pop: { id: 'ground_pound', name: 'Ground Pound', desc: 'Stops and sends a Break shockwave.' },
      personality: 'Serious tiny rock.',
      power: 13,
    },
    bubloo: {
      id: 'bubloo', name: 'Bubloo', role: 'Redirect / safety',
      color: '#7fc7ff', color2: '#c6e6ff', accent: '#1f4a7a',
      element: 'none',
      passive: 'Creates a bubble after every third Buddy hit.',
      passiveId: 'bubbley',
      pop: { id: 'bubble_gate', name: 'Bubble Gate', desc: 'Places a temporary redirect portal.' },
      personality: 'Curious and easily distracted.',
      power: 9,
    },
    glim: {
      id: 'glim', name: 'Glim', role: 'Precision / critical',
      color: '#ff7b9c', color2: '#ffc4d8', accent: '#7a1f4a',
      element: 'mark',
      passive: 'Consecutive unique-target hits increase critical chance.',
      passiveId: 'precise',
      pop: { id: 'prism_cut', name: 'Prism Cut', desc: 'Next collision passes through the target.' },
      personality: 'Dramatic performer.',
      power: 10,
    },
    nox: {
      id: 'nox', name: 'Nox', role: 'Teleport / risk',
      color: '#9b6fc0', color2: '#d4bfff', accent: '#3a1f6a',
      element: 'none',
      passive: 'Hitting a marked target relocates Nox behind it.',
      passiveId: 'phase',
      pop: { id: 'lights_out', name: 'Lights Out', desc: 'Marks all enemies but removes trajectory preview.' },
      personality: 'Shy prankster.',
      power: 10,
    },
    magnetot: {
      id: 'magnetot', name: 'Magnetot', role: 'Formation / setup',
      color: '#a8a8b8', color2: '#d8d8e0', accent: '#2a2a38',
      element: 'none',
      passive: 'Slightly attracts loose metal objects during motion.',
      passiveId: 'magnetic',
      pop: { id: 'polar_flip', name: 'Polar Flip', desc: 'Reverses magnetic pull and launches objects outward.' },
      personality: 'Collector of junk.',
      power: 9,
    },
    chime: {
      id: 'chime', name: 'Chime', role: 'Rhythm / score',
      color: '#5ec8e0', color2: '#a8e6f0', accent: '#0f3a4a',
      element: 'none',
      passive: 'Well-timed POP produces a Perfect note and extra combo.',
      passiveId: 'rhythmic',
      pop: { id: 'encore', name: 'Encore', desc: 'Repeats the previous Buddy effect at reduced power.' },
      personality: 'Communicates by melody.',
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
      intent: 'locked', intentRange: 120, intentDamage: 5, moveAfter: false,
      lesson: 'Read a locked zone.',
    },
    pinprick: {
      id: 'pinprick', name: 'Pinprick',
      color: '#ff9eb0', color2: '#ffd0db', accent: '#7a1f33',
      hp: 10, armor: 0, radius: 22,
      intent: 'tracking', intentRange: 9999, intentDamage: 5, moveAfter: false,
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
      intent: 'charge', intentRange: 0, intentDamage: 7, moveAfter: false,
      lesson: 'Reposition and exploit hazards.',
    },
    mumbler: {
      id: 'mumbler', name: 'Mumbler',
      color: '#b0a26b', color2: '#e3d8a8', accent: '#5e521a',
      hp: 18, armor: 0, radius: 28,
      intent: 'countdown', intentRange: 0, intentDamage: 6, moveAfter: false, countdown: 3, weaken: 0.10,
      lesson: 'Target priority.',
    },
    // ---- Extended family (blueprint §10) ----
    puffer: {
      id: 'puffer', name: 'Puffer',
      color: '#ff8c42', color2: '#ffc8a0', accent: '#7a3f10',
      hp: 14, armor: 0, radius: 24,
      intent: 'puffer', intentRange: 0, intentDamage: 10, moveAfter: false,
      // Inflates when struck repeatedly, then explodes. Control combo order (§10).
      inflateThreshold: 3, explodeDamage: 18, explodeRadius: 100,
      lesson: 'Control combo order — don\u2019t over-hit.',
    },
    sticky: {
      id: 'sticky', name: 'Sticky',
      color: '#7fd6a0', color2: '#c6f0d4', accent: '#1f5e3a',
      hp: 16, armor: 0, radius: 26,
      intent: 'sticky', intentRange: 0, intentDamage: 4, moveAfter: false,
      // Leaves slowing patches each turn. Route planning (§10).
      patchSlow: 0.5, patchRadius: 70, patchLife: 2,
      lesson: 'Route planning around slowing patches.',
    },
    snatcher: {
      id: 'snatcher', name: 'Snatcher',
      color: '#c080ff', color2: '#e4c8ff', accent: '#4a1f7a',
      hp: 20, armor: 1, radius: 28,
      intent: 'snatcher', intentRange: 0, intentDamage: 0, moveAfter: false,
      // Temporarily disables one arena object. Adaptation (§10).
      disableDuration: 2,
      lesson: 'Adapt when arena objects are disabled.',
    },
    tether: {
      id: 'tether', name: 'Tether Twins',
      color: '#ff6b9d', color2: '#ffc4d8', accent: '#7a1f4a',
      hp: 12, armor: 0, radius: 22,
      intent: 'tether', intentRange: 0, intentDamage: 6, moveAfter: false,
      // Shares damage while linked — hit both simultaneously for efficiency (§10).
      linkRadius: 200, sharedDamage: 0.5,
      lesson: 'Geometry and simultaneous setup.',
    },
  };

  // Elite modifiers (§10). One used early.
  const ELITE_MODS = {
    armored: { name: 'Armored', armor: 6, color: '#cfd6e6' },
    restless: { name: 'Restless', moveAfter: true, color: '#e67fb0' },
    unstable: { name: 'Unstable', explodeOnDeath: 90, color: '#ff7b6b' },
  };

  // ---- Boss: Grumble Hoover (blueprint §11 World 1) ----
  // A hungry vacuum creature that pulls units toward a telegraphed mouth cone.
  // Players knock heavy objects to clog it, then ricochet into exposed filters.
  // Phase 0 simplified: boss has a "mouth" (vulnerable front) and "filters" (weak points).
  const BOSSES = {
    grumble_hoover: {
      id: 'grumble_hoover', name: 'Grumble Hoover',
      color: '#8b6fc0', color2: '#d4bfff', accent: '#3a1f6a',
      hp: 140, radius: 56, armor: 2,
      // The boss cycles phases: SHIELDING (mouth closed, armored) -> EXPOSED (mouth open, vulnerable).
      phaseDuration: 2.5, // turns shielded before exposing
      mouthCone: 1.6,      // arc of the "mouth" pull cone (radians)
      pullStrength: 280,   // how hard it pulls the popling toward the mouth when shielded
      intentDamage: 12,    // vacuum suck damage when shielded
      lesson: 'Clog the mouth, then strike the exposed filters.',
      // Weak points: 3 filter nodes around the body; hitting one when EXPOSED deals big damage.
      filters: 3,
      filterHp: 20,
      exposedDamageMult: 2.5, // bonus damage when boss is in EXPOSED phase
    },
    // ---- Boss: Chef Char (blueprint §11 World 2 — Ember Pantry) ----
    // Plates hot zones in patterns; striking hanging pans interrupts the finishing attack.
    // Phase 0 simplified: cycles COOKING (spawns burner hazards) <-> STUNNED (pans hit).
    chef_char: {
      id: 'chef_char', name: 'Chef Char',
      color: '#ff5a3a', color2: '#ffb085', accent: '#7a1f0a',
      hp: 160, radius: 54, armor: 2,
      phaseDuration: 3,    // turns cooking before vulnerable
      intentDamage: 11,
      // Spawns 2 burner hot-zone objects each cooking turn that damage poplings standing on them.
      burnersPerTurn: 2, burnerDamage: 7, burnerRadius: 70,
      // When STUNNED (after pans struck), takes heavy damage.
      exposedDamageMult: 2.2,
      lesson: 'Strike the hanging pans to interrupt the chef\u2019s finishing attack.',
    },
    // ---- Boss: Tanktopus (blueprint §11 World 3 — Bubbleworks) ----
    // Arms divide the arena. Players pop pressure bubbles in the correct sequence
    // to rotate the arms and expose its center.
    // Phase 0 simplified: GUARDED (armored, arms block) <-> EXPOSED (center open).
    tanktopus: {
      id: 'tanktopus', name: 'Tanktopus',
      color: '#5ec8e0', color2: '#a8e6f0', accent: '#0f3a4a',
      hp: 180, radius: 60, armor: 3,
      phaseDuration: 3,
      intentDamage: 12,
      // Spawns pressure-bubble objects each guarded turn that must be popped to expose.
      bubblesPerTurn: 3, bubbleHp: 8,
      // Tidal surge: damages all poplings each guarded turn.
      surgeDamage: 8,
      exposedDamageMult: 2.3,
      lesson: 'Pop the pressure bubbles in sequence to expose the center.',
    },
    // ---- Boss: The Snooze (blueprint §11 World 4 — Clockwork Cloud) ----
    // A giant alarm clock that steals one upcoming turn. Striking clock hands
    // changes when attacks resolve; perfect timing wakes sleeping bumpers.
    // Phase 0 simplified: TICKING (armored, charges attack) <-> RINGING (vulnerable).
    the_snooze: {
      id: 'the_snooze', name: 'The Snooze',
      color: '#b0a8d0', color2: '#e0daf0', accent: '#3a2f5a',
      hp: 200, radius: 58, armor: 3,
      phaseDuration: 3,
      intentDamage: 13,
      // Each ticking turn, advances a countdown; at zero, "steals a turn" (extra damage).
      stealThreshold: 3, stealDamage: 15,
      // Spawns a "clock hand" gear object each turn that must be struck to reset timing.
      gearsPerTurn: 2, gearHp: 6,
      exposedDamageMult: 2.3,
      lesson: 'Strike the clock hands to reset the alarm before it rings.',
    },
    // ---- Boss: The Hush Regent (blueprint §11 World 5 — Velvet Void) ----
    // A three-act encounter that disables one familiar affordance per phase:
    // Act 1 disables sound cue, Act 2 disables trajectory extension,
    // Act 3 disables color (icons/patterns remain). Beaten by Buddy chains.
    // Phase 0 simplified: HUSHING (armored, drains color) <-> VULNERABLE.
    the_hush_regent: {
      id: 'the_hush_regent', name: 'The Hush Regent',
      color: '#8a8aa0', color2: '#c0c0d0', accent: '#1a1a2a',
      hp: 240, radius: 62, armor: 4,
      phaseDuration: 3,
      intentDamage: 14,
      // Drains Courage each hushing turn (the "Hush" spreading).
      drainDamage: 9,
      // Exposed only by Buddy chains — requires touching 2+ allies this shot.
      exposedDamageMult: 2.5,
      lesson: 'Create unpredictable Buddy chains to break the Hush.',
    },
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
    { id: 'secret_handshake', name: 'Secret Handshake', family: 'Buddy', rarity: 'rare', desc: 'Alternating the same two Poplings escalates Buddy power.', icon: '🤝', tags: ['buddy','escalate'], hook: 'secret_handshake' },
    { id: 'group_photo', name: 'Group Photo', family: 'Buddy', rarity: 'rare', desc: 'Ending all three Poplings close together grants a temporary aura.', icon: '📸', tags: ['buddy','aura'], hook: 'group_photo' },
    // Precision
    { id: 'called_shot', name: 'Called Shot', family: 'Precision', rarity: 'common', desc: 'First enemy hit matches the preview and gains +25% damage.', icon: '🎯', tags: ['precision','damage'], hook: 'called_shot' },
    { id: 'bank_shot', name: 'Bank Shot', family: 'Precision', rarity: 'common', desc: 'First enemy hit after a wall is guaranteed critical.', icon: '🏦', tags: ['precision','crit'], hook: 'bank_shot' },
    { id: 'long_distance', name: 'Long Distance', family: 'Precision', rarity: 'common', desc: 'Damage increases with travel distance before first enemy contact.', icon: '📏', tags: ['precision','damage'], hook: 'long_distance' },
    { id: 'clean_entrance', name: 'Clean Entrance', family: 'Precision', rarity: 'rare', desc: 'Hitting an enemy before touching a wall creates shield (+8).', icon: '🛡️', tags: ['precision','shield'], hook: 'clean_entrance' },
    // Element (§9 #13-18)
    { id: 'spicy_corners', name: 'Spicy Corners', family: 'Element', rarity: 'common', desc: 'Wall hits add one Burn to the next enemy struck.', icon: '🔥', tags: ['element','burn'], hook: 'spicy_corners' },
    { id: 'cold_snap', name: 'Cold Snap', family: 'Element', rarity: 'common', desc: 'First Chill each turn also slows nearby enemies.', icon: '❄️', tags: ['element','chill'], hook: 'cold_snap' },
    { id: 'parallel_circuit', name: 'Parallel Circuit', family: 'Element', rarity: 'common', desc: 'Shock may chain through a Buddy.', icon: '⚡', tags: ['element','shock'], hook: 'parallel_circuit' },
    { id: 'wild_garden', name: 'Wild Garden', family: 'Element', rarity: 'rare', desc: 'Bloom bumpers grow larger after being struck.', icon: '🌿', tags: ['element','bloom'], hook: 'wild_garden' },
    { id: 'fault_line', name: 'Fault Line', family: 'Element', rarity: 'common', desc: 'Break shockwaves travel through breakable objects.', icon: '🌋', tags: ['element','break'], hook: 'fault_line' },
    { id: 'spotlight', name: 'Spotlight', family: 'Element', rarity: 'rare', desc: 'Defeating a Marked target marks the farthest enemy.', icon: '🔦', tags: ['element','mark'], hook: 'spotlight' },
    // Precision continued (§9 #19-24)
    { id: 'thread_the_needle', name: 'Thread the Needle', family: 'Precision', rarity: 'common', desc: 'Passing close to an enemy charges POP faster.', icon: '🪡', tags: ['precision','pop'], hook: 'thread_the_needle' },
    { id: 'perfect_pause', name: 'Perfect Pause', family: 'Precision', rarity: 'rare', desc: 'Triggering POP inside a timing window briefly slows motion.', icon: '⏸️', tags: ['precision','slowmo'], hook: 'perfect_pause' },
    { id: 'soft_landing', name: 'Soft Landing', family: 'Bounce', rarity: 'common', desc: 'Ending a shot beside an ally grants shield (+6).', icon: '🛬', tags: ['bounce','shield'], hook: 'soft_landing' },
    { id: 'round_trip', name: 'Round Trip', family: 'Bounce', rarity: 'common', desc: 'Returning near the start point refunds part of POP charge.', icon: '🔄', tags: ['bounce','pop'], hook: 'round_trip' },
    // Swarm (§9 #25-30)
    { id: 'pocket_echo', name: 'Pocket Echo', family: 'Swarm', rarity: 'common', desc: 'First POP creates a harmless echo that can trigger objects.', icon: '🔔', tags: ['swarm','echo'], hook: 'pocket_echo' },
    { id: 'loose_change', name: 'Loose Change', family: 'Swarm', rarity: 'common', desc: 'Breakables release bouncing coins that deal tiny impact damage.', icon: '🪙', tags: ['swarm','coins'], hook: 'loose_change' },
    { id: 'mini_me', name: 'Mini Me', family: 'Swarm', rarity: 'rare', desc: 'Every 20th combo spawns a one-hit miniature Popling.', icon: '🐣', tags: ['swarm','minion'], hook: 'mini_me' },
    { id: 'fireflies', name: 'Fireflies', family: 'Swarm', rarity: 'common', desc: 'Healing releases seeking lights that apply Mark.', icon: '✨', tags: ['swarm','mark'], hook: 'fireflies' },
    { id: 'afterimage', name: 'Afterimage', family: 'Swarm', rarity: 'common', desc: 'Critical hits leave a delayed impact ghost.', icon: '👻', tags: ['swarm','ghost'], hook: 'afterimage' },
    { id: 'party_crashers', name: 'Party Crashers', family: 'Swarm', rarity: 'common', desc: 'Entering a new room begins with two neutral bumpers.', icon: '🎉', tags: ['swarm','bumpers'], hook: 'party_crashers' },
    // Courage (§9 #31-36)
    { id: 'brave_face', name: 'Brave Face', family: 'Courage', rarity: 'common', desc: 'Below 30 Courage, first hit each turn grants shield.', icon: '😤', tags: ['courage','shield'], hook: 'brave_face' },
    { id: 'close_call', name: 'Close Call', family: 'Courage', rarity: 'common', desc: 'Leaving an intent zone during the shot heals one Courage.', icon: '😮‍💨', tags: ['courage','heal'], hook: 'close_call' },
    { id: 'overprotective', name: 'Overprotective', family: 'Courage', rarity: 'common', desc: 'Excess healing becomes a capped shield.', icon: '🫂', tags: ['courage','shield'], hook: 'overprotective' },
    { id: 'last_laugh', name: 'Last Laugh', family: 'Courage', rarity: 'rare', desc: 'Once per room, lethal damage leaves one Courage.', icon: '😈', tags: ['courage','survive'], hook: 'last_laugh' },
    { id: 'belly_flop', name: 'Belly Flop', family: 'Courage', rarity: 'common', desc: 'Heavier Poplings gain power based on current shield.', icon: '🤰', tags: ['courage','damage'], hook: 'belly_flop' },
    { id: 'all_in', name: 'All In', family: 'Courage', rarity: 'rare', desc: 'Lose trajectory preview; gain damage and double score.', icon: '🃏', tags: ['courage','risk'], hook: 'all_in' },
  ];

  // ---- Worlds (§11) — Phase 0 greybox single arena; flavor only. ----
  const WORLDS = {
    jellyyard: { id: 'jellyyard', name: 'Jellyyard', theme: 'garden of lost lunchboxes', color: '#7be0a8', floor: '#23334a' },
    ember_pantry: { id: 'ember_pantry', name: 'Ember Pantry', theme: 'an impossible kitchen inside a coat pocket', color: '#ff8c42', floor: '#3a2317' },
    bubbleworks: { id: 'bubbleworks', name: 'Bubbleworks', theme: 'a flooded workshop inside a glass marble', color: '#5ec8e0', floor: '#173040' },
    clockwork_cloud: { id: 'clockwork_cloud', name: 'Clockwork Cloud', theme: 'a weather factory built from lost watches', color: '#b0a8d0', floor: '#241f3a' },
    velvet_void: { id: 'velvet_void', name: 'Velvet Void', theme: 'a quiet theatre where color has almost vanished', color: '#8a8aa0', floor: '#15151f' },
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
    POPLINGS, ENEMIES, ELITE_MODS, BOSSES, AUGMENTS, WORLDS, STATUSES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
