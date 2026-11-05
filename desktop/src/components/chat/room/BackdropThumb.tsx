import { memo, useMemo } from 'react';
import type { PublicBackdrop } from '../../../lib/chat/media-types';
import { scrimAlpha } from './backdrop/scrim';
import { useSchemeTokens } from './backdrop/tokens';
import { presetOf } from './presets';

const CARD_TEXT_TONE = 0.55;

export function hasBackdropThumb(backdrop: PublicBackdrop | null | undefined): boolean {
  return presetOf(backdrop?.kind === 'preset' ? backdrop.id : null) !== null;
}

export const BackdropThumb = memo(function BackdropThumb({
  backdrop,
}: {
  backdrop: PublicBackdrop | null;
}) {
  const tokens = useSchemeTokens();
  const preset = presetOf(backdrop?.kind === 'preset' ? backdrop.id : null);
  const alpha = useMemo(
    () => (preset ? scrimAlpha(preset.light, tokens, CARD_TEXT_TONE) : 0),
    [preset, tokens],
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
