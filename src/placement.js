// Where the mobs live: seeded, biome-by-biome placement rules, plus one mascot per checkpoint hall.
import * as THREE from 'three';
import { LIST, B } from './blocks.js';

const AIR = B.air;
const rngFrom = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// biome (cell.biome) -> list of rules.  where: ground | water | air | lava | lavaair | pillar
//   dmin/dmax: distance from the rail the mob may stand;  n: how many;  leash: wander radius;  sky: needs open sky
const RULES = {
  desert: [
    { type: 'rabbit', n: 5, where: 'ground', dmin: 8, dmax: 30, leash: 3, sky: true },
    { type: 'fox', n: 1, where: 'ground', dmin: 10, dmax: 26, leash: 3, sky: true },
  ],
  deep: [
    { type: 'warden', n: 2, where: 'ground', dmin: 9, dmax: 34, leash: 2, rough: true },
    { type: 'bat', n: 4, where: 'air', dmin: 5, dmax: 26, h: [4, 11], fly: 3 },
  ],
  alpine: [
    { type: 'goat', n: 3, where: 'ground', dmin: 14, dmax: 46, leash: 3, rock: true },
    { type: 'sheep', n: 4, where: 'ground', dmin: 6, dmax: 20, leash: 4, sky: true },
    { type: 'fox', n: 1, where: 'ground', dmin: 9, dmax: 22, leash: 3, sky: true },
    { type: 'bee', n: 3, where: 'air', dmin: 5, dmax: 18, h: [1.8, 3.5], fly: 3, sky: true },
  ],
  cherry: [
    { type: 'bee', n: 4, where: 'air', dmin: 6, dmax: 24, h: [2, 4.5], fly: 3.5, sky: true, plateau: true },
    { type: 'rabbit', n: 3, where: 'ground', dmin: 14, dmax: 30, leash: 3, sky: true },
    { type: 'pig', n: 2, where: 'ground', dmin: 14, dmax: 30, leash: 3, sky: true },
    { type: 'cod', n: 6, where: 'water', dmin: 0, dmax: 8, swim: 1.6 },
  ],
  taiga: [
    { type: 'wolf', n: 3, where: 'ground', dmin: 8, dmax: 26, leash: 2.5, sky: true },
    { type: 'fox_sleep', n: 1, where: 'ground', dmin: 8, dmax: 22, leash: 0, sky: true },
    { type: 'rabbit', n: 2, where: 'ground', dmin: 8, dmax: 26, leash: 3, sky: true },
    { type: 'iron_golem', n: 1, where: 'ground', dmin: 9, dmax: 15, leash: 2, sky: true },
  ],
  lush: [
    { type: 'axolotl', n: 4, where: 'water', dmin: 4, dmax: 40, swim: 0.9 },
    { type: 'glow_squid', n: 3, where: 'water', dmin: 4, dmax: 40, swim: 0.9, deep: 2 },
    { type: 'bee', n: 2, where: 'air', dmin: 5, dmax: 18, h: [1.5, 3], fly: 3 },
  ],
  ice: [
    { type: 'stray', n: 3, where: 'ground', dmin: 7, dmax: 26, leash: 2.5 },
    { type: 'snow_golem', n: 1, where: 'ground', dmin: 7, dmax: 18, leash: 2 },
    { type: 'polar_bear', n: 1, where: 'ground', dmin: 8, dmax: 22, leash: 3 },
    { type: 'bat', n: 3, where: 'air', dmin: 4, dmax: 20, h: [4, 8], fly: 3.5 },
  ],
  nether: [
    { type: 'blaze', n: 8, where: 'lavaair', dmin: 6, dmax: 30, h: [3.5, 8], fly: 2.2 },
    { type: 'wither_skeleton', n: 5, where: 'ground', dmin: 5, dmax: 34, leash: 2.5, rough: true },
    { type: 'strider', n: 4, where: 'lava', dmin: 4, dmax: 24, leash: 4 },
    { type: 'magma_cube', n: 3, where: 'ground', dmin: 4, dmax: 34, leash: 2, rough: true },
    { type: 'piglin', n: 2, where: 'ground', dmin: 4, dmax: 34, leash: 2, rough: true },
  ],
  end: [
    { type: 'enderman', n: 8, where: 'ground', dmin: 5, dmax: 40, leash: 2, island: true },
    { type: 'shulker', n: 3, where: 'ground', dmin: 6, dmax: 36, leash: 0, island: true },
  ],
};
// one mascot per hall (stop index -> mob), standing on the far side of the platform in the checkpoint camera's frame
const MASCOTS = { 0: 'rabbit', 1: 'goat', 2: 'pig', 3: 'wolf', 4: 'axolotl', 5: 'polar_bear', 6: 'warden', 7: 'piglin', 8: 'enderman' };

