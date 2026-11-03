// Minecraft-style cuboid models with the vanilla skin UV layout: minecart + Steve (seated).
import * as THREE from 'three';
import { pixelTexture } from './assets.js';

const FACE_CORNERS = {
  px: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  nx: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  py: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  ny: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  pz: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  nz: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
};

// w,h,d in pixels (x,y,z). (u,v) = top-left of the box's UV strip on a texW x texH texture.
// Front face is +z, as in vanilla (viewed from the front: right side of the body is -x).
export function mcBox(w, h, d, u, v, texW, texH, inflate = 0) {
  const hx = w / 2 + inflate, hy = h / 2 + inflate, hz = d / 2 + inflate;
  const rects = {
    pz: [u + d, v + d, w, h], nz: [u + 2 * d + w, v + d, w, h],
    nx: [u, v + d, d, h], px: [u + d + w, v + d, d, h],
    py: [u + d, v, w, d], ny: [u + d + w, v, w, d],
  };
  const pos = [], uv = [], idx = [];
  for (const key of Object.keys(FACE_CORNERS)) {
    const [rx, ry, rw, rh] = rects[key];
    const base = pos.length / 3;
    FACE_CORNERS[key].forEach((c, k) => {
      pos.push(c[0] * hx, c[1] * hy, c[2] * hz);
      const px = k === 0 || k === 3 ? rx : rx + rw;
      const py = k < 2 ? ry + rh : ry;
      uv.push(px / texW, 1 - py / texH);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createCart(img) {
  const tex = pixelTexture(img.minecart);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const root = new THREE.Group();     // positioned/oriented on the rail
  const body = new THREE.Group();     // long axis along +x in model space, turned to run along +z
  body.rotation.y = Math.PI / 2;
  root.add(body);
  const K = 1 / 16;
  const piece = (w, h, d, u, v, x, y, z, ry, rx = 0) => {
    const m = new THREE.Mesh(mcBox(w, h, d, u, v, 64, 32), mat);
    m.position.set(x * K, y * K, z * K); m.rotation.set(rx, ry, 0); m.scale.setScalar(K);
    body.add(m);
  };
  piece(20, 16, 2, 0, 10, 0, -4, 0, 0, -Math.PI / 2);          // floor
  piece(16, 8, 2, 0, 0, -9, 1, 0, -Math.PI / 2);               // end walls
  piece(16, 8, 2, 0, 0, 9, 1, 0, Math.PI / 2);
  piece(16, 8, 2, 0, 0, 0, 1, -7, Math.PI);                    // side walls
  piece(16, 8, 2, 0, 0, 0, 1, 7, 0);
  root.userData.materials = [mat];
  return root;
}

export function createSteve(img) {
  const tex = pixelTexture(img.steve);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const K = 0.9375 / 16;
  const box = (w, h, d, u, v, infl = 0) => new THREE.Mesh(mcBox(w, h, d, u, v, 64, 64, infl), mat);
  const limb = (x, y, w, h, d, u, v, uo, vo, io, rx, parent) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * K, y * K, 0);
    pivot.rotation.x = rx;
    for (const [uu, vv, inf] of [[u, v, 0], [uo, vo, io]]) {
      const m = box(w, h, d, uu, vv, inf);
      m.position.y = -h / 2 * K; m.scale.setScalar(K);
      pivot.add(m);
    }
    parent.add(pivot);
    return pivot;
  };
  // hips at the origin of `seat`; seat is pushed back & down into the cart
  const seat = new THREE.Group();
  seat.scale.setScalar(1);
  root.add(seat);
  const torso = box(8, 12, 4, 16, 16); torso.position.y = 6 * K; torso.scale.setScalar(K);
  const jacket = box(8, 12, 4, 16, 32, 0.25); jacket.position.y = 6 * K; jacket.scale.setScalar(K);
  const headGroup = new THREE.Group(); headGroup.position.y = 12 * K; seat.add(headGroup);
  const head = box(8, 8, 8, 0, 0); head.position.y = 4 * K; head.scale.setScalar(K);
  const hat = box(8, 8, 8, 32, 0, 0.5); hat.position.y = 4 * K; hat.scale.setScalar(K);
  headGroup.add(head, hat);
  seat.add(torso, jacket);
  const armRot = -Math.PI / 3, legRot = -Math.PI / 2;
  limb(-6, 12, 4, 12, 4, 40, 16, 40, 32, 0.25, armRot, seat); // right arm (viewer's left)
  limb(6, 12, 4, 12, 4, 32, 48, 48, 48, 0.25, armRot, seat);  // left arm
  limb(-2, 0, 4, 12, 4, 0, 16, 0, 32, 0.25, legRot, seat);    // right leg
  limb(2, 0, 4, 12, 4, 16, 48, 0, 48, 0.25, legRot, seat);    // left leg
  seat.position.set(0, 0, -3 * K);
  root.userData = { materials: [mat], head: headGroup, headMeshes: [head, hat], seat };
  return root;
}
