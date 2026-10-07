import React from 'react';
import { type Rgb, tintFromRgb, useCoverPalette } from '../../lib/cover-palette';
import { usePerfMode } from '../../lib/perf';
import { useSettingsStore } from '../../stores/settings';

const rgb = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

export const CoverTint = React.memo(() => {
  const enabled = useSettingsStore((s) => s.coverTint);
  const perf = usePerfMode();
  const palette = useCoverPalette(enabled);
  if (!enabled) return null;

  const style = {
    '--cover-a': palette ? rgb(tintFromRgb(palette.primary)) : 'transparent',
    '--cover-b': palette ? rgb(tintFromRgb(palette.secondary)) : 'transparent',
    opacity: palette ? 1 : 0,
    contain: 'strict',
    transform: 'translateZ(0)',
  } as React.CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="cover-tint absolute inset-0 pointer-events-none"
      data-animate={perf.mode === 'light' ? undefined : ''}
      style={style}
    />
  );
});
