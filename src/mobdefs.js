// Mob definitions: vanilla-style models (see mobkit.js for the conventions) plus procedural animation.
// Boxes: { o:[x,y,z], s:[w,h,d], uv:[u,v], infl, mirror }.  Bone: { parent, pivot, rot, boxes }.
import { rad } from './mobkit.js';

const bx = (o, s, uv, extra = {}) => ({ o, s, uv, ...extra });
const PI = Math.PI;

// set a bone's rotation from vanilla-convention angles (added to its rest pose)
const vrot = (b, x = 0, y = 0, z = 0) => { if (!b) return; const r = b.userData.rest.rot; b.rotation.set(r.x + x, r.y - y, r.z - z); };
const vmove = (b, x = 0, y = 0, z = 0) => { if (!b) return; const p = b.userData.rest.pos; b.position.set(p.x + x / 16, p.y - y / 16, p.z - z / 16); };

// ---------- shared walk cycles (ported from the vanilla models) ----------
function quadWalk(m, B, amp = 1.4) {
  const p = m.wp * 0.6662, w = m.walk;
  vrot(B.hr, Math.cos(p) * amp * w); vrot(B.hl, Math.cos(p + PI) * amp * w);
  vrot(B.fr, Math.cos(p + PI) * amp * w); vrot(B.fl, Math.cos(p) * amp * w);
}
function bipedWalk(m, B, armAmp = 1.0, legAmp = 1.4) {
  const p = m.wp * 0.6662, w = m.walk;
  vrot(B.ra, Math.cos(p + PI) * armAmp * w); vrot(B.la, Math.cos(p) * armAmp * w);
  vrot(B.rl, Math.cos(p) * legAmp * w); vrot(B.ll, Math.cos(p + PI) * legAmp * w);
}
const headLook = (m, B, name = 'head', k = 1) => vrot(B[name], m.look.pitch * k, m.look.yaw * k, 0);
const breathe = (m, t, B, name) => { if (B[name]) B[name].scale.y = 1 + Math.sin(t * 1.6 + m.ph) * 0.012; };

const quadLegs = (u, v, o, s, pivs) => Object.fromEntries(pivs.map(([n, p, extra]) => [n, { pivot: p, boxes: [bx(o, s, [u, v], extra || {})] }]));

export const DEFS = {};

// ---------------------------------------------------------------- WARDEN (ancient city)
DEFS.warden = {
  tex: 'warden', texW: 128, texH: 128, kind: 'ground', speed: 0.4,
  bones: {
    body: { pivot: [0, 3, 0], boxes: [bx([-9, -13, -4], [18, 21, 11], [0, 0])] },
    head: { parent: 'body', pivot: [0, -13, 0], boxes: [bx([-8, -16, -5], [16, 16, 10], [0, 32])] },
    rt: { parent: 'head', pivot: [-8, -12, 0], boxes: [bx([-16, -13, 0], [16, 16, 0], [52, 32])] },
    lt: { parent: 'head', pivot: [8, -12, 0], boxes: [bx([0, -13, 0], [16, 16, 0], [58, 0])] },
    rrib: { parent: 'body', pivot: [-7, -2, -4], boxes: [bx([-2, -11, -0.1], [9, 21, 0], [90, 11])] },
    lrib: { parent: 'body', pivot: [7, -2, -4], boxes: [bx([-7, -11, -0.1], [9, 21, 0], [90, 11], { mirror: true })] },
    ra: { parent: 'body', pivot: [-13, -13, 1], boxes: [bx([-4, 0, -4], [8, 28, 8], [44, 50])] },
    la: { parent: 'body', pivot: [13, -13, 1], boxes: [bx([-4, 0, -4], [8, 28, 8], [0, 58])] },
    rl: { pivot: [-5.9, 11, 0], boxes: [bx([-3.1, 0, -3], [6, 13, 6], [76, 48])] },
    ll: { pivot: [5.9, 11, 0], boxes: [bx([-2.9, 0, -3], [6, 13, 6], [76, 76])] },
  },
  overlays: [{ tex: 'warden_glow', emissive: true }],
  anim(m, t, B) {
    const p = m.wp * 0.6662 * 0.7, w = m.walk, s = Math.sin(t * 0.9 + m.ph * 5);
    vrot(B.rl, Math.cos(p) * 0.9 * w); vrot(B.ll, Math.cos(p + PI) * 0.9 * w);
    vrot(B.ra, Math.cos(p + PI) * 0.6 * w + s * 0.04, 0, 0.09 + s * 0.02); vrot(B.la, Math.cos(p) * 0.6 * w - s * 0.04, 0, -0.09 - s * 0.02);
    vrot(B.body, 0, 0, Math.sin(p * 2) * 0.04 * w + s * 0.015);
    vrot(B.head, m.look.pitch * 0.7 + 0.05 * s, m.look.yaw * 0.7, 0);
    vrot(B.rt, 0, 0, -0.35 - Math.sin(t * 2.4 + m.ph) * 0.12); vrot(B.lt, 0, 0, 0.35 + Math.sin(t * 2.4 + m.ph + 1) * 0.12);
  },
};

