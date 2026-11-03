// Point-mass-on-rail physics (arc length s, speed v), fixed 120 Hz step. Units: blocks, seconds.
export const P = {
  g: 9.81 * 0.6,        // gravity scale keeps 45 degree drops lively but not violent
  cruise: 8.2,          // plain-rail speed the small motor/momentum settles to
  motorMax: 5.5,
  kp: 2.5,
  poweredCruise: 9.2,   // vanilla cap is 8 blocks/s
  poweredMax: 14.0,
  boostImpulse: 1.4,    // speed jump when entering a powered rail
  vmax: 10.4,
  vmin: 1.4,            // never stalls while riding
  mu: 0.02,
  drag: 0.002,
  brake: 6.5,
  rampTime: 0.6,
  dt: 1 / 120,
};

export class CartPhysics {
  constructor(track) {
    this.track = track;
    this.s = 0; this.prevS = 0; this.v = 0;
    this.mode = 'stopped'; // 'stopped' | 'running'
    this.tRun = 0;
    this.stopS = 0; this.brakeS = Infinity;
    this.cellIdx = 0;
    this.events = [];
    this.departCell = -1;
  }
  reset(s) { this.s = s; this.prevS = s; this.v = 0; this.mode = 'stopped'; this.cellIdx = this.track.cellIndexAt(s); this.events.length = 0; this.departCell = -1; }
  launch(stopS, brakeS) {
    this.mode = 'running'; this.tRun = 0; this.v = 0.3;
    this.stopS = stopS; this.brakeS = brakeS;
    this.departCell = this.track.cellIndexAt(this.s);
  }
  step(dt) {
    this.prevS = this.s;
    if (this.mode !== 'running') return;
    const T = this.track, cells = T.cells;
    const ci = T.cellIndexAt(this.s);
    const cell = cells[ci];
    if (ci !== this.cellIdx) {
      const prev = cells[this.cellIdx];
      const nowPowered = cell.kind === 'powered';
      const wasPowered = prev.kind === 'powered';
      if (nowPowered && !wasPowered) { this.v = Math.min(P.vmax, this.v + P.boostImpulse); this.events.push({ type: 'boost', cell }); }
      if (cell.kind === 'detector') this.events.push({ type: 'detector', cell });
      if (cell.kind === 'activator') this.events.push({ type: 'activator', cell });
      this.cellIdx = ci;
    }
    this.tRun += dt;
    const sin = T.slopeSin(this.s), cos = Math.sqrt(1 - sin * sin);
    const powered = cell.kind === 'powered' || ci === this.departCell;
    const ramp = Math.min(1, this.tRun / P.rampTime);
    const am = powered ? Math.min(P.poweredMax, Math.max(0, P.kp * (P.poweredCruise - this.v)))
                       : Math.min(P.motorMax, Math.max(0, P.kp * (P.cruise - this.v)));
    const a = -P.g * sin + am * ramp - P.mu * P.g * cos - P.drag * this.v * this.v;
    this.v += a * dt;
    const braking = this.s >= this.brakeS;
    if (!braking) this.v = Math.min(P.vmax, Math.max(P.vmin * Math.min(1, this.tRun * 3), this.v));
    this.s += this.v * dt;
    if (braking) {
      const d = this.stopS - this.s;
      const vt = Math.sqrt(2 * P.brake * Math.max(d, 0));
      if (this.v > vt) this.v = vt;
      if (d <= 0.004 || this.v < 0.01) {
        this.s = this.stopS; this.v = 0; this.mode = 'stopped'; this.events.push({ type: 'arrived', cell: cells[T.cellIndexAt(this.s)] });
      }
    }
  }
}
