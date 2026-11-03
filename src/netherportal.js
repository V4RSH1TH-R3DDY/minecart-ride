// Nether portal: the animated vanilla portal texture on a translucent plane, plus the full-screen purple haze when you pass through.
import * as THREE from 'three';
import { pixelTexture } from './assets.js';

const FRAMES = 32;

export function createNetherPortal(img, info) {
  const tex = pixelTexture(img.nether_portal);
  const uniforms = { uTex: { value: tex }, uFrame: { value: 0 }, uSize: { value: new THREE.Vector2(info.width, info.height) }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uFrame; uniform vec2 uSize; uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 b = fract(vUv * uSize);                       // one portal block per 1x1 cell
        b.x += 0.012 * sin(uTime * 2.0 + vUv.y * 9.0);       // a slight shimmer
        float f = mod(uFrame, ${FRAMES}.0);
        vec4 c = texture2D(uTex, vec2(clamp(b.x, 0.002, 0.998), (f + clamp(b.y, 0.002, 0.998)) / ${FRAMES}.0));
        gl_FragColor = vec4(c.rgb * 1.25, max(c.a, 0.45) * 0.9);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(info.width, info.height), mat);
  mesh.renderOrder = 3;
  return { mesh, uniforms, update(t) { uniforms.uFrame.value = Math.floor(t * 10) % FRAMES; uniforms.uTime.value = t; } };
}

// Screen overlay used while passing through: portal texture tiled over the whole view, tinted purple, plus a black fade.
export function createPortalFx(img) {
  const cv = document.getElementById('portalfx'), g = cv.getContext('2d');
  const fadeEl = document.getElementById('fade');
  let alpha = 0, fade = 0, fadeDir = 0;
  function resize() { cv.width = Math.ceil(window.innerWidth / 3); cv.height = Math.ceil(window.innerHeight / 3); }
  resize(); window.addEventListener('resize', resize);
  const frames = [];
  const sheet = img.nether_portal;
  for (let f = 0; f < FRAMES; f++) { const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').drawImage(sheet, 0, f * 16, 16, 16, 0, 0, 16, 16); frames.push(c); }
  function setFade(v) { fade = v; fadeEl.style.opacity = v; }
  return {
    setAlpha(a) { alpha = a; cv.style.opacity = a > 0.001 ? 1 : 0; },
    setFade,
    fadeFromBlack() { setFade(1); fadeDir = -1; },
    clear() { alpha = 0; cv.style.opacity = 0; setFade(0); fadeDir = 0; },
    update(dt, t) {
      if (fadeDir < 0) { setFade(Math.max(0, fade - dt)); if (fade <= 0) fadeDir = 0; }
      if (alpha <= 0.001) return;
      const ts = 16 * 2, f = frames[Math.floor(t * 10) % FRAMES], ox = Math.round(t * 6) % ts, oy = Math.round(t * 9) % ts;
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#2a0a52'; g.globalAlpha = 1; g.fillRect(0, 0, cv.width, cv.height);
      g.globalAlpha = 0.85;
      for (let y = -ts; y < cv.height + ts; y += ts) for (let x = -ts; x < cv.width + ts; x += ts) g.drawImage(f, x - ox, y - oy, ts, ts);
      g.globalAlpha = 1;
      cv.style.opacity = alpha;
    },
  };
}
