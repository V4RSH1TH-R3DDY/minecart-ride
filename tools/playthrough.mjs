import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.3&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
const shots = process.argv.slice(2).map(Number); // leg numbers to screenshot mid-ride and at arrival
const result = await page.evaluate(async ({ shots }) => {
  const G = window.__game, out = [];
  G.tick(3, 1 / 60, false);
  const maxLegs = G.track.legs.length;
  for (let leg = 0; leg < maxLegs; leg++) {
    G.click();
    let t = 0, vmax = 0, vmin = 99, boosts = 0;
    const mid = [];
    while (G.game.state === 'riding' && t < 40) {
      G.tick(1 / 6, 1 / 60, false); t += 1 / 6;
      vmax = Math.max(vmax, G.physics.v); if (G.physics.v > 0) vmin = Math.min(vmin, G.physics.v);
    }
    const stopped = G.physics.mode === 'stopped'; if (leg === maxLegs - 1) G.tick(3, 1 / 60, false);
    out.push({ leg, time: +t.toFixed(1), vmax: +vmax.toFixed(2), vmin: +vmin.toFixed(2), state: G.game.state, stopped, s: +G.physics.s.toFixed(2), target: +G.track.legs[leg].toS.toFixed(2), fov: +G.camera.fov.toFixed(1) });
    G.tick(2.5, 1 / 60, false);
    if (G.game.state === 'portal' || G.game.state === 'finished') break;
  }
  return out;
}, { shots });
console.table(result);
console.log(logs.join('\n') || 'no console errors');
await browser.close();
