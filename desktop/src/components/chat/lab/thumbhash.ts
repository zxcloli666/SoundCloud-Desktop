export interface Decoded {
  w: number;
  h: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

interface Channel {
  dc: number;
  ac: number[];
  scale: number;
}

const f32 = Math.fround;
const PI = f32(Math.PI);

function cosine(size: number, at: number, index: number): number {
  return f32(Math.cos(f32(f32(f32(PI / size) * at) * f32(index + 0.5))));
}

function encodeChannel(values: number[], w: number, h: number, nx: number, ny: number): Channel {
  let dc = 0;
  const ac: number[] = [];
  let scale = 0;
  const fx: number[] = new Array(w).fill(0);
  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
      let f = 0;
      for (let x = 0; x < w; x++) fx[x] = cosine(w, cx, x);
      for (let y = 0; y < h; y++) {
        const fy = cosine(h, cy, y);
        for (let x = 0; x < w; x++) f = f32(f + f32(f32(values[x + y * w] * fx[x]) * fy));
      }
      f = f32(f / (w * h));
      if (cx > 0 || cy > 0) {
        ac.push(f);
        scale = Math.max(scale, Math.abs(f));
      } else {
        dc = f;
      }
    }
  }
  if (scale > 0) {
    const stretch = f32(0.5 / scale);
    for (let i = 0; i < ac.length; i++) ac[i] = f32(0.5 + f32(stretch * ac[i]));
  }
  return { dc, ac, scale };
}

function quantize(value: number, size: number): number {
  return Math.round(f32(size * value));
}

export function encodeThumbhash(w: number, h: number, rgba: ArrayLike<number>): number[] {
  if (w > 100 || h > 100 || rgba.length !== w * h * 4) return [];
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let avgA = 0;
  for (let i = 0; i < w * h; i++) {
    const alpha = f32(rgba[i * 4 + 3] / 255);
    const weight = f32(alpha / 255);
    avgR = f32(avgR + f32(weight * rgba[i * 4]));
    avgG = f32(avgG + f32(weight * rgba[i * 4 + 1]));
    avgB = f32(avgB + f32(weight * rgba[i * 4 + 2]));
    avgA = f32(avgA + alpha);
  }
  if (avgA > 0) {
    avgR = f32(avgR / avgA);
    avgG = f32(avgG / avgA);
    avgB = f32(avgB / avgA);
  }
  const hasAlpha = avgA < w * h;
  const limit = hasAlpha ? 5 : 7;
  const lx = Math.max(1, Math.round(f32((limit * w) / Math.max(w, h))));
  const ly = Math.max(1, Math.round(f32((limit * h) / Math.max(w, h))));
  const l: number[] = [];
  const p: number[] = [];
  const q: number[] = [];
  const a: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const alpha = f32(rgba[i * 4 + 3] / 255);
    const weight = f32(alpha / 255);
    const rest = f32(1 - alpha);
    const r = f32(f32(avgR * rest) + f32(weight * rgba[i * 4]));
    const g = f32(f32(avgG * rest) + f32(weight * rgba[i * 4 + 1]));
    const b = f32(f32(avgB * rest) + f32(weight * rgba[i * 4 + 2]));
    l.push(f32(f32(f32(r + g) + b) / 3));
    p.push(f32(f32(f32(r + g) / 2) - b));
    q.push(f32(r - g));
    a.push(alpha);
  }
  const lc = encodeChannel(l, w, h, Math.max(3, lx), Math.max(3, ly));
  const pc = encodeChannel(p, w, h, 3, 3);
  const qc = encodeChannel(q, w, h, 3, 3);
  const ac = hasAlpha ? encodeChannel(a, w, h, 5, 5) : null;
  const landscape = w > h;
  const head24 =
    quantize(lc.dc, 63) |
    (Math.round(f32(31.5 + f32(31.5 * pc.dc))) << 6) |
    (Math.round(f32(31.5 + f32(31.5 * qc.dc))) << 12) |
    (quantize(lc.scale, 31) << 18) |
    (hasAlpha ? 1 << 23 : 0);
  const head16 =
    (landscape ? ly : lx) |
    (quantize(pc.scale, 63) << 3) |
    (quantize(qc.scale, 63) << 9) |
    (landscape ? 1 << 15 : 0);
  const hash = [head24 & 255, (head24 >> 8) & 255, head24 >> 16, head16 & 255, head16 >> 8];
  if (ac) hash.push(quantize(ac.dc, 15) | (quantize(ac.scale, 15) << 4));
  let odd = false;
  for (const factors of ac ? [lc.ac, pc.ac, qc.ac, ac.ac] : [lc.ac, pc.ac, qc.ac]) {
    for (const factor of factors) {
      const nibble = quantize(factor, 15);
      if (odd) hash[hash.length - 1] |= nibble << 4;
      else hash.push(nibble);
      odd = !odd;
    }
  }
  return hash;
}

