import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { art } from '../../../lib/formatters';
import { Music, Play, pauseWhite14, playWhite14, Trophy } from '../../../lib/icons';
import { useTrackPlay } from '../../../lib/useTrackPlay';
import { type Track, usePlayerStore } from '../../../stores/player';
import { StatsPanel } from './StatsPanel';
import { topTrackToTrack } from './stats-utils';
import type { TopTrack } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

const TrackRow = memo(function TrackRow({
  entry,
  track,
  queue,
  rank,
  max,
}: {
  entry: TopTrack;
  track: Track;
  queue: Track[];
  rank: number;
  max: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useStatsFormat();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(entry.artworkUrl, 't200x200');
  return (
    <div
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-2 py-2 transition-colors ${isThis ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.04]'}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-0 rounded-2xl bg-ink/[0.035]"
        style={{ width: `${(entry.plays / max) * 100}%` }}
      />
      <span
        className={`relative w-6 text-right text-[13px] font-bold tabular-nums ${rank === 1 ? 'text-ink-80' : 'text-ink-30'}`}
      >
        {rank}
      </span>
      <button
        type="button"
        onClick={togglePlay}
        className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-ink/[0.08]"
      >
        {cover ? (
          <img src={cover} alt="" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink/[0.04]">
            <Music size={14} className="text-ink-20" />
          </div>
        )}
        <span
          data-scheme="dark"
          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isThisPlaying ? pauseWhite14 : playWhite14}
        </span>
      </button>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => navigate(`/track/${encodeURIComponent(entry.trackUrn)}`)}
          className="block max-w-full text-left text-[13.5px] font-semibold text-ink-90 hover:text-ink truncate cursor-pointer transition-colors"
        >
          {entry.title}
        </button>
        <button
          type="button"
          disabled={!entry.artistUrn}
          onClick={() =>
            entry.artistUrn && navigate(`/user/${encodeURIComponent(entry.artistUrn)}`)
          }
          className="block max-w-full text-left text-[12px] text-ink-40 enabled:hover:text-ink-70 truncate enabled:cursor-pointer transition-colors"
        >
          {entry.artistName}
        </button>
      </div>
      <span className="relative shrink-0 text-right">
        <span className="block text-[13px] font-bold tabular-nums text-ink-80">
          {fmt.number(entry.plays)}
        </span>
        <span className="block text-[10px] text-ink-35">
          {t('stats.playsUnit', { count: entry.plays })}
        </span>
      </span>
    </div>
  );
});

export const TopTracks = memo(function TopTracks({
  tracks,
  delay,
}: {
  tracks: TopTrack[];
  delay?: number;
}) {
  const { t } = useTranslation();
  const queue = useMemo(() => tracks.map(topTrackToTrack), [tracks]);
  if (tracks.length === 0) return null;
  const max = tracks[0].plays || 1;
  const playAll = () => usePlayerStore.getState().play(queue[0], queue);
  return (
    <StatsPanel
      icon={<Trophy size={14} />}
      title={t('stats.topTracks')}
      delay={delay}
      aside={
        <button
          type="button"
          onClick={playAll}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent py-1.5 pr-3 pl-2.5 text-[11.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          <Play size={12} fill="currentColor" strokeWidth={0} />
          {t('stats.playAll')}
        </button>
      }
    >
      <div className="flex flex-col gap-0.5">
        {tracks.map((entry, i) => (
          <TrackRow
            key={entry.trackUrn}
            entry={entry}
            track={queue[i]}
            queue={queue}
            rank={i + 1}
            max={max}
          />
        ))}
      </div>
    </StatsPanel>
  );
});
