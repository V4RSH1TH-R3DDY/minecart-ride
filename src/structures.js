// Track furniture: bridge decks and supports, lanterns on chains, and the checkpoint halls with their sign walls.
import { B, LIST } from './blocks.js';
import { DIRS } from './track.js';
import { n2 } from './noise.js';
import { chorusTree } from './decor.js';

export const DECK = { alpine: 'spruce_planks', cherry: 'dark_oak_planks', taiga: 'spruce_planks', lush: 'oak_planks', ice: 'spruce_planks', nether: 'blackstone', end: 'obsidian', tunnel: 'oak_planks', desert: 'oak_planks', deep: 'deepslate_tiles' };
export const PILLAR = { alpine: 'spruce_log', cherry: 'dark_oak_log', taiga: 'spruce_log', lush: 'oak_log', ice: 'spruce_log', nether: 'blackstone', end: 'obsidian', tunnel: 'oak_log', desert: 'oak_log', deep: 'deepslate_bricks' };
const FLOOR = { alpine: 'cobblestone', cherry: 'stone_bricks', taiga: 'cobblestone', lush: 'mossy_cobblestone', ice: 'stone_bricks', nether: 'nether_bricks', end: 'end_stone', tunnel: 'stone_bricks', desert: 'sandstone', deep: 'deepslate_bricks' };

