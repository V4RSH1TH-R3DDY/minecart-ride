// Biome terrain around the track. Each biome owns its own footprint along the serpentine track.
//   leg 0 desert, 1 alpine meadow/mountains, 2 cherry river canyon, 3 taiga valley, 4 lush cave, 5 ice cave, 6 deep dark ancient city,
//   7 nether lava cavern, 8 the End (floating islands), finale: stone tunnel climbing into the alpine meadow.
import { B, LIST, BIOME_IDS } from './blocks.js';
import { START_Y, DIRS } from './track.js';
import { hash3, n2, fbm2, n3, smooth, clamp01 } from './noise.js';
import { decorate } from './decor.js';
import { buildStructures, DECK, PILLAR } from './structures.js';

export const BIOME_OF_LEG = ['desert', 'alpine', 'cherry', 'taiga', 'lush', 'ice', 'deep', 'nether', 'end'];
const SURFACE = new Set(['desert', 'alpine', 'cherry', 'taiga']);
const UNDER = new Set(['lush', 'ice', 'deep', 'nether', 'tunnel']);
export const cellBiome = (c, lastLeg = BIOME_OF_LEG.length) => (c.bio && c.leg < lastLeg ? c.bio : c.leg >= lastLeg ? (c.yb >= START_Y - 6 ? 'alpine' : 'tunnel') : BIOME_OF_LEG[c.leg % BIOME_OF_LEG.length]);

const AIR = B.air, WATER = B.water, LAVA = B.lava;
const MARGIN = 40;
const NONE = -32000;

