// Spacing report: for every pair of cells in different legs, the smallest horizontal distance (blocks) while their heights overlap a cave-sized band.
import { buildTrack, layoutFor } from '../src/track.js';
const t = buildTrack(layoutFor(9));
const worst = [];
for (let a = 0; a < t.cells.length; a++) for (let b = a + 1; b < t.cells.length; b++) {
  const A = t.cells[a], B = t.cells[b];
  if (Math.abs(A.leg - B.leg) < 1 || (A.leg === B.leg)) continue;
  const dy = Math.abs(A.yb - B.yb); if (dy > 22) continue;
  const d = Math.hypot(A.x - B.x, A.z - B.z);
  worst.push([d, A.leg, B.leg, dy]);
}
worst.sort((p, q) => p[0] - q[0]);
const perPair = {};
for (const [d, la, lb, dy] of worst) { const k = Math.min(la, lb) + '-' + Math.max(la, lb); if (!(k in perPair)) perPair[k] = d.toFixed(0) + ' (dy ' + dy + ')'; }
console.log('min horizontal gap between legs (blocks):', JSON.stringify(perPair));
let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
for (const c of t.cells) { minx = Math.min(minx, c.x); maxx = Math.max(maxx, c.x); minz = Math.min(minz, c.z); maxz = Math.max(maxz, c.z); }
console.log('footprint', maxx - minx, 'x', maxz - minz, 'track length', t.total.toFixed(0));
t.legs.forEach((l, i) => console.log('leg', i, 'length', (l.toS - l.fromS).toFixed(1)));
