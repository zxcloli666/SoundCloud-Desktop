import { useEffect, useState } from 'react';
import { usePlayerStore } from '../stores/player';
import { art } from './formatters';

export type Rgb = [number, number, number];

export interface CoverPalette {
  average: Rgb;
  primary: Rgb;
  secondary: Rgb;
  accent: string | null;
}

const SAMPLE = 32;
const HUE_BINS = 12;
const CACHE_LIMIT = 48;
const cache = new Map<string, Promise<CoverPalette | null>>();

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function accentFromRgb(rgb: Rgb): string | null {
  const [h, s] = rgbToHsl(rgb);
  if (s < 0.12) return null;
  return toHex(hslToRgb(h, clamp(s, 0.55, 0.9), 0.6));
}

export function tintFromRgb(rgb: Rgb): Rgb {
  const [h, s, l] = rgbToHsl(rgb);
  if (s < 0.08) return rgb;
  return hslToRgb(h, clamp(s, 0.45, 0.85), clamp(l, 0.42, 0.6));
}

function shiftHue(rgb: Rgb, degrees: number): Rgb {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb((h + degrees) % 360, s, l);
}

interface Bin {
  weight: number;
  r: number;
  g: number;
  b: number;
}

function binColor(bin: Bin): Rgb {
  return [
    Math.round(bin.r / bin.weight),
    Math.round(bin.g / bin.weight),
    Math.round(bin.b / bin.weight),
  ];
}

export function paletteFromPixels(data: Uint8ClampedArray): CoverPalette {
  const bins: Bin[] = Array.from({ length: HUE_BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const px: Rgb = [data[i], data[i + 1], data[i + 2]];
    r += px[0];
    g += px[1];
    b += px[2];
    const [h, s, l] = rgbToHsl(px);
    const weight = s * s * (1 - Math.abs(2 * l - 1));
    if (weight < 0.02) continue;
    const bin = bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS];
    bin.weight += weight;
    bin.r += px[0] * weight;
    bin.g += px[1] * weight;
    bin.b += px[2] * weight;
  }
  const average: Rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  const ranked = bins.map((bin, idx) => ({ bin, idx })).filter((e) => e.bin.weight > 0);
  ranked.sort((a, c) => c.bin.weight - a.bin.weight);
  const top = ranked[0];
  if (!top || top.bin.weight < n * 0.015) {
    return { average, primary: average, secondary: average, accent: null };
  }
  const primary = binColor(top.bin);
  const distance = (idx: number) => {
    const d = Math.abs(idx - top.idx);
    return Math.min(d, HUE_BINS - d);
  };
  const second = ranked.find((e) => distance(e.idx) >= 2 && e.bin.weight >= top.bin.weight * 0.12);
  const secondary = second ? binColor(second.bin) : shiftHue(primary, 40);
  return { average, primary, secondary, accent: accentFromRgb(primary) };
}

function loadPalette(src: string): Promise<CoverPalette | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        resolve(paletteFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function extractPalette(src: string): Promise<CoverPalette | null> {
  const hit = cache.get(src);
  if (hit) {
    cache.delete(src);
    cache.set(src, hit);
    return hit;
  }
  const pending = loadPalette(src);
  cache.set(src, pending);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pending;
}

export function coverSrc(artworkUrl: string | null | undefined): string | null {
  return art(artworkUrl, 't200x200');
}

export function useCoverPalette(enabled: boolean): CoverPalette | null {
  const src = usePlayerStore((s) => (enabled ? coverSrc(s.currentTrack?.artwork_url) : null));
  const [palette, setPalette] = useState<CoverPalette | null>(null);

  useEffect(() => {
    if (!src) {
      setPalette(null);
      return;
    }
    let alive = true;
    extractPalette(src).then((p) => {
      if (alive) setPalette(p);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  return palette;
}
