// Scripted run of the ending: final ride through the nether portal, fade to black, Space to restart, number-key jumps.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.7&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
const ev = (f, a) => page.evaluate(f, a);
const snap = (label) => ev(() => { const G = window.__game, s = G.physics.s, t = G.track; return { state: G.game.state, stop: G.game.stop, toPortal: +(t.endCell.sMid - 3 - s).toFixed(1), v: +G.physics.v.toFixed(1), portalT: +(G.game.portalT || 0).toFixed(2), haze: +document.getElementById('portalfx').style.opacity || 0, fade: +document.getElementById('fade').style.opacity || 0, hint: document.getElementById('hint').textContent }; }).then((r) => console.log(label.padEnd(30), JSON.stringify(r)));
let n = 0; const shot = () => page.screenshot({ path: `/tmp/en_${n++}.png` });
await ev(() => { window.__game.goTo(7); window.__game.click(); });
// ride until about 6 blocks before the portal
for (let i = 0; i < 200; i++) { await ev(() => window.__game.tick(0.25, 1 / 60, false)); const d = await ev(() => window.__game.track.endCell.sMid - 3 - window.__game.physics.s); if (d < 7) break; }
await snap('approaching the portal'); await ev(() => window.__game.tick(0.01, 1 / 60)); await shot();
for (let i = 0; i < 14; i++) { await ev(() => window.__game.tick(0.1, 1 / 60, false)); const d = await ev(() => window.__game.track.endCell.sMid - 3 - window.__game.physics.s); if (d < 1.5) break; }
await snap('1.5 blocks from the portal'); await ev(() => window.__game.tick(0.01, 1 / 60)); await shot();
await ev(() => window.__game.tick(0.3, 1 / 60)); await snap('just inside'); await shot();
await ev(() => window.__game.tick(0.5, 1 / 60)); await snap('+0.5s'); await shot();
await ev(() => window.__game.tick(1.0, 1 / 60)); await snap('+1.5s (fading)'); await shot();
await ev(() => window.__game.tick(1.5, 1 / 60, false)); await snap('+3s'); await shot();
await ev(() => window.__game.key('Space')); await snap('SPACE at the end');
await ev(() => window.__game.tick(0.5, 1 / 60, false)); await snap('  +0.5s');
await ev(() => window.__game.tick(1.5, 1 / 60, false)); await snap('  +2s');
await ev(() => window.__game.key('Digit8')); await snap('key 8 (jump to the end)');
await ev(() => window.__game.key('Digit3')); await snap('key 3 (leave the end)');
await ev(() => window.__game.tick(0.5, 1 / 60, false)); await snap('  after tick');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
