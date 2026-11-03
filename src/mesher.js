// Chunked mesh builder: opaque + cut-out geometry (one mesh) and water (separate transparent mesh).
// Vertex attributes: position, uv, color (tint * AO), normal, aLight = (sky, block, emission).
import * as THREE from 'three';
import { LIST, B, PALETTE, BIOME_IDS } from './blocks.js';

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
];
const AO = [0.45, 0.65, 0.82, 1];
const col3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const PAL = {};
for (const k of Object.keys(PALETTE)) PAL[k] = Object.fromEntries(Object.entries(PALETTE[k]).map(([n, v]) => [n, col3(v)]));
const WHITE = [1, 1, 1];
const SPRUCE = col3('#619961'), BIRCH = col3('#80a755');

export function buildMeshes(w, atlas) {
  const { data, nx, ny, nz, ox, oy, oz, I, inb, sky, blk, col, colStyle } = w;
  const buckets = new Map(), wbuckets = new Map(), fbuckets = new Map();
  const opaqueAt = (x, y, z) => { if (!inb(x, y, z)) return true; const d = LIST[data[I(x, y, z)]]; return d.opaque && (d.kind === 'cube' || d.name === 'lava'); };
  const idAt = (x, y, z) => (inb(x, y, z) ? data[I(x, y, z)] : B.stone);
  const lv = (x, y, z) => { if (!inb(x, y, z)) return [15, 0]; const i = I(x, y, z); return [sky[i], blk[i]]; };
  const bucket = (map, x, z) => {
    const key = ((x - ox) >> 5) + ',' + ((z - oz) >> 5);
    let b = map.get(key);
    if (!b) { b = { pos: [], uv: [], col: [], nor: [], lit: [], idx: [] }; map.set(key, b); }
    return b;
  };
  const uvRect = (tile) => atlas.uv[tile];
  const sub = (r, x0, y0, x1, y1) => { // sub-rect of a tile in pixel coords (origin top-left)
    const [u0, v0, u1, v1] = r, du = u1 - u0, dv = v1 - v0;
    return [u0 + (x0 / 16) * du, v1 - (y1 / 16) * dv, u0 + (x1 / 16) * du, v1 - (y0 / 16) * dv];
  };
  const quad = (b, p, uv, color, n, light, emit = 0) => {
    const base = b.pos.length / 3;
    const [u0, v0, u1, v1] = uv;
    const us = [u0, u1, u1, u0], vs = [v0, v0, v1, v1];
    for (let k = 0; k < 4; k++) {
      b.pos.push(p[k][0], p[k][1], p[k][2]);
      b.uv.push(us[k], vs[k]);
      b.col.push(color[0], color[1], color[2]);
      b.nor.push(n[0], n[1], n[2]);
      b.lit.push(light[0], light[1], emit);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // axis-aligned box in voxel pixel coordinates; faces: {top,bottom,side} uv rects
  const box = (b, vx, vy, vz, x0, y0, z0, x1, y1, z1, uvs, color, light, emit) => {
    const X0 = vx + x0 / 16, X1 = vx + x1 / 16, Y0 = vy + y0 / 16, Y1 = vy + y1 / 16, Z0 = vz + z0 / 16, Z1 = vz + z1 / 16;
    quad(b, [[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], uvs.top, color, [0, 1, 0], light, emit);
    quad(b, [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], uvs.bottom || uvs.top, color, [0, -1, 0], light, emit);
    quad(b, [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], uvs.side, color, [0, 0, 1], light, emit);
    quad(b, [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], uvs.side, color, [0, 0, -1], light, emit);
    quad(b, [[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], uvs.side, color, [1, 0, 0], light, emit);
    quad(b, [[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], uvs.side, color, [-1, 0, 0], light, emit);
  };
  // vertical plane rotated by `ang` around the voxel centre
  const plane = (b, vx, vy, vz, hw, y0, y1, ang, uv, color, light, emit) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (t, y) => [vx + 0.5 + t * c, vy + y, vz + 0.5 + t * s];
    const p = [P(-hw, y0), P(hw, y0), P(hw, y1), P(-hw, y1)];
    quad(b, p, uv, color, [0, 1, 0], light, emit);
  };


  // axis-aligned box with world-projected UVs (vanilla style): every face samples the texture by its block-space
  // pixel position. `tex(face)` picks the tile rect per face; `skip` is a set of face names that are not emitted.
  const wbox = (b, vx, vy, vz, x0, y0, z0, x1, y1, z1, tex, color, light, emit = 0, skip = null) => {
    const X0 = vx + x0 / 16, X1 = vx + x1 / 16, Y0 = vy + y0 / 16, Y1 = vy + y1 / 16, Z0 = vz + z0 / 16, Z1 = vz + z1 / 16;
    const fc = (shade) => [color[0] * shade, color[1] * shade, color[2] * shade];
    const F = (name, corners, n, uv, shade) => { if (skip && skip.has(name)) return; quad(b, corners, uv, fc(shade), n, light, emit); };
    F('py', [[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], [0, 1, 0], sub(tex('py'), x0, z0, x1, z1), 1.0);
    F('ny', [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], [0, -1, 0], sub(tex('ny'), x0, z1, x1, z0), 0.6);
    F('pz', [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], [0, 0, 1], sub(tex('pz'), x0, 16 - y1, x1, 16 - y0), 0.9);
    F('nz', [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], [0, 0, -1], sub(tex('nz'), x1, 16 - y1, x0, 16 - y0), 0.9);
    F('px', [[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], [1, 0, 0], sub(tex('px'), z1, 16 - y1, z0, 16 - y0), 0.8);
    F('nx', [[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], [-1, 0, 0], sub(tex('nx'), z0, 16 - y1, z1, 16 - y0), 0.8);
  };
  const FIRE = { fire: true, soul_fire: true };
  const hash = (x, y, z) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const isChorus = (id) => id === B.chorus_plant || id === B.chorus_flower || id === B.chorus_flower_dead;

  const total = nx * ny * nz;
  for (let y = oy; y < oy + ny; y++) for (let z = oz; z < oz + nz; z++) for (let x = ox; x < ox + nx; x++) {
    const id = data[I(x, y, z)];
    if (id === 0) continue;
    const def = LIST[id], kind = def.kind;
    const style = BIOME_IDS[colStyle[col(x, z)]] || 'alpine';
    const pal = PAL[style] || PAL.alpine;
    const tint = def.tint === 'foliage' || def.tint === 'grassTop' ? pal.foliage : def.tint === 'red' ? pal.red : def.tint === 'gold' ? pal.gold
      : def.tint === 'water' ? pal.foliage : def.tint === 'lily' ? [0.12, 0.42, 0.1] : def.tint === 'spruce' ? SPRUCE : def.tint === 'birch' ? BIRCH : WHITE;
    const grassTop = def.tint === 'grassTop' ? pal.grass : WHITE;

    if (kind === 'cube' || kind === 'leaves' || (kind === 'liquid' && id === B.lava)) {
      const b = bucket(buckets, x, z);
      const isLeaf = kind === 'leaves';
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const fx = x + F.n[0], fy = y + F.n[1], fz = z + F.n[2];
        if (!inb(fx, fy, fz)) continue;
        const nid = data[I(fx, fy, fz)];
        const nd = LIST[nid];
        if (nd.opaque && (nd.kind === 'cube' || nid === B.lava)) continue;
        if (isLeaf && nid === id) continue;
        if (kind === 'liquid' && nid === B.lava) continue;
        let tileName = f === 2 ? def.tiles[0] : f === 3 ? (def.tiles[2] || def.tiles[0]) : (def.tiles[1] || def.tiles[0]);
        if (tileName === 'GRASS_SIDE') tileName = 'grass_side_' + style;
        const uv = uvRect(tileName);
        const axis = F.n[0] !== 0 ? 0 : F.n[1] !== 0 ? 1 : 2;
        const ax1 = (axis + 1) % 3, ax2 = (axis + 2) % 3;
        const tc = f === 2 ? grassTop : tint;
        const pos = [], cols = [], lits = [];
        for (let k = 0; k < 4; k++) {
          const c = F.c[k];
          const d1 = c[ax1] ? 1 : -1, d2 = c[ax2] ? 1 : -1;
          const s1 = [fx, fy, fz], s2 = [fx, fy, fz], sc = [fx, fy, fz];
          s1[ax1] += d1; s2[ax2] += d2; sc[ax1] += d1; sc[ax2] += d2;
          const o1 = opaqueAt(s1[0], s1[1], s1[2]), o2 = opaqueAt(s2[0], s2[1], s2[2]), oc = opaqueAt(sc[0], sc[1], sc[2]);
          const ao = o1 && o2 ? 0 : 3 - ((o1 ? 1 : 0) + (o2 ? 1 : 0) + (oc ? 1 : 0));
          let sk = 0, bl = 0, cnt = 0;
          const add = (p) => { const [a, bb] = lv(p[0], p[1], p[2]); sk += a; bl += bb; cnt++; };
          add([fx, fy, fz]);
          if (!o1) add(s1); if (!o2) add(s2); if (!oc && !(o1 && o2)) add(sc);
          const shade = F.shade * AO[ao];
          cols.push([tc[0] * shade, tc[1] * shade, tc[2] * shade]);
          lits.push([sk / cnt / 15, bl / cnt / 15]);
          pos.push([x + c[0], y + c[1], z + c[2]]);
        }
        const base = b.pos.length / 3;
        const us = [uv[0], uv[2], uv[2], uv[0]], vs = [uv[1], uv[1], uv[3], uv[3]];
        for (let k = 0; k < 4; k++) {
          b.pos.push(pos[k][0], pos[k][1], pos[k][2]); b.uv.push(us[k], vs[k]);
          b.col.push(cols[k][0], cols[k][1], cols[k][2]); b.nor.push(F.n[0], F.n[1], F.n[2]);
          b.lit.push(lits[k][0], lits[k][1], def.emit);
        }
        // flip the diagonal for AO anisotropy
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      continue;
    }

    if (kind === 'liquid') { // water
      const wb = bucket(wbuckets, x, z);
      const aboveId = idAt(x, y + 1, z);
      const topY = aboveId === B.water ? 1 : 0.875;
      const L = lv(x, y + (aboveId === B.water ? 1 : 0), z);
      const light = [L[0] / 15, L[1] / 15];
      const uv = uvRect('water_still'), wcol = pal.water;
      if (aboveId !== B.water && !opaqueAt(x, y + 1, z)) quad(wb, [[x, y + topY, z + 1], [x + 1, y + topY, z + 1], [x + 1, y + topY, z], [x, y + topY, z]], uv, wcol, [0, 1, 0], light);
      for (let f = 0; f < 6; f++) {
        if (f === 2 || f === 3) continue;
        const F = FACES[f], fx = x + F.n[0], fy = y, fz = z + F.n[2];
        const nid = idAt(fx, fy, fz);
        if (nid === B.water || opaqueAt(fx, fy, fz)) continue;
        const p = F.c.map((c) => [x + c[0], y + c[1] * topY, z + c[2]]);
        quad(wb, p, uv, wcol, F.n, light);
      }
      continue;
    }

    // --- non-cube models: light is sampled at the voxel itself ---
    const b = bucket(buckets, x, z);
    const [sk, bl] = lv(x, y, z);
    const light = [Math.max(sk, id === B.cave_vines ? 0 : 0) / 15, bl / 15];
    const emit = def.emit;
    if (kind === 'cross' && FIRE[def.name]) {
      // vanilla fire: four planes leaning outward (22.5 deg, 22.4px tall), animated by a per-group frame offset
      const phase = Math.floor(hash(x, y, z) * 4);
      const fl = [Math.max(sk, 0) / 15, bl / 15];
      for (const variant of [0, 1]) {
        const key = def.name + '|' + variant + '|' + phase;
        let fb = fbuckets.get(key);
        if (!fb) { fb = { name: def.name, variant, phase, pos: [], uv: [], col: [], nor: [], lit: [], idx: [] }; fbuckets.set(key, fb); }
        const px = (v) => v / 16, H = 22.4 / 16, ext = 8 * 1.082, t = Math.tan(Math.PI / 8);
        const zb = 8.8 - 8 * t, zt = 8.8 + 14.4 * t;           // bottom leans in, top leans out (pivot at 8px)
        for (const flip of [false, true]) {
          const zB = flip ? 16 - zb : zb, zT = flip ? 16 - zt : zt;
          const corners = variant === 0
            ? [[x + px(8 - ext), y, z + px(zB)], [x + px(8 + ext), y, z + px(zB)], [x + px(8 + ext), y + H, z + px(zT)], [x + px(8 - ext), y + H, z + px(zT)]]
            : [[x + px(zB), y, z + px(8 + ext)], [x + px(zB), y, z + px(8 - ext)], [x + px(zT), y + H, z + px(8 - ext)], [x + px(zT), y + H, z + px(8 + ext)]];
          quad(fb, corners, [0, 0, 1, 1], WHITE, [0, 1, 0], fl, 1);
        }
      }
      continue;
    }
    if (kind === 'cross') {
      const uv = uvRect(def.tiles[0]);
      const col2 = tint;
      plane(b, x, y, z, 0.7071, 0, 1, Math.PI / 4, uv, col2, light, emit);
      plane(b, x, y, z, 0.7071, 0, 1, -Math.PI / 4, uv, col2, light, emit);
    } else if (kind === 'lily') {
      const uv = uvRect('lily_pad');
      quad(b, [[x, y + 0.02, z + 1], [x + 1, y + 0.02, z + 1], [x + 1, y + 0.02, z], [x, y + 0.02, z]], uv, tint, [0, 1, 0], light, 0);
    } else if (kind === 'lantern') {
      const r = uvRect(def.name === 'soul_lantern' ? 'soul_lantern' : 'lantern');
      const A = { top: sub(r, 0, 9, 6, 15), side: sub(r, 0, 2, 6, 9) };
      const C = { top: sub(r, 1, 10, 5, 14), side: sub(r, 1, 0, 5, 2) };
      box(b, x, y, z, 5, 0, 5, 11, 7, 11, A, WHITE, light, emit);
      box(b, x, y, z, 6, 7, 6, 10, 9, 10, C, WHITE, light, emit);
      plane(b, x, y, z, 3 / 16, 9 / 16, 11 / 16, 0, sub(r, 11, 1, 14, 3), WHITE, light, emit);
      plane(b, x, y, z, 3 / 16, 9 / 16, 11 / 16, Math.PI / 2, sub(r, 11, 10, 14, 12), WHITE, light, emit);
      if (idAt(x, y + 1, z) === B.iron_chain) {       // hanging: bridge the gap between the handle and the chain above
        const cr = uvRect('iron_chain');
        plane(b, x, y, z, 1.5 / 16, 11 / 16, 1, Math.PI / 4, sub(cr, 0, 0, 3, 5), WHITE, light, 0);
        plane(b, x, y, z, 1.5 / 16, 11 / 16, 1, -Math.PI / 4, sub(cr, 3, 0, 6, 5), WHITE, light, 0);
      }
    } else if (kind === 'lowbox') {
      const r0 = uvRect(def.tiles[0]), r1 = uvRect(def.tiles[1]), r2 = uvRect(def.tiles[2]);
      box(b, x, y, z, 0, 0, 0, 16, def.h, 16, { top: r0, side: sub(r1, 0, 16 - def.h, 16, 16), bottom: r2 }, WHITE, light, emit);
    } else if (kind === 'chain') {
      const r = uvRect('iron_chain');
      plane(b, x, y, z, 1.5 / 16, 0, 1, Math.PI / 4, sub(r, 0, 0, 3, 16), WHITE, light, 0);
      plane(b, x, y, z, 1.5 / 16, 0, 1, -Math.PI / 4, sub(r, 3, 0, 6, 16), WHITE, light, 0);
    } else if (kind === 'icicle') {
      const r = uvRect('packed_ice'), tintI = [0.78, 0.95, 1.0];
      const U = { top: sub(r, 4, 4, 12, 12), side: sub(r, 3, 0, 11, 16) };
      box(b, x, y, z, 5, 10, 5, 11, 16, 11, U, tintI, light, 0.12);
      box(b, x, y, z, 6, 5, 6, 10, 10, 10, U, tintI, light, 0.12);
      box(b, x, y, z, 7, 0, 7, 9, 5, 9, U, tintI, light, 0.12);
    } else if (kind === 'chorus') {
      const plant = uvRect('chorus_plant');
      const lightC = [Math.max(sk, 0) / 15, bl / 15];
      if (id === B.chorus_plant) {
        // six-way connector: 8x8x8 core plus an arm toward every neighbouring chorus block (and end stone below)
        const conn = {
          px: isChorus(idAt(x + 1, y, z)), nx: isChorus(idAt(x - 1, y, z)), pz: isChorus(idAt(x, y, z + 1)), nz: isChorus(idAt(x, y, z - 1)),
          py: isChorus(idAt(x, y + 1, z)), ny: isChorus(idAt(x, y - 1, z)) || idAt(x, y - 1, z) === B.end_stone,
        };
        const T = () => plant;
        wbox(b, x, y, z, 4, 4, 4, 12, 12, 12, T, WHITE, lightC, 0, new Set(Object.keys(conn).filter((k) => conn[k])));
        const arm = (k, x0, y0, z0, x1, y1, z1, hide) => { if (conn[k]) wbox(b, x, y, z, x0, y0, z0, x1, y1, z1, T, WHITE, lightC, 0, new Set(hide)); };
        arm('px', 12, 4, 4, 16, 12, 12, ['nx', 'px']);
        arm('nx', 0, 4, 4, 4, 12, 12, ['nx', 'px']);
        arm('pz', 4, 4, 12, 12, 12, 16, ['nz', 'pz']);
        arm('nz', 4, 4, 0, 12, 12, 4, ['nz', 'pz']);
        arm('py', 4, 12, 4, 12, 16, 12, ['ny', 'py']);
        arm('ny', 4, 0, 4, 12, 4, 12, ['ny', 'py']);
      } else {
        // chorus flower: a 12x12 shell; the flower texture is on the five outer panels, plant texture on the rim
        const fl = uvRect(id === B.chorus_flower ? 'chorus_flower' : 'chorus_flower_dead');
        const only = (face) => (f) => (f === face ? fl : plant);
        const T = () => plant;
        wbox(b, x, y, z, 2, 0, 2, 14, 14, 14, T, WHITE, lightC, 0);
        wbox(b, x, y, z, 2, 14, 2, 14, 16, 14, only('py'), WHITE, lightC, 0);
        wbox(b, x, y, z, 0, 2, 2, 2, 14, 14, only('nx'), WHITE, lightC, 0);
        wbox(b, x, y, z, 14, 2, 2, 16, 14, 14, only('px'), WHITE, lightC, 0);
        wbox(b, x, y, z, 2, 2, 0, 14, 14, 2, only('nz'), WHITE, lightC, 0);
        wbox(b, x, y, z, 2, 2, 14, 14, 14, 16, only('pz'), WHITE, lightC, 0);
      }
    }
  }

  const make = (map, extra = {}) => {
    const out = [];
    for (const b of map.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('aLight', new THREE.Float32BufferAttribute(b.lit, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(b.idx), 1));
      g.computeBoundingSphere();
      out.push(g);
    }
    return out;
  };
  const fire = [...fbuckets.values()].map((fb) => ({ name: fb.name, variant: fb.variant, phase: fb.phase, geo: make(new Map([['f', fb]]))[0] }));
  return { opaque: make(buckets), water: make(wbuckets), fire };
}
