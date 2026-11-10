import type { Scheme } from '../../../lib/scheme';
import type { Luminance } from './presets/types';

const TARGET = 4.5;
const PLAIN_SHARE = 0.97;
const FLOOR = 0.22;
const CEILING = 0.92;
const STEP = 0.01;

export const UNKNOWN_LIGHT: Luminance = { mean: 0.5, low: 0, high: 1 };

export const ROOM_TEXT_TONE = 0.75;

const FALLBACK: Record<Scheme, { ink: number[]; paper: number[]; lift: number }> = {
  dark: { ink: [255, 255, 255], paper: [8, 8, 10], lift: 0 },
  white: { ink: [22, 20, 28], paper: [245, 245, 247], lift: 0.6 },
};

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

export interface SchemeTokens {
  scheme: Scheme;
  ink: string;
  paper: string;
  lift: string;
}

function channels(raw: string, fallback: number[]): number[] {
  const parts = raw.trim().split(/\s+/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
}

function liftOf(raw: string, fallback: number): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function textContrast(inkCode: number, groundCode: number, alpha: number) {
  return contrast(decode(mix(inkCode, groundCode, alpha)), decode(groundCode));
}

export function scrimAlpha(light: Luminance, tokens: SchemeTokens, tone = ROOM_TEXT_TONE): number {
  const fallback = FALLBACK[tokens.scheme];
  const inkLight = channelLight(channels(tokens.ink, fallback.ink));
  const paperLight = channelLight(channels(tokens.paper, fallback.paper));
  const textAlpha = tone * (1 + liftOf(tokens.lift, fallback.lift) * (1 - tone));
  const worst = inkLight > paperLight ? light.high : light.low;
  const inkCode = encode(inkLight);
  const paperCode = encode(paperLight);
  const imageCode = encode(worst);
  const target = Math.min(TARGET, textContrast(inkCode, paperCode, textAlpha) * PLAIN_SHARE);
  for (let alpha = FLOOR; alpha < CEILING; alpha += STEP) {
    const ground = mix(paperCode, imageCode, alpha);
    if (textContrast(inkCode, ground, textAlpha) >= target) return Math.round(alpha * 100) / 100;
  }
  return CEILING;
}
