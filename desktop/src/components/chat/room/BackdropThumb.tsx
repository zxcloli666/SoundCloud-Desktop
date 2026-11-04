import { memo, useMemo } from 'react';
import type { PublicBackdrop } from '../../../lib/chat/media-types';
import { useScheme } from '../../../lib/scheme';
import { scrimAlpha } from './backdrop/scrim';
import { presetOf } from './presets';

const CARD_TEXT_TONE = 0.55;

export const BackdropThumb = memo(function BackdropThumb({
  backdrop,
}: {
  backdrop: PublicBackdrop | null;
}) {
  const scheme = useScheme();
  const preset = presetOf(backdrop?.kind === 'preset' ? backdrop.id : null);
  const alpha = useMemo(
    () => (preset ? scrimAlpha(preset.light, scheme, CARD_TEXT_TONE) : 0),
    [preset, scheme],
  );
  if (!preset) return null;
  return (
    <>
      <img
        src={preset.tile}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `rgb(var(--paper) / ${alpha})` }}
      />
    </>
  );
});
