import * as THREE from 'three';
import { PALETTE, BIOME_IDS } from './blocks.js';

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('failed to load ' + url));
    im.src = url;
  });
}

export async function loadAssets() {
  const img = {};
  const names = await (await fetch('assets/block/_list.json', { cache: 'no-store' })).json();
  await Promise.all([
    ...names.map(async (n) => { img[n] = await loadImage(`assets/block/${n}.png`); }),
    loadImage('assets/entity/minecart.png').then((i) => { img.minecart = i; }),
    loadImage('assets/entity/steve.png').then((i) => { img.steve = i; }),
    loadImage('assets/font/ascii.png').then((i) => { img.font = i; }),
    loadImage('assets/sky/moon.png').then((i) => { img.moon = i; }),
  ]);
  img._names = names;
  img._particles = {};
  const pn = await (await fetch('assets/particles/_list.json', { cache: 'no-store' })).json();
  await Promise.all(pn.map(async (n) => { img._particles[n] = await loadImage(`assets/particles/${n}.png`); }));
  img._mobs = {};
  const mobNames = await (await fetch('assets/mobs/_list.json', { cache: 'no-store' })).json();
  await Promise.all(mobNames.map(async (n) => { img._mobs[n] = await loadImage(`assets/mobs/${n}.png`); }));
  return img;
}

export function pixelTexture(image) {
  const t = new THREE.Texture(image);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function tinted(image, color) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, 16, 16);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
  return c;
}

// One 16px tile per texture (first animation frame), plus grass-side variants tinted per biome.
export function buildAtlas(img) {
  const names = img._names.filter((n) => !/^(rail|rail_corner|powered_rail.*|detector_rail.*|activator_rail.*|torch|redstone_torch)$/.test(n));
  const tiles = [...names, ...BIOME_IDS.map((b) => 'grass_side_' + b)];
  const cols = 16, rows = Math.ceil(tiles.length / cols);
  const W = cols * 16, H = rows * 16;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  const uv = {};
  tiles.forEach((name, i) => {
    const cx = (i % cols) * 16, cy = Math.floor(i / cols) * 16;
    if (name.startsWith('grass_side_')) {
      const biome = name.slice(11);
      g.drawImage(img.grass_block_side, 0, 0, 16, 16, cx, cy, 16, 16);
      g.drawImage(tinted(img.grass_block_side_overlay, PALETTE[biome].grass), cx, cy);
    } else g.drawImage(img[name], 0, 0, 16, 16, cx, cy, 16, 16);
    const e = 0.02 / W;
    uv[name] = [cx / W + e, 1 - (cy + 16) / H + e, (cx + 16) / W - e, 1 - cy / H - e];
  });
  const texture = new THREE.CanvasTexture(cv);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, uv, canvas: cv, size: [W, H], tileSize: [16 / W, 16 / H] };
}
