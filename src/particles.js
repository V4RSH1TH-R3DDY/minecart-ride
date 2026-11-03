// Biome particle effects: GPU point sprites (one batch per effect), simulated on the CPU, collided against the voxel world.
// Effects spawn in a fan in front of the camera and are scaled up / down by the biome the cart is in.
import * as THREE from 'three';
import { B } from './blocks.js';

const R = Math.random;
const rr = (a, b) => a + R() * (b - a);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const AUTUMN = [[0.78, 0.2, 0.1], [0.88, 0.52, 0.1], [0.92, 0.78, 0.22], [0.55, 0.62, 0.16]];

// ---- effect definitions ------------------------------------------------------------------------------------
// frames: sprite names; count: target alive count per biome; spawn: 'air' | 'ceiling' | 'lava'; other fields tune the motion.
const FX = [
  { name: 'cherry', frames: Array.from({ length: 12 }, (_, i) => 'cherry_' + i), max: 170, count: { cherry: 130, alpine: 26, taiga: 8 }, size: [0.13, 0.22], life: [6, 10], fall: [0.5, 0.85], sway: 0.5, drift: [0.35, 0.1], spin: 2.2, dy: [0.5, 9], r: [1.6, 15], anim: true },
  { name: 'leaf', frames: Array.from({ length: 12 }, (_, i) => 'leaf_' + i), max: 110, count: { taiga: 62, cherry: 28, alpine: 7 }, size: [0.2, 0.32], life: [6, 11], fall: [0.8, 1.3], sway: 0.9, drift: [0.5, 0.2], spin: 3, tint: () => pick(AUTUMN), dy: [0.5, 9], r: [1.6, 15] },
  { name: 'pollen', frames: ['glitter_4'], max: 70, count: { alpine: 48, cherry: 26, taiga: 12 }, size: [0.045, 0.08], life: [6, 10], fall: [-0.08, 0.05], sway: 0.3, drift: [0.12, 0.05], tint: () => [1, 0.95, 0.65], emissive: 0.7, dy: [-1, 5], r: [1.6, 14] },
  { name: 'snow', frames: ['glitter_4'], max: 280, count: { ice: 250, tunnel: 0 }, size: [0.06, 0.11], life: [7, 12], fall: [0.55, 0.95], sway: 0.35, drift: [0.12, 0.05], tint: () => [0.96, 0.98, 1], emissive: 0.45, dy: [1, 12], r: [1.5, 16] },
  { name: 'sparkle', frames: ['glow'], max: 44, count: { ice: 30 }, size: [0.2, 0.42], life: [2, 4.5], fall: [-0.03, 0.04], sway: 0.1, drift: [0.03, 0.02], tint: () => [0.55, 0.9, 1], emissive: 1, add: true, pulse: true, dy: [-1, 6], r: [2, 14] },
  { name: 'spore', frames: ['glitter_4'], max: 100, count: { lush: 85 }, size: [0.05, 0.1], life: [6, 10], fall: [0.08, 0.2], sway: 0.35, drift: [0.06, 0.03], tint: () => (R() < 0.7 ? [0.5, 0.95, 0.35] : [0.4, 0.95, 0.8]), emissive: 1, add: true, dy: [-1, 8], r: [1.6, 15] },
  { name: 'firefly', frames: ['glow'], max: 26, count: { lush: 15, taiga: 3 }, size: [0.18, 0.3], life: [6, 11], fall: [0, 0], sway: 0.0, wander: 0.9, tint: () => [0.85, 1, 0.35], emissive: 1, add: true, pulse: true, dy: [0.2, 3.5], r: [2, 13] },
  { name: 'drip', frames: ['drip_fall'], max: 22, count: { lush: 9, tunnel: 5, ice: 4 }, size: [0.1, 0.14], life: [3, 6], gravity: 11, tint: () => [0.45, 0.65, 1], emissive: 0.3, spawn: 'ceiling', r: [1.5, 11], rate: 0.5 },
  { name: 'ash', frames: ['generic_0'], max: 210, count: { nether: 190 }, size: [0.07, 0.13], life: [6, 11], fall: [0.25, 0.5], sway: 0.5, drift: [0.55, 0.2], tint: () => pick([[0.86, 0.84, 0.82], [0.62, 0.6, 0.6], [0.95, 0.9, 0.85]]), emissive: 0.5, dy: [-2, 10], r: [1.5, 17] },
  { name: 'ember', frames: ['lava'], max: 80, count: { nether: 60 }, size: [0.09, 0.18], life: [2.2, 4.2], rise: [1.0, 2.0], sway: 0.6, drift: [0.2, 0.1], tint: () => [1, rr(0.55, 0.9), 0.3], emissive: 1, add: true, spawn: 'lava', r: [2, 18], rate: 1 },
  { name: 'smoke', frames: ['big_smoke_0'], max: 16, count: { nether: 9 }, size: [0.9, 1.7], life: [3.5, 6], rise: [0.5, 0.9], sway: 0.4, drift: [0.25, 0.1], tint: () => [0.28, 0.26, 0.26], emissive: 0.2, alpha: 0.4, spawn: 'lava', r: [3, 18], rate: 0.5, grow: 1.6 },
  { name: 'endmote', frames: ['glitter_4'], max: 130, count: { end: 110 }, size: [0.06, 0.13], life: [4, 8], rise: [0.15, 0.45], sway: 0.6, drift: [0.1, 0.05], tint: () => (R() < 0.6 ? [0.72, 0.34, 1] : [0.3, 0.92, 0.85]), emissive: 1, add: true, dy: [-3, 9], r: [1.6, 16] },
  { name: 'dust', frames: ['generic_0'], max: 80, count: { tunnel: 55, ice: 8, lush: 10, nether: 8 }, size: [0.04, 0.07], life: [7, 12], fall: [0.02, 0.1], sway: 0.25, drift: [0.05, 0.03], tint: () => [0.95, 0.9, 0.8], emissive: 0.4, alpha: 0.7, dy: [-1, 4], r: [1.5, 12] },
];

