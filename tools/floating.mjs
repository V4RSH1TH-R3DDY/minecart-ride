// finds rails with nothing solid under them (floating rails), and rail cells with solid blocks in their corridor
import { buildTrack, layoutFor } from '../src/track.js';
import { generateWorld } from '../src/terrain.js';
import { B, LIST } from '../src/blocks.js';
const t = buildTrack(layoutFor(9)), w = generateWorld(t);
const solid = (x, y, z) => { const id = w.get(x, y, z); return id !== 0 && (LIST[id].kind === 'cube' || LIST[id].kind === 'leaves'); };
const bad = [];
for (const c of t.cells) {
  const under = solid(c.x, c.yb - 1, c.z);
  // a rising slope also needs its low end supported; the high end is supported by the next cell
  if (!under) bad.push({ i: c.i, biome: c.biome, shape: c.shape, kind: c.kind, x: c.x, y: c.yb, z: c.z, below: LIST[w.get(c.x, c.yb - 1, c.z)].name });
}
console.log('cells', t.cells.length, 'unsupported', bad.length);
console.log(bad.slice(0, 40).map((b) => JSON.stringify(b)).join('\n'));
const byBiome = {}; for (const b of bad) byBiome[b.biome] = (byBiome[b.biome] || 0) + 1; console.log(byBiome);
