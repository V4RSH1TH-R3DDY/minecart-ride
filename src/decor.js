// Vegetation, cave decoration and End islands.
import { B, LIST } from './blocks.js';
import { START_Y } from './track.js';

// A vanilla-style chorus tree: a stem, then up to a few branches that run sideways, rise, and end in a flower.
export function chorusTree(w, x, base, z, seed = 0) {
  const { get, set, hash3 } = w;
  const AIR = B.air;
  const r = (n) => hash3(x * 3 + n, base, z * 5 + n * 2, 700 + seed);
  const flower = (fx, fy, fz, n) => { if (get(fx, fy, fz) === AIR) set(fx, fy, fz, r(40 + n) < 0.45 ? B.chorus_flower : B.chorus_flower_dead); };
  const h = 2 + Math.floor(r(1) * 4);
  for (let i = 1; i <= h; i++) { if (get(x, base + i, z) !== AIR) { if (i === 1) return false; flower(x, base + i, z, 0); return true; } set(x, base + i, z, B.chorus_plant); }
  const top = base + h, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const nb = Math.floor(r(2) * 4);          // 0..3 branches
  let grew = 0;
  for (let k = 0; k < nb; k++) {
    const [dx, dz] = dirs[(Math.floor(r(3 + k) * 4) + k) % 4];
    let bx = x, bz = z; const steps = 1 + Math.floor(r(10 + k) * 3);
    let ok = true;
    for (let s2 = 0; s2 < steps; s2++) {
      bx += dx; bz += dz;
      if (get(bx, top, bz) !== AIR) { ok = false; break; }
      set(bx, top, bz, B.chorus_plant);
    }
    if (!ok && bx === x + dx && bz === z + dz) continue;
    const up = 1 + Math.floor(r(20 + k) * 2);
    let y2 = top;
    for (let u = 1; u <= up; u++) { if (get(bx, top + u, bz) !== AIR) break; set(bx, top + u, bz, B.chorus_plant); y2 = top + u; }
    flower(bx, y2 + 1, bz, 1 + k);
    grew++;
  }
  flower(x, top + 1, z, 9);                     // the stem always ends in a flower too
  return true;
}

const TREE = 0.6;   // global tree density multiplier (more open ground)
const PLANT = 0.72; // global grass / flower density multiplier

