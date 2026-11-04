import type { Luminance } from '../presets/types';
import { UNKNOWN_LIGHT } from './scrim';

const WIDTH = 48;
const HEIGHT = 27;

function linear(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function measure(image: HTMLImageElement): Luminance {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return UNKNOWN_LIGHT;
  context.drawImage(image, 0, 0, WIDTH, HEIGHT);
  const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    values.push(
      0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]),
    );
  }
  values.sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    mean,
    low: values[Math.floor(values.length * 0.1)],
    high: values[Math.floor(values.length * 0.9)],
  };
}

export function sampleLuminance(src: string): Promise<Luminance> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      try {
        resolve(measure(image));
      } catch {
        resolve(UNKNOWN_LIGHT);
      }
    };
    image.onerror = () => resolve(UNKNOWN_LIGHT);
    image.src = src;
  });
}