const VERT = /* glsl */`
  attribute float aSize; attribute float aAlpha; attribute float aRot; attribute float aFrame; attribute vec3 aColor;
  uniform float uPx; uniform float uMax; uniform float uFade;
  varying float vAlpha; varying float vRot; varying float vFrame; varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    gl_PointSize = clamp(aSize * uPx / max(d, 0.05), 1.0, uMax);
    float fade = 1.0 - smoothstep(uFade * 0.7, uFade, d);          // dissolve with distance
    float near = smoothstep(0.35, 1.2, d);                           // and just in front of the lens
    vAlpha = aAlpha * fade * near; vRot = aRot; vFrame = aFrame; vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uTex; uniform float uN; uniform float uBright; uniform float uEmis;
  varying float vAlpha; varying float vRot; varying float vFrame; varying vec3 vColor;
  void main() {
    if (vAlpha < 0.01) discard;
    vec2 pc = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    pc = mat2(c, -s, s, c) * pc + 0.5;
    if (pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) discard;
    vec4 t = texture2D(uTex, vec2((floor(vFrame + 0.5) + pc.x) / uN, 1.0 - pc.y));
    if (t.a < 0.1) discard;
    float b = mix(uBright, 1.0, uEmis);
    gl_FragColor = vec4(t.rgb * vColor * b, t.a * vAlpha);
  }`;

