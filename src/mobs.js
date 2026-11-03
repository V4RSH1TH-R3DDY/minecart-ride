// Mob manager: spawning, ambient behaviour (pace / hop / fly / swim), head-tracking, lighting and placement.
import * as THREE from 'three';
import { DEFS } from './mobdefs.js';
import { buildMob, clamp } from './mobkit.js';
import { LIST, B } from './blocks.js';
import { MOB_SOUNDS } from './audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rngFrom = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function createMobs({ scene, world, track, texFor, rt, fireballTex, audio }) {
  const mobs = [];
  const activeRadius = 52;
  const AIR = B.air;

  const solidFloor = (id) => id !== AIR && (LIST[id].kind === 'cube' || LIST[id].kind === 'leaves');
  const isAir = (x, y, z) => { const id = world.get(x, y, z); return id === AIR || LIST[id].kind === 'cross' || LIST[id].kind === 'chain'; };
  const isLiquid = (x, y, z, id) => world.get(x, y, z) === id;

  // ---------- spawning ----------
  function spawn(type, pos, o = {}) {
    const def = DEFS[type];
    if (!def) throw new Error('unknown mob ' + type);
    const objLight = V(1, 0, def.emissiveBase || 0);
    const built = buildMob(def, texFor, rt.patch, objLight);
    const m = {
      type, def, ...built, objLight, group: built.root,
      pos: pos.clone(), home: pos.clone(), yaw: o.yaw ?? 0, tyaw: o.yaw ?? 0, leash: o.leash ?? 3, ph: o.ph ?? Math.random(),
      walk: 0, wp: 0, hop: 0, hopT: 0, look: { yaw: 0, pitch: 0 }, vel: V(), state: 'idle', timer: 1 + Math.random() * 4,
      target: null, kind: o.kind || def.kind, swimRadius: o.swimRadius ?? 2, flyRadius: o.flyRadius ?? 4, flyY: o.flyY ?? 0,
      bob: 0, mascot: !!o.mascot, shoot: 0, lightT: Math.random(), ghostAlt: def.texAlt ? texFor(def.texAlt) : null, baseMap: built.main.map,
      lockYaw: o.lockYaw, floorY: pos.y, lavaFloor: !!o.lava, always: !!o.always,
    };
    m.group.position.copy(pos); m.group.rotation.y = m.yaw;
    m.group.visible = false;
    scene.add(m.group);
    mobs.push(m);
    return m;
  }

  // ---------- movement ----------
  function groundOk(x, y, z, kind) {
    // standing spot: solid (non-liquid) floor at y-1, two air cells above; lava surface for striders
    const fx = Math.floor(x), fz = Math.floor(z), fy = Math.floor(y + 0.01);
    if (kind === 'lava') return isLiquid(fx, fy - 1, fz, B.lava) && isAir(fx, fy, fz) && isAir(fx, fy + 1, fz);
    return solidFloor(world.get(fx, fy - 1, fz)) && isAir(fx, fy, fz) && isAir(fx, fy + 1, fz);
  }
  function pickGroundTarget(m, rnd) {
    for (let k = 0; k < 8; k++) {
      const a = rnd() * Math.PI * 2, r = 1 + rnd() * m.leash;
      const tx = m.home.x + Math.cos(a) * r, tz = m.home.z + Math.sin(a) * r;
      let ok = groundOk(tx, m.home.y, tz, m.kind === 'lava' ? 'lava' : 'ground');
      for (let s = 1; s <= 5 && ok; s++) ok = groundOk(m.pos.x + (tx - m.pos.x) * s / 5, m.home.y, m.pos.z + (tz - m.pos.z) * s / 5, m.kind === 'lava' ? 'lava' : 'ground');
      if (ok) return V(tx, m.home.y, tz);
    }
    return null;
  }

  const rnd = rngFrom(12345);
  function updateMob(m, dt, t, cart) {
    const def = m.def;
    m.timer -= dt;
    // ambient mob sounds: positional, only when the mob is reasonably close to the cart
    const snd = MOB_SOUNDS[m.type];
    if (snd && audio) {
      m.sndT = (m.sndT ?? rnd() * snd.every[1]) - dt;
      if (m.sndT <= 0) {
        m.sndT = snd.every[0] + rnd() * (snd.every[1] - snd.every[0]);
        if (Math.hypot(cart.x - m.pos.x, cart.z - m.pos.z) < (snd.range || 30)) audio.play(snd.ev, { pos: { x: m.pos.x, y: m.pos.y + 1, z: m.pos.z }, vol: snd.vol, ref: 5 });
      }
    }
    if (m.kind === 'ground' || m.kind === 'lava' || m.kind === 'hop') {
      if (m.state === 'idle' && m.timer <= 0 && def.speed > 0 && !m.mascot) {
        m.target = pickGroundTarget(m, rnd);
        if (m.target) { m.state = 'walk'; m.tyaw = Math.atan2(m.target.x - m.pos.x, m.target.z - m.pos.z); }
        else m.timer = 2 + rnd() * 3;
      }
      if (m.state === 'walk' && m.target) {
        const dx = m.target.x - m.pos.x, dz = m.target.z - m.pos.z, d = Math.hypot(dx, dz);
        const yawErr = wrapAngle(m.tyaw - m.yaw);
        m.yaw += yawErr * Math.min(1, dt * 6);
        if (d < 0.15) { m.state = 'idle'; m.timer = 2.5 + rnd() * 5; m.target = null; }
        else if (Math.abs(yawErr) < 0.6) {
          const sp = def.speed * (m.kind === 'hop' ? 1.5 : 1);
          if (m.kind === 'hop') {          // hop in bursts: move only while airborne
            m.hopT += dt * 2.0; m.hop = m.hopT % 1;
            const mv = Math.sin(m.hop * Math.PI) > 0.05 ? sp * dt * 1.8 : 0;
            m.pos.x += (dx / d) * Math.min(mv, d); m.pos.z += (dz / d) * Math.min(mv, d);
          } else { m.pos.x += (dx / d) * sp * dt; m.pos.z += (dz / d) * sp * dt; m.wp += sp * dt * 3.2 * (m.def.wpScale || 1); }
        }
      }
      const targetWalk = m.state === 'walk' && m.kind !== 'hop' ? 1 : 0;
      m.walk += (targetWalk - m.walk) * Math.min(1, dt * 6);
      if (m.kind === 'hop') { if (m.state !== 'walk') { m.hop = Math.max(0, m.hop - dt * 3); } m.pos.y = m.home.y + Math.sin(m.hop * Math.PI) * 0.5; }
      else m.pos.y = m.home.y + (m.kind === 'lava' ? 0.0 : 0);
    } else if (m.kind === 'fly') {
      // orbit around home on a circle, bobbing; heading follows the tangent
      const w = (def.speed || 1) / Math.max(1.5, m.flyRadius);
      const ang = t * w + m.ph * 6.28;
      const tx = m.home.x + Math.cos(ang) * m.flyRadius, tz = m.home.z + Math.sin(ang) * m.flyRadius;
      const dx = tx - m.pos.x, dz = tz - m.pos.z;
      m.pos.x = tx; m.pos.z = tz;
      m.pos.y = m.home.y + Math.sin(t * (m.type === 'blaze' ? 1.2 : 2.2) + m.ph * 7) * (m.type === 'blaze' ? 0.5 : 0.4) + (m.type === 'bat' ? Math.sin(t * 5 + m.ph) * 0.15 : 0);
      if (m.type !== 'blaze') m.yaw = Math.atan2(-Math.sin(ang), Math.cos(ang)) * 0 + Math.atan2(dx, dz) || m.yaw;
      m.walk = 0;
    } else if (m.kind === 'swim') {
      const ang = t * 0.35 + m.ph * 6.28;
      const tx = m.home.x + Math.cos(ang) * m.swimRadius, tz = m.home.z + Math.sin(ang * 1.3) * m.swimRadius * 0.6;
      m.yaw = Math.atan2(tx - m.pos.x, tz - m.pos.z) || m.yaw;
      m.pos.x = tx; m.pos.z = tz; m.pos.y = m.home.y + Math.sin(t * 0.8 + m.ph * 5) * 0.25;
      m.walk = 0;
    }
    // head tracking: turn the head toward the cart when it is near
    const dx = cart.x - m.pos.x, dz = cart.z - m.pos.z, dy = cart.y + 0.8 - (m.pos.y + 1.0), d = Math.hypot(dx, dz);
    let ty = 0, tp = 0;
    if (d < 16 && m.kind !== 'swim') {
      ty = clamp(wrapAngle(Math.atan2(dx, dz) - m.yaw), -0.9, 0.9);
      tp = clamp(-Math.atan2(dy, Math.max(d, 1)) * 0.8, -0.5, 0.5);
    }
    m.look.yaw += (ty - m.look.yaw) * Math.min(1, dt * 4); m.look.pitch += (tp - m.look.pitch) * Math.min(1, dt * 4);
    if (m.mascot) { m.yaw += wrapAngle((m.lockYaw ?? m.yaw) - m.yaw) * Math.min(1, dt * 3); }

    m.group.position.copy(m.pos);
    m.group.rotation.y = m.yaw;
    def.anim(m, t, m.bones);

    // blaze: now and then lobs a small fireball toward the cart that falls short
    if (m.type === 'blaze') {
      m.shoot -= dt;
      if (m.shoot <= 0 && m.timer <= 0 && Math.hypot(cart.x - m.pos.x, cart.z - m.pos.z) < 32) { m.shoot = 1; m.timer = 5 + rnd() * 7; launchFireball(m, cart); }
    }
  }

  // ---------- fireballs (blaze) ----------
  const fireballs = [];
  function launchFireball(m, cart) {
    if (!fireballTex) return;
    const mat = new THREE.SpriteMaterial({ map: fireballTex, fog: false, depthWrite: false, transparent: true });
    const s = new THREE.Sprite(mat); s.scale.setScalar(0.7);
    const from = m.pos.clone().add(V(0, 0.8, 0));
    const to = V(cart.x + (rnd() - 0.5) * 9, cart.y - 2.5, cart.z + (rnd() - 0.5) * 9);   // aimed near the cart, never at it
    const dir = to.clone().sub(from); if (dir.length() > 20) to.copy(from).addScaledVector(dir.normalize(), 20);
    s.position.copy(from); scene.add(s);
    fireballs.push({ s, from, to, t: 0, life: 1.6 });
  }
  function updateFireballs(dt) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i]; f.t += dt;
      const k = f.t / f.life;
      f.s.position.lerpVectors(f.from, f.to, k); f.s.position.y -= (k * k) * 3;
      f.s.material.opacity = k < 0.85 ? 1 : (1 - k) / 0.15;
      f.s.material.rotation = f.t * 4;
      if (k >= 1) { scene.remove(f.s); f.s.material.dispose(); fireballs.splice(i, 1); }
    }
  }

  // ---------- per-frame ----------
  function update(dt, t, cartPos, camPos) {
    for (const m of mobs) {
      const d = Math.hypot(m.pos.x - cartPos.x, m.pos.z - cartPos.z) + Math.abs(m.pos.y - cartPos.y) * 0.5;
      const near = m.always || d < activeRadius;
      if (m.group.visible !== near) m.group.visible = near;
      if (!near) continue;
      updateMob(m, dt, t, cartPos);
      m.lightT -= dt;
      if (m.lightT <= 0) {            // ambient light for the mob, refreshed a few times a second
        m.lightT = 0.4;
        const l = world.lightAt(m.pos.x, m.pos.y + 1, m.pos.z);
        m.objLight.x = l.sky / 15; m.objLight.y = l.blk / 15; m.objLight.z = m.def.emissiveBase || 0;
      }
    }
    updateFireballs(dt);
  }

  return { mobs, spawn, update };
}
