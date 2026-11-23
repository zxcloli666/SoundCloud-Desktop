import { useTranslation } from 'react-i18next';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { LyricCurrent } from './DeckLyrics';
import { TrackRow } from './TrackRow';

export function WavePane({ tracks, current }: { tracks: Track[]; current: Track | null }) {
  const { t } = useTranslation();
  const play = usePlayerStore((s) => s.play);
  return (
    <section
      data-ui="wave-pane"
      aria-label={t('flowRedesign.waveTitle')}
      className="hidden w-full max-w-[360px] flex-col gap-5 self-center @min-[1180px]:col-start-1 @min-[1180px]:row-start-1 @min-[1180px]:flex"
    >
      <h2 className="text-[22px] font-bold tracking-[-0.025em] text-ink">
        {t('flowRedesign.waveTitle')}
      </h2>
      <ul className="flex flex-col gap-2">
        {tracks.map((track) => (
          <li key={track.urn} data-ui="wave-row">
            <TrackRow track={track} onPlay={() => play(track, tracks)} />
          </li>
        ))}
      </ul>
      {current && <LyricCurrent track={current} />}
    </section>
  );
}
