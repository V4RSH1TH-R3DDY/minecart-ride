import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8137/index.html?scale=0.3&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
const res = await page.evaluate(() => {
  const G = window.__game, T = G.track, W = G.world;
  // 1) cart + Steve volume along the whole path
  const cartHits = [];
  const p = [0, 0, 0], t = [0, 0, 0];
  for (let s = 0.5; s < T.total - 0.5; s += 0.2) {
    T.sample(s, p); T.tangent(s, t);
    const hx = Math.hypot(t[0], t[2]) || 1;
    const rx = -t[2] / hx, rz = t[0] / hx; // horizontal right
    // up = tangent x right  (orthonormal frame along the rail)
    const ux = t[1] * rz - t[2] * 0, uy = t[2] * rx - t[0] * rz, uz = t[0] * 0 - t[1] * rx;
    const ul = Math.hypot(ux, uy, uz) || 1; const upv = [ux / ul, uy / ul, uz / ul];
    if (upv[1] < 0) { upv[0] *= -1; upv[1] *= -1; upv[2] *= -1; }
    let hit = null;
    for (const [a, l, y] of [[0, 0, 0.3], [0, 0, 1.0], [0, 0, 1.7], [0.6, 0.45, 0.3], [0.6, -0.45, 0.3], [-0.6, 0.45, 0.3], [-0.6, -0.45, 0.3], [0.6, 0, 1.2], [-0.6, 0, 1.2], [0, 0.45, 1.2], [0, -0.45, 1.2]]) {
      const x = p[0] + t[0] * a + rx * l + upv[0] * y, yy = p[1] + t[1] * a + upv[1] * y, z = p[2] + t[2] * a + rz * l + upv[2] * y;
      if (W.solidAt(x, yy, z)) { hit = [+x.toFixed(1), +yy.toFixed(1), +z.toFixed(1), a, l, y]; break; }
    }
    if (hit) cartHits.push({ s: +s.toFixed(1), cell: T.cellIndexAt(s), kind: T.cells[T.cellIndexAt(s)].kind, shape: T.cells[T.cellIndexAt(s)].shape, hit });
  }
  // 2) camera over a full ride
  const camHits = [];
  G.tick(2, 1 / 60, false);
  for (let leg = 0; leg < T.legs.length; leg++) {
    G.click();
    let guard = 0;
    while (G.game.state === 'riding' && guard++ < 3000) {
      G.tick(1 / 30, 1 / 60, false);
      const c = G.camera.position;
      let n = 0;
      for (const [dx, dy, dz] of [[0, 0, 0], [.3, 0, 0], [-.3, 0, 0], [0, .3, 0], [0, -.3, 0], [0, 0, .3], [0, 0, -.3]]) if (W.solidAt(c.x + dx, c.y + dy, c.z + dz)) n++;
      if (n) camHits.push({ leg, s: +G.physics.s.toFixed(1), cam: [c.x, c.y, c.z].map((v) => +v.toFixed(1)), n, fp: +G.rig.wFP.toFixed(2) });
    }
    G.tick(2, 1 / 60, false);
  }
  return { cartHits: cartHits.length, cartSample: cartHits.filter((_, i) => i % 4 === 0).slice(0, 20).map((h) => `${h.s} cell${h.cell} ${h.kind}/${h.shape} hit@${h.hit.join(',')}`), camHits: camHits.length, camSample: camHits.filter((_, i) => i % 8 === 0).slice(0, 20).map((h) => `leg${h.leg} s${h.s} cam${h.cam.join(',')} n${h.n} fp${h.fp}`) };
});
console.log(JSON.stringify(res));
await browser.close();
