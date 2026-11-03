// Mob kit: builds three.js models from vanilla-style definitions (box origin/size/UV in 1/16 block units, y down, bone hierarchy).
//
// Coordinate conversion (vanilla model space -> entity-local, +Z = front, +Y = up, scaled 1/16, feet at y = 0):
//   X = mx,  Y = 24 - my,  Z = -mz        (the renderer's scale(-1,-1,1) followed by a 180 degree turn)
//   rotations: xRot stays, yRot and zRot change sign, applied in ZYX order like ModelPart.
import * as THREE from 'three';
import { pixelTexture } from './assets.js';

const K = 1 / 16;
const FACES = {
  px: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  nx: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  py: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  ny: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  pz: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  nz: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
};
const NORMALS = { px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1] };

// one geometry for all boxes of a bone. box = { o:[x,y,z], s:[w,h,d], uv:[u,v], infl, mirror }
export function boxesGeometry(boxes, texW, texH, defaultInfl = 0) {
  const pos = [], uv = [], nor = [], idx = [];
  for (const b of boxes) {
    const [ox, oy, oz] = b.o, [w, h, d] = b.s, [u, v] = b.uv, infl = (b.infl || 0) + defaultInfl;
    // box centre / half extents in entity-local units (vanilla y/z flipped)
    const cx = (ox + w / 2) * K, cy = -(oy + h / 2) * K, cz = -(oz + d / 2) * K;
    const hx = (w / 2 + infl) * K, hy = (h / 2 + infl) * K, hz = (d / 2 + infl) * K;
    const rects = {
      pz: [u + d, v + d, w, h], nz: [u + 2 * d + w, v + d, w, h],
      nx: [u, v + d, d, h], px: [u + d + w, v + d, d, h],
      py: [u + d, v, w, d], ny: [u + d + w, v, w, d],
    };
    if (b.mirror) { const t = rects.nx; rects.nx = rects.px; rects.px = t; }
    for (const key of Object.keys(FACES)) {
      const [rx, ry, rw, rh] = rects[key];
      const base = pos.length / 3;
      FACES[key].forEach((c, k) => {
        pos.push(cx + c[0] * hx, cy + c[1] * hy, cz + c[2] * hz);
        let pxu = k === 0 || k === 3 ? rx : rx + rw;
        if (b.mirror) pxu = k === 0 || k === 3 ? rx + rw : rx;
        const pyv = k < 2 ? ry + rh : ry;
        uv.push(pxu / texW, 1 - pyv / texH);
        nor.push(...NORMALS[key]);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// def = { tex, texW, texH, scale, bones: { name: { parent, pivot:[x,y,z], rot:[x,y,z], boxes:[...] } },
//         overlays: [{ tex, infl, only:[bone names], emissive, tint:[r,g,b] }] }
export function buildMob(def, texFor, patch, objLight) {
  const root = new THREE.Group();
  const model = new THREE.Group();            // y offset: the vanilla renderer lifts the model by 24/16
  model.position.y = (def.lift ?? 24) * K;
  model.scale.setScalar(def.scale || 1);
  root.add(model);
  const bones = {}, order = Object.keys(def.bones);
  const materials = [];
  const mat = (tex, opts = {}) => {
    const m = new THREE.MeshBasicMaterial({ map: texFor(tex), alphaTest: 0.1, side: THREE.DoubleSide, transparent: !!opts.transparent, depthWrite: !opts.emissiveOverlay, ...opts.extra });
    if (opts.tint) m.color.setRGB(...opts.tint);
    patch(m, { objLight });
    materials.push(m);
    return m;
  };
  const main = mat(def.tex);
  const overlayMats = (def.overlays || []).map((o) => mat(o.tex, {
    tint: o.tint, transparent: !!o.emissive,
    extra: o.emissive ? { blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } : { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
  }));
  for (const name of order) {
    const bd = def.bones[name];
    const g = new THREE.Group(); g.name = name;
    const p = bd.pivot || [0, 0, 0], r = bd.rot || [0, 0, 0];
    g.position.set(p[0] * K, -p[1] * K, -p[2] * K);
    g.rotation.order = 'ZYX';
    g.rotation.set(r[0], -r[1], -r[2]);
    g.userData.rest = { pos: g.position.clone(), rot: g.rotation.clone() };
    (bd.parent ? bones[bd.parent] : model).add(g);
    bones[name] = g;
    if (bd.boxes && bd.boxes.length) {
      const m = new THREE.Mesh(boxesGeometry(bd.boxes, def.texW, def.texH), main);
      g.add(m);
      (def.overlays || []).forEach((o, i) => {
        if (o.only && !o.only.includes(name)) return;
        if (o.bones && !o.bones[name]) return;
        const boxes = o.bones ? o.bones[name] : bd.boxes;
        g.add(new THREE.Mesh(boxesGeometry(boxes, o.texW || def.texW, o.texH || def.texH, o.infl || 0), overlayMats[i]));
      });
    }
  }
  // the vanilla model's y offset puts the model origin at its pivot-less root; bones positions are absolute from the model root
  // (top level bones have vanilla offsets relative to the model root, which sits 24px above the feet)
  return { root, model, bones, materials, main, overlayMats };
}

// textures: image map -> cached THREE.Texture
export function makeTexLoader(images) {
  const cache = {};
  return (name) => {
    if (!cache[name]) {
      if (!images[name]) throw new Error('missing mob texture ' + name);
      cache[name] = pixelTexture(images[name]);
    }
    return cache[name];
  };
}

export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
