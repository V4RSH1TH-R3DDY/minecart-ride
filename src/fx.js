import * as THREE from 'three';

// Speed streaks shown when the cart hits a powered rail.
export function createStreaks(scene) {
  const N = 48;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  let life = 0;
  return {
    fire(pos, fwd) {
      const p = geo.attributes.position.array;
      const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(up, fwd).normalize();
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 2.6, t = -2 + Math.random() * 8;
        const c = pos.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, 0.4 + Math.sin(a) * r * 0.6 + 0.6).addScaledVector(fwd, t);
        const len = 1.5 + Math.random() * 2.5;
        p.set([c.x, c.y, c.z, c.x - fwd.x * len, c.y - fwd.y * len, c.z - fwd.z * len], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      life = 1;
    },
    update(dt) { life = Math.max(0, life - dt * 2.4); mat.opacity = life * 0.3; },
  };
}
