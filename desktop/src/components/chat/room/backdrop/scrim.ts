import type { Luminance } from '../presets/types';

const TARGET = 4.5;
const TEXT_ALPHA = 0.75;
const FLOOR = 0.22;
const CEILING = 0.92;
const STEP = 0.01;

export const UNKNOWN_LIGHT: Luminance = { mean: 0.5, low: 0, high: 1 };

function decode(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encode(value: number) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function channelLight([r, g, b]: number[]) {
  return 0.2126 * decode(r / 255) + 0.7152 * decode(g / 255) + 0.0722 * decode(b / 255);
}

function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function mix(top: number, bottom: number, alpha: number) {
  return alpha * top + (1 - alpha) * bottom;
}

export function readChannels(name: string): number[] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : [0, 0, 0];
}

export function scrimAlpha(light: Luminance, ink: number[], paper: number[]): number {
  const inkLight = channelLight(ink);
  const paperLight = channelLight(paper);
  const worst = inkLight > paperLight ? light.high : light.low;
  const inkCode = encode(inkLight);
  const paperCode = encode(paperLight);
  const imageCode = encode(worst);
  for (let alpha = FLOOR; alpha < CEILING; alpha += STEP) {
    const ground = mix(paperCode, imageCode, alpha);
    const text = mix(inkCode, ground, TEXT_ALPHA);
    if (contrast(decode(text), decode(ground)) >= TARGET) return Math.round(alpha * 100) / 100;
  }
  return CEILING;
}
