import { chromium } from 'playwright-core';
const q = process.argv[2] || 'high', scale = process.argv[3] || '0.45';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto(`http://localhost:8137/index.html?quality=${q}&scale=${scale}`);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
const rows = [];
const run = async (label, setup, n = 24, uneven = false) => {
  await page.evaluate(setup);
  const r = await page.evaluate(({ n, uneven }) => { const b = window.__game.bench(n, 1 / 60, uneven); const pos = b.pos; delete b.pos;
    // smoothness: speed (units/s) of the cart per frame, and its relative variation
    const sp = []; for (let i = 1; i < pos.length; i++) { const dx = pos[i].x - pos[i - 1].x, dy = pos[i].y - pos[i - 1].y, dz = pos[i].z - pos[i - 1].z; sp.push(Math.hypot(dx, dy, dz) / pos[i].d); }
    const mean = sp.reduce((a, c) => a + c, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, c) => a + (c - mean) ** 2, 0) / sp.length);
    return { ...b, cartSpeed: +mean.toFixed(2), speedJitterPct: mean > 0.5 ? +(100 * sd / mean).toFixed(1) : null }; }, { n, uneven });
  rows.push({ scene: label, ...r });
};
await run('start hall (idle)', () => window.__game.goTo(0));
await run('alpine hall', () => window.__game.goTo(1));
await run('lush cave hall', () => window.__game.goTo(4));
await run('nether hall', () => window.__game.goTo(6));
await run('end hall', () => window.__game.goTo(7));
await run('riding alpine (steady 60Hz)', () => { window.__game.goTo(0); window.__game.click(); window.__game.tick(3.5, 1 / 60, false); });
await run('riding alpine (UNEVEN frames)', () => { window.__game.goTo(0); window.__game.click(); window.__game.tick(3.5, 1 / 60, false); }, 36, true);
await run('riding nether (steady)', () => { window.__game.goTo(5); window.__game.click(); window.__game.tick(3.5, 1 / 60, false); });
console.table(rows);
console.log(logs.join('\n') || 'no errors');
await browser.close();
