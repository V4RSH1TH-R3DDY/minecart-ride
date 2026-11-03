import { buildTrack, layoutFor } from '../src/track.js';
import { generateWorld } from '../src/terrain.js';
import { bakeLight } from '../src/lighting.js';
import { LIST } from '../src/blocks.js';
const t0 = performance.now();
const track = buildTrack(layoutFor(9));
let last = t0;
const w = generateWorld(track, (s) => { const n = performance.now(); console.log(s.padEnd(12), Math.round(n - last), 'ms'); last = n; });
console.log('dims', w.nx, w.ny, w.nz, 'voxels', w.nx * w.ny * w.nz);
const t1 = performance.now();
bakeLight(w);
console.log('light', Math.round(performance.now() - t1), 'ms, lights', w.lights.length);
const counts = {};
for (let i = 0; i < w.data.length; i++) { const id = w.data[i]; if (id) counts[LIST[id].name] = (counts[LIST[id].name] || 0) + 1; }
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ':' + v).join(' '));
console.log('total', Math.round(performance.now() - t0), 'ms');
// floating liquid check: liquid voxels with air beside or below
{
  const { data, nx, ny, nz, I, inb, ox, oy, oz } = w;
  const WATER = LIST.findIndex((d) => d.name === 'water'), LAVA = LIST.findIndex((d) => d.name === 'lava');
  const bad = { water: 0, lava: 0 }, tot = { water: 0, lava: 0 };
  for (let y = oy; y < oy + ny; y++) for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
    const id = data[I(x, y, z)];
    if (id !== WATER && id !== LAVA) continue;
    const k = id === WATER ? 'water' : 'lava'; tot[k]++;
    let leak = inb(x, y - 1, z) && data[I(x, y - 1, z)] === 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y, z + dz) && data[I(x + dx, y, z + dz)] === 0) leak = true;
    if (leak) bad[k]++;
  }
  console.log('liquid voxels', JSON.stringify(tot), 'uncontained', JSON.stringify(bad));
}
