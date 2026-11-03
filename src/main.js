import * as THREE from 'three';
import { loadAssets, buildAtlas, pixelTexture } from './assets.js';
import { buildTrack, layoutFor } from './track.js';
import { generateWorld } from './terrain.js';
import { bakeLight, createRT } from './lighting.js';
import { buildMeshes } from './mesher.js';
import { createSky } from './sky.js';
import { createRails } from './rails.js';
import { createCart, createSteve } from './models.js';
import { createPanelFactory } from './panel.js';
import { CartPhysics, P } from './physics.js';
import { CameraRig } from './camera.js';
import { createStreaks } from './fx.js';
import { createMobs } from './mobs.js';
import { makeTexLoader } from './mobkit.js';
import { placeMobs } from './placement.js';
import { createNetherPortal, createPortalFx } from './netherportal.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { LIST } from './blocks.js';

const POPUP_GUARD_MS = 300;
const ease = (t) => t * t * (3 - 2 * t);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

async function main() {
  const config = await (await fetch('config.json', { cache: 'no-store' })).json();
  const N = config.checkpoints.length;
  const NIGHT = (config.timeOfDay || 'night') !== 'day';                  // set "timeOfDay": "day" in config.json for the daytime look

  const params = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let renderScale = params.get('scale') ? parseFloat(params.get('scale')) : 1;
  const basePR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(basePR * renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = NIGHT ? 1.12 : 0.92;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 500);
  scene.fog = new THREE.Fog(new THREE.Color(0.65, 0.78, 0.92), 40, 150);
  const loading = document.getElementById('loading');
  const say = async (t) => { if (loading) loading.textContent = t; await new Promise((r) => setTimeout(r, 30)); };

  await say('LOADING TEXTURES...');
  const img = await loadAssets();
  const atlas = buildAtlas(img);
  await say('BUILDING TRACK...');
  const track = buildTrack(layoutFor(N));
  await say('GENERATING WORLD...');
  const world = generateWorld(track);
  await say('LIGHTING...');
  bakeLight(world);
  const rt = createRT(world, atlas);
  await say('BUILDING MESHES...');
  const meshes = buildMeshes(world, atlas);
  const worldMat = rt.patch(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  const waterMat = rt.patch(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }), { water: true });
  // animated fire: each group shows one 16px frame of the 32-frame strip, advanced at vanilla's 20 frames/s
  const fireGroups = meshes.fire.map((f) => {
    const tex = pixelTexture(img[`${f.name}_${f.variant}`]);
    tex.repeat.set(1, 1 / 32);
    const mat = rt.patch(new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.1, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(f.geo, mat); m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m);
    return { tex, phase: f.phase, reorder: f.variant === 0 && f.name === 'fire' };   // fire_0's mcmeta starts at frame 16
  });
  function animateFire(t) {
    const tick = Math.floor(t * 20);
    for (const g of fireGroups) {
      const f = (tick + g.phase * 8) % 32, idx = g.reorder ? (f + 16) % 32 : f;
      g.tex.offset.y = 1 - (idx + 1) / 32;
    }
  }
  let tris = 0;
  const still = (m) => { m.matrixAutoUpdate = false; return m; };
  for (const g of meshes.opaque) { scene.add(still(new THREE.Mesh(g, worldMat))); tris += g.index.count / 3; }
  for (const g of meshes.water) { const m = still(new THREE.Mesh(g, waterMat)); m.renderOrder = 2; scene.add(m); tris += g.index.count / 3; }
  console.log(`world: ${world.nx}x${world.ny}x${world.nz}, ${tris} triangles, ${rt.lights} lights`);
  const sky = createSky(scene, img.moon);
  const audio = createAudio({ night: NIGHT });
  const fx = createParticles({ scene, world, renderer, imgs: img._particles, night: NIGHT });
  const mobsMgr = createMobs({ scene, world, track, texFor: makeTexLoader(img._mobs), rt, fireballTex: pixelTexture(img._mobs.fire_charge), audio });
  const rails = createRails(track, img, world, rt);
  scene.add(rails.group);

  // cart + Steve
  const cart = createCart(img);
  const steve = createSteve(img);
  cart.add(steve);
  scene.add(cart);
  const entLightVec = new THREE.Vector3(1, 0, 0);
  for (const m of [...cart.userData.materials, ...steve.userData.materials]) rt.patch(m, { objLight: entLightVec });
  const streaks = createStreaks(scene);

  // sign boards, one per stop: start, checkpoints, end
  const cards = createPanelFactory(img);
  const stopInfo = world.stopInfo;
  const cardEl = document.getElementById('card');
  const endInfo = world.stopInfo[world.stopInfo.length - 1];
  const netherPortal = createNetherPortal(img, endInfo.portal);
  {
    const o = endInfo.portal.origin, f = endInfo.fwd, cy = o[1] + endInfo.portal.height / 2;
    netherPortal.mesh.position.set(o[0], cy, o[2]);
    netherPortal.mesh.lookAt(o[0] - f[0], cy, o[2] - f[1]);       // the plane faces along the rail
    scene.add(netherPortal.mesh);
  }
  const portalFx = createPortalFx(img);
  const portalS = track.endCell.sMid - 3;                          // where the cart crosses the portal plane (3 blocks before the end of the line)
  const endS = track.endCell.sMid;
  const cardCache = [];
  // slide graphics: any image paths named in config.json are loaded once, up front
  const slideImages = {};
  const slideSrc = (c) => [...(c.image ? [c.image] : []), ...(c.images || []), ...(c.photos || []).map((p) => p.image).filter(Boolean), ...(c.gallery || []).map((p) => p.image).filter(Boolean), ...(c.startups || []).flatMap((gr) => gr.items.map((b) => b.image)).filter(Boolean), ...(c.logos || [])];
  await Promise.all(config.checkpoints.flatMap(slideSrc).filter((src, i, a) => a.indexOf(src) === i).map((src) => new Promise((res) => {
    const im = new Image(); im.onload = () => { slideImages[src] = im; res(); }; im.onerror = () => { console.warn('slide image not found: ' + src); res(); }; im.src = src;
  })));
  const withSlide = (base, c) => ({ ...base, title: c.title ?? '', body: c.body, bullets: c.bullets, after: c.after, tagline: c.tagline, columns: c.columns, layout: c.layout, footer: c.footer, images: [...(c.image ? [c.image] : []), ...(c.images || [])].map((s) => slideImages[s]), logos: (c.logos || []).map((s) => slideImages[s]), centerBoxes: (c.startups || []).map((gr) => ({ label: gr.label, items: gr.items.map((b) => ({ ...b, image: b.image ? slideImages[b.image] : null })) })), gallery: (c.gallery || []).map((p) => ({ caption: p.caption, label: 'PICTURE', image: p.image ? slideImages[p.image] : null })), photos: (c.photos || []).map((p) => ({ caption: p.caption, role: p.role, image: p.image ? slideImages[p.image] : null })) });
  const cardContent = (i) => {
    if (i <= N) return withSlide({ eyebrow: '' }, config.checkpoints[i - 1]);
    return withSlide({ eyebrow: '' }, { title: '' });                 // state N+1 (the end) shows no card
  };

  const physics = new CartPhysics(track);
  const rig = new CameraRig(camera, world);
  const hint = document.getElementById('hint'), hud = document.getElementById('hud');

  // ---- state machine ----
  const game = { state: 'idle', stop: 0, openedAt: 0, time: 0, finale: false };
  // checkpoint framing: oblique view of the cart in its hall, cart pushed to the right so the card fits on the left
  const stopPanelPose = (i) => {
    const st = stopInfo[i - 1], o = V(...st.origin);      // slide i stands in hall i-1
    const f = V(st.fwd[0], 0, st.fwd[1]), l = V(st.left[0], 0, st.left[1]);
    const pos = o.clone().addScaledVector(f, -6.2).addScaledVector(l, 5.6).add(V(0, 3.8, 0));
    const cartC = o.clone().add(V(0, 1.0, 0));
    const dir = cartC.clone().sub(pos); dir.y = 0; dir.normalize();
    const right = V().crossVectors(dir, V(0, 1, 0));
    const look = cartC.clone().addScaledVector(right, -3.9);
    return { pos, look };
  };
  const headPos = () => {
    const p = V(); steve.userData.head.getWorldPosition(p);
    p.addScaledVector(cartFwd, 0.12).y += 0.1;
    return p;
  };

  // ---- the state machine ----------------------------------------------------------------------------------
  // Slide numbers are the state indices: 0 = start, 1..N = checkpoints, N+1 = the end. Each is a resting state
  // (idle / popup / finished). 'riding' moves the cart from state i to i+1. The last ride does not stop: the cart drives
  // straight through the nether portal, 'portal' is the short transition (purple haze, fade to black) into 'finished'.
  const LAST = N + 1;
  const stateName = (i) => (i === 0 ? 'idle' : i === LAST ? 'finished' : 'popup');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const hudEl = document.getElementById('hud');
  let fxFill = 0;
  const toastEl = document.getElementById('toast'); let toastT = 0;
  function toast(t) { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, 1400); }

  const dimEl = document.getElementById('dim');
  function showBoard(i, instant = false) {
    if (!cardCache[i]) cardCache[i] = cards.renderCard(cardContent(i));
    cardEl.replaceChildren(cardCache[i]);
    dimEl.classList.toggle('instant', instant);
    if (instant) {
      cardEl.classList.add('instant', 'show'); dimEl.classList.add('show');
      requestAnimationFrame(() => requestAnimationFrame(() => { cardEl.classList.remove('instant'); dimEl.classList.remove('instant'); }));
    } else requestAnimationFrame(() => { cardEl.classList.add('show'); dimEl.classList.add('show'); });
    audio.setBlocked(true);                          // a slide is on screen: no sound at all (animation and mobs carry on)
  }
  function hideBoard() { cardEl.classList.remove('show'); dimEl.classList.remove('show'); audio.setBlocked(false); }

  // Space (or click / Enter): continue the animation from the current state
  function startLeg(i) {
    const leg = track.legs[i - 1];                          // the ride from slide i to the next
    if (i === N) physics.launch(Infinity, Infinity);        // the final ride never brakes: it goes through the portal
    else physics.launch(leg.toS, leg.brakeS);
    game.state = 'riding';
    game.stop = i;
    rig.setPanel(false);
    hideBoard();
    hint.style.opacity = 0;
  }

  // the cart has stopped in state game.stop + 1
  function onArrived() {
    const idx = game.stop + 1;
    game.stop = idx;
    game.openedAt = performance.now();
    showBoard(idx);
    game.state = stateName(idx);
    rig.setPanel(true, stopPanelPose(idx));
  }

  function advance() {
    if (game.state === 'idle') startLeg(0);
    else if (game.state === 'finished') { goTo(1); portalFx.fadeFromBlack(); }      // Space after the end: back to slide 1
    else if (game.state === 'popup') {
      if (performance.now() - game.openedAt < POPUP_GUARD_MS) return;
      startLeg(game.stop);
    }
  }

  // Slide number key: jump to that state instantly, from any state (even mid-ride). No ride animation.
  function goTo(i, opts = {}) {
    i = Math.max(1, Math.min(LAST, i | 0));              // there is no slide 0: the ride starts parked at slide 1
    portalFx.clear(); hudEl.style.opacity = ''; fx.clear(); fxFill = 2; if (game.time > 1) audio.play('ui.button.click', { vol: 0.5 });
    physics.reset(i < LAST ? track.stops[i - 1].sMid : track.endCell.sMid);
    update.acc = 0;
    game.stop = i; game.state = stateName(i); game.openedAt = -1e9;   // no popup guard: the presenter chose this
    game.finale = i === LAST; game.portalT = 0;
    rig.setFirstPerson(game.finale); rig.wFP = game.finale ? 1 : 0; rig.fpPose = null; rig.kick = 0;
    steve.userData.headMeshes.forEach((m) => { m.visible = !game.finale; });
    snapCart = true; placeCart(0.016);
    rig.snap = true;
    if (game.finale) { rig.setPanel(false); rig.wPanel = 0; } else { rig.setPanel(true, stopPanelPose(i)); rig.wPanel = 1; }
    if (i === LAST) { hideBoard(); hudEl.style.opacity = 0; portalFx.setFade(1); }     // jumping straight to the end: the black screen after the portal
    else showBoard(i, true);
    hint.textContent = i === LAST ? 'Press SPACE to restart' : '';
    hint.style.opacity = i === LAST ? 1 : 0;                       // the start slide already says it; the black end screen needs the prompt
  }
  const restart = () => goTo(1);

  // multi-digit slide numbers (only needed when there are 10+ checkpoints): wait briefly for a second digit
  let digitBuf = '', digitTimer = 0;
  // slide numbers start at 0 (the first slide); state index = slide number + 1, and the black end screen is slide number N
  const MAXSLIDE = LAST - 1;
  function commitDigits() { clearTimeout(digitTimer); const v = parseInt(digitBuf, 10); if (digitBuf !== '' && v >= 0 && v <= MAXSLIDE) goTo(v + 1); digitBuf = ''; }   // out-of-range numbers do nothing
  function pressDigit(d) {
    if (digitBuf !== '' && parseInt(digitBuf + d, 10) > MAXSLIDE) commitDigits();   // can't extend: jump to what was typed first
    digitBuf += d;
    const v = parseInt(digitBuf, 10);
    if (MAXSLIDE < 10 || v * 10 > MAXSLIDE) commitDigits();
    else { clearTimeout(digitTimer); digitTimer = setTimeout(commitDigits, 450); }
  }

  window.addEventListener('pointerdown', (e) => { if (e.button === 0) advance(); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const dm = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (dm) { e.preventDefault(); pressDigit(dm[1]); }
    else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
    else if (e.code === 'KeyR') restart();
    else if (e.code === 'KeyM') { const m = audio.toggleMute(); toast(m ? 'Sound off (M)' : 'Sound on (M)'); }
    else if (e.code === 'KeyF') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
  });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    applyQuality?.();
  });

  // ---- cart placement ----
  const cartQuat = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
  let cartFwd = V(0, 0, 1), cartUp = V(0, 1, 0), cartPos = V();
  const sA = [0, 0, 0], sB = [0, 0, 0], sC = [0, 0, 0];
  let snapCart = true;
  function placeCart(dt) {
    // render between the last two physics steps: the cart moves smoothly even when frame times are uneven
    const a = Math.min(1, (update.acc || 0) / P.dt), s = physics.prevS + (physics.s - physics.prevS) * a;
    track.sample(s + 0.45, sA); track.sample(s - 0.45, sB); track.sample(s, sC);
    const fwd = V(sA[0] - sB[0], sA[1] - sB[1], sA[2] - sB[2]).normalize();
    const right = V().crossVectors(V(0, 1, 0), fwd).normalize();
    const up = V().crossVectors(fwd, right).normalize();
    tmpM.makeBasis(right, up, fwd);
    const q = new THREE.Quaternion().setFromRotationMatrix(tmpM);
    if (snapCart) { cartQuat.copy(q); snapCart = false; } else cartQuat.slerp(q, 1 - Math.exp(-dt * 16));
    cart.quaternion.copy(cartQuat);
    cartFwd = V(0, 0, 1).applyQuaternion(cartQuat);
    cartUp = V(0, 1, 0).applyQuaternion(cartQuat);
    cartPos = V(sC[0], sC[1], sC[2]);
    cart.position.copy(cartPos).addScaledVector(cartUp, 0.44);
  }

  // entity lighting: ambient levels sampled at the cart; direct light is ray traced per pixel
  function lightEntities(dt) {
    const l = world.lightAt(cartPos.x, cartPos.y + 0.8, cartPos.z);
    entLightVec.x += (l.sky / 15 - entLightVec.x) * Math.min(1, dt * 8);
    entLightVec.y += (l.blk / 15 - entLightVec.y) * Math.min(1, dt * 8);
  }

  // per-biome atmosphere, blended as the cart rides between biomes
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const ATMO = {
    desert: { top: C(0.18, 0.40, 0.82), hor: C(0.80, 0.80, 0.70), skyAmb: C(0.50, 0.50, 0.55), cave: C(0.02, 0.02, 0.03), sun: 0.8, stars: 0, nebula: 0, fogN: 55, fogF: 200 },
    alpine: { top: C(0.16, 0.36, 0.78), hor: C(0.62, 0.78, 0.92), skyAmb: C(0.42, 0.50, 0.64), cave: C(0.02, 0.02, 0.03), sun: 0.72, stars: 0, nebula: 0, fogN: 50, fogF: 190 },
    cherry: { top: C(0.20, 0.45, 0.82), hor: C(0.68, 0.84, 0.95), skyAmb: C(0.44, 0.52, 0.66), cave: C(0.02, 0.02, 0.03), sun: 0.72, stars: 0, nebula: 0, fogN: 45, fogF: 170 },
    taiga: { top: C(0.40, 0.52, 0.68), hor: C(0.72, 0.78, 0.84), skyAmb: C(0.38, 0.44, 0.54), cave: C(0.02, 0.025, 0.03), sun: 0.42, stars: 0, nebula: 0, fogN: 30, fogF: 130 },
    lush: { top: C(0.03, 0.06, 0.04), hor: C(0.05, 0.10, 0.06), skyAmb: C(0.4, 0.5, 0.4), cave: C(0.045, 0.07, 0.05), sun: 0, stars: 0, nebula: 0, fogN: 12, fogF: 70 },
    ice: { top: C(0.04, 0.10, 0.20), hor: C(0.08, 0.18, 0.32), skyAmb: C(0.4, 0.55, 0.8), cave: C(0.05, 0.10, 0.17), sun: 0, stars: 0, nebula: 0, fogN: 12, fogF: 75 },
    deep: { top: C(0, 0.012, 0.016), hor: C(0.004, 0.022, 0.03), skyAmb: C(0.1, 0.3, 0.4), cave: C(0.012, 0.036, 0.046), sun: 0, stars: 0, nebula: 0, fogN: 6, fogF: 50 },
    nether: { top: C(0.12, 0.02, 0.01), hor: C(0.25, 0.05, 0.02), skyAmb: C(0.6, 0.3, 0.2), cave: C(0.12, 0.035, 0.015), sun: 0, stars: 0, nebula: 0, fogN: 10, fogF: 85 },
    end: { top: C(0.02, 0.0, 0.07), hor: C(0.20, 0.09, 0.34), skyAmb: C(0.35, 0.25, 0.55), cave: C(0.06, 0.04, 0.10), sun: 0, stars: 1, nebula: 1, fogN: 20, fogF: 150 },
    tunnel: { top: C(0.03, 0.03, 0.04), hor: C(0.05, 0.05, 0.06), skyAmb: C(0.4, 0.45, 0.55), cave: C(0.04, 0.04, 0.05), sun: 0, stars: 0, nebula: 0, fogN: 10, fogF: 70 },
  };
  if (NIGHT) {   // moonlit surface: deep blue sky, stars, cool moonlight from the moon's direction instead of the sun
    Object.assign(ATMO.alpine, { top: C(0.010, 0.018, 0.075), hor: C(0.045, 0.07, 0.17), skyAmb: C(0.06, 0.09, 0.21), sun: 0.5, stars: 1, fogN: 35, fogF: 160 });
    Object.assign(ATMO.desert, { top: C(0.012, 0.02, 0.08), hor: C(0.075, 0.08, 0.17), skyAmb: C(0.07, 0.095, 0.21), sun: 0.5, stars: 1, fogN: 38, fogF: 170 });
    Object.assign(ATMO.cherry, { top: C(0.018, 0.02, 0.08), hor: C(0.07, 0.07, 0.19), skyAmb: C(0.075, 0.09, 0.215), sun: 0.5, stars: 1, fogN: 32, fogF: 150 });
    Object.assign(ATMO.taiga, { top: C(0.008, 0.016, 0.06), hor: C(0.035, 0.06, 0.13), skyAmb: C(0.055, 0.085, 0.19), sun: 0.36, stars: 1, fogN: 24, fogF: 115 });
    rt.uniforms.uSunDir.value.copy(sky.moonDir); rt.uniforms.uSunColor.value.set(0.50, 0.60, 1.0);
    sky.uniforms.uSunDir.value.copy(sky.moonDir); sky.uniforms.uStarDen.value = 0.9925;
    sky.cloudMat.color.setRGB(0.07, 0.085, 0.16);
  }
  const cur = { nebula: 0, top: ATMO.alpine.top.clone(), hor: ATMO.alpine.hor.clone(), skyAmb: ATMO.alpine.skyAmb.clone(), cave: ATMO.alpine.cave.clone(), sun: 1, stars: 0, nebula: 0, fogN: 50, fogF: 190 };
  let biomeNow = 'alpine';
  function updateAtmosphere(dt) {
    const px = Math.floor(cartPos.x), pz = Math.floor(cartPos.z);
    if (world.inb(px, world.oy, pz)) {
      const cell = world.cells[world.colCell[world.col(px, pz)]];
      biomeNow = cell.biome;
    }
    const sk = world.lightAt(camera.position.x, camera.position.y, camera.position.z).sky / 15;
    let T = ATMO[biomeNow];
    // surface biomes turn dark inside tunnels / caves (low sky light)
    const open = Math.min(1, sk * 1.4);
    const k = Math.min(1, dt * 1.6);
    const tgt = (key) => (T.sun > 0 && open < 1 ? ATMO.tunnel[key] : T[key]);
    for (const key of ['top', 'hor', 'skyAmb', 'cave']) {
      const goal = T.sun > 0 ? ATMO[open > 0.6 ? biomeNow : 'tunnel'][key] : T[key];
      cur[key].lerp(goal, k);
    }
    const goalSun = T.sun > 0 ? T.sun * Math.min(1, open) : 0;
    cur.sun += (goalSun - cur.sun) * k; cur.stars += (T.stars - cur.stars) * k; cur.nebula += (T.nebula - cur.nebula) * k;
    cur.fogN += ((T.sun > 0 && open < 0.6 ? ATMO.tunnel.fogN : T.fogN) - cur.fogN) * k;
    cur.fogF += ((T.sun > 0 && open < 0.6 ? ATMO.tunnel.fogF : T.fogF) - cur.fogF) * k;
    const u = rt.uniforms;
    u.uSkyTop.value.copy(cur.top); u.uSkyHorizon.value.copy(cur.hor); u.uSkyAmb.value.copy(cur.skyAmb); u.uCaveAmb.value.copy(cur.cave);
    u.uSunOn.value = cur.sun > 0.02 ? cur.sun : 0; u.uCamPos.value.copy(camera.position); u.uTime.value = game.time;
    sky.uniforms.uTop.value.copy(cur.top); sky.uniforms.uHorizon.value.copy(cur.hor);
    sky.uniforms.uSunOn.value = NIGHT ? 0 : cur.sun; sky.uniforms.uStars.value = cur.stars; sky.uniforms.uNebula.value = cur.nebula;
    sky.uniforms.uMoonGlow.value = NIGHT ? Math.min(1, cur.sun * 1.8) : 0;
    if (sky.moon) sky.moon.visible = NIGHT && cur.sun > 0.2;
    scene.fog.color.copy(cur.hor); scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
    sky.cloudMat.opacity = 0.88 * Math.min(1, cur.sun * 1.5);
    sky.update(dt, camera.position, game.time);
  }

  // ---- main update ----
  function update(dt) {
    game.time += dt;
    // fixed-step physics
    let acc = (update.acc || 0) + dt; const step = P.dt;
    while (acc >= step) { physics.step(step); acc -= step; }
    update.acc = acc;
    for (const ev of physics.events.splice(0)) {
      if (ev.type === 'boost') { rig.boost(); streaks.fire(cartPos, cartFwd); audio.play('entity.firework_rocket.launch', { vol: 0.45, pitch: 1.35 }); }
      else if (ev.type === 'activator' && !game.finale) {
        audio.play('block.note_block.chime', { vol: 0.5, pitch: 0.8 });
        game.finale = true;
        rig.setFirstPerson(true);
      }
      else if (ev.type === 'detector') { audio.play('block.stone_pressure_plate.click_on', { vol: 0.7 }); if (!(stopInfo[game.stop].isEnd && game.finale)) rig.setPanel(true, stopPanelPose(game.stop + 1)); } // focus starts shifting as the cart rolls over the detector rail
      else if (ev.type === 'arrived') onArrived();
    }
    placeCart(dt);
    lightEntities(dt);
    const dep = physics.mode === 'running' && physics.cellIdx === physics.departCell ? physics.departCell : -1;
    rails.update(physics.s, dep);
    streaks.update(dt);

    // first person pose + head visibility
    if (game.finale) {
      steve.userData.headMeshes.forEach((m) => { m.visible = rig.wFP < 0.55; });
      const hp = headPos();
      rig.fpPose = { pos: hp, look: hp.clone().addScaledVector(cartFwd, 6).add(V(0, -0.15, 0)) };
    }
    // the final ride: the haze builds as the cart nears the portal, then it drives straight through
    if (game.finale && game.state === 'riding' && game.stop === N) {
      const d = portalS - physics.s, near = clamp01((2.2 - d) / 2.2);
      portalFx.setAlpha(near * 0.4); rig.kick = Math.max(rig.kick, near * 9);
      if (d <= 0) { game.state = 'portal'; game.portalT = 0; game.travelSound = false; audio.play('block.portal.trigger', { vol: 0.9 }); }
    }
    if (game.state === 'portal') {
      game.portalT += dt;
      if (!game.travelSound && game.portalT > 1.0) { game.travelSound = true; audio.play('block.portal.travel', { vol: 0.65 }); }
      if (physics.s >= endS) { physics.mode = 'stopped'; physics.v = 0; physics.s = endS; }   // the rails end a few blocks beyond the portal
      portalFx.setAlpha(0.4 + 0.6 * clamp01(game.portalT / 0.9));
      portalFx.setFade(clamp01((game.portalT - 1.3) / 1.0));
      rig.kick = Math.max(rig.kick, 16 * clamp01(game.portalT / 0.9));
      if (game.portalT >= 2.6) { game.state = 'finished'; game.stop = LAST; hudEl.style.opacity = 0; hint.textContent = 'Press SPACE to restart'; hint.style.opacity = 1; }
    }
    netherPortal.update(game.time);
    portalFx.update(dt, game.time);

    const hudText = game.state === 'idle' || game.state === 'portal' || game.state === 'finished' ? '' : `SLIDE ${Math.min(game.stop + (game.state === 'riding' ? 1 : 0), N) - 1} / ${N - 1}`;
    if (hud.textContent !== hudText) hud.textContent = hudText;
    rig.update(dt, { cartPos, fwd: cartFwd, speed: physics.v });
    animateFire(game.time);
    mobsMgr.update(dt, game.time, cartPos, camera.position);
    updateAtmosphere(dt);
    const skyHere = world.lightAt(camera.position.x, camera.position.y, camera.position.z).sky / 15;
    fx.update(dt, game.time, { camera, cart: cartPos, biome: biomeNow, sky: skyHere, fill: fxFill-- > 0, night: NIGHT });
    const po = endInfo.portal.origin, pp = { x: po[0], y: po[1] + 2, z: po[2] };
    audio.update(dt, { camera, speed: physics.v, biome: biomeNow, riding: game.state === 'riding' || game.state === 'portal',
      nearPortal: game.finale && Math.hypot(cartPos.x - pp.x, cartPos.z - pp.z) < 45, portalPos: pp });
  }

  const mobReport = placeMobs({ world, track, mgr: mobsMgr, hallCameraPos: (i) => stopPanelPose(i + 1).pos });
  console.log('mobs placed: ' + mobsMgr.mobs.length + ' ' + JSON.stringify(mobReport));
  window.__mobReport = mobReport;
  goTo(1);
  if (loading) loading.remove();

  let last = performance.now();
  // Quality governor. Total pixels are capped (a HiDPI laptop would otherwise shade 4x the pixels), the resolution scale and the ray budget
  // step together, drops react quickly (about half a second of slow frames) and rises are cautious, so it does not flap.
  const autoQ = (params.get('quality') || 'auto') === 'auto';
  const QUAL = [
    { scale: 1.0, lights: 8, steps: 96 }, { scale: 0.9, lights: 6, steps: 80 }, { scale: 0.8, lights: 5, steps: 64 },
    { scale: 0.7, lights: 4, steps: 52 }, { scale: 0.6, lights: 3, steps: 44 }, { scale: 0.5, lights: 2, steps: 36 },
  ];
  let qLevel = params.get('quality') === 'low' ? 4 : params.get('quality') === 'med' ? 2 : params.get('quality') === 'high' ? 0 : 1;      // auto starts one notch down and probes upward
  const MAX_PIXELS = 2.4e6;                                                                            // about 1080p worth of shaded pixels at full quality
  let slowT = 0, fastT = 0, ewma = 1 / 60;
  function applyQuality() {
    const q = QUAL[qLevel], css = window.innerWidth * window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / css));
    renderer.setPixelRatio(Math.max(0.5, pr * q.scale * renderScale));
    renderer.setSize(window.innerWidth, window.innerHeight);
    rt.uniforms.uMaxLights.value = q.lights; rt.uniforms.uSunSteps.value = q.steps;
  }
  applyQuality();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (window.__paused) { requestAnimationFrame(frame); return; }
    if (!document.hidden) update(dt);
    renderer.render(scene, camera);
    if (autoQ && !document.hidden && dt > 0) {
      ewma += (dt - ewma) * 0.08;                                  // smoothed frame time
      if (ewma > 1 / 47) { slowT += dt; fastT = 0; } else if (ewma < 1 / 57) { fastT += dt; slowT = 0; } else { slowT = Math.max(0, slowT - dt); fastT = 0; }
      if (slowT > 0.6 && qLevel < QUAL.length - 1) { qLevel++; slowT = 0; fastT = 0; applyQuality(); }
      else if (fastT > 7 && qLevel > 0) { qLevel--; slowT = 0; fastT = 0; applyQuality(); }
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  requestAnimationFrame(frame);

  // debug / test hooks (also handy for rehearsing)
  window.__game = {
    game, physics, track, world, rig, camera, scene, renderer, rt, sky, blockName: (id) => LIST[id].name,
    tick(sec, dt = 1 / 60, render = true) { for (let t = 0; t < sec; t += dt) update(dt); if (render) renderer.render(scene, camera); },
    click() { game.openedAt = -1e9; advance(); },
    mobs: mobsMgr, portalFx, fx, audio,
    // performance probe: CPU time of update() vs render + GPU sync, optionally with uneven frame times; also records the cart's rendered position
    bench(n = 30, dt = 1 / 60, uneven = false) {
      const gl = renderer.getContext(), px = new Uint8Array(4); let u = 0, r = 0; const pos = [];
      for (let i = 0; i < n; i++) {
        const d = uneven ? dt * (i % 3 === 0 ? 1.45 : i % 3 === 1 ? 0.75 : 0.8) : dt;
        const t0 = performance.now(); update(d); const t1 = performance.now();
        renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t2 = performance.now();
        u += t1 - t0; r += t2 - t1; pos.push({ x: cart.position.x, y: cart.position.y, z: cart.position.z, d });
      }
      return { updateMs: +(u / n).toFixed(2), renderMs: +(r / n).toFixed(1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pos };
    },
    gallery(types, o = {}) {
      const x0 = o.x ?? 20, y = o.y ?? (world.yTop + 6), z = o.z ?? 40, gap = o.gap ?? 4;
      types.forEach((tp, i) => mobsMgr.spawn(tp, new THREE.Vector3(x0 + i * gap, y, z), { always: true, kind: 'static', yaw: o.yaw ?? Math.PI * 0.85, ph: 0.3 }));
      this.tick(0.2, 1 / 60, false);
    },
    goTo, key(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); },
    skipTo(i) { goTo(i); this.tick(0.5); },
    view(p, l, fov = 60) { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...l); renderer.render(scene, camera); },
  };
}

main().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'ERROR: ' + e.message;
});