export function decorate(w, progress) {
  const { data, nx, nz, ox, oy, oz, ny, yTop, I, inb, get, set, setIfAir, cells, col, colCell, colDist, colTop, colWater, colStyle, colSurfDist, hash3, n2, fbm2, UNDER, NONE } = w;
  const AIR = B.air, WATER = B.water;
  const isAir = (x, y, z) => get(x, y, z) === AIR;
  const STYLES = ['alpine', 'cherry', 'taiga', 'lush', 'ice', 'nether', 'end', 'tunnel', 'desert', 'deep'];

  // ---------- helpers ----------
  const blob = (cx, cy, cz, rx, ry, rz, pick, hole = 0.0, seed = 0) => {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
      if (d > 1.0 + (hash3(cx + dx, cy + dy, cz + dz, seed) - 0.5) * 0.35) continue;
      if (hole && hash3(cx + dx, cy + dy, cz + dz, seed + 3) < hole) continue;
      setIfAir(cx + dx, cy + dy, cz + dz, pick(dx, dy, dz));
    }
  };
  const log = (x, y, z, h, id) => { for (let i = 1; i <= h; i++) set(x, y + i, z, id); };

  function spruce(x, y, z, h, maxR, leaf = B.spruce_leaves) {
    log(x, y, z, h, B.spruce_log);
    const tip = y + h + 1;
    for (let ly = y + 2; ly <= tip; ly++) {
      const t = tip - ly;
      let r = t === 0 ? 0 : Math.min(maxR, 1 + Math.floor(t / 2.1));
      if (t > 1 && t % 2 === 0) r = Math.max(1, r - 1);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 0.6) continue;
        if (hash3(x + dx, ly, z + dz, 51) < 0.07 && r > 1) continue;
        setIfAir(x + dx, ly, z + dz, leaf);
      }
    }
  }
  function cherry(x, y, z, h) {
    const lean = hash3(x, 0, z, 61) < 0.5 ? 1 : -1, axis = hash3(x, 1, z, 62) < 0.5;
    let tx = x, tz = z;
    for (let i = 1; i <= h; i++) {
      if (i === Math.floor(h * 0.6)) { if (axis) tx += lean; else tz += lean; }
      set(tx, y + i, tz, B.cherry_log);
    }
    const cy = y + h;
    blob(tx, cy + 1, tz, 4.6, 1.8, 4.6, () => B.cherry_leaves, 0.1, 63);
    blob(tx, cy + 2, tz, 3, 1.2, 3, () => B.cherry_leaves, 0.05, 64);
    if (hash3(x, 2, z, 65) < 0.7) { const ax = tx + (axis ? 0 : 3 * lean), az = tz + (axis ? 3 * lean : 0); log(ax, cy - 2, az, 0, B.cherry_log); blob(ax, cy, az, 2.6, 1.2, 2.6, () => B.cherry_leaves, 0.12, 66); }
  }
  function autumn(x, y, z, h) {
    log(x, y, z, h, B.dark_oak_log);
    const cy = y + h;
    blob(x, cy + 1, z, 4.2, 2.2, 4.2, (dx, dy, dz) => (hash3(x + dx, cy + dy, z + dz, 71) < 0.3 ? B.red_mushroom_block : B.red_leaves), 0.06, 72);
    blob(x, cy + 3, z, 2.4, 1.2, 2.4, () => B.red_leaves, 0.05, 73);
  }
  function goldTree(x, y, z, h) {
    log(x, y, z, h, B.spruce_log);
    const tip = y + h + 1;
    for (let ly = y + 2; ly <= tip; ly++) {
      const t = tip - ly, r = t === 0 ? 0 : Math.min(2, 1 + Math.floor(t / 3));
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + 0.5) setIfAir(x + dx, ly, z + dz, B.gold_leaves);
    }
  }
  function bush(x, y, z) {
    set(x, y + 1, z, B.oak_log);
    blob(x, y + 2, z, 1.9, 1.3, 1.9, () => B.oak_leaves, 0.12, 81);
  }
  function azaleaTree(x, y, z) {
    const h = 3 + Math.floor(hash3(x, y, z, 91) * 2);
    log(x, y, z, h, B.oak_log);
    blob(x, y + h + 1, z, 2.8, 1.8, 2.8, (dx, dy, dz) => (hash3(x + dx, y + dy, z + dz, 92) < 0.25 ? B.flowering_azalea_leaves : B.azalea_leaves), 0.08, 93);
  }

  // ---------- surface biomes ----------
  const PLANTS = [B.dandelion, B.poppy, B.azure_bluet, B.cornflower];
  for (let z = oz + 2; z < oz + nz - 2; z++) for (let x = ox + 2; x < ox + nx - 2; x++) {
    const k = col(x, z), top = colTop[k];
    if (top === NONE || top >= yTop - 6) continue;
    const style = STYLES[colStyle[k]], dTrack = colDist[k];
    const above = get(x, top + 1, z), topId = get(x, top, z);
    const r = hash3(x, 0, z, 100);
    const wl = colWater[k];
    // underwater: seagrass
    if (wl !== NONE && wl > top && above === WATER) {
      if (r < 0.14 && dTrack > 2) set(x, top + 1, z, B.seagrass);
      else if (r > 0.97 && get(x, wl + 1, z) === AIR) set(x, wl + 1, z, B.lily_pad);
      continue;
    }
    if (above !== AIR) continue;
    if (style === 'desert') {                     // sand: cacti, dead bushes
      if (topId !== B.sand || dTrack < 3.5) continue;
      const t2 = hash3(x, 1, z, 131), p2 = hash3(x, 2, z, 132);
      if (t2 < 0.0075 && dTrack > 4.5 && !(w.steep(x, z) >= 2)) { const h = 1 + Math.floor(hash3(x, 3, z, 133) * 3); for (let i = 1; i <= h; i++) set(x, top + i, z, B.cactus); }
      else if (p2 < 0.045) set(x, top + 1, z, B.dead_bush);
      continue;
    }
    const onGrass = topId === B.grass || topId === B.podzol || topId === B.coarse_dirt;
    if (!onGrass) continue;
    if (dTrack < 3.2) { if (r < 0.2) set(x, top + 1, z, B.short_grass); continue; }
    const tree = hash3(x, 1, z, 101), pl = hash3(x, 2, z, 102);
    const far = colSurfDist[k] > 5.5 && dTrack > 4.2;
    const steepHere = w.steep(x, z) >= 2;
    if (style === 'alpine') {
      if (far && tree < 0.006 * TREE && !steepHere) spruce(x, top, z, 6 + Math.floor(hash3(x, 3, z, 103) * 7), 2);
      else if (far && tree < 0.009 * TREE && !steepHere) goldTree(x, top, z, 5 + Math.floor(hash3(x, 3, z, 104) * 3));
      else if (pl < 0.4 * PLANT) set(x, top + 1, z, B.short_grass);
      else if (pl < 0.43 * PLANT) set(x, top + 1, z, PLANTS[Math.floor(hash3(x, 4, z, 105) * 4)]);
      else if (pl < 0.46 * PLANT) { set(x, top + 1, z, B.tall_grass_bottom); set(x, top + 2, z, B.tall_grass_top); }
    } else if (style === 'cherry') {
      const onPlateau = colSurfDist[k] > 9.5 && !steepHere;
      if (onPlateau && far) {
        if (tree < 0.018 * TREE) cherry(x, top, z, 4 + Math.floor(hash3(x, 3, z, 111) * 3));
        else if (tree < 0.03 * TREE) autumn(x, top, z, 4 + Math.floor(hash3(x, 3, z, 112) * 3));
        else if (tree < 0.034 * TREE) spruce(x, top, z, 8 + Math.floor(hash3(x, 3, z, 113) * 6), 3);
      }
      if (pl < 0.42 * PLANT) set(x, top + 1, z, B.short_grass);
      else if (pl < 0.46 * PLANT) set(x, top + 1, z, PLANTS[Math.floor(hash3(x, 4, z, 114) * 4)]);
      else if (pl < 0.5 * PLANT) { set(x, top + 1, z, B.tall_grass_bottom); set(x, top + 2, z, B.tall_grass_top); }
    } else { // taiga
      if (far && !steepHere) {
        if (tree < 0.05 * TREE) spruce(x, top, z, 8 + Math.floor(hash3(x, 3, z, 121) * 9), 3 + (hash3(x, 5, z, 122) < 0.4 ? 1 : 0));
        else if (tree < 0.056 * TREE) autumn(x, top, z, 5);
        else if (tree < 0.07 * TREE) bush(x, top, z);
        else if (tree < 0.073 * TREE) goldTree(x, top, z, 7 + Math.floor(hash3(x, 3, z, 123) * 4));
      }
      if (pl < 0.3 * PLANT) set(x, top + 1, z, B.fern);
      else if (pl < 0.55 * PLANT) set(x, top + 1, z, B.short_grass);
      else if (pl < 0.58 * PLANT) set(x, top + 1, z, PLANTS[Math.floor(hash3(x, 4, z, 124) * 4)]);
    }
  }
  progress('vegetation');

  // ---------- cave biomes ----------
  const lushFloor = [], lushCeil = [];
  for (let z = oz + 2; z < oz + nz - 2; z++) for (let x = ox + 2; x < ox + nx - 2; x++) {
    const k = col(x, z), c = cells[colCell[k]], dc = colDist[k];
    if (!UNDER.has(c.biome) || c.biome === 'tunnel' || dc > 36) continue;
    const y0 = Math.max(oy + 1, c.yb - 24), y1 = Math.min(oy + ny - 2, c.yb + 24);
    for (let y = y0; y < y1; y++) {
      const id = data[I(x, y, z)];
      if (id === AIR || id === WATER) continue;
      const upAir = data[I(x, y + 1, z)] === AIR, dnAir = data[I(x, y - 1, z)] === AIR;
      const r = hash3(x, y, z, 130);
      if (c.biome === 'lush') {
        if (upAir && (id === B.moss_block || id === B.coarse_dirt)) {
          if (dc < 2.4) continue;
          if (r < 0.34) set(x, y + 1, z, B.short_grass);
          else if (r < 0.43) set(x, y + 1, z, B.fern);
          else if (r < 0.46) set(x, y + 1, z, PLANTS[Math.floor(hash3(x, y, z, 131) * 4)]);
          else if (r < 0.463 && dc > 4.5) lushFloor.push([x, y, z]);
        } else if (dnAir && r < 0.2 && dc > 1.5) {
          let L = 1 + Math.floor(hash3(x, y, z, 132) * 7), yy = y - 1; const lit = hash3(x, y, z, 133) < 0.45;
          for (let i = 0; i < L && data[I(x, yy, z)] === AIR; i++, yy--) {
            const last = i === L - 1 || data[I(x, yy - 1, z)] !== AIR;
            set(x, yy, z, last ? (lit ? B.cave_vines_lit : B.cave_vines) : (lit ? B.cave_vines_plant_lit : B.cave_vines_plant));
          }
        }
      } else if (c.biome === 'ice') {
        if (dnAir && r < 0.13 && dc > 1.5) {
          const L = 1 + Math.floor(hash3(x, y, z, 134) * 3);
          for (let i = 1; i <= L && data[I(x, y - i, z)] === AIR; i++) set(x, y - i, z, B.icicle);
        } else if (upAir && r < 0.03 && dc > 3.5) {
          const L = 1 + Math.floor(hash3(x, y, z, 135) * 5);
          for (let i = 1; i <= L; i++) {
            const wide = i <= L / 2;
            setIfAir(x, y + i, z, B.blue_ice);
            if (wide && L > 2 && i === 1) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setIfAir(x + dx, y + 1, z + dz, B.packed_ice);
          }
        }
      } else if (c.biome === 'deep') {
        // ancient city: broken deepslate pillars with soul lanterns at their feet, and lone lanterns on the sculk floor
        if (upAir && dc > 3 && (id === B.sculk || id === B.deepslate_tiles || id === B.polished_deepslate)) {
          if (r < 0.003) { const h = 4 + Math.floor(hash3(x, y, z, 136) * 7); for (let i = 1; i <= h; i++) setIfAir(x, y + i, z, i % 4 === 0 ? B.reinforced_deepslate : B.deepslate_bricks); setIfAir(x + 1, y + 1, z, B.soul_lantern); }
          else if (r < 0.012) set(x, y + 1, z, B.soul_lantern);
          else if (id === B.sculk && r < 0.03) set(x, y + 1, z, B.sculk_sensor);
          else if (id === B.sculk && r < 0.037 && dc > 4) { set(x, y + 1, z, B.sculk_catalyst); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y, z + dz) !== AIR && get(x + dx, y + 1, z + dz) === AIR) set(x + dx, y, z + dz, B.sculk); }
        } else if (dnAir && dc > 2 && r < 0.012) {        // soul lanterns hanging from the ceiling on chains
          const L = 2 + Math.floor(hash3(x, y, z, 137) * 4);
          let yy = y - 1, n = 0;
          while (n < L && data[I(x, yy, z)] === AIR) { set(x, yy, z, B.iron_chain); yy--; n++; }
          if (n > 0 && data[I(x, yy, z)] === AIR) set(x, yy, z, B.soul_lantern);
        }
      } else if (c.biome === 'nether') {
        if (upAir && id === B.netherrack && r < 0.05 && dc > 2) set(x, y + 1, z, B.fire);
        else if (upAir && id === B.soul_sand && r < 0.14 && dc > 2) set(x, y + 1, z, B.soul_fire);
        else if (dnAir && r < 0.0035 && dc > 2) {
          // lava fall
          let yy = y - 1;
          while (data[I(x, yy, z)] === AIR && yy > oy + 2) { set(x, yy, z, B.lava); yy--; }
        } else if (dnAir && r < 0.012 && dc > 3) {
          blob(x, y - 1, z, 1.6, 1.4, 1.6, () => B.glowstone, 0.0, 140);
        } else if (dnAir && r < 0.016 && dc > 3) set(x, y - 1, z, B.shroomlight);
      }
    }
  }
  for (const [x, y, z] of lushFloor) azaleaTree(x, y, z);
  progress('caves');

  // ---------- the End: floating islands ----------
  const endCells = cells.filter((c) => c.biome === 'end');
  const islands = [];
  endCells.forEach((c, i) => {
    if (c.kind === 'stop' || c.kind === 'end') islands.push({ x: c.x, z: c.z, y: c.yb - 2, r: 9.5, th: 6 });
    else if (i % 11 === 0) islands.push({ x: c.x + (hash3(c.x, 0, c.z, 150) - 0.5) * 6, z: c.z + (hash3(c.x, 1, c.z, 151) - 0.5) * 6, y: c.yb - 3 - Math.floor(hash3(c.x, 2, c.z, 152) * 3), r: 6 + hash3(c.x, 3, c.z, 153) * 3, th: 4 });
    if (i % 5 === 0) {
      const s = hash3(c.x, 4, c.z, 154) < 0.5 ? 1 : -1, off = 11 + hash3(c.x, 5, c.z, 155) * 16;
      islands.push({ x: c.x + (i % 2 ? s * off * 1.4 : 0) + 0.5, z: c.z + (i % 2 ? 0 : s * off * 1.4) + 0.5, y: c.yb - 4 - hash3(c.x, 6, c.z, 156) * 22, r: 5 + hash3(c.x, 7, c.z, 157) * 8, th: 3 + hash3(c.x, 8, c.z, 158) * 5 });
    }
  });
  w.islands = islands;
  const chorus = [];
  for (const isl of islands) {
    const R = Math.ceil(isl.r) + 2, th = Math.ceil(isl.th);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = Math.floor(isl.x) + dx, z = Math.floor(isl.z) + dz;
      if (x < ox || x >= ox + nx || z < oz || z >= oz + nz) continue;
      if (!w.isVoid(col(x, z))) continue;
      const hd = Math.hypot(dx + (Math.floor(isl.x) - isl.x), dz + (Math.floor(isl.z) - isl.z));
      const wob = 1 + (n2(x * 0.3, z * 0.3, 160) - 0.5) * 0.5;
      if (hd > isl.r * wob) continue;
      const surf = Math.floor(isl.y) + (n2(x * 0.2, z * 0.2, 161) > 0.7 ? 1 : 0);
      const depth = Math.ceil(th * Math.pow(1 - hd / (isl.r * wob), 0.7) * 1.4) + (hd < isl.r * 0.4 ? 1 : 0);
      for (let d = 0; d <= depth; d++) setIfAir(x, surf - d, z, B.end_stone);
      if (hd < isl.r * wob - 1 && hash3(x, 0, z, 162) < 0.024) chorus.push([x, surf, z]);
    }
    if (isl.r > 8.5 && isl.th >= 4) {
      const px = Math.floor(isl.x) + 3, pz = Math.floor(isl.z) - 2, ph = 7 + Math.floor(hash3(px, 0, pz, 163) * 7), sy = Math.floor(isl.y);
      if (isAir(px, sy + 1, pz) && get(px, sy, pz) === B.end_stone) { (w.pillarTops = w.pillarTops || []).push([px, sy + ph, pz]); for (let i = 1; i <= ph; i++) { set(px, sy + i, pz, B.obsidian); if (i < ph - 3) { set(px + 1, sy + i, pz, B.obsidian); set(px, sy + i, pz + 1, B.obsidian); set(px + 1, sy + i, pz + 1, B.obsidian); } } }
    }
  }
  for (const [x, y, z] of chorus) {
    if (get(x, y, z) !== B.end_stone || !isAir(x, y + 1, z)) continue;
    chorusTree(w, x, y, z, 1);
  }
  progress('islands');
}
