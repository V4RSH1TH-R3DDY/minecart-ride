// Sound: Web Audio. Positional one-shots (mobs, drips, lava pops), looping beds that crossfade by biome, a speed-driven cart rumble,
// procedural wind (filtered noise) and the rail / portal effects. Uses the real vanilla sound files listed in assets/sounds/manifest.json.
import * as THREE from 'three';

const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// mob -> sound event, seconds between sounds, volume, how far it can be heard
export const MOB_SOUNDS = {
  pig: { ev: 'entity.pig.ambient', every: [8, 20], vol: 0.8 }, sheep: { ev: 'entity.sheep.ambient', every: [9, 22], vol: 0.8 },
  wolf: { ev: 'entity.wolf.ambient', every: [10, 24], vol: 0.6 }, fox: { ev: 'entity.fox.ambient', every: [14, 30], vol: 0.7 },
  goat: { ev: 'entity.goat.ambient', every: [10, 25], vol: 0.8 }, bee: { ev: 'entity.bee.loop', every: [2.3, 3.4], vol: 0.3, range: 16 },
  rabbit: { ev: 'entity.rabbit.ambient', every: [12, 28], vol: 0.6 }, axolotl: { ev: 'entity.axolotl.idle_water', every: [8, 18], vol: 0.55 },
  glow_squid: { ev: 'entity.glow_squid.ambient', every: [10, 22], vol: 0.5 }, stray: { ev: 'entity.stray.ambient', every: [9, 20], vol: 0.7 },
  polar_bear: { ev: 'entity.polar_bear.ambient', every: [14, 30], vol: 0.8 }, bat: { ev: 'entity.bat.ambient', every: [5, 12], vol: 0.35, range: 20 },
  blaze: { ev: 'entity.blaze.ambient', every: [3, 7], vol: 0.5, range: 26 }, wither_skeleton: { ev: 'entity.wither_skeleton.ambient', every: [8, 18], vol: 0.7 },
  strider: { ev: 'entity.strider.ambient', every: [7, 16], vol: 0.7 }, magma_cube: { ev: 'entity.magma_cube.squish', every: [4, 9], vol: 0.45 },
  piglin: { ev: 'entity.piglin.ambient', every: [8, 18], vol: 0.7 }, enderman: { ev: 'entity.enderman.ambient', every: [10, 24], vol: 0.65 },
  shulker: { ev: 'entity.shulker.ambient', every: [12, 28], vol: 0.6 }, warden: { ev: 'entity.warden.ambient', every: [9, 18], vol: 0.8, range: 30 },
};

// per-biome beds and random one-shots
//  wind: level of the procedural wind;  loops: { name: volume };  random: [{ ev, every, vol, pos?, pitch? }]
const BIOME = {
  alpine: { wind: 0.5, crickets: 0.1, loops: { water: 0 }, random: [] },
  desert: { wind: 0.46, crickets: 0.12, loops: { water: 0 }, random: [] },
  cherry: { wind: 0.36, crickets: 0.09, loops: { water: 0.2 }, random: [] },
  taiga: { wind: 0.42, crickets: 0.08, loops: { water: 0.06 }, random: [] },
  lush: { wind: 0, loops: { water: 0.2 }, random: [{ ev: 'ambient.cave', every: [22, 40], vol: 0.35 }, { ev: 'block.pointed_dripstone.drip_water', every: [1.4, 3.6], vol: 0.6, pos: [3, 11] }] },
  ice: { wind: 0.3, loops: {}, random: [{ ev: 'ambient.cave', every: [25, 45], vol: 0.32 }, { ev: 'block.note_block.chime', every: [7, 14], vol: 0.22, pos: [8, 18], pitch: [0.55, 1.3] }, { ev: 'block.pointed_dripstone.drip_water', every: [3, 6], vol: 0.4, pos: [3, 11] }] },
  nether: { wind: 0, loops: { nether: 0.5, lava: 0.22, fire: 0.12 }, random: [{ ev: 'ambient.nether_wastes.mood', every: [18, 35], vol: 0.55 }, { ev: 'ambient.nether_wastes.additions', every: [6, 14], vol: 0.45 }, { ev: 'block.lava.pop', every: [1.2, 3.2], vol: 0.5, pos: [4, 14] }] },
  end: { wind: 0.16, loops: { hum: 0.13 }, random: [{ ev: 'ambient.cave', every: [18, 32], vol: 0.3, pitch: [0.6, 0.8] }] },
  deep: { wind: 0.04, loops: {}, random: [{ ev: 'ambient.cave', every: [14, 26], vol: 0.45, pitch: [0.7, 0.9] }, { ev: 'entity.warden.heartbeat', every: [2.3, 3.0], vol: 0.5 }, { ev: 'block.sculk_sensor.clicking', every: [5, 12], vol: 0.4, pos: [4, 14], pitch: [0.8, 1.2] }] },
  tunnel: { wind: 0.12, loops: {}, random: [{ ev: 'ambient.cave', every: [14, 26], vol: 0.42 }, { ev: 'block.pointed_dripstone.drip_water', every: [3, 7], vol: 0.4, pos: [3, 10] }] },
};
const BED = { // loop beds: name -> sound event
  cart: 'entity.minecart.riding', water: 'block.water.ambient', nether: 'ambient.nether_wastes.loop', lava: 'block.lava.ambient',
  fire: 'block.fire.ambient', hum: 'block.portal.ambient', portal: 'block.portal.ambient',
};