// ---------------------------------------------------------------- PIG
DEFS.pig = {
  tex: 'pig', texW: 64, texH: 64, kind: 'ground', speed: 0.9,
  bones: {
    head: { pivot: [0, 12, -6], boxes: [bx([-4, -4, -8], [8, 8, 8], [0, 0]), bx([-2, 0, -9], [4, 3, 1], [16, 16])] },
    body: { pivot: [0, 11, 2], rot: [PI / 2, 0, 0], boxes: [bx([-5, -10, -7], [10, 16, 8], [28, 8])] },
    ...quadLegs(0, 16, [-2, 0, -2], [4, 6, 4], [['hr', [-3, 18, 7]], ['hl', [3, 18, 7]], ['fr', [-3, 18, -5]], ['fl', [3, 18, -5]]]),
  },
  anim(m, t, B) { quadWalk(m, B); headLook(m, B); },
};

// ---------------------------------------------------------------- SHEEP (skin + wool)
DEFS.sheep = {
  tex: 'sheep', texW: 64, texH: 32, kind: 'ground', speed: 0.8,
  bones: {
    head: { pivot: [0, 6, -8], boxes: [bx([-3, -4, -6], [6, 6, 8], [0, 0])] },
    body: { pivot: [0, 5, 2], rot: [PI / 2, 0, 0], boxes: [bx([-4, -10, -7], [8, 16, 6], [28, 8])] },
    ...quadLegs(0, 16, [-2, 0, -2], [4, 12, 4], [['hr', [-3, 12, 7]], ['hl', [3, 12, 7]], ['fr', [-3, 12, -5]], ['fl', [3, 12, -5]]]),
  },
  overlays: [{
    tex: 'sheep_wool', tint: [0.95, 0.95, 0.95],
    bones: {
      head: [bx([-3, -4, -4], [6, 6, 6], [0, 0], { infl: 0.6 })],
      body: [bx([-4, -10, -7], [8, 16, 6], [28, 8], { infl: 1.75 })],
      hr: [bx([-2, 0, -2], [4, 6, 4], [0, 16], { infl: 0.5 })], hl: [bx([-2, 0, -2], [4, 6, 4], [0, 16], { infl: 0.5 })],
      fr: [bx([-2, 0, -2], [4, 6, 4], [0, 16], { infl: 0.5 })], fl: [bx([-2, 0, -2], [4, 6, 4], [0, 16], { infl: 0.5 })],
    },
  }],
  anim(m, t, B) { quadWalk(m, B); headLook(m, B); if (!m.walk) vrot(B.head, 0.35 * Math.max(0, Math.sin(t * 0.5 + m.ph * 3)) + m.look.pitch, m.look.yaw, 0); },
};

// ---------------------------------------------------------------- WOLF
DEFS.wolf = {
  tex: 'wolf', texW: 64, texH: 32, kind: 'ground', speed: 1.4,
  bones: {
    head: { pivot: [-1, 13.5, -7], boxes: [bx([-2, -3, -2], [6, 6, 4], [0, 0]), bx([-2, -5, 0], [2, 2, 1], [16, 14]), bx([2, -5, 0], [2, 2, 1], [16, 14]), bx([-0.5, 0, -5], [3, 3, 4], [0, 10])] },
    body: { pivot: [0, 14, 2], rot: [PI / 2, 0, 0], boxes: [bx([-3, -2, -3], [6, 9, 6], [18, 14])] },
    mane: { pivot: [-1, 14, -3], rot: [PI / 2, 0, 0], boxes: [bx([-3, -3, -3], [8, 6, 7], [21, 0])] },
    ...quadLegs(0, 18, [0, 0, -1], [2, 8, 2], [['hr', [-2.5, 16, 7]], ['hl', [0.5, 16, 7]], ['fr', [-2.5, 16, -4]], ['fl', [0.5, 16, -4]]]),
    tail: { pivot: [-1, 12, 8], rot: [PI / 5, 0, 0], boxes: [bx([0, 0, -1], [2, 8, 2], [9, 18])] },
  },
  anim(m, t, B) { quadWalk(m, B); headLook(m, B); vrot(B.tail, 0, Math.sin(t * 3 + m.ph) * 0.25 * (m.walk ? 0.3 : 1), 0); },
};

