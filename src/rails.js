// Rails: every rail piece is a quad in ONE merged mesh using a small atlas of the vanilla rail textures, so the whole track
// costs a single draw call. Powered / detector / activator state changes just swap a quad's texture coordinates and glow.
import * as THREE from 'three';
import { DIRS, RAIL_Y } from './track.js';

const TILES = ['rail', 'rail_corner', 'powered_rail', 'powered_rail_on', 'detector_rail', 'detector_rail_on', 'activator_rail', 'activator_rail_on'];

export function createRails(track, img, world, rt) {
  // atlas
  const cv = document.createElement('canvas'); cv.width = TILES.length * 16; cv.height = 16;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  TILES.forEach((n, i) => g.drawImage(img[n], 0, 0, 16, 16, i * 16, 0, 16, 16));
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const uvOf = (name) => { const k = TILES.indexOf(name), e = 0.01 / TILES.length; return [k / TILES.length + e, 0.001, (k + 1) / TILES.length - e, 0.999]; };

  const cells = track.cells, n = cells.length;
  const pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), uv = new Float32Array(n * 8), lit = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const rails = [];
  const tmp = new THREE.Object3D();
  const corner = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const cornerUV = [[0, 0], [1, 0], [1, 1], [0, 1]];

  cells.forEach((c, i) => {
    let name = 'rail';
    if (c.shape === 'turn') name = 'rail_corner';
    else if (c.kind === 'powered' || c.kind === 'brake' || c.kind === 'stop' || c.kind === 'end') name = 'powered_rail';
    else if (c.kind === 'detector') name = 'detector_rail';
    else if (c.kind === 'activator') name = 'activator_rail';

    tmp.position.set(0, 0, 0); tmp.quaternion.identity(); tmp.scale.set(1, 1, 1);
    const f = DIRS[c.dirIn], cx = c.x + 0.5, cz = c.z + 0.5, rise = c.hx - c.he;
    if (c.shape === 'turn') {
      // default rail_corner joins its south and east edges; rotate clockwise k quarter turns
      const a = (c.dirIn + 2) % 4, b = c.dirOut;
      let k = 0;
      for (; k < 4; k++) { const s = (2 + k) % 4, e = (1 + k) % 4; if ((s === a && e === b) || (s === b && e === a)) break; }
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -k * Math.PI / 2));
      tmp.position.set(cx, c.yb + RAIL_Y + 0.004, cz);
    } else {
      const fwd = new THREE.Vector3(f[0], rise, f[1]).normalize();
      const r = new THREE.Vector3(-f[1], 0, f[0]);
      const nrm = new THREE.Vector3().crossVectors(r, fwd);
      if (nrm.y < 0) { r.negate(); nrm.negate(); }
      tmp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, fwd, nrm));
      tmp.scale.y = rise ? Math.SQRT2 : 1;
      const cy = rise ? Math.min(c.he, c.hx) + 0.5 + RAIL_Y : c.yb + RAIL_Y;
      tmp.position.set(cx, cy, cz).addScaledVector(nrm, 0.004);
    }
    tmp.updateMatrix();
    const N = new THREE.Vector3(0, 0, 1).applyQuaternion(tmp.quaternion);
    const l = world.lightAt(cx, c.yb + 0.5, cz), rect = uvOf(name);
    for (let k = 0; k < 4; k++) {
      const v = new THREE.Vector3(corner[k][0], corner[k][1], 0).applyMatrix4(tmp.matrix);
      pos.set([v.x, v.y, v.z], i * 12 + k * 3); nor.set([N.x, N.y, N.z], i * 12 + k * 3);
      uv.set([cornerUV[k][0] ? rect[2] : rect[0], cornerUV[k][1] ? rect[3] : rect[1]], i * 8 + k * 2);
      lit.set([l.sky / 15, l.blk / 15, 0], i * 12 + k * 3);
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    rails.push({ cell: c, i, base: name, on: false });
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const uvAttr = new THREE.BufferAttribute(uv, 2), litAttr = new THREE.BufferAttribute(lit, 3);
  geo.setAttribute('uv', uvAttr); geo.setAttribute('aLight', litAttr);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mat = rt.patch(new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  const group = new THREE.Group(); group.add(mesh);

  function setState(r, on) {
    const name = on ? r.base + '_on' : r.base, rect = uvOf(name), i = r.i;
    for (let k = 0; k < 4; k++) uv.set([cornerUV[k][0] ? rect[2] : rect[0], cornerUV[k][1] ? rect[3] : rect[1]], i * 8 + k * 2);
    for (let k = 0; k < 4; k++) lit[i * 12 + k * 3 + 2] = on ? 0.55 : 0;          // lit redstone glows
    uvAttr.needsUpdate = true; litAttr.needsUpdate = true;
  }

  // sRail = cart arc-length position; departingCellIndex lights the stop rail the cart is leaving
  function update(sRail, departingCellIndex = -1) {
    for (const r of rails) {
      const c = r.cell;
      let on = false;
      if (c.kind === 'powered') on = sRail > c.s0 - 10 && sRail < c.s1 + 2.5;
      else if (c.kind === 'detector') on = sRail >= c.s0 && sRail < c.s1 + 6;
      else if (c.kind === 'activator') on = sRail >= c.s0 - 0.5 && sRail < c.s1 + 3;
      else if (c.kind === 'stop' || c.kind === 'end') on = c.i === departingCellIndex;
      if (on !== r.on) { r.on = on; if (r.base !== 'rail' && r.base !== 'rail_corner') setState(r, on); }
    }
  }
  return { group, update, rails };
}
