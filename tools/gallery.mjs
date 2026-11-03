import { chromium } from 'playwright-core';
const [,, out = '/tmp/gal', ...groups] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.9&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; document.getElementById('card').style.display = 'none'; document.getElementById('hud').style.display = 'none'; document.getElementById('hint').style.display = 'none'; });
let n = 0;
for (const g of groups) {            // "pig,sheep,wolf@0.9" = types @ yaw multiplier of pi
  const [list, yaw] = g.split('@');
  const types = list.split(',');
  await page.evaluate(({ types, yaw }) => {
    const G = window.__game;
    for (const m of G.mobs.mobs.filter((x) => x.always)) { m.group.parent.remove(m.group); }
    G.mobs.mobs.splice(0, G.mobs.mobs.length, ...G.mobs.mobs.filter((x) => !x.always));
    G.gallery(types, { x: 20, z: 40, gap: types.includes('ghast') ? 11 : 5, yaw: Math.PI * (yaw ? parseFloat(yaw) : 0.85) });
    const gap = types.includes('ghast') ? 11 : 5, cx = 20 + (types.length - 1) * gap / 2, y = G.world.yTop + 6;
    G.camera.position.set(cx + 2, y + 1.6 + (types.includes('ghast') ? 3 : 0), 40 + (types.length === 1 ? 3.2 : 6 + types.length * (types.includes('ghast') ? 6 : 2.2))); G.camera.fov = 40; G.camera.updateProjectionMatrix(); G.camera.lookAt(cx, y + 1.4, 40);
    G.mobs.mobs.filter((x) => x.always).forEach((m) => { m.group.visible = true; });
    G.renderer.render(G.scene, G.camera);
  }, { types, yaw });
  await page.screenshot({ path: `${out}_${n++}.png` });
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