// ---------------------------------------------------------------- FOX
const foxLegs = { hr: [[-5, 17.5, 7], 13], hl: [[-1, 17.5, 7], 4], fr: [[-5, 17.5, 0], 13], fl: [[-1, 17.5, 0], 4] };
DEFS.fox = {
  tex: 'fox', texW: 48, texH: 32, kind: 'ground', speed: 1.4,
  bones: {
    head: { pivot: [-1, 16.5, -3], boxes: [bx([-3, -2, -5], [8, 6, 6], [1, 5]), bx([-3, -4, -4], [2, 2, 1], [8, 1]), bx([3, -4, -4], [2, 2, 1], [15, 1]), bx([-1, 2.01, -8], [4, 2, 3], [6, 18])] },
    body: { pivot: [0, 16, -6], rot: [PI / 2, 0, 0], boxes: [bx([-3, 3, -3], [6, 11, 6], [24, 15])] },
    tail: { parent: 'body', pivot: [-4, 15, -1], rot: [-0.05, 0, 0], boxes: [bx([2, 0, -1], [4, 9, 5], [30, 0])] },
    ...Object.fromEntries(Object.entries(foxLegs).map(([n, [p, u]]) => [n, { pivot: p, boxes: [bx([2, 0.5, -1], [2, 6, 2], [u, 24])] }])),
  },
  anim(m, t, B) { quadWalk(m, B, 1.2); headLook(m, B); vrot(B.tail, Math.sin(t * 2 + m.ph) * 0.08, 0, 0); },
};
DEFS.fox_sleep = {   // curled-up sleeping fox: same model, sleeping texture, body low and head tucked
  ...DEFS.fox, tex: 'fox_sleep', kind: 'static',
  anim(m, t, B) {
    for (const n of ['hr', 'hl', 'fr', 'fl']) vrot(B[n], -1.3, 0, 0);
    vrot(B.head, 0.6, -0.9, 0); vmove(B.head, 0, 4.5, 2);
    for (const n of ['hr', 'hl', 'fr', 'fl']) vmove(B[n], 0, 4.5, 0);
    vmove(B.body, 0, 4.5, 0); breathe(m, t, B, 'body');
  },
};

// ---------------------------------------------------------------- BEE
DEFS.bee = {
  tex: 'bee', texW: 64, texH: 64, kind: 'fly', speed: 1.8, scale: 1.5, lift: 24,
  bones: {
    body: { pivot: [0, 19, 0], boxes: [bx([-3.5, -4, -5], [7, 7, 10], [0, 0]), bx([0, -1, 5], [0, 1, 2], [26, 7])] },
    ant1: { parent: 'body', pivot: [0, -2, -5], boxes: [bx([1.5, -2, -3], [1, 2, 1], [2, 0])] },
    ant2: { parent: 'body', pivot: [0, -2, -5], boxes: [bx([-2.5, -2, -3], [1, 2, 1], [2, 3])] },
    rw: { parent: 'body', pivot: [-1.5, -4, -3], rot: [0, 0, 0.3], boxes: [bx([-9, 0, 0], [9, 0, 6], [0, 18])] },
    lw: { parent: 'body', pivot: [1.5, -4, -3], rot: [0, 0, -0.3], boxes: [bx([0, 0, 0], [9, 0, 6], [0, 18], { mirror: true })] },
    legf: { parent: 'body', pivot: [1.5, 3, -2], boxes: [bx([-5, 0, 0], [7, 2, 0], [26, 1])] },
    legm: { parent: 'body', pivot: [1.5, 3, 0], boxes: [bx([-5, 0, 0], [7, 2, 0], [26, 3])] },
    legb: { parent: 'body', pivot: [1.5, 3, 2], boxes: [bx([-5, 0, 0], [7, 2, 0], [26, 5])] },
  },
  anim(m, t, B) {
    const f = Math.sin(t * 60 + m.ph * 9) * 0.7;
    vrot(B.rw, 0, 0, 0.4 + f); vrot(B.lw, 0, 0, -0.4 - f);
    vrot(B.legf, 0.9); vrot(B.legm, 0.9); vrot(B.legb, 0.9);
    vrot(B.body, 0.2 + Math.sin(t * 2 + m.ph) * 0.05, 0, 0);
  },
};

// ---------------------------------------------------------------- RABBIT
DEFS.rabbit = {
  tex: 'rabbit_brown', texW: 64, texH: 32, kind: 'hop', speed: 1.6,
  bones: {
    lf: { pivot: [3, 17.5, 3.7], boxes: [bx([-1, 5.5, -3.7], [2, 1, 7], [26, 24])] },
    rf: { pivot: [-3, 17.5, 3.7], boxes: [bx([-1, 5.5, -3.7], [2, 1, 7], [8, 24])] },
    lh: { pivot: [3, 17.5, 3.7], boxes: [bx([-1, 0, 0], [2, 4, 5], [30, 15])] },
    rh: { pivot: [-3, 17.5, 3.7], boxes: [bx([-1, 0, 0], [2, 4, 5], [16, 15])] },
    body: { pivot: [0, 19, 8], rot: [-0.349, 0, 0], boxes: [bx([-3, -2, -10], [6, 5, 10], [0, 0])] },
    lfl: { pivot: [3, 17, -1], rot: [-0.17, 0, 0], boxes: [bx([-1, 0, -1], [2, 7, 2], [8, 15])] },
    rfl: { pivot: [-3, 17, -1], rot: [-0.17, 0, 0], boxes: [bx([-1, 0, -1], [2, 7, 2], [0, 15])] },
    head: { pivot: [0, 16, -1], boxes: [bx([-2.5, -4, -5], [5, 4, 5], [32, 0]), bx([-0.5, -2.5, -5.5], [1, 1, 1], [32, 9])] },
    rear: { pivot: [0, 16, -1], rot: [0, -0.2618, 0], boxes: [bx([-2.5, -9, -1], [2, 5, 1], [52, 0])] },
    lear: { pivot: [0, 16, -1], rot: [0, 0.2618, 0], boxes: [bx([0.5, -9, -1], [2, 5, 1], [58, 0])] },
    tail: { pivot: [0, 20, 7], rot: [-0.349, 0, 0], boxes: [bx([-1.5, -1.5, 0], [3, 3, 2], [52, 6])] },
  },
  anim(m, t, B) {
    const hop = m.hop;              // 0..1 jump arc (set by the manager while hopping)
    const a = Math.sin(hop * PI);
    for (const n of ['lh', 'rh', 'lf', 'rf']) vrot(B[n], a * 1.0 - 0.1);
    for (const n of ['lfl', 'rfl']) vrot(B[n], -a * 0.9);
    vrot(B.head, m.look.pitch - a * 0.2, m.look.yaw, 0);
    vrot(B.rear, 0, 0, Math.sin(t * 2 + m.ph) * 0.05); vrot(B.lear, 0, 0, -Math.sin(t * 2 + m.ph) * 0.05);
  },
};

