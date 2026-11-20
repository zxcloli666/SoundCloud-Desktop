import type { LyricLine } from './lyrics';

export const LYRICS_OFFSET_STEP = 0.5;
export const LYRICS_OFFSET_MAX = 15;
export const LYRICS_OFFSET_KEEP = 500;

export function clampLyricsOffset(value: number): number {
  const limited = Math.max(-LYRICS_OFFSET_MAX, Math.min(LYRICS_OFFSET_MAX, value));
  return Math.round(limited * 10) / 10;
}

export function stepLyricsOffset(current: number, direction: 1 | -1): number {
  return clampLyricsOffset(current + direction * LYRICS_OFFSET_STEP);
}

export function shiftLyricLines(lines: LyricLine[], offset: number): LyricLine[] {
  if (offset === 0) return lines;
  return lines.map((line) => ({ ...line, time: Math.max(0, line.time + offset) }));
}

export function formatLyricsOffset(offset: number): string {
  const sign = offset > 0 ? '+' : offset < 0 ? '-' : '';
  return `${sign}${Math.abs(offset).toFixed(1)} s`;
}

export function withLyricsOffset(
  offsets: Record<string, number>,
  urn: string,
  value: number,
): Record<string, number> {
  const { [urn]: _dropped, ...rest } = offsets;
  const next = clampLyricsOffset(value);
  if (next === 0) return rest;
  const kept = Object.entries(rest).slice(-(LYRICS_OFFSET_KEEP - 1));
  return { ...Object.fromEntries(kept), [urn]: next };
}
