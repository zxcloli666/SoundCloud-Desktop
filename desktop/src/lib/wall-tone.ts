import { useEffect } from 'react';

type Tone = { lo: number; hi: number };

const SAMPLE_W = 64;
const SAMPLE_H = 36;
const OPACITY_WEIGHT = 0.2;

const tones = new Map<string, Promise<Tone | null>>();

export function useWallTone(url: string | null, dim: number, opacity: number): void {
  useEffect(() => {
    if (!url) return;
    let live = true;
    void wallTone(url).then((tone) => {
      if (!live || !tone) return;
      const open = (1 - dim) * (1 - opacity * OPACITY_WEIGHT);
      const root = document.documentElement.style;
      root.setProperty('--wall-bright', (tone.hi * open).toFixed(3));
      root.setProperty('--wall-dark', ((1 - tone.lo) * open).toFixed(3));
    });
    return () => {
      live = false;
    };
  }, [url, dim, opacity]);
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
