// Fly the camera to the nearest mob of a type and shoot it in place (card hidden). usage: node mobview.mjs out type[:dist] ...
import { chromium } from 'playwright-core';
const [,, out, ...specs] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.8&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; for (const id of ['card', 'hud', 'hint']) document.getElementById(id).style.display = 'none'; });
let n = 0;
for (const sp of specs) {
  const [type, dist = '6', idx = '0'] = sp.split(':');
  const info = await page.evaluate(({ type, dist, idx }) => {
    const G = window.__game, list = G.mobs.mobs.filter((m) => m.type === type);
    const m = list[parseInt(idx, 10)]; if (!m) return null;
    G.mobs.mobs.forEach((x) => { x.group.visible = false; });
    m.group.visible = true;
    // park the cart-based culling: show everything within reach of the mob
    const p = m.pos, d = parseFloat(dist);
    G.game.state = 'idle';
    const ang = m.yaw + 0.6;
    G.camera.position.set(p.x + Math.sin(ang) * d, p.y + d * 0.35 + 1.2, p.z + Math.cos(ang) * d);
    G.camera.fov = 50; G.camera.updateProjectionMatrix(); G.camera.lookAt(p.x, p.y + 1.2, p.z);
    G.mobs.mobs.forEach((x) => { const dd = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); x.group.visible = dd < 40; });
    for (let i = 0; i < 20; i++) G.mobs.update(0.05, 3 + i * 0.05, { x: p.x, y: p.y, z: p.z }, G.camera.position);
    G.renderer.render(G.scene, G.camera);
    return { at: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), count: list.length };
  }, { type, dist, idx });
  if (!info) { console.log(type, 'none'); continue; }
  console.log(type, JSON.stringify(info));
  await page.screenshot({ path: `${out}_${n++}.png` });
}
console.log(logs.join('\n') || 'no errors');
await browser.close();
