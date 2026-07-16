/* ui.js — DOM overlay UI: screens, settings, augment cards, result/end.
   Wired by main.js. Blueprint §18 UX & screen map. */
(function (global) {
  'use strict';

  const $ = (sel) => { try { return document.querySelector(sel); } catch (e) { return null; } };
  const $$ = (sel) => { try { return Array.from(document.querySelectorAll(sel)); } catch (e) { return []; } };
  // null-safe property setter
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const setHTML = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };

  let game = null;
  let toastTimer = null;

  function init(g) {
    game = g;
    bindTitle();
    bindPause();
    bindSquadUI();
    buildSettingsList();
  }

  function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
  function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
  function hideAll() {
    ['screen-title', 'screen-howto', 'screen-pause', 'screen-settings', 'screen-augment', 'screen-result', 'screen-end']
      .forEach(hide);
  }

  // ---- Title ----
  function bindTitle() {
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on('#btn-start', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      game.isDaily = false; game.isWild = false; game.isTower = false; game.isPlayground = false;
      showSquadSelect('journey');
    });
    on('#btn-daily', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      hideAll(); game.startDaily();
    });
    on('#btn-wild', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      showSquadSelect('wild');
    });
    on('#btn-tower', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      showSquadSelect('tower');
    });
    on('#btn-playground', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      showSquadSelect('playground');
    });
    on('#btn-sanctuary', 'click', () => { PP_Audio.uiClick(); showSanctuary(); });
    on('#btn-sanctuary-back', 'click', () => { PP_Audio.uiBack(); hideAll(); show('screen-title'); });
    on('#btn-wardrobe-open', 'click', () => { PP_Audio.uiClick(); showWardrobe(); });
    on('#btn-share', 'click', () => { PP_Audio.uiClick(); showShare(); });
    on('#btn-share-back', 'click', () => { PP_Audio.uiBack(); hideAll(); show('screen-title'); });
    on('#btn-share-copy', 'click', () => {
      PP_Audio.uiClick();
      const inp = document.getElementById('share-code-input');
      if (inp && inp.select) { inp.select(); document.execCommand && document.execCommand('copy'); PP_UI.toast('Code copied!'); }
    });
    on('#btn-share-load', 'click', () => {
      PP_Audio.uiClick();
      const code = (document.getElementById('share-code-load') || {}).value || '';
      if (!code.trim()) { PP_UI.toast('Enter a code first'); return; }
      const ok = game.startFromShareCode(code);
      if (ok) { hideAll(); }
      else { PP_Audio.bad(); PP_UI.toast('Invalid code'); }
    });
    on('#btn-wardrobe-back', 'click', () => { PP_Audio.uiBack(); hideAll(); show('screen-sanctuary'); });
    on('#btn-howto', 'click', () => { PP_Audio.uiClick(); hideAll(); show('screen-howto'); });
    on('#btn-howto-back', 'click', () => { PP_Audio.uiBack(); hideAll(); show('screen-title'); });
    // Show today's daily code on the title button.
    const dailyDateEl = document.getElementById('daily-date');
    if (dailyDateEl && typeof PP_Game !== 'undefined') {
      dailyDateEl.textContent = '#' + PP_Game.dailyCode();
    }
  }

  function showTitle() { hideAll(); show('screen-title'); }

  // ---- Squad selection (blueprint §5.2: bring exactly three Poplings) ----
  let pendingMode = 'journey';
  let selectedIds = ['pogo', 'cinder', 'mosslug'];

  function showSquadSelect(mode) {
    pendingMode = mode;
    if (!selectedIds || selectedIds.length !== 3) selectedIds = ['pogo', 'cinder', 'mosslug'];
    hideAll(); show('screen-squad');
    const cont = document.getElementById('squad-cards');
    if (!cont) return;
    cont.innerHTML = '';
    const all = PP_Content.POPLINGS;
    Object.keys(all).forEach((id) => {
      const def = all[id];
      const card = document.createElement('div');
      const isSelected = selectedIds.includes(id);
      card.className = 'aug-card' + (isSelected ? ' rare' : '');
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="ac-head">
          <div class="ac-icon" style="background:${def.color};color:#fff;">●</div>
          <div>
            <div class="ac-name">${def.name}</div>
            <div class="ac-family">${def.role}</div>
          </div>
        </div>
        <div class="ac-desc"><b>Passive:</b> ${def.passive}<br><b>POP:</b> ${def.pop.name} — ${def.pop.desc}</div>`;
      card.addEventListener('click', () => {
        PP_Audio.uiClick();
        const idx = selectedIds.indexOf(id);
        if (idx >= 0) {
          if (selectedIds.length <= 1) { PP_UI.toast('Need at least 1 Popling'); return; }
          selectedIds.splice(idx, 1);
        } else {
          if (selectedIds.length >= 3) { PP_UI.toast('Squad full (3/3)'); return; }
          selectedIds.push(id);
        }
        showSquadSelect(pendingMode); // refresh
      });
      cont.appendChild(card);
    });
  }
  function bindSquadUI() {
    const el = document.getElementById('btn-squad-confirm');
    if (el) el.addEventListener('click', () => {
      PP_Audio.uiClick();
      game.selectedSquad = selectedIds.slice(0, 3);
      hideAll();
      if (pendingMode === 'journey') game.startRun();
      else if (pendingMode === 'wild') game.startWildPocket();
      else if (pendingMode === 'tower') game.startWeeklyTower();
      else if (pendingMode === 'playground') game.startPlayground();
      else game.startRun();
    });
  }

  // ---- Sanctuary (blueprint §14) ----
  const SANCTUARY_ROOMS = [
    { id: 'launch_lawn', name: 'Launch Lawn', icon: '🌱', desc: 'Squad selection. Poplings practice bouncing.' },
    { id: 'tinker_cart', name: 'Tinker Cart', icon: '🛒', desc: 'One run reroll. Tinkerer animations and props.' },
    { id: 'cozy_nook', name: 'Cozy Nook', icon: '🛏️', desc: 'Friendship quests. Favorite Popling sleeps and reacts.' },
    { id: 'replay_pond', name: 'Replay Pond', icon: '🎞️', desc: 'Replay and sharing. Memories appear as reflections.' },
    { id: 'wardrobe_tent', name: 'Wardrobe Tent', icon: '👗', desc: 'Cosmetic preview. Characters model owned items.' },
    { id: 'festival_dock', name: 'Festival Dock', icon: '🎉', desc: 'Seasonal events. Shows upcoming visitors and decorations.' },
  ];

  function showSanctuary() {
    hideAll(); show('screen-sanctuary');
    setText('#sanctuary-sparks', '✨ Sparks: ' + game.sparks);
    // Rooms
    const roomsEl = document.getElementById('sanctuary-rooms');
    if (roomsEl) {
      roomsEl.innerHTML = '';
      for (const r of SANCTUARY_ROOMS) {
        const owned = game.sanctuaryRooms.includes(r.id);
        const cost = game.sanctuaryRoomCost(r.id);
        const card = document.createElement('div');
        card.className = 'aug-card' + (owned ? ' rare' : '');
        card.innerHTML = `
          <div class="ac-head">
            <div class="ac-icon">${r.icon}</div>
            <div>
              <div class="ac-name">${r.name}</div>
              <div class="ac-family">${owned ? 'RESTORED' : '✨ ' + cost}</div>
            </div>
          </div>
          <div class="ac-desc">${r.desc}</div>`;
        if (!owned) {
          card.addEventListener('click', () => {
            const res = game.buySanctuaryRoom(r.id);
            if (res.ok) { PP_Audio.good(); PP_UI.toast(r.name + ' restored!'); }
            else { PP_Audio.bad(); PP_UI.toast(res.reason); }
            showSanctuary(); // refresh
          });
        }
        roomsEl.appendChild(card);
      }
    }
    // Friendship
    const fEl = document.getElementById('sanctuary-friendship');
    if (fEl) {
      fEl.innerHTML = '';
      const all = PP_Content.POPLINGS;
      Object.keys(all).forEach((id) => {
        const def = all[id];
        const lvl = game.friendship[id] || 1;
        const card = document.createElement('div');
        card.className = 'aug-card';
        card.innerHTML = `
          <div class="ac-head">
            <div class="ac-icon" style="background:${def.color};color:#fff;">●</div>
            <div>
              <div class="ac-name">${def.name}</div>
              <div class="ac-family">Friendship Lv ${lvl}/10</div>
            </div>
          </div>
          <div class="ac-desc">${'★'.repeat(lvl)}${'☆'.repeat(10 - lvl)}</div>`;
        fEl.appendChild(card);
      });
    }
  }

  // ---- Wardrobe (blueprint §16 cosmetics, §19) ----
  function showWardrobe() {
    hideAll(); show('screen-wardrobe');
    setText('#wardrobe-sparks', '✨ Sparks: ' + game.sparks);
    const cont = document.getElementById('wardrobe-cosmetics');
    if (!cont) return;
    cont.innerHTML = '';
    const all = PP_Content.COSMETICS || [];
    all.forEach((c) => {
      const owned = game.ownedCosmetics.includes(c.id);
      const equipped = (c.type === 'palette' && game.equippedCosmetics[c.popling] === c.id)
                    || (c.type === 'trail' && game.equippedCosmetics.trail === c.id);
      const card = document.createElement('div');
      card.className = 'aug-card' + (equipped ? ' rare' : '');
      const poplingName = c.popling ? PP_Content.POPLINGS[c.popling].name : 'All';
      card.innerHTML = `
        <div class="ac-head">
          <div class="ac-icon" style="background:${c.color || '#888'};color:#fff;">●</div>
          <div>
            <div class="ac-name">${c.name}</div>
            <div class="ac-family">${c.type.toUpperCase()} · ${poplingName}</div>
          </div>
        </div>
        <div class="ac-desc">${equipped ? 'EQUIPPED' : owned ? 'Tap to equip' : '✨ ' + c.cost}</div>`;
      card.addEventListener('click', () => {
        PP_Audio.uiClick();
        if (!owned) {
          const res = game.buyCosmetic(c.id);
          if (res.ok) { PP_Audio.good(); game.equipCosmetic(c.id); PP_UI.toast(c.name + ' bought + equipped!'); }
          else { PP_Audio.bad(); PP_UI.toast(res.reason); }
        } else {
          const res = game.equipCosmetic(c.id);
          if (res.ok) { PP_UI.toast(c.name + ' equipped'); }
        }
        showWardrobe();
      });
      cont.appendChild(card);
    });
  }

  // ---- Share / challenge (blueprint §24) ----
  function showShare() {
    hideAll(); show('screen-share');
    // Generate a share code for a fresh challenge (default squad + random seed).
    const seed = ((Math.random() * 1e9) | 0) || 12345;
    const squad = (game.selectedSquad && game.selectedSquad.length === 3) ? game.selectedSquad : ['pogo', 'cinder', 'mosslug'];
    const code = PP_Game.encodeShareCode(seed, squad, 'journey');
    const inp = document.getElementById('share-code-input');
    if (inp) inp.value = code;
    const loadInp = document.getElementById('share-code-load');
    if (loadInp) loadInp.value = '';
  }

  // ---- Pause ----
  function bindPause() {
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on('#btn-resume', 'click', () => { PP_Audio.uiClick(); hideAll(); game.setState(PP_Game.States.PLAYING); });
    on('#btn-settings', 'click', () => { PP_Audio.uiClick(); hideAll(); show('screen-settings'); });
    on('#btn-settings-back', 'click', () => { PP_Audio.uiBack(); applySettings(); game.saveSettings(); if (game.state === PP_Game.States.SETTINGS && game._wasPaused) { hideAll(); show('screen-pause'); } else { hideAll(); show('screen-title'); } });
    on('#btn-quit', 'click', () => { PP_Audio.uiBack(); hideAll(); showTitle(); });
  }

  function togglePause() {
    if (game.state === PP_Game.States.PLAYING) {
      game._wasPaused = true;
      game.setState(PP_Game.States.PAUSE);
      hideAll(); show('screen-pause');
    } else if (game.state === PP_Game.States.PAUSE) {
      game.setState(PP_Game.States.PLAYING);
      hideAll();
    }
  }

  // ---- Settings ----
  const SETTING_DEFS = [
    { key: 'masterVolume', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'musicVolume', label: 'Music volume', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'sfxVolume', label: 'Effects volume', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'haptics', label: 'Haptics', type: 'toggle' },
    { key: 'screenShake', label: 'Screen shake', type: 'range', min: 0, max: 1, step: 0.1 },
    { key: 'reducedFlashes', label: 'Reduced flashes', type: 'toggle' },
    { key: 'reducedMotion', label: 'Reduced motion', type: 'toggle' },
    { key: 'aimAssist', label: 'Extended aim preview', type: 'toggle' },
    { key: 'leftHanded', label: 'Left-handed layout', type: 'toggle' },
    { key: 'batterySaver', label: 'Battery saver (30 FPS)', type: 'toggle' },
  ];

  function buildSettingsList() {
    const list = $('#settings-list');
    list.innerHTML = '';
    for (const def of SETTING_DEFS) {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const label = document.createElement('div'); label.className = 'label'; label.textContent = def.label;
      const ctrl = document.createElement('div'); ctrl.className = 'ctrl';
      if (def.type === 'toggle') {
        const t = document.createElement('button');
        t.className = 'toggle' + (game.settings[def.key] ? ' on' : '');
        t.setAttribute('aria-pressed', game.settings[def.key] ? 'true' : 'false');
        t.addEventListener('click', () => {
          game.settings[def.key] = !game.settings[def.key];
          t.classList.toggle('on', game.settings[def.key]);
          applySettings();
        });
        ctrl.appendChild(t);
      } else {
        const input = document.createElement('input');
        input.type = 'range'; input.min = def.min; input.max = def.max; input.step = def.step;
        input.value = game.settings[def.key];
        const val = document.createElement('span'); val.style.cssText = 'min-width:34px;text-align:right;color:var(--ink-dim);font-size:13px;';
        val.textContent = Math.round(game.settings[def.key] * 100) + '%';
        input.addEventListener('input', () => {
          game.settings[def.key] = parseFloat(input.value);
          val.textContent = Math.round(game.settings[def.key] * 100) + '%';
          applySettings();
        });
        ctrl.appendChild(input); ctrl.appendChild(val);
      }
      row.appendChild(label); row.appendChild(ctrl);
      list.appendChild(row);
    }
  }

  function applySettings() { game.applySettingsToSystems(); }

  // ---- Augment choice (§9) ----
  function showAugment(offer, rerolls) {
    hideAll(); show('screen-augment');
    const cont = $('#aug-cards'); if (!cont) return;
    cont.innerHTML = '';
    setText('#reroll-count', rerolls);
    for (const def of offer) {
      const card = document.createElement('div');
      card.className = 'aug-card' + (def.rarity === 'rare' ? ' rare' : '');
      card.innerHTML = `
        <div class="ac-head">
          <div class="ac-icon">${def.icon || '✦'}</div>
          <div>
            <div class="ac-name">${def.name}</div>
            <div class="ac-family">${def.family} · ${def.rarity}</div>
          </div>
        </div>
        <div class="ac-desc">${def.desc}</div>`;
      card.addEventListener('click', () => {
        PP_Audio.uiClick();
        game.pickAugment(def.id);
      });
      cont.appendChild(card);
    }
  }

  function bindAugmentUI() {
    const el = $('#btn-aug-reroll');
    if (el) el.addEventListener('click', () => {
      if (game.rerollAugments()) {
        PP_Audio.uiClick();
        showAugment(game._pendingAugmentOffer, game._rerollsLeft);
      } else { PP_Audio.uiBack(); }
    });
  }

  // ---- Result (room clear) ----
  function showResult(highlight) {
    hideAll(); show('screen-result');
    setText('#result-highlight', highlight || '');
    const s = [
      ['Best combo', game.roomBestCombo + 'x'],
      ['Courage', Math.ceil(game.courage) + '/' + game.maxCourage],
      ['Buttons', game.buttons],
      ['Augments', game.augments.length],
    ];
    setHTML('#result-stats', s.map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join(''));
  }

  // ---- Run end ----
  function showEnd(won, g) {
    hideAll(); show('screen-end');
    const isDaily = !!g.isDaily;
    setText('#end-title', won
      ? (isDaily ? 'Daily Shot Complete!' : 'Expedition Complete!')
      : 'Courage Drained');
    let line;
    if (won && isDaily) {
      const score = g.dailyScore || 0;
      const best = g.dailyBest || 0;
      line = `Daily Shot #${g.dailyCode} — Score: ${Math.round(score)}${score >= best ? ' (NEW BEST!)' : ' · Best: ' + Math.round(best)}`;
    } else if (won) {
      line = `You cleared all ${g.totalRooms} rooms of the expedition.`;
    } else {
      line = g._lastFailCause ? `The decisive blow: ${g._lastFailCause}.` : 'The Hush claimed this pocket.';
    }
    setText('#end-line', line);
    const s = isDaily ? [
      ['Best combo', g.runStats.bestCombo + 'x'],
      ['Damage dealt', Math.round(g.runStats.damageDealt)],
      ['Shots fired', g.runStats.shotsFired],
      ['Enemies', g.runStats.enemiesDefeated],
    ] : [
      ['Rooms cleared', g.runStats.roomsCleared],
      ['Best combo', g.runStats.bestCombo + 'x'],
      ['Shots fired', g.runStats.shotsFired],
      ['Enemies defeated', g.runStats.enemiesDefeated],
    ];
    setHTML('#end-stats', s.map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join(''));
    // Meta rewards (§14/§7/§15.1): show Sparks + Friendship gained on win.
    if (won && g._lastSparksEarned) {
      const rewardLine = document.createElement('div');
      rewardLine.style.cssText = 'margin-top:10px;text-align:center;color:var(--accent);font-weight:800;';
      let txt = '✨ +' + g._lastSparksEarned + ' Sparks';
      if (g._lastFriendshipGains && g._lastFriendshipGains.length) {
        txt += ' · Friendship: ' + g._lastFriendshipGains.join(', ');
      }
      rewardLine.textContent = txt;
      const stats = document.getElementById('end-stats');
      if (stats && stats.parentNode) stats.parentNode.insertBefore(rewardLine, stats.nextSibling);
    }
  }

  // ---- Toast ----
  function toast(msg) {
    let el = $('#pp-toast');
    if (!el) {
      const stage = document.querySelector ? document.querySelector('#stage') : null;
      if (!stage) return;
      el = document.createElement('div');
      el.id = 'pp-toast';
      el.style.cssText = 'position:absolute;top:120px;left:50%;transform:translateX(-50%);background:rgba(22,20,42,0.9);border:1px solid var(--panel-line);color:var(--accent);padding:10px 18px;border-radius:999px;font-weight:800;letter-spacing:1px;pointer-events:none;opacity:0;transition:opacity .2s;z-index:5;';
      stage.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  global.PP_UI = {
    init, showTitle, togglePause,
    showAugment, bindAugmentUI,
    showSquadSelect, bindSquadUI,
    showSanctuary, showWardrobe, showShare,
    showResult, showEnd, toast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
