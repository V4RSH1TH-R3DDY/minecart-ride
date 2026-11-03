// Lighting: CPU light bake (ambient fill) + GPU voxel ray tracing (sun shadows, shadowed lantern/lava lights,
// water reflections). The voxel grid is uploaded as a 3D texture and rays are marched with a DDA in the shader.
import * as THREE from 'three';
import { LIST, B } from './blocks.js';

const EMIT_LEVEL = { nether_portal: 11, soul_fire: 12, lava: 15, glowstone: 15, shroomlight: 15, lantern: 14, soul_lantern: 13, sculk_sensor: 3, sculk_catalyst: 6, fire: 13, magma: 7, cave_vines_lit: 10, cave_vines_plant_lit: 10 };

export function bakeLight(w) {
  const { data, nx, ny, nz, ox, oy, oz, I } = w;
  const n = nx * ny * nz;
  const sky = new Uint8Array(n), blk = new Uint8Array(n);
  const queue = new Int32Array(n);
  const passable = new Uint8Array(256);
  for (const d of LIST) passable[d.id] = (d.kind === 'cube' && d.opaque) || d.name === 'lava' || d.kind === 'leaves' ? 0 : 1;
  const strideY = nx * nz;
  const bfs = (arr, seeds) => {
    let head = 0, tail = 0;
    for (const s of seeds) queue[tail++] = s;
    while (head < tail) {
      const i = queue[head++], L = arr[i];
      if (L <= 1) continue;
      const x = i % nx, rest = (i - x) / nx, z = rest % nz, y = (rest - z) / nz;
      if (x > 0 && passable[data[i - 1]] && arr[i - 1] < L - 1) { arr[i - 1] = L - 1; queue[tail++] = i - 1; }
      if (x < nx - 1 && passable[data[i + 1]] && arr[i + 1] < L - 1) { arr[i + 1] = L - 1; queue[tail++] = i + 1; }
      if (z > 0 && passable[data[i - nx]] && arr[i - nx] < L - 1) { arr[i - nx] = L - 1; queue[tail++] = i - nx; }
      if (z < nz - 1 && passable[data[i + nx]] && arr[i + nx] < L - 1) { arr[i + nx] = L - 1; queue[tail++] = i + nx; }
      if (y > 0 && passable[data[i - strideY]] && arr[i - strideY] < L - 1) { arr[i - strideY] = L - 1; queue[tail++] = i - strideY; }
      if (y < ny - 1 && passable[data[i + strideY]] && arr[i + strideY] < L - 1) { arr[i + strideY] = L - 1; queue[tail++] = i + strideY; }
    }
  };
  const skySeeds = [];
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    for (let y = ny - 1; y >= 0; y--) {
      const i = x + nx * (z + nz * y);
      if (!passable[data[i]]) break;
      sky[i] = 15; skySeeds.push(i);
    }
  }
  bfs(sky, skySeeds);

  const blkSeeds = [];
  const lights = [];
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const i = x + nx * (z + nz * y), id = data[i];
    if (id === 0) continue;
    const d = LIST[id];
    const lvl = EMIT_LEVEL[d.name];
    if (!lvl) continue;
    blk[i] = lvl; blkSeeds.push(i);
    if (!d.light) continue;
    const wx = x + ox, wy = y + oy, wz = z + oz;
    if (id === B.lava) { // only the exposed surface, sparsely
      if (data[i + strideY] === 0 && wx % 3 === 0 && wz % 3 === 0) lights.push([wx + 0.5, wy + 1.15, wz + 0.5, 20, d.light[0], d.light[1], d.light[2], d.light[3]]);
    } else if (id === B.magma || id === B.cave_vines_lit || id === B.cave_vines_plant_lit || id === B.fire || id === B.soul_fire) {
      if ((wx * 7 + wz * 13 + wy) % 4 === 0) lights.push([wx + 0.5, wy + 0.5, wz + 0.5, 9, d.light[0], d.light[1], d.light[2], d.light[3]]);
    } else lights.push([wx + 0.5, wy + 0.5, wz + 0.5, d.name === 'glowstone' || d.name === 'shroomlight' ? 16 : 15, d.light[0], d.light[1], d.light[2], d.light[3]]);
  }
  bfs(blk, blkSeeds);
  w.sky = sky; w.blk = blk; w.lights = lights;
  w.lightAt = (x, y, z) => {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    if (!w.inb(fx, fy, fz)) return { sky: 15, blk: 0 };
    const i = I(fx, fy, fz);
    return { sky: sky[i], blk: blk[i] };
  };
  w.solidAt = (x, y, z) => {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    if (!w.inb(fx, fy, fz)) return true;
    const d = LIST[data[I(fx, fy, fz)]];
    return d.kind === 'cube' || d.kind === 'leaves' || d.name === 'lava';
  };
  return w;
}

