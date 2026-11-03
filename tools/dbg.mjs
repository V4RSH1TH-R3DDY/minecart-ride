import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:8137/index.html?scale=0.2&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
console.log(JSON.stringify(await page.evaluate(() => {
  const G = window.__game, W = G.world, cnt = {}, ys = {};
  for (let y = W.oy; y < W.oy + W.ny; y++) for (let z = W.oz; z < W.oz + W.nz; z++) for (let x = W.ox; x < W.ox + W.nx; x++) {
    if (G.blockName(W.get(x, y, z)) !== 'water') continue;
    const b = W.cells[W.colCell[W.col(x, z)]].biome; cnt[b] = (cnt[b] || 0) + 1; (ys[b] = ys[b] || new Set()).add(y);
  }
  const out = {}; for (const k of Object.keys(ys)) out[k] = cnt[k] + ' voxels, y ' + Math.min(...ys[k]) + '..' + Math.max(...ys[k]);
  const legMin = {}; for (const c of W.cells) legMin[c.leg] = Math.min(legMin[c.leg] ?? 1e9, c.yb);
  return { out, legMin };
})));
await browser.close();
