import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (t) => t * t * (3 - 2 * t);

function smoothDamp(cur, target, vel, smoothTime, dt) {
  const omega = 2 / smoothTime, x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur.clone().sub(target);
  const temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt);
  vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  return target.clone().add(change.add(temp).multiplyScalar(exp));
}

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera; this.world = world;
    this.pos = V(0, 80, 0); this.posVel = V();
    this.look = V(); this.lookVel = V();
    this.yaw = 0; this.t = 0;
    this.wPanel = 0; this.wPanelTarget = 0;
    this.wFP = 0; this.wFPTarget = 0;
    this.baseFov = 58; this.kick = 0;
    this.shake = 0;
    this.panelPose = null; // {pos, look}
    this.fpPose = null;    // {pos, look}
    this.snap = true; this.lastK = 0; this.open = 1;
  }
  setPanel(on, pose) { this.wPanelTarget = on ? 1 : 0; if (pose) this.panelPose = pose; }
  setFirstPerson(on) { this.wFPTarget = on ? 1 : 0; }
  boost() { this.kick = 14; }
  // a point is "blocked" if it, or anything within the near-plane margin, is inside a solid block
  blocked(p) {
    const m = 0.32, w = this.world;
    return w.solidAt(p.x, p.y, p.z) || w.solidAt(p.x + m, p.y, p.z) || w.solidAt(p.x - m, p.y, p.z) ||
      w.solidAt(p.x, p.y + m, p.z) || w.solidAt(p.x, p.y - m, p.z) || w.solidAt(p.x, p.y, p.z + m) || w.solidAt(p.x, p.y, p.z - m);
  }
  // free-space march from `from` toward `to`; returns the furthest unblocked point
  clip(from, to) {
    const d = to.clone().sub(from), len = d.length();
    if (len < 1e-3) return to.clone();
    d.divideScalar(len);
    const p = V();
    let q = to.clone();
    for (let t = 0.4; t < len; t += 0.2) {
      p.copy(from).addScaledVector(d, t);
      if (this.blocked(p)) { q = from.clone().addScaledVector(d, Math.max(0.6, t - 0.4)); break; }
    }
    if (q === to || q.equals(to)) { if (this.blocked(to)) q = from.clone().addScaledVector(d, Math.max(0.6, len - 0.6)); }
    // never hand back a point that is itself inside geometry
    for (let i = 0; i < 10 && this.blocked(q); i++) q.lerp(from, 0.3);
    return q;
  }
  update(dt, ctx) {
    this.t += dt;
    const { cartPos, fwd, speed } = ctx;
    // heading yaw follows the rail with a lag -> the camera sweeps through corners
    const targetYaw = Math.atan2(fwd.x, fwd.z);
    let dy = targetYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 1.6);

    const phi0 = 150 + 38 * Math.sin(this.t * 0.35) + 10 * Math.sin(this.t * 0.9);
    const sk = this.world.lightAt(cartPos.x, cartPos.y + 1, cartPos.z).sky / 15;
    this.open += (sk - this.open) * Math.min(1, dt * 1.5);
    const R = (5.2 + 3 * this.open) + 1.0 * Math.sin(this.t * 0.27);
    const H = (2.5 + 1.3 * this.open) + 0.6 * Math.sin(this.t * 0.31 + 1);
    const lookT = cartPos.clone().addScaledVector(fwd, Math.min(1.2, speed * 0.15)).add(V(0, 0.7, 0));
    // try several orbit angles and keep the one with the most free space (sticky, so it doesn't flicker)
    let best = null;
    for (const k of [0, -30, 30, -60, 60, -90, 90]) {
      const a = this.yaw + THREE.MathUtils.degToRad(phi0 + k);
      const c = this.clip(lookT, cartPos.clone().add(V(Math.sin(a) * R, H, Math.cos(a) * R)));
      let tight = 0;
      for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) if (this.world.solidAt(c.x + ox, c.y, c.z + oz)) tight += 1.2;
      const score = Math.min(c.distanceTo(lookT), R) - tight - Math.abs(k) * 0.03 + (k === this.lastK ? 0.8 : 0);
      if (!best || score > best.score) best = { score, c, k };
    }
    this.lastK = best.k;
    const clipped = best.c;
    if (this.snap) { this.pos.copy(clipped); this.look.copy(lookT); this.snap = false; }
    this.pos = smoothDamp(this.pos, clipped, this.posVel, 0.45, dt);
    this.look = smoothDamp(this.look, lookT, this.lookVel, 0.2, dt);
    // the lagging camera must never end up behind geometry
    this.pos.copy(this.clip(this.look, this.pos));

    this.wPanel += Math.sign(this.wPanelTarget - this.wPanel) * Math.min(Math.abs(this.wPanelTarget - this.wPanel), dt / 1.2);
    this.wFP += Math.sign(this.wFPTarget - this.wFP) * Math.min(Math.abs(this.wFPTarget - this.wFP), dt / 2.6);

    let pos = this.pos.clone(), look = this.look.clone();
    if (this.fpPose && this.wFP > 0) {
      const k = ease(this.wFP);
      pos.lerp(this.fpPose.pos, k); look.lerp(this.fpPose.look, k);
      pos.y += Math.sin(Math.PI * k) * 0.9; // arc over the cart instead of cutting through it
    }
    if (this.panelPose && this.wPanel > 0) {
      const k = ease(this.wPanel);
      pos.lerp(this.panelPose.pos, k); look.lerp(this.panelPose.look, k);
    }
    // blends (chase -> panel / first person) must not cut through rock either
    const ref = cartPos.clone().add(V(0, 0.9, 0));
    if (this.blocked(pos)) pos = this.clip(ref, pos);
    // gentle sway in first person at speed
    if (this.wFP > 0.99 && this.wPanel < 0.5) {
      const a = Math.min(1, speed / 8) * 0.025;
      pos.y += Math.sin(this.t * 18) * a * 0.5; look.y += Math.sin(this.t * 11) * a;
    }
    this.kick *= Math.exp(-dt * 3.2);
    const fp = ease(this.wFP);
    this.cam.fov = THREE.MathUtils.lerp(this.baseFov, 74, fp) + this.kick + Math.min(6, speed * 0.4) * (1 - this.wPanel);
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(pos);
    this.cam.lookAt(look);
  }
}