// ---------------------------------------------------------------- IRON GOLEM
DEFS.iron_golem = {
  tex: 'iron_golem', texW: 128, texH: 128, kind: 'ground', speed: 0.7,
  bones: {
    head: { pivot: [0, -7, -2], boxes: [bx([-4, -12, -5.5], [8, 10, 8], [0, 0]), bx([-1, -5, -7.5], [2, 4, 2], [24, 0])] },
    body: { pivot: [0, -7, 0], boxes: [bx([-9, -2, -6], [18, 12, 11], [0, 40]), bx([-4.5, 10, -3], [9, 5, 6], [0, 70], { infl: 0.5 })] },
    ra: { pivot: [0, -7, 0], boxes: [bx([-13, -2.5, -3], [4, 30, 6], [60, 21])] },
    la: { pivot: [0, -7, 0], boxes: [bx([9, -2.5, -3], [4, 30, 6], [60, 58])] },
    rl: { pivot: [-4, 11, 0], boxes: [bx([-3.5, -3, -3], [6, 16, 5], [37, 0])] },
    ll: { pivot: [5, 11, 0], boxes: [bx([-3.5, -3, -3], [6, 16, 5], [60, 0], { mirror: true })] },
  },
  anim(m, t, B) {
    const p = m.wp * 0.6662 * 0.5, w = m.walk;
    vrot(B.rl, -1.5 * Math.cos(p) * w * 0.6); vrot(B.ll, 1.5 * Math.cos(p) * w * 0.6);
    vrot(B.ra, (-0.2 + 1.5 * Math.cos(p)) * (w ? 0.5 : 1) * (w ? 1 : 0.1) - 0.05); vrot(B.la, (-0.2 - 1.5 * Math.cos(p)) * (w ? 0.5 : 1) * (w ? 1 : 0.1) - 0.05);
    vrot(B.head, m.look.pitch, m.look.yaw, 0);
  },
};

// ---------------------------------------------------------------- SQUID / GLOW SQUID
const squidDef = (tex) => {
  const bones = { body: { pivot: [0, 8, 0], boxes: [bx([-6, -8, -6], [12, 16, 12], [0, 0])] } };
  for (let i = 0; i < 8; i++) {
    const a = (i * PI * 2) / 8;
    bones['t' + i] = { parent: 'body', pivot: [Math.cos(a) * 5, 7, Math.sin(a) * 5], rot: [0, -a + PI / 2 * 0 + a * 0, 0], boxes: [bx([-1, 0, -1], [2, 18, 2], [48, 0])] };
  }
  return {
    tex, texW: 64, texH: 32, kind: 'swim', speed: 0.5, scale: 1.0, lift: 14,
    bones,
    overlays: [],
    anim(m, t, B) {
      for (let i = 0; i < 8; i++) vrot(B['t' + i], Math.sin(t * 3 + i * 0.7 + m.ph * 6) * 0.35 + 0.15);
      vrot(B.body, 0, 0, Math.sin(t * 1.2 + m.ph) * 0.06);
    },
  };
};
DEFS.glow_squid = squidDef('glow_squid');
DEFS.glow_squid.emissiveBase = 0.55;

// ---------------------------------------------------------------- COD
DEFS.cod = {
  tex: 'cod', texW: 32, texH: 32, kind: 'swim', speed: 0.9, scale: 1.2, lift: 24,
  bones: {
    body: { pivot: [0, 22, 0], boxes: [bx([-1, -2, 0], [2, 4, 7], [0, 0])] },
    head: { pivot: [0, 22, 0], boxes: [bx([-1, -2, -3], [2, 4, 3], [11, 0]), bx([-1, -1, -4], [2, 3, 1], [0, 0])] },
    rf: { pivot: [-1, 23, 0], rot: [0, 0, -0.4], boxes: [bx([-2, 0, 0], [2, 0, 2], [22, 1])] },
    lf: { pivot: [1, 23, 0], rot: [0, 0, 0.4], boxes: [bx([0, 0, 0], [2, 0, 2], [22, 4])] },
    tail: { pivot: [0, 22, 7], boxes: [bx([0, -2, 0], [0, 4, 4], [22, 3])] },
    fin: { pivot: [0, 20, 0], boxes: [bx([0, -1, -1], [0, 1, 6], [20, 0])] },
  },
  anim(m, t, B) { vrot(B.tail, 0, Math.sin(t * 9 + m.ph * 5) * 0.55, 0); vrot(B.rf, 0, 0, Math.sin(t * 5) * 0.2); vrot(B.lf, 0, 0, -Math.sin(t * 5) * 0.2); },
};

