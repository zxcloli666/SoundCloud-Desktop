import { type CSSProperties, useEffect } from 'react';
import { create } from 'zustand';
import type { Aura } from './aura';
import { tintFromRgb } from './cover-palette';
import { parseCssColor } from './genre-aura';

export type GlowLevel = 'calm' | 'page' | 'star';

export interface PageLight {
  colors: string[];
  level: GlowLevel;
  stars: Aura | null;
}

export const usePageGlowStore = create<{ light: PageLight | null }>(() => ({ light: null }));

export function glowColor(css: string): string | null {
  const rgb = parseCssColor(css);
  return rgb ? `rgb(${tintFromRgb(rgb).join(' ')})` : null;
}

export function glowColors(hues: readonly string[]): string[] {
  const colors = hues.map(glowColor).filter((color): color is string => color !== null);
  if (colors.length === 0) return [];
  return [0, 1, 2].map((i) => colors[i % colors.length]);
}

export function usePageGlow(
  hues: readonly string[],
  level: GlowLevel = 'calm',
  stars: Aura | null = null,
): string[] {
  const colors = glowColors(hues);
  const [a = '', b = '', c = ''] = colors;
  useEffect(() => {
    usePageGlowStore.setState({ light: { colors: a ? [a, b, c] : [], level, stars } });
    return () => usePageGlowStore.setState({ light: null });
  }, [a, b, c, level, stars]);
  return colors;
}

export function litStyle(glow: readonly string[]): CSSProperties {
  return {
    '--lit': glow[0] ?? 'var(--color-accent)',
    '--lit-b': glow[1] ?? glow[0] ?? 'var(--color-accent)',
  } as CSSProperties;
}