export function placeMobs({ world, track, mgr, hallCameraPos }) {
  const { cells, stopInfo, get, inb, col, colCell, colDist } = world;
  const rnd = rngFrom(20251031);
  const placed = [];
  const stopCenters = stopInfo.map((s) => s.origin);

  const solidAt = (x, y, z) => { const id = get(x, y, z); return id !== AIR && LIST[id].kind === 'cube'; };
  const airAt = (x, y, z) => { const id = get(x, y, z); return id === AIR || LIST[id].kind === 'cross' || LIST[id].kind === 'chain'; };
  const nearRail = (x, y, z, r) => cells.some((c) => Math.abs(c.yb - y) < 5 && Math.hypot(c.x + 0.5 - x, c.z + 0.5 - z) < r);
  const nearHall = (x, z, r = 12) => stopCenters.some((o) => Math.hypot(o[0] - x, o[2] - z) < r);
  const nearMob = (x, y, z, r = 2.6) => placed.some((p) => Math.hypot(p.x - x, p.z - z) < r && Math.abs(p.y - y) < 6);
  const biomeAt = (x, z) => { const k = col(Math.floor(x), Math.floor(z)); return cells[colCell[k]].biome; };

  // standing spot below (x, z): solid floor with two clear cells above, scanning down from y0 to y1
  function standY(x, z, y0, y1, notLeaves = true) {
    const fx = Math.floor(x), fz = Math.floor(z);
    for (let y = y0; y >= y1; y--) {
      const id = get(fx, y - 1, fz);
      if (id !== AIR && LIST[id].kind === 'cube' && airAt(fx, y, fz) && airAt(fx, y + 1, fz)) return y;
      if (notLeaves && id !== AIR && LIST[id].kind === 'leaves') return null;     // never stand on a canopy
      if (id !== AIR && LIST[id].kind === 'liquid') return null;
    }
    return null;
  }
  const flatEnough = (x, y, z) => { let ok = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = standY(x + dx, z + dz, y + 1, y - 1); if (yy === y) ok++; } return ok >= 3; };
  const ringFree = (x, y, z, r, test) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (!test(Math.floor(x + Math.cos(a) * r), Math.floor(y), Math.floor(z + Math.sin(a) * r))) return false; } return true; };

  function tryRule(rule, legCells) {
    for (let attempt = 0; attempt < 900; attempt++) {
      const c = legCells[Math.floor(rnd() * legCells.length)];
      const a = rnd() * Math.PI * 2, r = rule.dmin + rnd() * (rule.dmax - rule.dmin);
      const x = c.x + 0.5 + Math.cos(a) * r, z = c.z + 0.5 + Math.sin(a) * r;
      if (!inb(Math.floor(x), world.oy + 1, Math.floor(z))) continue;
      if (nearHall(x, z) || biomeAt(x, z) !== c.biome) continue;
      let pos = null, extra = {};
      if (rule.where === 'ground') {
        const y = standY(x, z, c.yb + 12, c.yb - 18);
        if (y === null || nearRail(x, y, z, 3.6) || (rule.leash > 0 && !rule.rough && !flatEnough(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5))) continue;
        if (rule.sky && world.lightAt(x, y + 1, z).sky < 14) continue;
        const under = LIST[get(Math.floor(x), y - 1, Math.floor(z))].name;
        if (rule.rock && !['stone', 'andesite', 'calcite', 'tuff', 'snow', 'gravel'].includes(under)) continue;
        if (rule.island && !['end_stone'].includes(under)) continue;
        pos = new THREE.Vector3(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5); extra = { leash: rule.leash };
      } else if (rule.where === 'air') {
        const y = standY(x, z, c.yb + 12, c.yb - 18);
        if (y === null || nearRail(x, y, z, 3.2)) continue;
        if (rule.sky && world.lightAt(x, y + 2, z).sky < 14) continue;
        const h = rule.h[0] + rnd() * (rule.h[1] - rule.h[0]);
        if (!ringFree(x, y + h, z, rule.fly, (xx, yy, zz) => airAt(xx, yy, zz) && airAt(xx, yy + 1, zz))) continue;
        pos = new THREE.Vector3(x, y + h, z); extra = { flyRadius: rule.fly, kind: 'fly' };
      } else if (rule.where === 'water') {
        let found = null;
        for (let y = c.yb + 4; y >= c.yb - 16; y--) {
          if (get(Math.floor(x), y, Math.floor(z)) === B.water && airAt(Math.floor(x), y + 1, Math.floor(z))) {
            let depth = 0; while (get(Math.floor(x), y - depth, Math.floor(z)) === B.water) depth++;
            found = { y, depth }; break;
          }
        }
        if (!found || found.depth < (rule.deep || 2)) continue;
        const my = found.y - Math.min(found.depth - 1, rule.deep ? found.depth * 0.5 : 0.5) + 0.2;
        if (!ringFree(x, my, z, rule.swim, (xx, yy, zz) => get(xx, yy, zz) === B.water)) continue;
        pos = new THREE.Vector3(x, my - (rule.deep ? 0.6 : 0.5), z); extra = { swimRadius: rule.swim, kind: 'swim' };
        if (rule.type === 'cod') pos.y = found.y - 0.25;
      } else if (rule.where === 'lava' || rule.where === 'lavaair') {
        let ly = null;
        for (let y = c.yb + 6; y >= c.yb - 24; y--) { if (get(Math.floor(x), y, Math.floor(z)) === B.lava) { ly = y; break; } }
        if (ly === null) continue;
        if (nearRail(x, ly + 3, z, rule.dmin > 5 ? rule.dmin * 0.6 : 3.4)) continue;
        if (rule.where === 'lava') {
          if (!airAt(Math.floor(x), ly + 1, Math.floor(z)) || !airAt(Math.floor(x), ly + 2, Math.floor(z))) continue;
          if (!ringFree(x, ly, z, rule.leash, (xx, yy, zz) => get(xx, yy, zz) === B.lava && airAt(xx, yy + 1, zz))) continue;
          pos = new THREE.Vector3(Math.floor(x) + 0.5, ly + 1, Math.floor(z) + 0.5); extra = { leash: rule.leash, kind: 'lava' };
        } else {
          const h = rule.h[0] + rnd() * (rule.h[1] - rule.h[0]);
          if (!ringFree(x, ly + h, z, rule.fly, (xx, yy, zz) => airAt(xx, yy, zz) && airAt(xx, yy + 2, zz))) continue;
          pos = new THREE.Vector3(x, ly + h, z); extra = { flyRadius: rule.fly, kind: 'fly' };
        }
      }
      if (!pos || nearMob(pos.x, pos.y, pos.z, 2.6)) continue;
      const m = mgr.spawn(rule.type, pos, { yaw: rnd() * Math.PI * 2, ph: rnd(), ...extra });
      placed.push({ x: pos.x, y: pos.y, z: pos.z });
      return m;
    }
    return null;
  }

  const report = {};
  const skipNearHalls = (arr) => arr.filter((c) => !stopInfo.some((s) => Math.abs(s.cell.i - c.i) <= 8));
  for (const biome of Object.keys(RULES)) {
    const legCells = skipNearHalls(cells.filter((c) => c.biome === biome));
    if (!legCells.length) continue;
    for (const rule of RULES[biome]) {
      let got = 0;
      for (let i = 0; i < rule.n; i++) if (tryRule(rule, legCells)) got++;
      report[`${biome}/${rule.type}`] = `${got}/${rule.n}`;
    }
  }

  // end crystals on the obsidian pillars
  for (const [px, py, pz] of world.pillarTops || []) {
    mgr.spawn('end_crystal', new THREE.Vector3(px + 0.5, py + 1, pz + 0.5), { ph: rnd(), kind: 'static' });
  }
  report['end/end_crystal'] = (world.pillarTops || []).length;

  // hall mascots: far side of the platform, turned toward the camera
  stopInfo.forEach((st, i) => {
    const type = MASCOTS[i];
    if (!type || st.isEnd) return;
    const o = st.origin, f = st.fwd, l = st.left;
    const a = type === 'axolotl' ? -1.0 : -1.2, lat = type === 'axolotl' ? -3.5 : -3.6;
    const x = o[0] + f[0] * a + l[0] * lat, z = o[2] + f[1] * a + l[1] * lat;
    const cam = hallCameraPos(i);
    const yaw = Math.atan2(cam.x - x, cam.z - z);
    if (type === 'axolotl') {
      mgr.spawn('axolotl', new THREE.Vector3(x, o[1] - 0.8, z), { mascot: true, kind: 'swim', swimRadius: 0.55, yaw, lockYaw: yaw, ph: 0.2 });
    } else {
      mgr.spawn(type, new THREE.Vector3(x, o[1], z), { mascot: true, yaw, lockYaw: yaw, ph: rnd(), leash: 0 });
    }
  });
  return report;
}
