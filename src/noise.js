// Small deterministic hash / value-noise helpers.
export function hash3(x, y, z, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const smooth = (t) => t * t * (3 - 2 * t);
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export function n2(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash3(xi, 0, zi, s), b = hash3(xi + 1, 0, zi, s), c = hash3(xi, 0, zi + 1, s), d = hash3(xi + 1, 0, zi + 1, s);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * zf;
}
export function fbm2(x, z, s = 0, oct = 4) {
  let a = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { a += amp * n2(x * f, z * f, s + i * 7); norm += amp; amp *= 0.5; f *= 2; }
  return a / norm;
}
export function n3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const h = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), xf), l(h(0, 1, 0), h(1, 1, 0), xf), yf),
    l(l(h(0, 0, 1), h(1, 0, 1), xf), l(h(0, 1, 1), h(1, 1, 1), xf), yf), zf);
}
