import { labPixels } from './pictures';

type Channel = { dc: number; ac: number[]; scale: number };

function encodeChannel(values: number[], w: number, h: number, nx: number, ny: number): Channel {
  let dc = 0;
  const ac: number[] = [];
  let scale = 0;
  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
      let f = 0;
      for (let y = 0; y < h; y++) {
        const fy = Math.cos((Math.PI / h) * cy * (y + 0.5));
        for (let x = 0; x < w; x++) {
          f += values[x + y * w] * Math.cos((Math.PI / w) * cx * (x + 0.5)) * fy;
        }
      }
      f /= w * h;
      if (cx || cy) {
        ac.push(f);
        scale = Math.max(scale, Math.abs(f));
      } else {
        dc = f;
      }
    }
  }
  if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i];
  return { dc, ac, scale };
}

export function thumbhashOf(mediaId: string): number[] {
  const image = labPixels(mediaId);
  if (!image) return [];
  const { width: w, height: h, data } = image;
  const l: number[] = [];
  const p: number[] = [];
  const q: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    l.push((r + g + b) / 3);
    p.push((r + g) / 2 - b);
    q.push(r - g);
  }
  const limit = 7;
  const lx = Math.max(1, Math.round((limit * w) / Math.max(w, h)));
  const ly = Math.max(1, Math.round((limit * h) / Math.max(w, h)));
  const lc = encodeChannel(l, w, h, Math.max(3, lx), Math.max(3, ly));
  const pc = encodeChannel(p, w, h, 3, 3);
  const qc = encodeChannel(q, w, h, 3, 3);
  const landscape = w > h;
  const head24 =
    Math.round(63 * lc.dc) |
    (Math.round(31.5 + 31.5 * pc.dc) << 6) |
    (Math.round(31.5 + 31.5 * qc.dc) << 12) |
    (Math.round(31 * lc.scale) << 18);
  const head16 =
    (landscape ? ly : lx) |
    (Math.round(63 * pc.scale) << 3) |
    (Math.round(63 * qc.scale) << 9) |
    ((landscape ? 1 : 0) << 15);
  const hash = [head24 & 255, (head24 >> 8) & 255, head24 >> 16, head16 & 255, head16 >> 8];
  let index = 0;
  for (const ac of [lc.ac, pc.ac, qc.ac]) {
    for (const f of ac) {
      const at = 5 + (index >> 1);
      hash[at] = (hash[at] ?? 0) | (Math.round(15 * f) << ((index & 1) << 2));
      index += 1;
    }
  }
  return hash;
}
