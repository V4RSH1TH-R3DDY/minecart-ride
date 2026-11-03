// how much water the lush cave got (axolotls and glow squid need ponds)
import { buildTrack, layoutFor } from '../src/track.js';
import { generateWorld } from '../src/terrain.js';
import { B } from '../src/blocks.js';
const t = buildTrack(layoutFor(9)); const w = generateWorld(t);
let n = 0; const seen = new Set();
for (const c of t.cells) if (c.biome === 'lush') for (let dz = -30; dz <= 30; dz++) for (let dx = -30; dx <= 30; dx++) for (let y = c.yb - 14; y <= c.yb + 2; y++) {
  const k = `${c.x + dx},${y},${c.z + dz}`; if (seen.has(k)) continue; seen.add(k);
  if (w.get(c.x + dx, y, c.z + dz) === B.water) n++;
}
console.log('lush cells', t.cells.filter((c) => c.biome === 'lush').length, 'water voxels near them', n);
// column probe under each lush cell's lateral ponds
const lush = t.cells.filter((c) => c.biome === 'lush');
let cnt = {};
for (const c of lush) { const k = w.col(c.x, c.z); }
const ys = new Map();
for (let z = w.oz; z < w.oz + w.nz; z++) for (let x = w.ox; x < w.ox + w.nx; x++) {
  const cell = w.cells[w.colCell[w.col(x, z)]];
  if (cell.biome !== 'lush') continue;
  for (let y = cell.yb - 14; y <= cell.yb + 4; y++) if (w.get(x, y, z) === B.water) { ys.set(y - cell.yb, (ys.get(y - cell.yb) || 0) + 1); }
}
console.log('water by height relative to nearest lush cell', [...ys.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + v).join(' '));