export function generateWorld(track, progress = () => {}) {
  const cells = track.cells;
  const lastLeg = track.stops.length;                 // the finale is leg index = number of stops
  for (const c of cells) {
    c.biome = cellBiome(c, lastLeg);
    if (c.leg === 1 && c.i <= track.stops[0].i + 26) c.biome = 'desert';       // the desert carries on for the first stretch of the ride out of slide 0
  }
  // a short stone tunnel leads out of every hall (and between two underground biomes of one leg) into an underground biome, so neighbouring caverns
  // are sealed off from each other by solid rock; no tunnel between two stretches of the same biome (End to End)
  const raw = cells.map((c) => c.biome);
  for (const c of cells) {
    if (c.leg >= 1 && c.leg < lastLeg && c.segStart != null && (raw[c.i] === 'end' || UNDER.has(raw[c.i])) && raw[c.segStart] !== raw[c.i] && c.i <= c.segStart + 18) c.biome = 'tunnel';
  }
  // guaranteed ponds beside the lush-cave rails (axolotls and glow squid live in them), alternating sides
  const lushPonds = cells.filter((c) => c.biome === 'lush' && c.i % 6 === 3 && c.shape === 'flat').map((c, k) => {
    const f = DIRS[c.dirIn], s = k % 2 ? 1 : -1;
    return [c.x + 0.5 + f[1] * s * 10, c.z + 0.5 - f[0] * s * 10];
  });
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9;
  for (const c of cells) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); minY = Math.min(minY, c.yb); }
  const ox = minX - MARGIN, oz = minZ - MARGIN, oy = minY - 24;
  const yTop = START_Y + 52;
  const nx = maxX - minX + 1 + MARGIN * 2, nz = maxZ - minZ + 1 + MARGIN * 2, ny = yTop - oy + 4;
  const data = new Uint8Array(nx * ny * nz);
  const I = (x, y, z) => (x - ox) + nx * ((z - oz) + nz * (y - oy));
  const inb = (x, y, z) => x >= ox && x < ox + nx && y >= oy && y < oy + ny && z >= oz && z < oz + nz;
  const get = (x, y, z) => (inb(x, y, z) ? data[I(x, y, z)] : B.stone);
  const set = (x, y, z, id) => { if (inb(x, y, z)) data[I(x, y, z)] = id; };
  const setIfAir = (x, y, z, id) => { if (inb(x, y, z)) { const i = I(x, y, z); if (data[i] === AIR) data[i] = id; } };

  // one flat water / lava level per leg, so rivers and lakes never step sideways into thin air
  const legMinYb = {};
  for (const c of cells) legMinYb[c.leg] = Math.min(legMinYb[c.leg] ?? 1e9, c.yb);
  const riverLevel = (c) => legMinYb[c.leg] - 4;
  const lavaLevel = (c) => legMinYb[c.leg] - 9;

  // ---- per-column nearest cells ----
  const NC = nx * nz;
  const col = (x, z) => (x - ox) + nx * (z - oz);
  const colCell = new Int16Array(NC), colDist = new Float32Array(NC);
  const colSurf = new Int16Array(NC).fill(-1), colSurfDist = new Float32Array(NC).fill(999);
  const colEndDist = new Float32Array(NC).fill(999);
  const colRiver = new Int16Array(NC).fill(NONE);
  const colTop = new Int16Array(NC), colWater = new Int16Array(NC).fill(NONE), colStyle = new Uint8Array(NC);
  const cxs = cells.map((c) => c.x + 0.5), czs = cells.map((c) => c.z + 0.5);
  const isSurf = cells.map((c) => SURFACE.has(c.biome));
  const isEnd = cells.map((c) => c.biome === 'end');
  for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
    const k = col(x, z), px = x + 0.5, pz = z + 0.5;
    let bd = 1e18, bi = 0, sd = 1e18, si = -1, ed = 1e18;
    for (let i = 0; i < cells.length; i++) {
      const dx = px - cxs[i], dz = pz - czs[i], d2 = dx * dx + dz * dz;
      const dd = isEnd[i] ? d2 * 0.72 : d2;
      if (dd < bd) { bd = dd; bi = i; }
      if (isSurf[i] && d2 < sd) { sd = d2; si = i; }
      if (isEnd[i] && d2 < ed) ed = d2;
    }
    colCell[k] = bi; { const dxx = px - cxs[bi], dzz = pz - czs[bi]; colDist[k] = Math.sqrt(dxx * dxx + dzz * dzz); }
    colSurf[k] = si; colSurfDist[k] = Math.sqrt(sd); colEndDist[k] = Math.sqrt(ed);
  }
  progress('columns');

  // ---- surface heightfield ----
  // Nothing here is a plain function of straight distance to the rail: the distance is domain-warped so edges meander, the
  // landforms are layered noise, and cliffs get rounded slopes with occasional sheer faces.
  const R_END = 70;
  const isVoid = (k) => cells[colCell[k]].biome === 'end' && colDist[k] < R_END;
  const warped = (x, z, d) => {                     // meandering distance: unchanged right at the rail, wobbles further out
    const k = smooth(clamp01((d - 3) / 12));
    return d + k * ((fbm2(x * 0.045, z * 0.045, 60, 3) - 0.5) * 20 + (fbm2(x * 0.13, z * 0.13, 61, 2) - 0.5) * 5);
  };
  for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
    const k = col(x, z);
    if (isVoid(k)) { colTop[k] = NONE; colStyle[k] = BIOME_IDS.indexOf('end'); continue; }
    const si = colSurf[k], d0 = colSurfDist[k], c = si >= 0 ? cells[si] : null;
    const d = warped(x, z, d0);
    // flowing coordinates for the big landforms
    const fx = x + (fbm2(x * 0.02, z * 0.02, 50, 2) - 0.5) * 36, fz = z + (fbm2(x * 0.02 + 40, z * 0.02, 51, 2) - 0.5) * 36;
    const ridge = 1 - Math.abs(2 * fbm2(fx * 0.014, fz * 0.014, 11, 5) - 1);
    const mount = Math.pow(ridge, 1.35) * 60 + fbm2(fx * 0.045, fz * 0.045, 12, 4) * 14;
    const t = smooth(clamp01((d - 30) / 52));
    const hills = (fbm2(fx * 0.03, fz * 0.03, 16, 4) - 0.5) * 16;          // gentle rolling ground
    const H = START_Y + 3 + hills * smooth(clamp01((d - 6) / 26)) + fbm2(x * 0.09, z * 0.09, 13, 3) * 4 + t * mount;
    let top = H, style = 'alpine', water = NONE;
    if (c && d0 < 90) {
      style = c.biome;
      const nz1 = fbm2(x * 0.1, z * 0.1, 14, 3), big = fbm2(fx * 0.035, fz * 0.035, 17, 3);
      if (style === 'desert') {
        // rolling dunes: long ridges plus fine ripples, easing up from the rail, with the odd oasis pond
        const ridge = Math.sin((x * 0.5 + z * 0.8) * 0.11 + fbm2(x * 0.03, z * 0.03, 19, 2) * 6) * 0.5 + 0.5;
        const dune = (ridge * 7 + (big - 0.5) * 8 + nz1 * 2) * smooth(clamp01((d - 3) / 9));
        top = Math.min(H + 2, c.yb - 1 + Math.pow(Math.max(0, d - 7), 1.08) * 0.32 + dune);
        const oasis = fbm2(x * 0.06, z * 0.06, 20, 3);
        if (oasis > 0.64 && d > 7 && d < 42) { top = Math.min(top, c.yb - 3); water = c.yb - 2; }
      } else if (style === 'alpine') {
        const g = c.yb - 1 + Math.pow(Math.max(0, d - 8), 1.12) * 0.55 + (nz1 - 0.5) * 3 * smooth(clamp01((d - 2) / 5)) + (big - 0.5) * 9 * smooth(clamp01((d - 10) / 18));
        top = Math.min(H + 2, g);
      } else if (style === 'cherry') {
        // a winding river in a canyon: width varies along its length, banks shelve, and the walls ease up to a rolling plateau
        const W = riverLevel(c), width = 5.5 + (big - 0.5) * 6 + nz1 * 2;
        const plateau = Math.min(H, c.yb + 12 + (big - 0.5) * 12 + nz1 * 4);
        if (d < width) { top = W - 3 + Math.floor(Math.max(0, d - width + 2.5) * 0.9); water = W; }
        else {
          const run = 7 + big * 12, u = clamp01((d - width) / run);                 // how far we are up the bank
          const sheer = smooth(clamp01((fbm2(fx * 0.05, fz * 0.05, 18, 2) - 0.5) * 6));   // some stretches are steep cliffs
          const prof = Math.pow(smooth(u), 1 - 0.45 * sheer);
          top = W + 1 + (plateau - W - 1) * prof;
        }
        colRiver[k] = W;
      } else { // taiga
        const pond = fbm2(x * 0.07, z * 0.07, 15, 3);
        const g = c.yb - 1 + Math.pow(Math.max(0, d - 12), 1.1) * 0.5 + (nz1 - 0.5) * 3.5 * smooth(clamp01((d - 3) / 6)) + (big - 0.5) * 12 * smooth(clamp01((d - 8) / 20));
        top = Math.min(H + 2, g);
        if (pond > 0.58 && d > 4.5 && d < 44) { top = Math.min(top, c.yb - 3); water = c.yb - 2; }
      }
    }
    colTop[k] = Math.floor(top + 0.5); colWater[k] = Math.floor(water); colStyle[k] = BIOME_IDS.indexOf(style);
  }
  // track cells keep a firm bed under the rail on land biomes
  for (const c of cells) {
    if (c.biome === 'cherry' || c.biome === 'end') continue;
    if (!SURFACE.has(c.biome)) continue;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const k = col(c.x + dx, c.z + dz), ch = Math.max(Math.abs(dx), Math.abs(dz));
      if (ch === 0) { colTop[k] = c.yb - 1; colWater[k] = NONE; } else if (colTop[k] < c.yb - 1 - ch) colTop[k] = c.yb - 1 - ch;
    }
  }
  progress('heightfield');

  // steepness for rock exposure
  const steep = (x, z) => {
    const t = colTop[col(x, z)];
    let m = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz;
      if (xx < ox || xx >= ox + nx || zz < oz || zz >= oz + nz) continue;
      m = Math.max(m, Math.abs(colTop[col(xx, zz)] - t));
    }
    return m;
  };
  const DEEP_Y = START_Y - 30;

  // ---- fill, with cave carving for underground biomes ----
  const SEA_STYLE = BIOME_IDS.indexOf('cherry');
  for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
    const k = col(x, z);
    const top = colTop[k];
    if (top === NONE) continue;
    const style = BIOME_IDS[colStyle[k]];
    const cell = cells[colCell[k]], dc = colDist[k], ub = UNDER.has(cell.biome) && dc < 36;
    const wlvl = colWater[k];
    const st = steep(x, z);
    const top0 = Math.min(top, yTop);
    for (let y = oy; y <= Math.min(yTop, Math.max(top0, wlvl)); y++) {
      let id;
      if (y > top0) id = y <= wlvl ? WATER : AIR;
      else {
        const depth = top0 - y;
        if (depth === 0) id = surfaceBlock(style, x, y, z, k, st, cell, top0);
        else if (depth <= (style === 'cherry' ? 2 : style === 'desert' ? 6 : 3)) id = subBlock(style, x, y, z, k, st, cell, depth);
        else id = rockBlock(x, y, z, DEEP_Y);
        if (ub) {
          const c2 = carve(cell, x, y, z, dc);
          if (c2 !== -1) id = c2;
        }
      }
      data[I(x, y, z)] = id;
    }
  }
  progress('fill');


  function surfaceBlock(style, x, y, z, k, st, cell, top) {
    if (style === 'desert') return st >= 4 ? B.sandstone : B.sand;
    const snow = START_Y + 30 + (hash3(x, 0, z, 3) - 0.5) * 6 + n2(x * 0.1, z * 0.1, 9) * 8;
    if (style === 'cherry') {
      const W = colRiver[k];
      if (W !== NONE && top <= W + 4) return top <= W - 2 ? (hash3(x, 0, z, 4) < 0.25 ? B.gravel : B.sand) : B.sandstone;
      if (st >= 3) return stripe(x, y, z);
      return B.grass;
    }
    if (st >= 3 && y > START_Y - 6) return y > snow ? B.snow : stripe(x, y, z);
    if (y > snow) return B.snow;
    if (style === 'taiga') {
      const r = fbm2(x * 0.12, z * 0.12, 16, 3);
      const c = cells[colSurf[k]];
      if (colWater[k] !== NONE && top < c.yb - 2) return hash3(x, 0, z, 5) < 0.3 ? B.clay : B.gravel;
      if (colWater[k] === NONE && c && top <= c.yb - 2) return B.gravel;
      return r > 0.62 ? B.podzol : r > 0.52 ? B.coarse_dirt : B.grass;
    }
    return B.grass; // alpine
  }
  function subBlock(style, x, y, z, k, st, cell, depth = 1) {
    if (style === 'desert') return depth <= 1 ? B.sand : B.sandstone;
    if (style === 'cherry' && colRiver[k] !== NONE && colTop[k] <= colRiver[k] + 4) return B.sandstone;
    return B.dirt;
  }
  function stripe(x, y, z) {
    const v = (Math.floor(y / 2) * 7 + Math.floor(n2(x * 0.15, z * 0.15, 6) * 5)) % 5;
    return v === 0 ? B.calcite : v === 1 ? B.andesite : v === 2 ? B.stone : v === 3 ? B.tuff : B.calcite;
  }
  function rockBlock(x, y, z, deepY) {
    const r = hash3(x, y, z, 1);
    const deep = y <= deepY + (hash3(x, y, z, 7) < 0.4 ? 1 : 0);
    if (deep) {
      if (r < 0.02) return B.deepslate_coal_ore; if (r < 0.03) return B.deepslate_iron_ore; if (r < 0.037) return B.deepslate_gold_ore;
      if (r < 0.041) return B.deepslate_diamond_ore; if (r < 0.05) return B.deepslate_redstone_ore; if (r < 0.056) return B.deepslate_lapis_ore;
      return hash3(x >> 2, y >> 1, z >> 2, 2) < 0.12 ? B.tuff : B.deepslate;
    }
    if (r < 0.02) return B.coal_ore; if (r < 0.03) return B.iron_ore; if (r < 0.036) return B.gold_ore;
    if (r < 0.04) return B.diamond_ore; if (r < 0.048) return B.redstone_ore; if (r < 0.054) return B.lapis_ore;
    const p = hash3(x >> 2, y >> 1, z >> 2, 2);
    return p < 0.1 ? B.andesite : p < 0.15 ? B.gravel : B.stone;
  }

  // returns -1 to keep the rock, or AIR / WATER / LAVA when the voxel is inside the cavern
  function carve(cell, x, y, z, dc) {
    const b = cell.biome, yb = cell.yb;
    if (b === 'tunnel') {
      // an arched oval of varying width instead of a square bore
      const dx = x + 0.5 - (cell.x + 0.5), dz = z + 0.5 - (cell.z + 0.5), r = Math.hypot(dx, dz);
      const slope = cell.shape === 'up' || cell.shape === 'down' ? 1 : 0;
      const R = 3.9 + (n3(x * 0.16, y * 0.16, z * 0.16, 80) - 0.5) * 2.2;
      if (r > R) return -1;
      const arch = 3 + 5.2 * Math.sqrt(Math.max(0, 1 - (r / R) * (r / R)));
      return y >= yb && y - yb <= arch + slope ? AIR : -1;
    }
    // warped distance: every cavern edge wobbles in all three axes, so the rock never forms straight bands
    const nn = fbm2(x * 0.09, z * 0.09, 21, 3), n3v = n3(x * 0.12, y * 0.12, z * 0.12, 22);
    const near = smooth(clamp01((dc - 2) / 5));
    const dw = dc + near * ((n3(x * 0.07, y * 0.09, z * 0.07, 70) - 0.5) * 14 + (fbm2(x * 0.05, z * 0.05, 71, 3) - 0.5) * 10);
    const bump = (fbm2(x * 0.16 + y * 0.05, z * 0.16, 72, 2) - 0.5);
    if (b === 'lush') {
      const R = 14 + nn * 10;
      if (dw > R) return -1;
      const u = dw / R;
      let pond = 0;
      for (const [px, pz] of lushPonds) pond = Math.max(pond, smooth(clamp01((9 - Math.hypot(x + 0.5 - px, z + 0.5 - pz)) / 3)));
      const pm = Math.max(smooth(clamp01((fbm2(x * 0.07, z * 0.07, 23, 2) - 0.5) * 6)), pond) * (dc > 4 ? 1 : 0);
      const fl0 = yb - 1 + Math.pow(Math.max(0, dw - 7) / 7, 1.4) * 5 + (nn - 0.5) * 3 * near + bump * 2.2 * near;
      const floorY = fl0 * (1 - pond) + (yb - 1) * pond - pm * 6;       // the guaranteed ponds sit in a flat basin, so their rims always hold the water in
      const ceilY = yb + 3 + 13 * (1 - u * u) + (n3v - 0.5) * 5 * near;
      if (y <= floorY || y > ceilY) return -1;
      return y <= yb - 3 && pm > 0.2 ? WATER : AIR;
    }
    if (b === 'ice') {
      const R = 15 + nn * 9;
      if (dw > R) return -1;
      const u = dw / R;
      const floorY = yb - 1 + Math.pow(Math.max(0, dw - 8) / 7, 1.35) * 5 + (nn - 0.5) * 4 * near + bump * 2.6 * near;
      const ceilY = yb + 3 + 16 * (1 - u * u) + (n3v - 0.5) * 6 * near;
      return y <= floorY || y > ceilY ? -1 : AIR;
    }
    if (b === 'deep') {                              // the deep dark: a wide cathedral of a cave, tall ceiling
      const R = 17 + nn * 10;
      if (dw > R) return -1;
      const u = dw / R;
      const floorY = yb - 1 + Math.pow(Math.max(0, dw - 9) / 8, 1.3) * 4 + (nn - 0.5) * 3 * near + bump * 2.2 * near;
      const ceilY = yb + 6 + 18 * (1 - u * u) + (n3v - 0.5) * 6 * near;
      return y <= floorY || y > ceilY ? -1 : AIR;
    }
    if (b === 'nether') {
      const R = 20 + nn * 12;
      if (dw > R) return -1;
      const u = dw / R;
      const lv = lavaLevel(cell);
      const ledge = fbm2(x * 0.06, z * 0.06, 31, 3) - 0.45;
      const floorY = lv - 5 + ledge * 26 * smooth(clamp01((dc - 4) / 4)) + Math.max(0, dw - 14) * 0.95 + bump * 3 * near;
      const ceilY = yb + 4 + 17 * (1 - Math.pow(u, 1.6)) + (n3v - 0.5) * 6 * near;
      if (y <= floorY || y > ceilY) return -1;
      return y <= lv ? LAVA : AIR;
    }
    return -1;
  }

  // ---- exposed-surface skin (cave walls, cliff faces) ----
  const solidAt = (x, y, z) => { const v = get(x, y, z); return v !== AIR && LIST[v].kind !== 'cross' && LIST[v].kind !== 'liquid' || v === LAVA; };
  const open = (x, y, z) => inb(x, y, z) && (data[I(x, y, z)] === AIR || data[I(x, y, z)] === WATER);
  for (let z = oz + 1; z < oz + nz - 1; z++) for (let x = ox + 1; x < ox + nx - 1; x++) {
    const k = col(x, z);
    const cell = cells[colCell[k]], dc = colDist[k];
    const ub = UNDER.has(cell.biome) && dc < 36 && cell.biome !== 'tunnel';
    const dEnd = colEndDist[k];
    const darkRock = colTop[k] !== NONE && (dEnd < 34 || (dEnd < 56 && hash3(x >> 1, 0, z >> 1, 97) < (56 - dEnd) / 22));   // dark End rock thins out gradually
    const style = BIOME_IDS[colStyle[k]];
    const top = colTop[k];
    for (let y = oy + 1; y < oy + ny - 1; y++) {
      const i = I(x, y, z), id = data[i];
      if (id === AIR || id === WATER || id === LAVA) continue;
      const up = open(x, y + 1, z), dn = open(x, y - 1, z);
      const sd = open(x + 1, y, z) || open(x - 1, y, z) || open(x, y, z + 1) || open(x, y, z - 1);
      if (!up && !dn && !sd) continue;
      const r = hash3(x, y, z, 41), r2 = fbm2(x * 0.2 + y * 0.1, z * 0.2, 42, 2);
      if (ub && Math.abs(y - cell.yb) < 30) {
        data[i] = skinUnder(cell, x, y, z, up, dn, r, r2);
      } else if (darkRock) {
        if (up && y >= top) data[i] = r < 0.5 ? B.blackstone : B.obsidian;
        else data[i] = r < 0.4 ? B.blackstone : r < 0.6 ? B.smooth_basalt : r < 0.7 ? B.obsidian : B.basalt;
      } else if (!up || y < top) {
        // cliff / mountain faces on the surface
        if (style === 'cherry' || style === 'alpine' || style === 'taiga') {
          if (id === B.dirt || id === B.grass || id === B.podzol || id === B.coarse_dirt) { if (sd && !up && y < top - 2) data[i] = stripe(x, y, z); }
          else if (id === B.stone || id === B.andesite || id === B.gravel || id === B.tuff || id === B.deepslate || id === B.sandstone) { if (sd) data[i] = style === 'alpine' ? stripe(x, y, z) : (y < DEEP_Y ? id : stripe(x, y, z)); }
        }
      }
    }
  }
  progress('skin');

  // ---- water that is not contained by solid blocks would float: drain it (per connected body) ----
  {
    const seen = new Uint8Array(data.length), stack = [], dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    const leaks = (x, y, z) => {
      for (const [dx, , dz] of dirs) if (inb(x + dx, y, z + dz) && data[I(x + dx, y, z + dz)] === AIR) return true;
      return inb(x, y - 1, z) && data[I(x, y - 1, z)] === AIR;
    };
    for (let y = oy; y < oy + ny; y++) for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
      const i0 = I(x, y, z);
      if (data[i0] !== WATER || seen[i0]) continue;
      const body = []; let lowestLeak = 1e9;
      stack.push([x, y, z]); seen[i0] = 1;
      while (stack.length) {
        const [cx, cy, cz] = stack.pop();
        body.push([cx, cy, cz]);
        if (cy < lowestLeak && leaks(cx, cy, cz)) lowestLeak = cy;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx2 = cx + dx, ny2 = cy + dy, nz2 = cz + dz;
          if (!inb(nx2, ny2, nz2)) continue;
          const j = I(nx2, ny2, nz2);
          if (data[j] === WATER && !seen[j]) { seen[j] = 1; stack.push([nx2, ny2, nz2]); }
        }
      }
      if (lowestLeak < 1e9) for (const [bx, by, bz] of body) if (by >= lowestLeak) data[I(bx, by, bz)] = AIR;
    }
  }
  progress('water');

  function skinUnder(cell, x, y, z, up, dn, r, r2) {
    const b = cell.biome;
    if (b === 'lush') {
      if (up) {
        const wet = open(x, y + 1, z) && (get(x, y + 1, z) === WATER);
        if (wet) return r < 0.4 ? B.clay : r < 0.7 ? B.mud : B.sandstone;
        // beside water: sand/clay shore
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + 1, z + dz) === WATER) return r < 0.5 ? B.sandstone : B.clay;
        return r2 > 0.62 ? B.coarse_dirt : B.moss_block;
      }
      if (dn) return r < 0.55 ? B.moss_block : r < 0.75 ? B.dripstone_block : r < 0.9 ? B.tuff : B.stone;
      return r < 0.3 ? B.moss_block : r < 0.5 ? B.mossy_cobblestone : r < 0.7 ? B.tuff : B.stone;
    }
    if (b === 'ice') {
      if (up) return r2 > 0.55 ? B.snow : r < 0.5 ? B.packed_ice : B.blue_ice;
      return r < 0.45 ? B.packed_ice : r < 0.8 ? B.blue_ice : r < 0.92 ? B.snow : B.stone;
    }
    if (b === 'deep') {
      if (up) return r2 > 0.6 ? B.sculk : r < 0.5 ? B.deepslate_tiles : r < 0.8 ? B.polished_deepslate : B.tuff;
      if (dn) return r < 0.5 ? B.deepslate : r < 0.75 ? B.sculk : B.tuff;
      return r < 0.35 ? B.deepslate_bricks : r < 0.6 ? B.deepslate : r < 0.8 ? B.cobbled_deepslate : B.tuff;
    }
    if (b === 'nether') {
      if (up) return r < 0.07 ? B.magma : r < 0.18 ? B.soul_sand : r2 > 0.7 ? B.basalt : B.netherrack;
      if (dn) return r < 0.12 ? B.blackstone : B.netherrack;
      const band = Math.floor((y + r2 * 6) / 3) % 4;
      return band === 0 ? B.basalt : band === 1 ? B.blackstone : B.netherrack;
    }
    return B.stone;
  }

  // ---- everything that sits on top: islands, trees, plants, structures ----
  const w = { data, nx, ny, nz, ox, oy, oz, yTop, I, inb, get, set, setIfAir, cells, track, col, colCell, colDist, colTop, colWater, colStyle,
    colSurf, colSurfDist, colEndDist, isVoid, hash3, n2, fbm2, n3, UNDER, SURFACE, DEEP_Y, steep, NONE };
  w.lights = [];
  decorate(w, progress);
  buildStructures(w, progress);

  // rails must always have a clear corridor
  for (const c of cells) {
    for (let y = c.yb; y <= c.yb + (c.shape === 'flat' ? 2 : 3); y++) for (const [dx, dz] of [[0, 0]]) {
      const id = get(c.x + dx, y, c.z + dz);
      if (id !== AIR && LIST[id].kind !== 'chain') set(c.x + dx, y, c.z + dz, AIR);
    }
    if (c.shape === 'up') set(c.x, c.yb + 1, c.z, AIR);
  }
  // last word on support: whatever the halls' clearings, caves or tunnels removed, every rail sits on a solid block (and a pillar down to solid ground if there is nothing below)
  const holds = (id) => id !== AIR && (LIST[id].kind === 'cube');
  for (const c of cells) {
    if (holds(get(c.x, c.yb - 1, c.z))) continue;
    set(c.x, c.yb - 1, c.z, B[DECK[c.biome]] || B.stone_bricks);
    for (let y = c.yb - 2, n = 0; n < 70 && y > oy + 1 && !holds(get(c.x, y, c.z)); y--, n++) set(c.x, y, c.z, B[PILLAR[c.biome]] || B.stone_bricks);
  }
  progress('structures');
  return w;
}