export function createAudio({ onReady, night = false } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
  master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
  const state = { blocked: false, muted: localStorage.getItem('mc_muted') === '1', manifest: {}, bufs: {}, loaded: 0, total: 0, voices: 0 };
  master.gain.value = state.muted ? 0 : 0.85;

  // browsers start the context suspended until the first user gesture
  const resume = () => { if (ctx.state !== 'running') ctx.resume(); };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, resume, { passive: true });

  // ---- loading ----
  async function load() {
    state.manifest = await (await fetch('assets/sounds/manifest.json')).json();
    const files = [...new Set(Object.values(state.manifest).flat().map((f) => f.file))];
    state.total = files.length;
    const queue = files.slice();
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try { state.bufs[f] = await ctx.decodeAudioData(await (await fetch(`assets/sounds/${f}.ogg`)).arrayBuffer()); } catch (e) { console.warn('sound failed: ' + f); }
        state.loaded++;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    initBeds(); if (onReady) onReady();
  }

  // ---- one-shots ----
  const listener = ctx.listener;
  function play(event, o = {}) {
    const list = state.manifest[event]; if (!list || !list.length) return null;
    const f = pick(list), buf = state.bufs[f.file]; if (!buf || state.muted || state.blocked || state.voices > 28) return null;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.pitch ?? 1) * f.pitch * rr(0.94, 1.06);
    const gain = ctx.createGain(); gain.gain.value = (o.vol ?? 1) * f.vol;
    let node = src; src.connect(gain); node = gain;
    if (o.pos) {
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = o.ref ?? 4; p.rolloffFactor = o.rolloff ?? 1.5; p.maxDistance = 140;
      p.positionX.value = o.pos.x; p.positionY.value = o.pos.y; p.positionZ.value = o.pos.z;
      node.connect(p); node = p;
    }
    node.connect(master);
    state.voices++; src.onended = () => { state.voices--; try { src.disconnect(); gain.disconnect(); } catch (e) { /* already gone */ } };
    src.start();
    return src;
  }

  // ---- loop beds ----
  const beds = {};
  function initBeds() {
    for (const [name, ev] of Object.entries(BED)) {
      const list = state.manifest[ev]; if (!list) continue;
      const buf = state.bufs[list[0].file]; if (!buf) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(gain);
      let out = gain;
      if (name === 'portal') { const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.1; gain.connect(p); out = p; beds.portalPanner = p; }
      out.connect(master); src.start(0.001 + Math.random() * 0.5);
      beds[name] = { src, gain, base: list[0].vol };
    }
    // procedural wind: looped noise through a low-pass filter whose cutoff and level follow the speed
    const len = ctx.sampleRate * 3, nb = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let last = 0; for (let i = 0; i < len; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.28; d[i] = last; } }
    const ws = ctx.createBufferSource(); ws.buffer = nb; ws.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0;
    ws.connect(lp); lp.connect(wg); wg.connect(master); ws.start();
    beds.wind = { lp, gain: wg };
    // night crickets: band-passed noise chopped into chirps by a square-wave LFO (two detuned voices so they never lock together)
    if (night) {
      const cg = ctx.createGain(); cg.gain.value = 0; cg.connect(master); beds.crickets = { gain: cg };
      for (const [freq, rate, q] of [[4300, 6.3, 9], [5100, 7.9, 11]]) {
        const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
        const am = ctx.createGain(); am.gain.value = 0.5;
        const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rate;
        const depth = ctx.createGain(); depth.gain.value = 0.5; lfo.connect(depth); depth.connect(am.gain);
        ns.connect(bp); bp.connect(am); am.connect(cg); ns.start(Math.random()); lfo.start();
      }
    }
  }
  const setBed = (name, v, rate) => {
    const b = beds[name]; if (!b) return;
    b.gain.gain.setTargetAtTime(state.muted ? 0 : v * (b.base ?? 1), ctx.currentTime, 0.35);
    if (rate && b.src) b.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.2);
  };

  // ---- per-frame ----
  const timers = {}; let lastBiome = '', fwd = new THREE.Vector3();
  function update(dt, { camera, speed = 0, biome = 'alpine', riding = false, nearPortal = null, portalPos = null }) {
    if (!beds.wind) return;
    camera.getWorldDirection(fwd);
    if (listener.positionX) {
      listener.positionX.value = camera.position.x; listener.positionY.value = camera.position.y; listener.positionZ.value = camera.position.z;
      listener.forwardX.value = fwd.x; listener.forwardY.value = fwd.y; listener.forwardZ.value = fwd.z; listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    }
    const prof = BIOME[biome] || BIOME.alpine, sp = Math.min(1, speed / 8.5), t = ctx.currentTime;
    // cart rumble: only while it is moving
    setBed('cart', riding ? Math.pow(sp, 0.8) * 0.6 : 0, 0.7 + sp * 0.55);
    // wind (louder and brighter when fast); damped inside caves
    beds.wind.gain.gain.setTargetAtTime(state.muted ? 0 : prof.wind * (night ? 0.6 : 1) * (0.45 + 0.75 * sp) * (0.85 + 0.15 * Math.sin(t * 0.37)), t, 0.4);
    if (beds.crickets) beds.crickets.gain.gain.setTargetAtTime(state.muted ? 0 : (prof.crickets || 0) * (1 - 0.85 * sp) * 6, t, 0.6);   // fewer while the cart is moving fast
    beds.wind.lp.frequency.setTargetAtTime(260 + sp * 700 + (biome === 'ice' ? -60 : 0), t, 0.3);
    // biome beds
    for (const name of ['water', 'nether', 'lava', 'fire', 'hum']) setBed(name, prof.loops[name] ?? 0);
    // the exit portal hums when you are near it
    if (beds.portal && portalPos) {
      beds.portalPanner.positionX.value = portalPos.x; beds.portalPanner.positionY.value = portalPos.y; beds.portalPanner.positionZ.value = portalPos.z;
      setBed('portal', nearPortal ? 0.85 : 0, 1);
    } else setBed('portal', 0);
    // random one-shots
    if (biome !== lastBiome) { lastBiome = biome; for (const k of Object.keys(timers)) delete timers[k]; }
    prof.random.forEach((r, i) => {
      const key = biome + i;
      if (timers[key] === undefined) timers[key] = rr(0.3, r.every[1]);
      timers[key] -= dt;
      if (timers[key] <= 0) {
        timers[key] = rr(r.every[0], r.every[1]);
        const o = { vol: r.vol, pitch: r.pitch ? rr(r.pitch[0], r.pitch[1]) : 1 };
        if (r.pos) { const a = Math.random() * 6.283, d = rr(r.pos[0], r.pos[1]); o.pos = { x: camera.position.x + Math.sin(a) * d, y: camera.position.y + rr(-1, 3), z: camera.position.z + Math.cos(a) * d }; }
        play(r.ev, o);
      }
    });
  }

  // checkpoint reached: everything goes quiet (loops keep running silently so they resume in step); one-shots are refused meanwhile
  function setBlocked(b) {
    if (state.blocked === b) return;
    state.blocked = b;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(b || state.muted ? 0 : 0.85, ctx.currentTime, b ? 0.12 : 0.5);
  }
  function setMuted(m) {
    state.muted = m; localStorage.setItem('mc_muted', m ? '1' : '0');
    master.gain.setTargetAtTime(m || state.blocked ? 0 : 0.85, ctx.currentTime, 0.05);
    if (m) for (const b of Object.values(beds)) if (b && b.gain) b.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }
  function level() { const d = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(d); let s = 0; for (const v of d) s += (v - 128) * (v - 128); return Math.sqrt(s / d.length) / 128; }
  load().catch((e) => console.warn('audio load failed', e));
  return { ctx, play, update, setMuted, setBlocked, toggleMute() { setMuted(!state.muted); return state.muted; }, get muted() { return state.muted; }, state, level };
}
