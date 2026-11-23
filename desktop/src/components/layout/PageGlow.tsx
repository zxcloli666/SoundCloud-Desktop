import React, { type CSSProperties, useMemo } from 'react';
import { auraFromHex } from '../../lib/aura';
import { glowColors, usePageGlowStore } from '../../lib/page-glow';
import { usePerfMode } from '../../lib/perf';
import { useSettingsStore } from '../../stores/settings';
import { PAGE_STAR_SEEDS, StarField } from '../user/StarField';

export const PageGlow = React.memo(() => {
  const perf = usePerfMode();
  const light = usePageGlowStore((s) => s.light);
  const accent = useSettingsStore((s) => s.accentColor);
  const quiet = useSettingsStore((s) => s.coverTint || !!s.backgroundImage);
  const fallback = useMemo(() => glowColors(auraFromHex(accent)?.orbs ?? []), [accent]);

  const level = light?.level ?? 'calm';
  const [a, b, c] = light?.colors.length ? light.colors : fallback;
  const style = { '--glow-a': a, '--glow-b': b, '--glow-c': c } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      data-ui="page-glow"
      data-level={level === 'calm' && quiet ? 'off' : level}
      data-animate={perf.mode === 'light' ? undefined : ''}
      data-drift={perf.idleAnim ? '' : undefined}
      style={style}
    >
      <i className="glow-orb glow-orb-a" />
      <i className="glow-orb glow-orb-b" />
      <i className="glow-orb glow-orb-c" />
      {light?.stars && (
        <StarField aura={light.stars} seeds={PAGE_STAR_SEEDS} intensity={0.7} glow={false} />
      )}
    </div>
  );
});
