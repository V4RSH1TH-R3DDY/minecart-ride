// How much does the chase camera move? Rides a few legs and measures, in the cart's own frame, the camera's orbit angle, distance
// and height, plus how far the cart wanders around the screen and how fast the view rotates.
import { chromium } from 'playwright-core';
const legs = (process.argv[2] || '1,3,5').split(',').map(Number);
const SKIP = parseInt(process.argv[3] || '150', 10);   // frames ignored at the start of each ride (the hand-off from the slide view)
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:8137/index.html?scale=0.15&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => { window.__paused = true; });
const rows = [];
for (const L of legs) {
  const r = await page.evaluate(({ L, SKIP }) => {
    const G = window.__game; G.goTo(L); G.click();
    const V = G.camera.position.constructor, up = new V(0, 1, 0);
    const az = [], dist = [], hgt = [], ndcx = [], ndcy = [], fov = [], rot = [];
    let prevDir = null, prevAz = null, maxAzRate = 0, maxRot = 0;
    for (let i = 0; i < 700 && G.game.state === 'riding'; i++) {
      G.tick(1 / 60, 1 / 60, false);
      if (i < SKIP || G.physics.v < 1) { prevDir = null; prevAz = null; continue; }
      const cart = G.scene.children.find((o) => o.isGroup && o.userData && o.userData.materials && o.children.length) || null;
      const cp = new V(); G.camera.updateMatrixWorld();
      // cart position from the physics path
      const s = G.track.sample(G.physics.s, [0, 0, 0]); cp.set(s[0], s[1] + 0.7, s[2]);
      const t = G.track.tangent(G.physics.s, [0, 0, 0]); const heading = Math.atan2(t[0], t[2]);
      const off = G.camera.position.clone().sub(cp);
      let a = Math.atan2(off.x, off.z) - heading; a = Math.atan2(Math.sin(a), Math.cos(a));
      az.push(a * 180 / Math.PI); dist.push(Math.hypot(off.x, off.z)); hgt.push(off.y);
      const n = cp.clone().project(G.camera); ndcx.push(n.x); ndcy.push(n.y); fov.push(G.camera.fov);
      const d = G.camera.getWorldDirection(new V());
      if (prevDir) { const ang = Math.acos(Math.min(1, Math.max(-1, d.dot(prevDir)))) * 180 / Math.PI * 60; maxRot = Math.max(maxRot, ang); rot.push(ang); }
      if (prevAz !== null) { let da = a - prevAz; da = Math.atan2(Math.sin(da), Math.cos(da)); maxAzRate = Math.max(maxAzRate, Math.abs(da) * 180 / Math.PI * 60); }
      prevDir = d; prevAz = a;
    }
    const rng = (v) => +(Math.max(...v) - Math.min(...v)).toFixed(2), mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
    return { frames: az.length, orbitAngleRangeDeg: rng(az), maxOrbitRateDegPerS: +maxAzRate.toFixed(1), distRange: rng(dist), heightRange: rng(hgt), cartScreenRangeX: rng(ndcx), cartScreenRangeY: rng(ndcy), fovRange: rng(fov), meanViewRotDegPerS: +mean(rot).toFixed(1), maxViewRotDegPerS: +maxRot.toFixed(1) };
  }, { L, SKIP });
  rows.push({ leg: L, ...r });
}
console.table(rows);
await browser.close();