// ---------------------------------------------------------------- STRAY (skeleton model + clothes layer)
const skelBones = () => ({
  head: { pivot: [0, 0, 0], boxes: [bx([-4, -8, -4], [8, 8, 8], [0, 0])] },
  body: { pivot: [0, 0, 0], boxes: [bx([-4, 0, -2], [8, 12, 4], [16, 16])] },
  ra: { pivot: [-5, 2, 0], boxes: [bx([-1, -2, -1], [2, 12, 2], [40, 16])] },
  la: { pivot: [5, 2, 0], boxes: [bx([-1, -2, -1], [2, 12, 2], [40, 16], { mirror: true })] },
  rl: { pivot: [-2, 12, 0], boxes: [bx([-1, 0, -1], [2, 12, 2], [0, 16])] },
  ll: { pivot: [2, 12, 0], boxes: [bx([-1, 0, -1], [2, 12, 2], [0, 16], { mirror: true })] },
});
DEFS.stray = {
  tex: 'stray', texW: 64, texH: 32, kind: 'ground', speed: 0.7,
  bones: skelBones(),
  overlays: [{ tex: 'stray_overlay', infl: 0.25 }],
  anim(m, t, B) { bipedWalk(m, B, 1.0, 1.4); headLook(m, B); if (!m.walk) { vrot(B.ra, -0.15 + Math.sin(t * 1.3 + m.ph) * 0.03); vrot(B.la, -0.15 - Math.sin(t * 1.3 + m.ph) * 0.03); } },
};

// ---------------------------------------------------------------- WITHER SKELETON (skeleton model at 1.2x)
DEFS.wither_skeleton = {
  tex: 'wither_skeleton', texW: 64, texH: 32, kind: 'ground', speed: 0.7, scale: 1.2,
  bones: skelBones(),
  anim(m, t, B) { bipedWalk(m, B, 1.0, 1.4); headLook(m, B); if (!m.walk) { vrot(B.ra, -0.2 + Math.sin(t * 1.1 + m.ph) * 0.03); vrot(B.la, -0.2 - Math.sin(t * 1.1 + m.ph) * 0.03); } },
};

// ---------------------------------------------------------------- SNOW GOLEM (sheared: no pumpkin)
DEFS.snow_golem = {
  tex: 'snow_golem', texW: 64, texH: 64, kind: 'ground', speed: 0.6,
  bones: {
    head: { pivot: [0, 4, 0], boxes: [bx([-4, -8, -4], [8, 8, 8], [0, 0], { infl: -0.5 })] },
    ra: { pivot: [0, 6, 0], rot: [0, 0, 1.0], boxes: [bx([-1, 0, -1], [12, 2, 2], [32, 0], { infl: -0.5 })] },
    la: { pivot: [0, 6, 0], rot: [0, PI, -1.0], boxes: [bx([-1, 0, -1], [12, 2, 2], [32, 0], { infl: -0.5 })] },
    up: { pivot: [0, 13, 0], boxes: [bx([-5, -10, -5], [10, 10, 10], [0, 16], { infl: -0.5 })] },
    low: { pivot: [0, 24, 0], boxes: [bx([-6, -12, -6], [12, 12, 12], [0, 36], { infl: -0.5 })] },
  },
  anim(m, t, B) { vrot(B.head, m.look.pitch, m.look.yaw, 0); vrot(B.ra, 0, 0.0, 1.0 + Math.sin(t * 1.4 + m.ph) * 0.05); vrot(B.la, 0, 0, -1.0 - Math.sin(t * 1.4 + m.ph) * 0.05); },
};

// ---------------------------------------------------------------- POLAR BEAR
DEFS.polar_bear = {
  tex: 'polar_bear', texW: 128, texH: 64, kind: 'ground', speed: 0.8,
  bones: {
    head: { pivot: [0, 10, -16], boxes: [bx([-3.5, -3, -3], [7, 7, 7], [0, 0]), bx([-2.5, 1, -6], [5, 3, 3], [0, 44]), bx([-4.5, -4, -1], [2, 2, 1], [26, 0]), bx([2.5, -4, -1], [2, 2, 1], [26, 0], { mirror: true })] },
    body: { pivot: [-2, 9, 12], rot: [PI / 2, 0, 0], boxes: [bx([-4, -13, -7], [14, 14, 11], [0, 19]), bx([-3, -25, -7], [12, 12, 10], [39, 0])] },
    ...quadLegs(50, 22, [-2, 0, -2], [4, 10, 8], [['hr', [-3.5, 14, 6]], ['hl', [3.5, 14, 6]]]),
    ...quadLegs(50, 40, [-2, 0, -2], [4, 10, 6], [['fr', [-2.5, 14, -7]], ['fl', [2.5, 14, -7]]]),
  },
  anim(m, t, B) { quadWalk(m, B, 1.0); headLook(m, B); },
};