export function thumbhashRatio(hash: ArrayLike<number>): number | null {
  if (hash.length < 5) return null;
  const alpha = (hash[2] & 0x80) !== 0;
  const most = alpha ? 5 : 7;
  const least = hash[3] & 7;
  const landscape = (hash[4] & 0x80) !== 0;
  return landscape ? most / least : least / most;
}

export function decodeThumbhash(hash: ArrayLike<number>): Decoded | null {
  const ratio = thumbhashRatio(hash);
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return null;
  const head24 = hash[0] | (hash[1] << 8) | (hash[2] << 16);
  const head16 = hash[3] | (hash[4] << 8);
  const lDc = (head24 & 63) / 63;
  const pDc = ((head24 >> 6) & 63) / 31.5 - 1;
  const qDc = ((head24 >> 12) & 63) / 31.5 - 1;
  const lScale = ((head24 >> 18) & 31) / 31;
  const hasAlpha = head24 >> 23 !== 0;
  const pScale = ((head16 >> 3) & 63) / 63;
  const qScale = ((head16 >> 9) & 63) / 63;
  const landscape = head16 >> 15 !== 0;
  const lMax = hasAlpha ? 5 : 7;
  const lx = Math.max(3, landscape ? lMax : head16 & 7);
  const ly = Math.max(3, landscape ? head16 & 7 : lMax);
  let at = 5;
  let aDc = 1;
  let aScale = 1;
  if (hasAlpha) {
    if (hash.length <= at) return null;
    aDc = (hash[at] & 15) / 15;
    aScale = (hash[at] >> 4) / 15;
    at += 1;
  }
  let high: number | null = null;
  const decodeChannel = (nx: number, ny: number, scale: number): number[] | null => {
    const ac: number[] = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = cy > 0 ? 0 : 1; cx * ny < nx * (ny - cy); cx++) {
        let bits: number;
        if (high !== null) {
          bits = high;
          high = null;
        } else {
          if (at >= hash.length) return null;
          bits = hash[at] & 15;
          high = hash[at] >> 4;
          at += 1;
        }
        ac.push((bits / 7.5 - 1) * scale);
      }
    }
    return ac;
  };
  const lAc = decodeChannel(lx, ly, lScale);
  const pAc = decodeChannel(3, 3, pScale * 1.25);
  const qAc = decodeChannel(3, 3, qScale * 1.25);
  const aAc = hasAlpha ? decodeChannel(5, 5, aScale) : [];
  if (!lAc || !pAc || !qAc || !aAc) return null;
  const w = ratio > 1 ? 32 : Math.round(32 * ratio);
  const h = ratio > 1 ? Math.round(32 / ratio) : 32;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const fx: number[] = new Array(7).fill(0);
  const fy: number[] = new Array(7).fill(0);
  const spread = hasAlpha ? 5 : 3;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let l = lDc;
      let p = pDc;
      let q = qDc;
      let a = aDc;
      for (let cx = 0; cx < Math.max(lx, spread); cx++) {
        fx[cx] = Math.cos((Math.PI / w) * (x + 0.5) * cx);
      }
      for (let cy = 0; cy < Math.max(ly, spread); cy++) {
        fy[cy] = Math.cos((Math.PI / h) * (y + 0.5) * cy);
      }
      for (let cy = 0, j = 0; cy < ly; cy++) {
        const fy2 = fy[cy] * 2;
        for (let cx = cy > 0 ? 0 : 1; cx * ly < lx * (ly - cy); cx++, j++) {
          l += lAc[j] * fx[cx] * fy2;
        }
      }
      for (let cy = 0, j = 0; cy < 3; cy++) {
        const fy2 = fy[cy] * 2;
        for (let cx = cy > 0 ? 0 : 1; cx < 3 - cy; cx++, j++) {
          const f = fx[cx] * fy2;
          p += pAc[j] * f;
          q += qAc[j] * f;
        }
      }
      if (hasAlpha) {
        for (let cy = 0, j = 0; cy < 5; cy++) {
          const fy2 = fy[cy] * 2;
          for (let cx = cy > 0 ? 0 : 1; cx < 5 - cy; cx++, j++) {
            a += aAc[j] * fx[cx] * fy2;
          }
        }
      }
      const b = l - (2 / 3) * p;
      const r = (3 * l - b + q) / 2;
      const g = r - q;
      rgba[i] = Math.trunc(Math.min(1, Math.max(0, r)) * 255);
      rgba[i + 1] = Math.trunc(Math.min(1, Math.max(0, g)) * 255);
      rgba[i + 2] = Math.trunc(Math.min(1, Math.max(0, b)) * 255);
      rgba[i + 3] = Math.trunc(Math.min(1, Math.max(0, a)) * 255);
    }
  }
  return { w, h, rgba };
}
