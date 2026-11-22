import { useTranslation } from 'react-i18next';
import { useArtistLinkItems } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { ArtistNameLinks } from '../../music/ArtistNameLinks';
import { Marquee } from '../../ui/Marquee';

export const STATUS_CLASS = 'text-[13px] font-semibold tracking-[0.09em] text-ink-60';
export const HEADING_CLASS =
  'deck-heading mt-2 w-full text-[clamp(38px,6vw,64px)] font-medium leading-[1.16] tracking-[-0.055em] text-ink';

export function DeckHeading({ track }: { track: Track }) {
  const { t } = useTranslation();
  const playing = usePlayerStore((s) => s.isPlaying);
  const artists = useArtistLinkItems(track);
  return (
    <header className="mb-6 flex w-full max-w-[690px] min-w-0 flex-col items-center text-center">
      <p data-ui="deck-status" className={STATUS_CLASS}>
        {playing ? t('flowRedesign.nowPlaying') : t('flowRedesign.paused')}
      </p>
      <h1 data-ui="deck-artist" className={HEADING_CLASS}>
        <Marquee
          label={artists.map((item) => item.name).join(', ')}
          durationSec={19}
          delaySec={1.4}
          gapPx={42}
          hold
          className="py-[0.08em]"
        >
          <ArtistNameLinks
            items={artists}
            linkClassName="cursor-pointer transition-colors hover:text-accent"
          />
        </Marquee>
      </h1>
    </header>
  );
}