export function buildStructures(w, progress) {
  const { get, set, cells, track, hash3, UNDER } = w;
  const AIR = B.air;
  const isOpen = (id) => id === AIR || id === B.water || id === B.lava || LIST[id].kind === 'cross' || LIST[id].kind === 'lily';
  const stopIdx = track.stops.map((c) => c.i).concat(track.endCell ? [track.endCell.i] : []);
  const nearStop = (i, r = 7) => stopIdx.some((k) => Math.abs(k - i) <= r);
  const sideOf = (c) => { const f = DIRS[c.dirIn]; return [f[1], -f[0]]; }; // left

  // ---- decks, pillars, lanterns ----
  for (const c of cells) {
    const biome = c.biome;
    const deck = B[DECK[biome]], pillar = B[PILLAR[biome]];
    // deck block under every rail where the ground is missing
    if (isOpen(get(c.x, c.yb - 1, c.z))) set(c.x, c.yb - 1, c.z, deck);
    const [lx, lz] = sideOf(c);
    // pillars every third cell down to solid ground (or the world floor)
    if (c.i % 3 === 0) {
      let y = c.yb - 2, n = 0;
      if (isOpen(get(c.x, y, c.z))) {
        while (isOpen(get(c.x, y, c.z)) && n < 70 && y > w.oy + 1) { set(c.x, y, c.z, pillar); y--; n++; }
        for (const s of [-1, 1]) if (isOpen(get(c.x + lx * s, c.yb - 2, c.z + lz * s))) set(c.x + lx * s, c.yb - 2, c.z + lz * s, deck);
      }
    }
    if (nearStop(c.i)) continue;
    const flat = c.shape === 'flat' && cells[c.i - 1] && cells[c.i + 1] && cells[c.i - 1].shape === 'flat' && cells[c.i + 1].shape === 'flat';
    // standing lantern beside the rail
    if (flat && c.i % 5 === 2 && c.kind !== 'detector') {
      const s = (c.i / 5 | 0) % 2 ? 1 : -1;
      const px = c.x + lx * s, pz = c.z + lz * s;
      if (isOpen(get(px, c.yb, pz))) {
        if (isOpen(get(px, c.yb - 1, pz))) set(px, c.yb - 1, pz, deck);
        set(px, c.yb, pz, biome === 'ice' || biome === 'end' || biome === 'deep' ? B.soul_lantern : B.lantern);
      }
    }
    // lanterns hanging on chains from the ceiling in caves and the climbing tunnel (slopes too)
    if (c.shape !== 'turn' && (UNDER.has(biome) || biome === 'tunnel') && c.i % (biome === 'tunnel' ? 5 : 8) === 4) {
      const ly = c.yb + (c.shape === 'flat' ? 3 : 4);
      let ceil = -1;
      for (let y = ly + 1; y <= ly + 20; y++) if (!isOpen(get(c.x, y, c.z)) && LIST[get(c.x, y, c.z)].kind !== 'chain') { ceil = y; break; }
      if (ceil > 0) {
        for (let y = ly + 1; y < ceil; y++) set(c.x, y, c.z, B.iron_chain);
        set(c.x, ly, c.z, biome === 'ice' || biome === 'deep' ? B.soul_lantern : B.lantern);
      }
    }
    // the lava cavern bridge hangs from chains
    if (biome === 'nether' && c.i % 4 === 1) {
      for (const s of [-1, 1]) {
        const px = c.x + lx * s, pz = c.z + lz * s;
        let ceil = -1;
        for (let y = c.yb; y <= c.yb + 24; y++) if (!isOpen(get(px, y, pz))) { ceil = y; break; }
        if (ceil > 0 && isOpen(get(px, c.yb - 1, pz))) {
          set(px, c.yb - 1, pz, B.blackstone);
          for (let y = c.yb; y < ceil; y++) if (get(px, y, pz) === AIR) set(px, y, pz, B.iron_chain);
        }
      }
    }
  }
  // mine support frames in the finale tunnel
  for (const c of cells) {
    if (c.biome !== 'tunnel' || c.shape !== 'flat' || c.i % 6 !== 0 || nearStop(c.i)) continue;
    const [lx, lz] = sideOf(c);
    for (const s of [-1, 1]) for (let y = c.yb; y < c.yb + 4; y++) set(c.x + lx * 2 * s, y, c.z + lz * 2 * s, B.oak_log);
    for (let k = -2; k <= 2; k++) if (get(c.x + lx * k, c.yb + 4, c.z + lz * k) === AIR || Math.abs(k) === 2) set(c.x + lx * k, c.yb + 4, c.z + lz * k, B.oak_planks);
  }
  progress('track');

  // ---- checkpoint halls: each biome builds its gate, floor and lantern posts from its own blocks ----
  // floor / post / beam are block lists mixed per voxel; trim edges the platform; cap is a canopy over the gate;
  // hang dangles under the beam; flag is the flagpole banner; corner decorates the platform corners.
  const HALL = {
    desert: { floor: ['sandstone', 'cut_sandstone', 'sandstone', 'terracotta', 'sandstone', 'cut_sandstone'], trim: 'cut_sandstone', post: ['cut_sandstone', 'sandstone'], base: 'sandstone', beam: ['orange_terracotta', 'cut_sandstone'], cap: null, capSpread: 0, hang: null, flag: 'red_wool', pole: 'dark_oak_log', lamp: 'lantern', corner: 'cactus' },
    deep: { floor: ['deepslate_tiles', 'polished_deepslate', 'deepslate_bricks', 'deepslate_tiles', 'sculk', 'cobbled_deepslate'], trim: 'polished_deepslate', post: ['deepslate_bricks', 'reinforced_deepslate'], base: 'deepslate_bricks', beam: ['reinforced_deepslate', 'deepslate_tiles'], cap: null, capSpread: 0, hang: 'iron_chain', flag: 'sculk', pole: 'deepslate_bricks', lamp: 'soul_lantern', corner: 'sculk' },
    alpine: { floor: ['stone_bricks', 'cobblestone', 'andesite', 'stone_bricks', 'calcite'], trim: 'cobblestone', post: ['stone_bricks', 'cobblestone', 'andesite'], base: 'cobblestone', beam: ['spruce_planks', 'stone_bricks'], cap: 'snow', capSpread: 0, hang: null, flag: 'red_wool', pole: 'spruce_log', lamp: 'lantern', corner: null },
    cherry: { floor: ['sandstone', 'stone_bricks', 'sandstone', 'cherry_planks'], trim: 'cherry_planks', post: ['cherry_log'], base: 'sandstone', beam: ['cherry_planks'], cap: 'cherry_leaves', capSpread: 1, hang: null, flag: 'red_wool', pole: 'cherry_log', lamp: 'lantern', corner: 'cherry_leaves' },
    taiga: { floor: ['coarse_dirt', 'podzol', 'cobblestone', 'mossy_cobblestone', 'gravel', 'podzol'], trim: 'andesite', post: ['spruce_log'], base: 'cobblestone', beam: ['spruce_planks'], cap: 'spruce_leaves', capSpread: 1, hang: null, flag: 'red_wool', pole: 'spruce_log', lamp: 'lantern', corner: 'spruce_leaves' },
    lush: { floor: ['moss_block', 'mossy_cobblestone', 'clay', 'moss_block', 'mud', 'moss_block'], trim: 'dripstone_block', post: ['dripstone_block', 'mossy_cobblestone', 'moss_block'], base: 'mossy_cobblestone', beam: ['oak_planks', 'mossy_cobblestone'], cap: 'flowering_azalea_leaves', capSpread: 1, hang: 'cave_vines_lit', flag: 'moss_block', pole: 'oak_log', lamp: 'lantern', corner: 'azalea_leaves' },
    ice: { floor: ['snow', 'packed_ice', 'snow', 'blue_ice', 'snow'], trim: 'blue_ice', post: ['blue_ice', 'packed_ice'], base: 'packed_ice', beam: ['blue_ice', 'packed_ice'], cap: 'snow', capSpread: 1, hang: 'icicle', flag: 'white_wool', pole: 'packed_ice', lamp: 'soul_lantern', corner: 'blue_ice' },
    nether: { floor: ['nether_bricks', 'blackstone', 'basalt', 'nether_bricks', 'soul_sand', 'magma', 'nether_bricks'], trim: 'blackstone', post: ['blackstone', 'basalt', 'nether_bricks'], base: 'basalt', beam: ['nether_bricks', 'blackstone', 'glowstone'], cap: null, capSpread: 0, hang: 'iron_chain', flag: 'red_wool', pole: 'blackstone', lamp: 'lantern', corner: 'fire' },
    end: { floor: ['end_stone', 'obsidian', 'end_stone', 'end_stone'], trim: 'obsidian', post: ['obsidian', 'amethyst_block'], base: 'obsidian', beam: ['obsidian', 'amethyst_block'], cap: null, capSpread: 0, hang: null, flag: 'amethyst_block', pole: 'obsidian', lamp: 'soul_lantern', corner: 'chorus' },
    tunnel: { floor: ['stone_bricks', 'cobblestone', 'stone_bricks'], trim: 'cobblestone', post: ['oak_log'], base: 'stone_bricks', beam: ['oak_planks'], cap: null, capSpread: 0, hang: null, flag: 'red_wool', pole: 'oak_log', lamp: 'lantern', corner: null },
  };
  const blk = (n) => { if (!(n in B)) throw new Error('unknown block ' + n); return B[n]; };
  let inHall = () => true;
  const stopInfo = [];
  const stopCells = track.stops.concat(track.endCell ? [track.endCell] : []);
  stopCells.forEach((c, idx) => {
    const f = DIRS[c.dirIn], l = [f[1], -f[0]];
    const P = (a, lat) => [c.x + f[0] * a + l[0] * lat, c.z + f[1] * a + l[1] * lat];
    const put = (a, lat, y, id) => { const [x, z] = P(a, lat); set(x, y, z, id); };
    const isEnd = c === track.endCell;
    const H = HALL[c.biome] || HALL.alpine;
    const mix = (list, a, lat, y) => blk(list[Math.floor(hash3(c.x * 5 + a, y, c.z * 7 + lat, 211) * list.length)]);
    const lamp = blk(H.lamp), flag = blk(H.flag);
    // clear room for the hall and lay a mixed platform with a trimmed edge
    // organic oval platform (wobbling edge) on a foundation, with a domed clearing above it
    const hn = (a, lat) => (n2(c.x * 0.37 + a * 0.33, c.z * 0.37 + lat * 0.33, 91) - 0.5) * 0.34;
    const hallR = (a, lat) => Math.hypot(a / 9.8, (lat - 2) / 7.8) - hn(a, lat);      // < 1 inside the platform
    inHall = (a, lat, m = 0) => hallR(a, lat) < 1 + m;
    for (let a = -13; a <= 13; a++) for (let lat = -9; lat <= 13; lat++) {
      const r = hallR(a, lat), rc = Math.hypot(a / 11.4, (lat - 2) / 9.4) - hn(a, lat) * 0.8;
      for (let y = c.yb; y <= c.yb + 12; y++) { const dy = (y - c.yb) / 10.5; if (rc * rc + dy * dy < 1) put(a, lat, y, AIR); }
      if (r < 1) {
        put(a, lat, c.yb - 1, r > 0.84 ? blk(H.trim) : mix(H.floor, a, lat, 0));
        const [fx, fz] = P(a, lat);                      // foundation: fill down to solid ground so the platform never floats
        for (let y = c.yb - 2, n = 0; n < 14 && y > w.oy + 1 && isOpen(get(fx, y, fz)); y--, n++) set(fx, y, fz, r > 0.7 ? blk(H.base) : mix(H.post, a, lat, y));
      }
    }
    if (!isEnd) {
    // gate over the rail, three blocks ahead of the stop so the cart halts just before it and the view behind the cart stays open
    const GA = 3, gput = (a, lat, y, id) => put(a + GA, lat, y, id);
    for (const a of [-2, 2]) {
      gput(a, -1, c.yb, blk(H.base));
      for (let y = c.yb + 1; y <= c.yb + 3; y++) gput(a, -1, y, mix(H.post, a, -1, y));
    }
    for (let a = -2; a <= 2; a++) { gput(a, -1, c.yb + 3, mix(H.post, a, -1, 3)); gput(a, -1, c.yb + 4, mix(H.beam, a, -1, 4)); }
    if (H.cap) { // canopy over the beam (snow caps, cherry blossom, spruce boughs, azalea ...)
      const cap = blk(H.cap), sp = H.capSpread;
      for (let a = -3; a <= 3; a++) for (let lat = -2 - sp; lat <= 0 + sp; lat++) {
        if (Math.abs(a) === 3 && hash3(a, lat, c.x, 212) < 0.5) continue;
        gput(a, lat, c.yb + 5, cap);
        if (sp && Math.abs(a) < 3 && lat === -1 && hash3(a, lat, c.z, 213) < 0.6) gput(a, lat, c.yb + 6, cap);
      }
    }
    gput(0, -1, c.yb + 2, lamp);
    if (H.hang) for (const a of [-1, 1]) {
      const n = 1 + Math.floor(hash3(a, c.x, c.z, 214) * 2);
      for (let i = 0; i < n; i++) {
        const id = H.hang === 'cave_vines_lit' ? (i === n - 1 ? B.cave_vines_lit : B.cave_vines_plant_lit) : blk(H.hang);
        gput(a, -1, c.yb + 2 - i, id);
      }
    }
    for (let y = c.yb + 5; y <= c.yb + 8; y++) gput(0, -1, y, blk(H.pole));
    for (const a of [1, 2]) for (const y of [c.yb + 7, c.yb + 8]) gput(a, -1, y, flag);
    // lantern posts on the far side, with a stone base
    for (const a of [1, 7]) {
      put(a, -2, c.yb, blk(H.base));
      for (let y = c.yb + 1; y <= c.yb + 2; y++) put(a, -2, y, mix(H.post, a, -2, y));
      put(a, -2, c.yb + 3, lamp);
    }
    // corner decoration of the platform
    if (H.corner) for (const [a, lat] of [[-8, -3], [8, -3], [-8, 7], [8, 7], [-4, 8], [4, 8], [-7, 2], [8, 2]]) {
      if (!inHall(a, lat, -0.14)) continue;
      if (H.corner === 'chorus') {
        const [cx, cz] = P(a, lat);
        set(cx, c.yb - 1, cz, B.end_stone);
        chorusTree(w, cx, c.yb - 1, cz, 2 + a + lat);
      } else if (H.corner === 'fire') { put(a, lat, c.yb - 1, B.netherrack); put(a, lat, c.yb, B.fire); }
      else if (H.corner === 'blue_ice') { for (let i = 0; i < 2 + (a & 1); i++) put(a, lat, c.yb + i, B.blue_ice); }
      else { put(a, lat, c.yb, blk(H.corner)); put(a, lat, c.yb + 1, blk(H.corner)); put(a + 1, lat, c.yb, blk(H.corner)); }
    }
    if (c.biome === 'lush' && !isEnd) {          // a small pond for the hall's axolotl
      for (let a = -3; a <= 1; a++) for (let lat = -5; lat <= -2; lat++) {
        const inPool = a >= -2 && a <= 0 && lat >= -4 && lat <= -3;
        if (inPool) { put(a, lat, c.yb - 1, B.water); put(a, lat, c.yb - 2, B.water); put(a, lat, c.yb - 3, B.clay); }
        else { put(a, lat, c.yb - 2, blk('mossy_cobblestone')); put(a, lat, c.yb - 1, blk('mossy_cobblestone')); }
      }
    }
    }
    let portal = null;
    if (isEnd) {
      // the exit: a nether portal in an obsidian frame straddling the rail, three blocks before the end of the line
      const PA = -3;
      const [fx0, fz0] = P(PA, 0);
      for (let lat = -2; lat <= 2; lat++) for (let y = c.yb - 1; y <= c.yb + 4; y++) {
        const inside = Math.abs(lat) <= 1 && y >= c.yb && y <= c.yb + 3;
        if (inside) { put(PA, lat, y, B.nether_portal); continue; }
        put(PA, lat, y, hash3(lat, y, c.x, 230) < 0.22 ? B.crying_obsidian : B.obsidian);
      }
      portal = { origin: [fx0 + 0.5, c.yb, fz0 + 0.5], width: 3, height: 4 };
    }
    const [wx, wz] = P(0, 0);
    stopInfo.push({ idx, cell: c, fwd: f, left: l, origin: [wx + 0.5, c.yb, wz + 0.5], isEnd, portal });
  });
  w.stopInfo = stopInfo;
}
