// Per-biome particle counts + audio engine health (headless; autoplay allowed so the audio graph runs).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.3&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
await page.waitForFunction(() => window.__game.audio.state.loaded >= window.__game.audio.state.total && window.__game.audio.state.total > 0, null, { timeout: 60000 }).catch(() => {});
console.log(await page.evaluate(() => { const a = window.__game.audio; return { ctx: a.ctx.state, sounds: `${a.state.loaded}/${a.state.total}`, events: Object.keys(a.state.manifest).length }; }));
const rows = [];
for (const [label, st] of [['alpine meadow', 1], ['cherry canyon', 2], ['taiga', 3], ['lush cave', 4], ['ice cave', 5], ['nether', 6], ['the end', 7]]) {
  const r = await page.evaluate((st) => { const G = window.__game; G.goTo(st); G.tick(2.5, 1 / 30, false); const s = G.fx.stats(); return Object.entries(s).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' '); }, st);
  rows.push({ biome: label, particles: r });
}
console.table(rows);
console.log(logs.join('\n') || 'no errors/warnings');
await browser.close();