// ---------------------------------------------------------------------------------------------------------------
const GLSL_COMMON = /* glsl */`
uniform highp sampler3D uVox;
uniform highp sampler2D uLightCells;
uniform highp sampler2D uLights;
uniform highp sampler2D uPalette;
uniform vec3 uGridSize;
uniform vec3 uGridMin;
uniform vec3 uCellGrid;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uCaveAmb;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uMaxLights;
uniform float uSunSteps;
uniform float uSunOn;
varying vec3 vWPos;
varying vec3 vWNor;
varying vec3 vLight;

float voxAt(ivec3 c) {
  if (c.x < 0 || c.y < 0 || c.z < 0 || c.x >= int(uGridSize.x) || c.y >= int(uGridSize.y) || c.z >= int(uGridSize.z)) return -1.0;
  return texelFetch(uVox, ivec3(c.x, c.z, c.y), 0).r;
}
ivec2 t2(int t) { return ivec2(t & 4095, t >> 12); }

// DDA shadow ray: returns transmittance (0 = fully blocked)
float marchShadow(vec3 ro, vec3 rd, float maxDist, int maxSteps) {
  vec3 p = ro - uGridMin;
  ivec3 c = ivec3(floor(p));
  vec3 inv = 1.0 / (abs(rd) + 1e-6);
  ivec3 st = ivec3(rd.x >= 0.0 ? 1 : -1, rd.y >= 0.0 ? 1 : -1, rd.z >= 0.0 ? 1 : -1);
  vec3 tMax = vec3(
    ((rd.x >= 0.0 ? float(c.x) + 1.0 : float(c.x)) - p.x) / (rd.x + (rd.x >= 0.0 ? 1e-6 : -1e-6)),
    ((rd.y >= 0.0 ? float(c.y) + 1.0 : float(c.y)) - p.y) / (rd.y + (rd.y >= 0.0 ? 1e-6 : -1e-6)),
    ((rd.z >= 0.0 ? float(c.z) + 1.0 : float(c.z)) - p.z) / (rd.z + (rd.z >= 0.0 ? 1e-6 : -1e-6)));
  float trans = 1.0;
  for (int i = 0; i < 256; i++) {
    if (i >= maxSteps) break;
    float t = min(tMax.x, min(tMax.y, tMax.z));
    if (t > maxDist) break;
    if (tMax.x < tMax.y && tMax.x < tMax.z) { c.x += st.x; tMax.x += inv.x; }
    else if (tMax.y < tMax.z) { c.y += st.y; tMax.y += inv.y; }
    else { c.z += st.z; tMax.z += inv.z; }
    float v = voxAt(c);
    if (v < 0.0) break;
    if (v > 0.9) return 0.0;
    if (v > 0.3) trans *= 0.5;
  }
  return trans;
}

// DDA that reports the hit voxel and face normal (for reflections)
bool marchHit(vec3 ro, vec3 rd, int maxSteps, out ivec3 hitC, out vec3 hitN, out float hitT) {
  vec3 p = ro - uGridMin;
  ivec3 c = ivec3(floor(p));
  vec3 inv = 1.0 / (abs(rd) + 1e-6);
  ivec3 st = ivec3(rd.x >= 0.0 ? 1 : -1, rd.y >= 0.0 ? 1 : -1, rd.z >= 0.0 ? 1 : -1);
  vec3 tMax = vec3(
    ((rd.x >= 0.0 ? float(c.x) + 1.0 : float(c.x)) - p.x) / (rd.x + (rd.x >= 0.0 ? 1e-6 : -1e-6)),
    ((rd.y >= 0.0 ? float(c.y) + 1.0 : float(c.y)) - p.y) / (rd.y + (rd.y >= 0.0 ? 1e-6 : -1e-6)),
    ((rd.z >= 0.0 ? float(c.z) + 1.0 : float(c.z)) - p.z) / (rd.z + (rd.z >= 0.0 ? 1e-6 : -1e-6)));
  hitN = vec3(0.0, 1.0, 0.0); hitT = 0.0; hitC = c;
  for (int i = 0; i < 160; i++) {
    if (i >= maxSteps) break;
    float t;
    if (tMax.x < tMax.y && tMax.x < tMax.z) { t = tMax.x; c.x += st.x; tMax.x += inv.x; hitN = vec3(-float(st.x), 0.0, 0.0); }
    else if (tMax.y < tMax.z) { t = tMax.y; c.y += st.y; tMax.y += inv.y; hitN = vec3(0.0, -float(st.y), 0.0); }
    else { t = tMax.z; c.z += st.z; tMax.z += inv.z; hitN = vec3(0.0, 0.0, -float(st.z)); }
    float v = voxAt(c);
    if (v < 0.0) return false;
    if (v > 0.3) { hitC = c; hitT = t; return true; }
  }
  return false;
}

vec3 skyColor(vec3 d) {
  float h = clamp(d.y * 1.4 + 0.1, 0.0, 1.0);
  vec3 s = mix(uSkyHorizon, uSkyTop, pow(h, 0.7));
  float sun = pow(max(dot(d, uSunDir), 0.0), 64.0);
  return s + uSunColor * sun * 0.6 * uSunOn;
}

vec3 pointLights(vec3 pos, vec3 N, float cd) {
  vec3 g = (pos - uGridMin) / 8.0;
  ivec3 cc = clamp(ivec3(floor(g)), ivec3(0), ivec3(uCellGrid) - 1);
  int ci = cc.x + int(uCellGrid.x) * (cc.z + int(uCellGrid.z) * cc.y);
  vec3 acc = vec3(0.0);
  int used = 0;
  for (int h = 0; h < 2; h++) {
    vec4 ids = texelFetch(uLightCells, t2(ci * 2 + h), 0);
    for (int k = 0; k < 4; k++) {
      if (float(used) >= uMaxLights) break;
      float idf = ids[k];
      if (idf < -0.5) continue;
      used++;
      int li = int(idf + 0.5);
      vec4 A = texelFetch(uLights, t2(li * 2), 0);
      vec4 C = texelFetch(uLights, t2(li * 2 + 1), 0);
      vec3 L = A.xyz - pos;
      float d = length(L);
      if (d > A.w || d < 0.001) continue;
      L /= d;
      float nl = dot(N, L);
      if (nl <= 0.0) continue;
      float att = 1.0 - d / A.w;
      att = att * att * (1.0 + 2.0 / (1.0 + d));
      float contrib = C.a * att * nl;
      if (contrib < 0.02) continue;                                   // too faint to matter: no shadow ray
      float sh = 1.0;
      if (cd < 48.0 && contrib > 0.05) sh = marchShadow(pos + N * 0.04, L, max(d - 0.85, 0.0), int(clamp(d * 2.0 + 6.0, 8.0, 32.0)));
      float fl = 1.0 + 0.10 * sin(uTime * 11.0 + float(li) * 2.3) * sin(uTime * 7.3 + float(li)) * step(C.b, 0.55);   // warm lights flicker, cool ones do not
      acc += C.rgb * C.a * fl * att * nl * sh;
    }
  }
  return acc;
}

vec3 rtLighting(vec3 pos, vec3 N, vec3 lit) {
  float sky = lit.x, blk = lit.y;
  float cd = distance(pos, uCamPos);
  vec3 amb = uSkyAmb * sky * (0.55 + 0.45 * N.y) + uCaveAmb + vec3(1.0, 0.74, 0.45) * blk * 0.38;
  vec3 col = amb;
  if (uSunOn > 0.0 && sky > 0.04) {
    float nl = max(dot(N, uSunDir), 0.0);
    if (nl > 0.0) {
      float sh = 0.8;                                                   // beyond ~100 blocks (fogged): a flat average shadow
      if (cd < 100.0) {
        sh = marchShadow(pos + N * 0.04, uSunDir, 90.0, int(min(uSunSteps, 30.0 + cd * 1.2)));
        sh = mix(sh, 0.8, smoothstep(60.0, 100.0, cd));
      }
      col += uSunColor * nl * sh * smoothstep(0.04, 0.5, sky);
    }
  }
  if (blk > 0.03) col += pointLights(pos, N, cd);                   // block light is zero away from every lamp: skip the whole loop
  return col;
}
`;