export function createParticles({ scene, world, renderer, imgs, night = false }) {
  if (night) {   // fireflies come out, pollen mostly goes away
    const f = FX.find((d) => d.name === 'firefly'), p = FX.find((d) => d.name === 'pollen');
    f.count = { lush: 15, alpine: 11, cherry: 13, taiga: 17 }; f.max = 40; f.size = [0.22, 0.38]; f.r = [2, 15];
    p.count = { alpine: 10, cherry: 6, taiga: 3 };
  }
  const effects = FX.map((def) => {
    // atlas: one cell per frame, each sprite centred in a square cell
    const S = Math.max(...def.frames.map((f) => Math.max(imgs[f].width, imgs[f].height)));
    const cv = document.createElement('canvas'); cv.width = S * def.frames.length; cv.height = S;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    def.frames.forEach((f, i) => g.drawImage(imgs[f], i * S + Math.floor((S - imgs[f].width) / 2), Math.floor((S - imgs[f].height) / 2)));
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const N = def.max;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), rot = new Float32Array(N), frame = new Float32Array(N), color = new Float32Array(N * 3).fill(1);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setAttribute('aFrame', new THREE.BufferAttribute(frame, 1)); geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uN: { value: def.frames.length }, uPx: { value: 800 }, uMax: { value: 128 }, uFade: { value: (def.r ? def.r[1] : 14) + 4 }, uBright: { value: 1 }, uEmis: { value: def.emissive ?? 0 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false,
      blending: def.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4;
    scene.add(pts);
    return {
      def, pts, geo, mat, pos, size, alpha, rot, frame, color,
      age: new Float32Array(N).fill(1e9), life: new Float32Array(N).fill(1), vel: new Float32Array(N * 3), ph: new Float32Array(N), base: new Float32Array(N), spin: new Float32Array(N), alive: 0, acc: 0,
    };
  });

  const gl = renderer.getContext();
  const maxPoint = Math.min(256, gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64);
  const solid = (x, y, z) => world.solidAt(x, y, z);

  function lavaSurface(x, z, y0, y1) {                      // top of a lava column with air above it, scanning down
    const fx = Math.floor(x), fz = Math.floor(z);
    for (let y = Math.floor(y0); y >= Math.floor(y1); y--) {
      if (world.get(fx, y, fz) === B.lava && world.get(fx, y + 1, fz) === B.air) return y + 1;
    }
    return null;
  }

  function spawnPoint(e, cam, fwdAng, out, cart) {
    const d = e.def;
    for (let a = 0; a < 7; a++) {
      const ang = fwdAng + (R() - 0.5) * 3.0, r = rr(d.r[0], d.r[1]);
      const x = cam.x + Math.sin(ang) * r, z = cam.z + Math.cos(ang) * r;
      if (d.spawn === 'lava') {
        const y = lavaSurface(x, z, cam.y + 6, cam.y - 24);
        if (y !== null) { out[0] = x; out[1] = y + 0.05; out[2] = z; return true; }
        continue;
      }
      if (d.spawn === 'ceiling') {                           // just under the nearest ceiling above an open column
        for (let y = cam.y + 9; y > cam.y - 2; y--) {
          if (solid(x, y, z) && !solid(x, y - 1, z)) { out[0] = x; out[1] = y - 0.1; out[2] = z; return true; }
        }
        continue;
      }
      const y = cam.y + rr(d.dy[0], d.dy[1]);
      if (!solid(x, y, z)) { out[0] = x; out[1] = y; out[2] = z; return true; }
    }
    return false;
  }

  const tmp = [0, 0, 0];
  function spawn(e, cam, fwdAng, cart, fill) {
    const d = e.def;
    let i = -1;
    for (let k = 0; k < d.max; k++) if (e.age[k] >= e.life[k]) { i = k; break; }
    if (i < 0 || !spawnPoint(e, cam, fwdAng, tmp, cart)) return false;
    e.life[i] = rr(d.life[0], d.life[1]); e.age[i] = fill ? R() * e.life[i] * 0.8 : 0;
    e.pos[i * 3] = tmp[0]; e.pos[i * 3 + 1] = tmp[1]; e.pos[i * 3 + 2] = tmp[2];
    e.base[i] = rr(d.size[0], d.size[1]); e.size[i] = e.base[i];
    e.ph[i] = R() * 6.283; e.spin[i] = (R() - 0.5) * 2 * (d.spin || 0); e.rot[i] = R() * 6.283;
    e.frame[i] = Math.floor(R() * d.frames.length);
    const c = d.tint ? d.tint() : [1, 1, 1]; e.color.set(c, i * 3);
    const vx = d.drift ? d.drift[0] * rr(0.5, 1.2) : 0, vz = d.drift ? d.drift[1] * rr(-1, 1) : 0;
    e.vel[i * 3] = vx; e.vel[i * 3 + 2] = vz;
    e.vel[i * 3 + 1] = d.gravity ? 0 : d.rise ? rr(d.rise[0], d.rise[1]) : d.fall ? -rr(d.fall[0], d.fall[1]) : 0;
    if (d.wander) { e.vel[i * 3] = (R() - 0.5) * d.wander; e.vel[i * 3 + 2] = (R() - 0.5) * d.wander; e.vel[i * 3 + 1] = (R() - 0.5) * d.wander * 0.5; }
    return true;
  }

  function update(dt, t, { camera, cart, biome, sky = 1, fill = false, night = false }) {
    const cam = camera.position, fwd = camera.getWorldDirection(new THREE.Vector3()), fwdAng = Math.atan2(fwd.x, fwd.z);
    const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const bright = (0.4 + 0.6 * sky) * (night ? 1 - 0.68 * sky : 1);   // unlit sprites must not glow in the dark
    for (const e of effects) {
      const d = e.def, target = d.count[biome] || 0;
      e.mat.uniforms.uPx.value = px; e.mat.uniforms.uMax.value = maxPoint; e.mat.uniforms.uBright.value = bright;
      // spawn up to the biome's target; the pool simply drains when the biome has none
      let aliveNow = 0;
      for (let i = 0; i < d.max; i++) if (e.age[i] < e.life[i]) aliveNow++;
      let want = Math.max(0, target - aliveNow);
      if (d.rate !== undefined) { e.acc += d.rate * target * dt * 0.35; want = Math.min(want, Math.floor(e.acc)); e.acc -= Math.floor(e.acc); }
      const burst = fill ? want : Math.min(want, 5);
      for (let k = 0; k < burst; k++) spawn(e, cam, fwdAng, cart, fill);
      // integrate
      for (let i = 0; i < d.max; i++) {
        if (e.age[i] >= e.life[i]) { e.alpha[i] = 0; continue; }
        e.age[i] += dt;
        const a = e.age[i], life = e.life[i], i3 = i * 3;
        let x = e.pos[i3], y = e.pos[i3 + 1], z = e.pos[i3 + 2];
        const sw = (d.sway || 0), ph = e.ph[i];
        if (d.gravity) e.vel[i3 + 1] -= d.gravity * dt;
        if (d.wander) { e.vel[i3] += (R() - 0.5) * d.wander * dt * 3; e.vel[i3 + 1] += (R() - 0.5) * d.wander * dt * 2; e.vel[i3 + 2] += (R() - 0.5) * d.wander * dt * 3; for (const k of [0, 1, 2]) e.vel[i3 + k] *= 1 - dt * 0.8; }
        x += (e.vel[i3] + Math.sin(t * 1.3 + ph) * sw) * dt; z += (e.vel[i3 + 2] + Math.cos(t * 1.1 + ph * 1.7) * sw) * dt; y += (e.vel[i3 + 1] + (sw ? Math.sin(t * 2.1 + ph) * sw * 0.15 : 0)) * dt;
        if (solid(x, y, z)) { e.age[i] = life; e.alpha[i] = 0; continue; }      // hit the ground, a wall or a ceiling
        e.pos[i3] = x; e.pos[i3 + 1] = y; e.pos[i3 + 2] = z;
        e.rot[i] += e.spin[i] * dt;
        if (d.anim) e.frame[i] = (e.frame[i] + dt * 7) % d.frames.length;
        const fadeIn = Math.min(1, a / 0.7), fadeOut = Math.min(1, (life - a) / 1.2);
        let al = (d.alpha ?? 1) * fadeIn * fadeOut;
        if (d.pulse) al *= 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2 + ph * 3));
        e.alpha[i] = al;
        e.size[i] = e.base[i] * (d.grow ? 1 + (a / life) * (d.grow - 1) : 1);
      }
      const g = e.geo.attributes;
      g.position.needsUpdate = g.aAlpha.needsUpdate = g.aSize.needsUpdate = g.aRot.needsUpdate = g.aFrame.needsUpdate = g.aColor.needsUpdate = true;
    }
  }
  function clear() { for (const e of effects) { e.age.fill(1e9); e.alpha.fill(0); e.acc = 0; } }
  function stats() { return Object.fromEntries(effects.map((e) => [e.def.name, e.age.reduce((n, a, i) => n + (a < e.life[i] ? 1 : 0), 0)])); }
  return { update, clear, stats, effects };
}
