import { useTranslation } from 'react-i18next';
import { useArtistLinkItems } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { ArtistNameLinks } from '../../music/ArtistNameLinks';

export function DeckHeading({ track }: { track: Track }) {
  const { t } = useTranslation();
  const playing = usePlayerStore((s) => s.isPlaying);
  const artists = useArtistLinkItems(track);
  return (
    <header className="flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
      <p
        data-ui="deck-status"
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-45"
      >
        <span
          className={`size-1.5 rounded-full ${playing ? 'bg-accent' : 'bg-ink/30'}`}
          aria-hidden
        />
        {playing ? t('flowRedesign.nowPlaying') : t('flowRedesign.paused')}
      </p>
      <h1 data-ui="deck-artist" className="max-w-full truncate text-[15px] font-medium text-ink-70">
        <ArtistNameLinks
          items={artists}
          linkClassName="cursor-pointer transition-colors hover:text-accent"
        />
      </h1>
    </header>
  );
}
