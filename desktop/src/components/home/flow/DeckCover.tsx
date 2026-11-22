import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Music } from '../../../lib/icons';
import { useLyricsStore } from '../../../stores/lyrics';
import type { Track } from '../../../stores/player';

export const DECK_COVER_SIZE = 'clamp(200px, 31vh, 300px)';

export function DeckCover({ track, title }: { track: Track; title: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const source = track.artwork_url || track.user?.avatar_url;
  const src = art(source, 't500x500');
  return (
    <button
      type="button"
      data-ui="deck-cover"
      aria-label={t('flowRedesign.openPlayer', { title })}
      onClick={() => useLyricsStore.getState().openPanel({ rightPanelOpen: false })}
      style={{ width: DECK_COVER_SIZE, height: DECK_COVER_SIZE }}
      className="relative block shrink-0 cursor-pointer overflow-hidden rounded-[28px] bg-ink/[0.06] shadow-[0_24px_60px_-18px_rgb(var(--shade)/calc(0.7*var(--shade-alpha)))] ring-1 ring-ink/[0.1] outline-none transition-transform duration-300 hover:scale-[1.015] focus-visible:ring-2 focus-visible:ring-accent/70 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {src && !failed ? (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-ink-30">
          <Music size={56} aria-hidden />
        </span>
      )}
    </button>
  );
}
