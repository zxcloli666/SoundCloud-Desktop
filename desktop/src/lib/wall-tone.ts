import { useEffect } from 'react';

type Tone = { lo: number; hi: number };

const SAMPLE_W = 64;
const SAMPLE_H = 36;
const OPACITY_WEIGHT = 0.2;
const CLASH_FROM = 0.4;
const CLASH_SPAN = 0.3;

const tones = new Map<string, Promise<Tone | null>>();

export function useWallTone(url: string | null, dim: number, opacity: number): void {
  useEffect(() => {
    if (!url) return;
    let live = true;
    void wallTone(url).then((tone) => {
      if (!live || !tone) return;
      const open = (1 - dim) * (1 - opacity * OPACITY_WEIGHT);
      const dark = clash(tone.hi * open);
      const white = clash((1 - tone.lo) * open);
      const root = document.documentElement.style;
      root.setProperty('--veil-dark', percent(22 + 28 * dark));
      root.setProperty('--veil-white', percent(22 + 28 * white));
      root.setProperty('--pane-dark', percent(34 + 40 * dark));
      root.setProperty('--pane-white', percent(34 + 40 * white));
      root.setProperty('--lift-dark', (0.5 * dark).toFixed(3));
      root.setProperty('--lift-white', (0.6 + 0.25 * white).toFixed(3));
      root.setProperty('--lift-mix-dark', percent(30 * dark));
      root.setProperty('--lift-mix-white', percent(60 * (0.6 + 0.25 * white)));
    });
    return () => {
      live = false;
    };
  }, [url, dim, opacity]);
}

function clash(value: number): number {
  return Math.min(1, Math.max(0, (value - CLASH_FROM) / CLASH_SPAN));
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function wallTone(url: string): Promise<Tone | null> {
  let tone = tones.get(url);
  if (!tone) {
    tone = measure(url);
    tones.set(url, tone);
  }
  return tone;
}

function measure(url: string): Promise<Tone | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(sample(img));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function sample(img: HTMLImageElement): Tone | null {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    const lumas: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      lumas.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
    }
    lumas.sort((a, b) => a - b);
    return { lo: lumas[Math.floor(lumas.length * 0.2)], hi: lumas[Math.floor(lumas.length * 0.8)] };
  } catch {
    return null;
  }
}