// ---------------------------------------------------------------- BLAZE
DEFS.blaze = {
  tex: 'blaze', texW: 64, texH: 32, kind: 'fly', speed: 1.0, scale: 1.0,
  bones: (() => {
    const bones = { head: { pivot: [0, 0, 0], boxes: [bx([-4, -4, -4], [8, 8, 8], [0, 0])] } };
    for (let i = 0; i < 12; i++) bones['r' + i] = { pivot: [0, 0, 0], boxes: [bx([0, 0, 0], [2, 8, 2], [0, 16])] };
    return bones;
  })(),
  emissiveBase: 1.0,
  anim(m, t, B) {
    let f = t * PI * -0.1;
    for (let i = 0; i < 4; i++) { vmove(B['r' + i], Math.cos(f) * 9, -2 + Math.cos(i * 2 * 0.25 + t * 0.4 * 2), Math.sin(f) * 9); f += PI / 2; }
    f = PI / 4 + t * PI * 0.03;
    for (let i = 4; i < 8; i++) { vmove(B['r' + i], Math.cos(f) * 7, 2 + Math.cos(i * 2 * 0.25 + t * 0.4 * 2), Math.sin(f) * 7); f += PI / 2; }
    f = 0.47123888 + t * PI * -0.05;
    for (let i = 8; i < 12; i++) { vmove(B['r' + i], Math.cos(f) * 5, 11 + Math.cos(i * 1.5 * 0.5 + t * 0.4 * 2), Math.sin(f) * 5); f += PI / 2; }
    headLook(m, B);
  },
};

// ---------------------------------------------------------------- STRIDER
DEFS.strider = {
  tex: 'strider', texW: 64, texH: 128, kind: 'lava', speed: 0.9,
  bones: {
    body: { pivot: [0, 1, 0], boxes: [bx([-8, -6, -8], [16, 14, 16], [0, 0])] },
    rl: { pivot: [-4, 8, 0], boxes: [bx([-2, 0, -2], [4, 16, 4], [0, 32])] },
    ll: { pivot: [4, 8, 0], boxes: [bx([-2, 0, -2], [4, 16, 4], [0, 55])] },
  },
  anim(m, t, B) {
    const p = m.wp * 0.6, w = Math.max(m.walk, 0.4);
    vrot(B.rl, 0, 0, Math.sin(p) * 0.35 * w); vrot(B.ll, 0, 0, -Math.sin(p) * 0.35 * w);
    vmove(B.body, 0, Math.sin(t * 1.8 + m.ph) * 0.8, 0);
    vrot(B.body, 0, 0, Math.sin(t * 1.2 + m.ph) * 0.04);
  },
};

// ---------------------------------------------------------------- MAGMA CUBE (8 slices + core)
DEFS.magma_cube = (() => {
  const bones = {};
  const uvs = [[0, 0], [0, 1], [24, 10], [24, 19], [0, 4], [0, 5], [0, 6], [0, 7]];
  for (let i = 0; i < 8; i++) bones['s' + i] = { pivot: [0, 0, 0], boxes: [bx([-4, 16 + i, -4], [8, 1, 8], uvs[i])] };
  bones.core = { pivot: [0, 0, 0], boxes: [bx([-2, 18, -2], [4, 4, 4], [24, 40])] };
  return {
    tex: 'magma_cube', texW: 64, texH: 64, kind: 'hop', speed: 0.9, scale: 2.0, lift: 24, emissiveBase: 0.45,
    bones,
    anim(m, t, B) {
      const sq = m.hop ? Math.sin(m.hop * PI) : 0;
      for (let i = 0; i < 8; i++) vmove(B['s' + i], 0, -sq * (i * 0.5), 0);
      vmove(B.core, 0, -sq * 3, 0);
    },
  };
})();

// ---------------------------------------------------------------- PIGLIN
DEFS.piglin = {
  tex: 'piglin', texW: 64, texH: 64, kind: 'ground', speed: 0.9,
  bones: {
    head: { pivot: [0, 0, 0], boxes: [bx([-5, -8, -4], [10, 8, 8], [0, 0]), bx([-2, -4, -5], [4, 4, 1], [31, 1]), bx([2, -2, -5], [1, 2, 1], [2, 4]), bx([-3, -2, -5], [1, 2, 1], [2, 0])] },
    rear: { parent: 'head', pivot: [-4.5, -6, 0], rot: [0, 0, 0.5236], boxes: [bx([-1, 0, -2], [1, 5, 4], [39, 6])] },
    lear: { parent: 'head', pivot: [4.5, -6, 0], rot: [0, 0, -0.5236], boxes: [bx([0, 0, -2], [1, 5, 4], [51, 6])] },
    body: { pivot: [0, 0, 0], boxes: [bx([-4, 0, -2], [8, 12, 4], [16, 16])] },
    ra: { pivot: [-5, 2, 0], boxes: [bx([-3, -2, -2], [4, 12, 4], [40, 16])] },
    la: { pivot: [5, 2, 0], boxes: [bx([-1, -2, -2], [4, 12, 4], [32, 48])] },
    rl: { pivot: [-1.9, 12, 0], boxes: [bx([-2, 0, -2], [4, 12, 4], [0, 16])] },
    ll: { pivot: [1.9, 12, 0], boxes: [bx([-2, 0, -2], [4, 12, 4], [16, 48])] },
  },
  anim(m, t, B) { bipedWalk(m, B, 1.0, 1.4); headLook(m, B); vrot(B.rear, 0, 0, Math.sin(t * 2 + m.ph) * 0.05); vrot(B.lear, 0, 0, -Math.sin(t * 2 + m.ph) * 0.05); },
};

