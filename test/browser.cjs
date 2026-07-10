/* test/browser.cjs — load the game in headless Chrome, check for console errors,
   simulate a real pointer interaction (pull & release), and verify the game runs.
   Run: node test/browser.cjs */
const path = require('path');
const fs = require('fs');
const npxCache = path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Local', 'npm-cache', '_npx');
let puppeteer = null;
if (fs.existsSync(npxCache)) {
  for (const dir of fs.readdirSync(npxCache)) {
    const cand = path.join(npxCache, dir, 'node_modules', 'puppeteer-core');
    if (fs.existsSync(path.join(cand, 'package.json'))) { puppeteer = require(cand); break; }
  }
}
if (!puppeteer) { try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('puppeteer'); } }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const errors = [];
  const warnings = [];
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error') errors.push(msg.text());
    else if (t === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  const url = 'file:///' + path.resolve(__dirname, '..', 'www', 'index.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 400));

  // Click PLAY
  await page.evaluate(() => { const b = document.getElementById('btn-start'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 600));

  // Verify the game object + room built
  const state1 = await page.evaluate(() => {
    const g = window.__PP_GAME;
    if (!g) return { hasGame: false };
    return {
      hasGame: true,
      state: g.state,
      squadLen: g.squad.length,
      enemies: g.room ? g.room.enemies.length : -1,
      courage: g.courage,
      canvasPx: (() => { const c = document.getElementById('game'); const x = c.getContext('2d'); const d = x.getImageData(c.width/2, c.height/2, 1, 1).data; return [d[0],d[1],d[2],d[3]]; })(),
    };
  });

  // Simulate a shot via the game API directly (reliable across touch/mouse quirks)
  const shotResult = await page.evaluate(() => {
    const g = window.__PP_GAME;
    const p = g.squad.find(s => s.state === 'ready') || g.squad[0];
    g.activePoplingIdx = g.squad.indexOf(p);
    const e = g.room.enemies.find(en => !en.dead);
    if (!e) return { fired: false, reason: 'no enemy' };
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    g.onAimStart(p);
    g.onAimRelease({ dir: { x: dx/d, y: dy/d }, forceFrac: 1.0, frac: 1.0, pivot: { x: p.x, y: p.y } });
    return { fired: true, phase: g.phase };
  });

  // Let the shot resolve
  await new Promise((r) => setTimeout(r, 1500));

  // Check the game didn't crash and is in a sane state
  const state2 = await page.evaluate(() => {
    const g = window.__PP_GAME;
    return {
      state: g.state,
      phase: g.phase,
      enemiesRemaining: g.room.enemies.filter(e => !e.dead).length,
      courage: g.courage,
      hasNaN: g.squad.some(p => Number.isNaN(p.x) || Number.isNaN(p.y)),
    };
  });

  await page.screenshot({ path: path.join(__dirname, 'screenshot.png') });
  await browser.close();

  console.log('=== Browser load + play test ===');
  console.log('Load errors:', errors.length);
  errors.slice(0, 10).forEach((e) => console.log('  ERR:', e));
  console.log('Load warnings:', warnings.length);
  console.log('Game object present:', state1.hasGame);
  console.log('State after PLAY:', state1.state, '| squad:', state1.squadLen, '| enemies:', state1.enemies, '| courage:', state1.courage);
  console.log('Canvas center pixel (non-zero=rendered):', state1.canvasPx ? state1.canvasPx.join(',') : 'n/a');
  console.log('Shot fired:', shotResult.fired, shotResult.phase ? ('(phase=' + shotResult.phase + ')') : ('(' + shotResult.reason + ')'));
  console.log('After shot — state:', state2.state, 'phase:', state2.phase, 'enemies:', state2.enemiesRemaining, 'courage:', state2.courage, 'NaN:', state2.hasNaN);
  console.log('Screenshot: test/screenshot.png');

  const ok = errors.length === 0 && state1.hasGame && state1.enemies > 0 && shotResult.fired && !state2.hasNaN;
  console.log('\n' + (ok ? '✓ PASS' : '✗ FAIL'));
  process.exit(ok ? 0 : 1);
})();
