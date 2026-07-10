/* test/browser-hosted.cjs — verify the game runs from the hosted GitHub Pages URL
   on a mobile viewport. Confirms the device-test path works end-to-end. */
const path = require('path');
const fs = require('fs');
const npxCache = path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Local', 'npm-cache', '_npx');
let puppeteer = null;
for (const dir of fs.readdirSync(npxCache)) {
  const c = path.join(npxCache, dir, 'node_modules', 'puppeteer-core');
  if (fs.existsSync(path.join(c, 'package.json'))) { puppeteer = require(c); break; }
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CON:' + m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto('https://closebug.github.io/pullpop-pocket-beasts/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => { const b = document.getElementById('btn-start'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 600));
  const state = await page.evaluate(() => {
    const g = window.__PP_GAME;
    return g ? { hasGame: true, state: g.state, squad: g.squad.length, enemies: g.room.enemies.length, courage: g.courage } : { hasGame: false };
  });
  const shot = await page.evaluate(() => {
    const g = window.__PP_GAME;
    const p = g.squad[0]; g.activePoplingIdx = 0;
    const e = g.room.enemies[0];
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    g.onAimStart(p);
    g.onAimRelease({ dir: { x: dx / d, y: dy / d }, forceFrac: 1.0, frac: 1.0, pivot: { x: p.x, y: p.y } });
    return { phase: g.phase };
  });
  await new Promise((r) => setTimeout(r, 1200));
  const after = await page.evaluate(() => {
    const g = window.__PP_GAME;
    return { phase: g.phase, hasNaN: g.squad.some((p) => Number.isNaN(p.x)) };
  });
  await page.screenshot({ path: path.join(__dirname, 'screenshot-hosted.png') });
  await browser.close();
  console.log('=== Hosted GitHub Pages test (mobile 390x844 viewport) ===');
  console.log('Load errors:', errors.length);
  errors.slice(0, 5).forEach((e) => console.log('  ERR:', e));
  console.log('Game state after PLAY:', JSON.stringify(state));
  console.log('Shot fired:', JSON.stringify(shot));
  console.log('After shot:', JSON.stringify(after));
  const ok = errors.length === 0 && state.hasGame === true && shot.phase === 'fly';
  console.log('\n' + (ok ? 'PASS — game runs on GitHub Pages' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})();
