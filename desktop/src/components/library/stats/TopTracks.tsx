import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgb, auraRgba, isLight } from '../../../lib/aura';
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
  aura,
}: {
  entry: TopTrack;
  track: Track;
  queue: Track[];
  rank: number;
  max: number;
  aura: Aura;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useStatsFormat();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(entry.artworkUrl, 't200x200');
  const lead = rank === 1;
  return (
    <div
      className="group relative flex items-center gap-3 px-2 py-2 rounded-2xl overflow-hidden transition-colors hover:bg-white/[0.04]"
      style={isThis ? { background: auraRgba(aura, 0.1) } : undefined}
    >
      <div
        aria-hidden
        className="absolute inset-y-1 left-0 rounded-2xl pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100"
        style={{
          width: `${(entry.plays / max) * 100}%`,
          background: `linear-gradient(90deg, transparent, ${auraRgba(aura, lead ? 0.16 : 0.08)})`,
        }}
      />
      <span
        className="relative w-6 text-right text-[13px] font-black tabular-nums"
        style={{ color: lead ? auraRgb(aura) : 'rgba(255,255,255,0.3)' }}
      >
        {rank}
      </span>
      <button
        type="button"
        onClick={togglePlay}
        className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md cursor-pointer"
      >
        {cover ? (
          <img src={cover} alt="" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
            <Music size={14} className="text-white/20" />
          </div>
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${
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
          className="block max-w-full text-left text-[13.5px] font-semibold text-white/90 hover:text-white truncate cursor-pointer transition-colors"
        >
          {entry.title}
        </button>
        <button
          type="button"
          disabled={!entry.artistUrn}
          onClick={() =>
            entry.artistUrn && navigate(`/user/${encodeURIComponent(entry.artistUrn)}`)
          }
          className="block max-w-full text-left text-[12px] text-white/40 enabled:hover:text-white/70 truncate enabled:cursor-pointer transition-colors"
        >
          {entry.artistName}
        </button>
      </div>
      <span className="relative shrink-0 text-right">
        <span className="block text-[13px] font-bold tabular-nums text-white/80">
          {fmt.number(entry.plays)}
        </span>
        <span className="block text-[10px] text-white/30">
          {t('stats.playsUnit', { count: entry.plays })}
        </span>
      </span>
    </div>
  );
});

export const TopTracks = memo(function TopTracks({
  tracks,
  aura,
  delay,
}: {
  tracks: TopTrack[];
  aura: Aura;
  delay?: number;
}) {
  const { t } = useTranslation();
  const queue = useMemo(() => tracks.map(topTrackToTrack), [tracks]);
  if (tracks.length === 0) return null;
  const max = tracks[0].plays || 1;
  const playAll = () => usePlayerStore.getState().play(queue[0], queue);
  return (
    <StatsPanel
      aura={aura}
      icon={<Trophy size={14} />}
      title={t('stats.topTracks')}
      delay={delay}
      aside={
        <button
          type="button"
          onClick={playAll}
          className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-[11.5px] font-bold cursor-pointer transition-transform duration-300 hover:scale-[1.04] active:scale-95"
          style={{
            color: isLight(aura) ? '#0a0a0c' : '#fff',
            background: `radial-gradient(125% 125% at 30% 22%, ${aura.orbs[1]}, ${aura.orbs[0]} 70%)`,
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.2), 0 6px 18px ${auraRgba(aura, 0.35)}`,
          }}
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
            aura={aura}
          />
        ))}
      </div>
    </StatsPanel>
  );
});
