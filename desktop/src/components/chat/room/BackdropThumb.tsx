import { memo } from 'react';
import type { PublicBackdrop } from '../../../lib/chat/media-types';
import { presetOf } from './presets';

export const BackdropThumb = memo(function BackdropThumb({
  backdrop,
  className,
}: {
  backdrop: PublicBackdrop | null;
  className?: string;
}) {
  const preset = presetOf(backdrop?.kind === 'preset' ? backdrop.id : null);
  if (!preset) return null;
  return (
    <img
      src={preset.tile}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      loading="lazy"
      data-tone={preset.tone}
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full object-cover'}
    />
  );
});
