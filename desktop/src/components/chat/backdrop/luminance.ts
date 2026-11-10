import type { Luminance } from './presets/types';
import { UNKNOWN_LIGHT } from './scrim';

const WIDTH = 48;
const HEIGHT = 27;

function linear(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function measureImage(image: HTMLImageElement): Luminance {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return UNKNOWN_LIGHT;
  let data: Uint8ClampedArray;
  try {
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    data = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  } catch {
    return UNKNOWN_LIGHT;
  }
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
