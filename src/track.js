// Block-grid rail track: layout DSL -> cells -> smooth arc-length path.
// Coordinates: x east, z south, y up. One cell = one block. Heading index 0..3 = N,E,S,W.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const RAIL_Y = 0.0625; // rail sits 1/16 above its block floor, like vanilla

// Token = letter + optional repeat count, e.g. "F3".
//  F plain flat   P powered flat   B unpowered (brake) flat   T detector   A activator
//  S stop (unpowered powered rail, cart halts at its centre)   E end stop (finale)
//  U plain up slope   W powered up slope   D plain down slope   L / R plain 90 degree turn
const FLAT = { F: 'plain', P: 'powered', B: 'brake', T: 'detector', S: 'stop', A: 'activator', E: 'end' };

export const START_Y = 60;

// Each leg ends in B.. T S (brake zone, detector, stop). Net descent ~4 per leg, so the ride
// spirals down from daylight into the deep mine.
//   '@name' (not a rail) tags the following cells with a biome, so one leg can cross two biomes (not used by the current layout).
export const LEG_TEMPLATES = [
  'P3 W3 F2 D7 F8 L F3 R F8 D2 F3 B7 T S',                          // 0 alpine
  'P2 TURN P8 W3 F1 D4 W2 D5 F8 L F2 R F4 D2 F2 B7 T S',            // 1 cherry canyon
  'P2 TURN P8 W4 D5 F2 D5 F8 D2 F4 B7 T S',                         // 2 taiga
  'P2 TURN P8 W3 F2 D4 F1 W2 D5 F6 R F1 L F2 D2 F2 B7 T S',         // 3 lush cave
  'P2 TURN P8 W4 F1 D6 F2 W3 D5 F8 D2 F4 B7 T S',                   // 4 ice cave
  'P2 TURN P8 W3 D5 F2 W4 D6 F6 L F2 R F4 D2 F2 B7 T S',            // 5 deep dark (ancient city)
  'P2 TURN P8 W3 D5 F2 W3 D5 F4 L F2 R F4 D2 F2 B7 T S',            // 6 nether
  'P2 TURN P8 W4 F1 D6 F2 W2 D4 F8 D2 F4 B7 T S',                   // 7 end
];
// turn direction at the start of each leg: a serpentine keeps every biome in its own footprint
const TURNS = ['R', 'R', 'L', 'L', 'R', 'R', 'L'];                  // index = template number - 1

// the finale (first person): powered climb out of the End up to the meadow, then through the nether portal. `k` repeats of 'W8 F2' reach the surface.
const finaleFor = (up) => {
  const full = Math.max(1, Math.floor(up / 8)), rem = Math.max(0, up - full * 8);
  return 'P2 L F3 A ' + 'W8 F2 '.repeat(full) + (rem ? `W${rem} F2 ` : '') + 'F2 P3 F9 E';
};
export const FINALE_TOP = 66;                                      // height of the last rail of the climb (above START_Y - 6: the alpine meadow)

export function layoutFor(checkpoints = 9) {
  // slide 0 is the very first stop (a short lead-in behind it, nothing before); each further slide is one leg later, then the finale
  const body = (t, turn = t) => LEG_TEMPLATES[t].replace('TURN', TURNS[turn - 1] ?? 'R');
  const legs = [];
  for (let t = 0; t < 8; t++) legs.push(body(t));                  // one stop per leg: slides 1..8
  const kept = legs.slice(0, Math.max(0, checkpoints - 1));
  const base = ['F8 S', ...kept];
  const yEnd = buildTrack(base).stops.at(-1).yb;
  return [...base, finaleFor(FINALE_TOP - yEnd)];
}
export const LAYOUT = layoutFor(9);