// ---------------------------------------------------------------- ENDERMAN
DEFS.enderman = {
  tex: 'enderman', texW: 64, texH: 32, kind: 'ground', speed: 0.5, lift: 25,
  bones: {
    head: { pivot: [0, -13, 0], boxes: [bx([-4, -8, -4], [8, 8, 8], [0, 0]), bx([-4, -8, -4], [8, 8, 8], [0, 16], { infl: -0.5 })] },
    body: { pivot: [0, -14, 0], boxes: [bx([-4, 0, -2], [8, 12, 4], [32, 16])] },
    ra: { pivot: [-5, -12, 0], boxes: [bx([-1, -2, -1], [2, 30, 2], [56, 0])] },
    la: { pivot: [5, -12, 0], boxes: [bx([-1, -2, -1], [2, 30, 2], [56, 0], { mirror: true })] },
    rl: { pivot: [-2, -5, 0], boxes: [bx([-1, 0, -1], [2, 30, 2], [56, 0])] },
    ll: { pivot: [2, -5, 0], boxes: [bx([-1, 0, -1], [2, 30, 2], [56, 0], { mirror: true })] },
  },
  overlays: [{ tex: 'enderman_eyes', emissive: true, only: ['head'] }],
  anim(m, t, B) { bipedWalk(m, B, 0.5, 0.7); headLook(m, B); if (!m.walk) { vrot(B.ra, Math.sin(t * 0.9 + m.ph) * 0.05 + 0.02, 0, 0.05); vrot(B.la, -Math.sin(t * 0.9 + m.ph) * 0.05 + 0.02, 0, -0.05); } },
};

// ---------------------------------------------------------------- SHULKER
DEFS.shulker = {
  tex: 'shulker', texW: 64, texH: 64, kind: 'static', speed: 0, lift: 24,
  bones: {
    base: { pivot: [0, 24, 0], boxes: [bx([-8, -8, -8], [16, 8, 16], [0, 28])] },
    head: { pivot: [0, 12, 0], boxes: [bx([-3, 0, -3], [6, 6, 6], [0, 52])] },
    lid: { pivot: [0, 24, 0], boxes: [bx([-8, -16, -8], [16, 12, 16], [0, 0])] },
  },
  anim(m, t, B) {
    const open = Math.max(0, Math.sin(t * 0.5 + m.ph * 8)) ** 2;   // slow open / close
    vmove(B.lid, 0, -open * 9, 0); vrot(B.lid, 0, open * 0.6, 0);
    vmove(B.head, 0, -open * 5, 0);
    vrot(B.head, m.look.pitch * 0.6, m.look.yaw * 0.6, 0);
  },
};

// ---------------------------------------------------------------- END CRYSTAL (new 128x64 sheet)
DEFS.end_crystal = {
  tex: 'end_crystal', texW: 128, texH: 64, kind: 'static', speed: 0, lift: 0, emissiveBase: 0.5,
  bones: {
    base: { pivot: [0, 0, 0], boxes: [bx([-12, 0, -12], [24, 8, 24], [0, 32])] },
    glass: { pivot: [0, -20, 0], boxes: [bx([-8, -8, -8], [16, 16, 16], [0, 0])] },
    glass2: { pivot: [0, -20, 0], boxes: [bx([-8, -8, -8], [16, 16, 16], [0, 0], { infl: -1 })] },
    core: { pivot: [0, -20, 0], boxes: [bx([-8, -8, -8], [16, 16, 16], [64, 0], { infl: -2 })] },
  },
  anim(m, t, B) {
    const bob = Math.sin(t * 1.4 + m.ph * 5) * 1.6;
    for (const [n, k] of [['glass', 1], ['glass2', -1.3], ['core', 1.7]]) { vmove(B[n], 0, bob, 0); B[n].rotation.set(0.62 * 0.5 + t * 0.2 * k * 0.0, 0, 0); B[n].rotation.y = t * 0.8 * k; B[n].rotation.x = 0.5; }
  },
};

