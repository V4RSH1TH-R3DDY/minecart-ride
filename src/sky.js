import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// Sky dome with gradient, sun glow and stars (for the End), plus drifting blocky clouds.
export function createSky(scene, moonImage) {
  const uniforms = {
    uTop: { value: new THREE.Color(0.25, 0.45, 0.8) }, uHorizon: { value: new THREE.Color(0.65, 0.78, 0.92) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.62, 0.35).normalize() }, uSunOn: { value: 1 }, uStars: { value: 0 }, uTime: { value: 0 }, uNebula: { value: 0 }, uMoonGlow: { value: 0 }, uStarDen: { value: 0.9965 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform float uSunOn; uniform float uStars; uniform float uTime; uniform float uNebula; uniform float uMoonGlow; uniform float uStarDen;
      varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.5, clamp(-d.y * 3.0, 0.0, 1.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.18) * uSunOn;
        if (uStars > 0.0) {
          vec2 g = floor(vec2(atan(d.z, d.x) * 90.0, d.y * 160.0));
          float r = h21(g);
          float star = step(uStarDen, r) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 40.0));
          float tint = h21(g + 7.0);
          vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), step(0.7, tint));      // blue-white and warm stars
          col += sc * star * uStars * step(0.0, d.y + 0.05) * (1.0 + 0.8 * step(0.998, r));
        }
        col += vec3(0.35, 0.1, 0.55) * pow(1.0 - abs(d.y), 3.0) * 0.35 * uNebula;                // the End's purple haze
        float ms = max(dot(d, uSunDir), 0.0);
        col += vec3(0.42, 0.52, 0.9) * (pow(ms, 40.0) * 0.28 + pow(ms, 400.0) * 0.5) * uMoonGlow;  // moon halo
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);

  // blocky clouds: all boxes merged into one geometry (two copies a period apart so the drift wraps seamlessly) = 2 draw calls
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false, depthWrite: false });
  const PERIOD = 760;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const boxes = [];
  for (let i = 0; i < 70; i++) {
    const cx = (rnd() - 0.5) * PERIOD, cy = 175 + rnd() * 25, cz = (rnd() - 0.5) * 700;
    const parts = 3 + Math.floor(rnd() * 4);
    for (let p = 0; p < parts; p++) {
      const w = 14 + rnd() * 30, h = 4 + rnd() * 3, d = 10 + rnd() * 22;
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(cx + (rnd() - 0.5) * 36, cy + rnd() * 3, cz + (rnd() - 0.5) * 26);
      boxes.push(geo);
    }
  }
  const merged = mergeGeometries(boxes);
  boxes.forEach((g) => g.dispose());
  const clouds = new THREE.Group();
  for (const k of [0, -1]) { const m = new THREE.Mesh(merged, cloudMat); m.position.x = k * PERIOD; m.frustumCulled = false; clouds.add(m); }
  scene.add(clouds);

  // the moon: the vanilla (square) moon sprite, kept at a fixed direction in the sky and following the camera
  let moon = null; const moonDir = new THREE.Vector3(-0.35, 0.5, 0.8).normalize();
  if (moonImage) {
    const tex = new THREE.Texture(moonImage); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    moon = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, depthWrite: false, fog: false, color: 0xffffff, blending: THREE.AdditiveBlending }));   // additive: the sprite's black becomes see-through
    moon.renderOrder = -9; moon.visible = false; scene.add(moon);
  }
  return {
    uniforms, clouds, cloudMat, moon, moonDir,
    update(dt, camPos, t) {
      dome.position.copy(camPos);
      if (moon) { moon.position.copy(camPos).addScaledVector(moonDir, 330); moon.lookAt(camPos); }
      uniforms.uTime.value = t;
      clouds.position.x = (clouds.position.x + dt * 1.4) % PERIOD;           // the two copies tile, so the drift never shows a seam
    },
  };
}
