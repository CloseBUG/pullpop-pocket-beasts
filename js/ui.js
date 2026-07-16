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
      game.isDaily = false;
      hideAll(); game.startRun();
    });
    on('#btn-daily', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      hideAll(); game.startDaily();
    });
    on('#btn-wild', 'click', () => {
      PP_Audio.unlock(); PP_Audio.uiClick(); PP_Audio.startMusic();
      hideAll(); game.startWildPocket();
    });
    on('#btn-howto', 'click', () => { PP_Audio.uiClick(); hideAll(); show('screen-howto'); });
    on('#btn-howto-back', 'click', () => { PP_Audio.uiBack(); hideAll(); show('screen-title'); });
    // Show today's daily code on the title button.
    const dailyDateEl = document.getElementById('daily-date');
    if (dailyDateEl && typeof PP_Game !== 'undefined') {
      dailyDateEl.textContent = '#' + PP_Game.dailyCode();
    }
  }

  function showTitle() { hideAll(); show('screen-title'); }

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
    showResult, showEnd, toast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