export function buildTrack(layout = LAYOUT) {
  const cells = [];
  let x = 0, z = 0, y = START_Y, dir = 1;
  let curBio = null, segStart = null;                    // biome tag from '@name' markers, and where the current stretch (after a stop / marker) began
  const push = (c) => {
    c.i = cells.length;
    if (curBio) c.bio = curBio;
    c.segStart = segStart;
    cells.push(c);
    if (c.kind === 'stop') { curBio = null; segStart = c.i; }
  };

  for (const line of layout) {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok[0] === '@') { curBio = tok.slice(1); segStart = cells.length - 1; continue; }
      const ch = tok[0];
      const n = parseInt(tok.slice(1) || '1', 10);
      for (let k = 0; k < n; k++) {
        const [dx, dz] = DIRS[dir];
        if (FLAT[ch]) {
          push({ x, z, yb: y, he: y, hx: y, dirIn: dir, dirOut: dir, shape: 'flat', kind: FLAT[ch] });
          x += dx; z += dz;
        } else if (ch === 'U' || ch === 'W') {
          push({ x, z, yb: y, he: y, hx: y + 1, dirIn: dir, dirOut: dir, shape: 'up', kind: ch === 'W' ? 'powered' : 'plain' });
          x += dx; z += dz; y += 1;
        } else if (ch === 'D') {
          // vanilla rule: a slope's high end only connects to a rail one block higher, so an up slope followed straight by a down
          // slope does not connect. Every peak therefore gets one flat rail on top.
          const prev = cells[cells.length - 1];
          if (prev && prev.shape === 'up') {
            push({ x, z, yb: y, he: y, hx: y, dirIn: dir, dirOut: dir, shape: 'flat', kind: 'plain' });
            x += dx; z += dz;
          }
          push({ x, z, yb: y - 1, he: y, hx: y - 1, dirIn: dir, dirOut: dir, shape: 'down', kind: 'plain' });
          x += dx; z += dz; y -= 1;
        } else if (ch === 'L' || ch === 'R') {
          const nd = (dir + (ch === 'R' ? 1 : 3)) % 4;
          push({ x, z, yb: y, he: y, hx: y, dirIn: dir, dirOut: nd, shape: 'turn', kind: 'plain', turn: ch });
          dir = nd;
          const [ndx, ndz] = DIRS[nd];
          x += ndx; z += ndz;
        } else throw new Error('bad track token ' + tok);
      }
    }
  }

  // ---- smooth path: straight lines per cell, quadratic corner arcs on turns ----
  const pts = []; // [x, y, z]
  const cum = [];
  let s = 0;
  const add = (p) => {
    const last = pts[pts.length - 1];
    if (last) {
      const d = Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
      if (d < 1e-6) return;
      s += d;
    }
    pts.push(p); cum.push(s);
  };

  for (const c of cells) {
    const cx = c.x + 0.5, cz = c.z + 0.5;
    const [ix, iz] = DIRS[c.dirIn], [ox, oz] = DIRS[c.dirOut];
    const E = [cx - ix * 0.5, c.he + RAIL_Y, cz - iz * 0.5];
    const X = [cx + ox * 0.5, c.hx + RAIL_Y, cz + oz * 0.5];
    c.s0 = s;
    if (c.shape === 'turn') {
      const C = [cx, c.he + RAIL_Y, cz];
      const N = 14;
      for (let k = 0; k <= N; k++) {
        const t = k / N, u = 1 - t;
        add([u * u * E[0] + 2 * u * t * C[0] + t * t * X[0], E[1], u * u * E[2] + 2 * u * t * C[2] + t * t * X[2]]);
      }
    } else {
      const N = 10;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        add([E[0] + (X[0] - E[0]) * t, E[1] + (X[1] - E[1]) * t, E[2] + (X[2] - E[2]) * t]);
      }
    }
    c.s1 = s;
    c.sMid = (c.s0 + c.s1) / 2;
  }

  const total = s;
  const cellStarts = cells.map((c) => c.s0);

  function index(sv) { // binary search into cum
    let lo = 0, hi = cum.length - 1;
    if (sv <= 0) return 0;
    if (sv >= total) return hi - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= sv) lo = m; else hi = m; }
    return lo;
  }
  function sample(sv, out = [0, 0, 0]) {
    const i = index(sv), a = pts[i], b = pts[i + 1];
    const t = (sv - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i]);
    const tt = Math.min(1, Math.max(0, t));
    out[0] = a[0] + (b[0] - a[0]) * tt; out[1] = a[1] + (b[1] - a[1]) * tt; out[2] = a[2] + (b[2] - a[2]) * tt;
    return out;
  }
  function cellIndexAt(sv) {
    let lo = 0, hi = cells.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cellStarts[m] <= sv) lo = m; else hi = m - 1; }
    return lo;
  }
  const _a = [0, 0, 0], _b = [0, 0, 0];
  // sin(slope angle) over a short window: drives gravity along the rail
  function slopeSin(sv) {
    const e = 0.35;
    sample(sv - e, _a); sample(sv + e, _b);
    const dy = _b[1] - _a[1], d = Math.hypot(_b[0] - _a[0], dy, _b[2] - _a[2]);
    return d > 1e-6 ? dy / d : 0;
  }
  // rail tangent (unit) at s
  function tangent(sv, out = [0, 0, 0], e = 0.3) {
    sample(sv - e, _a); sample(sv + e, _b);
    const dx = _b[0] - _a[0], dy = _b[1] - _a[1], dz = _b[2] - _a[2];
    const d = Math.hypot(dx, dy, dz) || 1;
    out[0] = dx / d; out[1] = dy / d; out[2] = dz / d;
    return out;
  }

  // checkpoints: every 'stop' cell (index 0 is the start station), 'end' is the finale stop
  const stops = cells.filter((c) => c.kind === 'stop');
  // leg k = the cells after stop k up to and including stop k+1 (the last leg runs to the end stop)
  for (const c of cells) c.leg = stops.filter((st) => st.i < c.i).length;     // leg k = the stretch that ends at stop k (stop 0 = slide 1)
  const endCell = cells.find((c) => c.kind === 'end');
  const activator = cells.find((c) => c.kind === 'activator');
  const checkpoints = stops.map((c, i) => ({ n: i + 1, cell: c, s: c.sMid }));
  const legs = [];
  for (let i = 0; i < stops.length; i++) {
    const from = stops[i], to = i + 1 < stops.length ? stops[i + 1] : endCell;
    if (!to) continue;                                  // (a partial layout without a finale, used to measure heights)
    // brake zone starts at first consecutive 'brake' cell before the stop/end
    let b = to.i; while (b - 1 >= 0 && cells[b - 1].kind !== 'powered' && (cells[b - 1].kind === 'brake' || cells[b - 1].kind === 'detector')) b--;
    legs.push({ fromS: from.sMid, toS: to.sMid, brakeS: cells[b].s0, detectorS: (cells.slice(b, to.i + 1).find((c) => c.kind === 'detector') || to).sMid });
  }

  return { cells, total, sample, tangent, slopeSin, cellIndexAt, stops, endCell, activator, checkpoints, legs, pts };
}