// ---------------------------------------------------------------- AXOLOTL
DEFS.axolotl = {
  tex: 'axolotl_lucy', texW: 64, texH: 64, kind: 'swim', speed: 0.5, scale: 1.4, lift: 24,
  bones: {
    body: { pivot: [0, 20, 5], boxes: [bx([-4, -2, -9], [8, 4, 10], [0, 11]), bx([0, -3, -8], [0, 5, 9], [2, 17])] },
    head: { parent: 'body', pivot: [0, 0, -9], boxes: [bx([-4, -3, -5], [8, 5, 5], [0, 1])] },
    topg: { parent: 'head', pivot: [0, -3, -1], boxes: [bx([-4, -3, 0], [8, 3, 0], [3, 37])] },
    lg: { parent: 'head', pivot: [-4, 0, -1], rot: [0, 0, 0.2], boxes: [bx([-3, -5, 0], [3, 7, 0], [0, 40])] },
    rg: { parent: 'head', pivot: [4, 0, -1], rot: [0, 0, -0.2], boxes: [bx([0, -5, 0], [3, 7, 0], [11, 40])] },
    tail: { parent: 'body', pivot: [0, 0, 1], boxes: [bx([0, -3, 0], [0, 5, 12], [2, 19])] },
    rhl: { parent: 'body', pivot: [-3.5, 1, -1], rot: [0, 0, 0.5], boxes: [bx([-1, 0, 0], [3, 5, 0], [2, 13])] },
    lhl: { parent: 'body', pivot: [3.5, 1, -1], rot: [0, 0, -0.5], boxes: [bx([-2, 0, 0], [3, 5, 0], [2, 13], { mirror: true })] },
    rfl: { parent: 'body', pivot: [-3.5, 1, -8], rot: [0, 0, 0.5], boxes: [bx([-1, 0, 0], [3, 5, 0], [2, 13])] },
    lfl: { parent: 'body', pivot: [3.5, 1, -8], rot: [0, 0, -0.5], boxes: [bx([-2, 0, 0], [3, 5, 0], [2, 13], { mirror: true })] },
  },
  anim(m, t, B) {
    vrot(B.tail, 0, Math.sin(t * 3 + m.ph * 5) * 0.5, 0);
    vrot(B.lg, 0, 0, 0.2 + Math.sin(t * 5) * 0.12); vrot(B.rg, 0, 0, -0.2 - Math.sin(t * 5) * 0.12);
    vrot(B.body, 0, Math.sin(t * 1.5 + m.ph) * 0.1, 0);
    vrot(B.head, m.look.pitch * 0.5, m.look.yaw * 0.5, 0);
  },
};

// ---------------------------------------------------------------- BAT (new 32x32 sheet, see texture for the layout)
DEFS.bat = {
  tex: 'bat', texW: 32, texH: 32, kind: 'fly', speed: 1.4, scale: 1.3, lift: 24,
  bones: {
    body: { pivot: [0, 18, 0], boxes: [bx([-1.5, 0, -1], [3, 5, 2], [0, 0])] },
    head: { parent: 'body', pivot: [0, 0, 0], boxes: [bx([-2, -3, -1.5], [4, 3, 3], [0, 7])] },
    rw: { parent: 'body', pivot: [-1.5, 0.5, 0], boxes: [bx([-6, 0, 0], [6, 7, 0], [10, 0])] },
    lw: { parent: 'body', pivot: [1.5, 0.5, 0], boxes: [bx([0, 0, 0], [6, 7, 0], [10, 0], { mirror: true })] },
  },
  anim(m, t, B) {
    const f = Math.sin(t * 22 + m.ph * 9) * 0.9;
    vrot(B.rw, 0, 0, f); vrot(B.lw, 0, 0, -f);
    vrot(B.body, 0.4, 0, 0);
  },
};

// ---------------------------------------------------------------- GOAT (head from the sheet's islands; body simplified)
DEFS.goat = {
  tex: 'goat', texW: 64, texH: 64, kind: 'ground', speed: 1.0,
  bones: {
    body: { pivot: [0, 24, 0], boxes: [bx([-4, -17, -7], [9, 11, 16], [1, 1])] },
    head: { pivot: [0.5, 9, -3], boxes: [bx([-3, -4, -8], [5, 7, 10], [34, 46]), bx([-2.5, -11, -3], [2, 7, 2], [12, 55]), bx([0.5, -11, -3], [2, 7, 2], [12, 55])] },
    hl: { pivot: [1, 14, 4], boxes: [bx([0, 4, 0], [3, 6, 3], [36, 29])] },
    hr: { pivot: [-1, 14, 4], boxes: [bx([-3, 4, 0], [3, 6, 3], [49, 29])] },
    fl: { pivot: [1, 14, -6], boxes: [bx([0, 0, 0], [3, 10, 3], [49, 2])] },
    fr: { pivot: [-1, 14, -6], boxes: [bx([-3, 0, 0], [3, 10, 3], [35, 2])] },
  },
  anim(m, t, B) { quadWalk(m, B, 1.2); headLook(m, B); },
};

export const MOB_TEXTURES = ['pig', 'sheep', 'sheep_wool', 'wolf', 'fox', 'fox_sleep', 'bee', 'rabbit_brown', 'iron_golem', 'glow_squid', 'cod', 'stray', 'stray_overlay',
  'snow_golem', 'polar_bear', 'blaze', 'wither_skeleton', 'strider', 'magma_cube', 'piglin', 'enderman', 'enderman_eyes', 'shulker', 'end_crystal', 'axolotl_lucy', 'bat', 'goat'];