const GLSL_WATER = /* glsl */`
vec3 waterReflect(vec3 pos, vec3 N, vec3 V) {
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  if (distance(pos, uCamPos) > 70.0) return skyColor(normalize(R));
  ivec3 hc; vec3 hn; float ht;
  vec3 ro = pos + vec3(0.0, 0.05, 0.0);
  if (marchHit(ro, normalize(R), 64, hc, hn, ht)) {
    int id = int(texelFetch(uVox, ivec3(hc.x, hc.z, hc.y), 0).r * 255.0 + 0.5);
    vec3 alb = texelFetch(uPalette, ivec2(id, hn.y > 0.5 ? 0 : 1), 0).rgb;
    vec3 hp = ro + normalize(R) * ht + hn * 0.05;
    float nl = max(dot(hn, uSunDir), 0.0);
    return alb * (uSkyAmb * 0.9 + uCaveAmb + uSunColor * nl * 0.7 * uSunOn);
  }
  return skyColor(normalize(R));
}
`;

export function createRT(w, atlas) {
  const { nx, ny, nz, data } = w;
  // occupancy texture (x fastest, then z, then y, same as the world array)
  const occ = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const d = LIST[data[i]];
    occ[i] = d.kind === 'cube' || d.name === 'lava' ? 255 : d.kind === 'leaves' ? 120 : 0;
  }
  const vox = new THREE.Data3DTexture(occ, nx, nz, ny);
  vox.format = THREE.RedFormat; vox.type = THREE.UnsignedByteType;
  vox.minFilter = vox.magFilter = THREE.NearestFilter;
  vox.unpackAlignment = 1; vox.needsUpdate = true;

  // coarse light grid: the 8 most relevant lights per 8^3 cell
  const cgx = Math.ceil(nx / 8), cgy = Math.ceil(ny / 8), cgz = Math.ceil(nz / 8);
  const cellCount = cgx * cgy * cgz;
  let lights = w.lights;
  if (lights.length > 6000) lights = lights.filter((_, i) => i % Math.ceil(lights.length / 6000) === 0);
  const W = 4096;
  const rowsFor = (texels) => Math.max(1, Math.ceil(texels / W));
  const lcData = new Float32Array(W * rowsFor(cellCount * 2) * 4).fill(-1);
  for (let cy = 0; cy < cgy; cy++) for (let cz = 0; cz < cgz; cz++) for (let cx = 0; cx < cgx; cx++) {
    const ci = cx + cgx * (cz + cgz * cy);
    const px = w.ox + cx * 8 + 4, py = w.oy + cy * 8 + 4, pz = w.oz + cz * 8 + 4;
    const best = [];
    for (let li = 0; li < lights.length; li++) {
      const L = lights[li];
      const d = Math.hypot(L[0] - px, L[1] - py, L[2] - pz);
      if (d > L[3] + 7) continue;
      best.push([L[7] * Math.pow(1 - d / (L[3] + 7), 2) / (1 + d * 0.05), li]);
    }
    if (!best.length) continue;
    best.sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < Math.min(8, best.length); k++) lcData[(ci * 2 + (k >> 2)) * 4 + (k & 3)] = best[k][1];
  }
  const lightCells = new THREE.DataTexture(lcData, W, rowsFor(cellCount * 2), THREE.RGBAFormat, THREE.FloatType);
  lightCells.minFilter = lightCells.magFilter = THREE.NearestFilter; lightCells.needsUpdate = true;
  const lData = new Float32Array(W * rowsFor(lights.length * 2) * 4);
  lights.forEach((L, i) => {
    lData.set([L[0], L[1], L[2], L[3]], i * 2 * 4);
    lData.set([L[4], L[5], L[6], L[7]], (i * 2 + 1) * 4);
  });
  const lightTex = new THREE.DataTexture(lData, W, rowsFor(lights.length * 2), THREE.RGBAFormat, THREE.FloatType);
  lightTex.minFilter = lightTex.magFilter = THREE.NearestFilter; lightTex.needsUpdate = true;

  // average colour per block id (top / side) for reflections
  const pal = new Uint8Array(256 * 2 * 4);
  const cv = atlas.canvas, g = cv.getContext('2d');
  for (const d of LIST) {
    if (d.id === 0) continue;
    const avg = (tile) => {
      const r = atlas.uv[tile]; if (!r) return [128, 128, 128];
      const x = Math.round(r[0] * cv.width), y = Math.round((1 - r[3]) * cv.height);
      const px = g.getImageData(x, y, 16, 16).data; let rr = 0, gg = 0, bb = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 40) { rr += px[i]; gg += px[i + 1]; bb += px[i + 2]; n++; }
      return n ? [rr / n, gg / n, bb / n] : [128, 128, 128];
    };
    const top = avg(d.tiles[0] === 'GRASS_SIDE' ? 'grass_block_top' : d.tiles[0] || 'stone'), side = avg(d.tiles[1] && d.tiles[1] !== 'GRASS_SIDE' ? d.tiles[1] : d.tiles[0] === 'GRASS_SIDE' ? 'grass_block_side' : d.tiles[0] || 'stone');
    const lin = (v) => Math.round(255 * Math.pow(v / 255, 2.2));
    pal.set([lin(top[0]), lin(top[1]), lin(top[2]), 255], d.id * 4);
    pal.set([lin(side[0]), lin(side[1]), lin(side[2]), 255], (256 + d.id) * 4);
  }
  const palette = new THREE.DataTexture(pal, 256, 2, THREE.RGBAFormat, THREE.UnsignedByteType);
  palette.minFilter = palette.magFilter = THREE.NearestFilter; palette.needsUpdate = true;

  const uniforms = {
    uVox: { value: vox }, uLightCells: { value: lightCells }, uLights: { value: lightTex }, uPalette: { value: palette },
    uGridSize: { value: new THREE.Vector3(nx, ny, nz) }, uGridMin: { value: new THREE.Vector3(w.ox, w.oy, w.oz) },
    uCellGrid: { value: new THREE.Vector3(cgx, cgy, cgz) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.62, 0.35).normalize() }, uSunColor: { value: new THREE.Color(1.05, 0.9, 0.72) },
    uSkyAmb: { value: new THREE.Color(0.5, 0.62, 0.8) }, uCaveAmb: { value: new THREE.Color(0.02, 0.02, 0.03) },
    uSkyTop: { value: new THREE.Color(0.25, 0.45, 0.8) }, uSkyHorizon: { value: new THREE.Color(0.65, 0.78, 0.92) },
    uCamPos: { value: new THREE.Vector3() }, uTime: { value: 0 }, uMaxLights: { value: 8 }, uSunSteps: { value: 120 }, uSunOn: { value: 1 },
  };

  // patch a MeshBasicMaterial so it is lit by the ray-traced lighting
  function patch(mat, { objLight = null, water = false } = {}) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      if (objLight) sh.uniforms.uObjLight = { value: objLight };
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', `varying vec3 vWPos; varying vec3 vWNor; varying vec3 vLight;
          ${objLight ? 'uniform vec3 uObjLight;' : 'attribute vec3 aLight;'}
          void main() {`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNor = normalize(mat3(modelMatrix) * normal);
          vLight = ${objLight ? 'uObjLight' : 'aLight'};`);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `${GLSL_COMMON}${water ? GLSL_WATER : ''}
          void main() {`)
        .replace('#include <opaque_fragment>', water ? /* glsl */`
          vec3 Nw = normalize(vWNor);
          vec3 V = normalize(uCamPos - vWPos);
          Nw = normalize(Nw + vec3(sin(vWPos.x * 1.7 + uTime * 1.2) * 0.04 + sin(vWPos.z * 3.1 - uTime) * 0.03, 0.0, cos(vWPos.z * 1.9 + uTime * 1.1) * 0.04));
          vec3 base = outgoingLight;
          vec3 lt = rtLighting(vWPos, vec3(0.0, 1.0, 0.0), vLight);
          vec3 refr = base * lt;
          float fr = 0.03 + 0.97 * pow(1.0 - max(dot(V, Nw), 0.0), 4.0);
          vec3 refl = waterReflect(vWPos, Nw, V);
          outgoingLight = mix(refr, refl, clamp(fr + 0.12, 0.0, 1.0));
          diffuseColor.a = mix(0.62, 0.96, fr);
          #include <opaque_fragment>`
          : /* glsl */`
          vec3 Nn = normalize(vWNor);
          vec3 lt = rtLighting(vWPos, Nn, vLight);
          outgoingLight *= lt;
          outgoingLight = max(outgoingLight, diffuseColor.rgb * vLight.z * 1.15);
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'rt' + (objLight ? 'o' : 'w') + (water ? 'w' : '');
    return mat;
  }
  return { uniforms, patch, lights: lights.length };
}
