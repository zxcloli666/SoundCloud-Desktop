import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {art, dur} from '../../../lib/formatters';
import {pauseWhite12, playWhite12} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {ClusterFeedbackProvider} from '../../../lib/recsFeedback';
import {useTrackContextMenu} from '../../../lib/useTrackContextMenu';
import {useTrackPlay} from '../../../lib/useTrackPlay';
import type {Track} from '../../../stores/player';
import {LikeButton} from '../../music/LikeButton';
import {PlayNextButton} from '../../music/PlayNextButton';

const SCHEDULE_SIZE = 10;
const FRESH_WINDOW_MS = 14 * 24 * 3600 * 1000;

export function isFreshTrack(track: Track): boolean {
  const stamp = track.release_date ?? track.created_at;
  if (!stamp) return false;
  const ts = Date.parse(stamp);
  return Number.isFinite(ts) && Date.now() - ts < FRESH_WINDOW_MS;
}

const PlayingEq = React.memo(function PlayingEq() {
  const perf = usePerfMode();
  if (!perf.idleAnim) return null;
  return (
    <span className="inline-flex h-[11px] flex-none items-end gap-[2px]" aria-hidden>
      {['-0.2s', '-0.5s', '-0.05s'].map((d) => (
        <i
          key={d}
          className="riv-anim w-[2.5px] origin-bottom rounded-[1px]"
          style={{
            height: '100%',
            background: 'var(--color-accent)',
            animation: `riv-eq 0.8s ease-in-out ${d} infinite alternate`,
          }}
        />
      ))}
    </span>
  );
});

export const ScheduleRow = React.memo(function ScheduleRow({
  track,
  index,
  queue,
  leading,
}: {
  track: Track;
  index: number;
  queue: Track[];
  /** Текст вместо номера (например, дата релиза в «верховьях»). */
  leading?: string;
}) {
  const { t } = useTranslation();
  const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const cover = art(track.artwork_url, 't200x200');

  return (
    <div
      onContextMenu={onContextMenu}
      className={`group relative flex items-center gap-3.5 rounded-xl border py-2 pl-2.5 pr-3 transition-colors ${
        isThisPlaying
          ? 'border-[var(--color-accent-glow)]'
          : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]'
      }`}
      style={isThisPlaying ? { background: 'var(--color-accent-glow)' } : undefined}
    >
      {isThisPlaying && (
        <span
          className="absolute bottom-2.5 left-0 top-2.5 w-[2.5px] rounded-[2px]"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
      <span
        className={`flex-none text-right font-mono text-[11px] tabular-nums ${leading ? 'w-12 truncate' : 'w-7'} ${
          isThisPlaying ? 'text-[var(--color-accent-hover)]' : 'text-white/30'
        }`}
      >
        {leading ?? String(index + 1).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={togglePlay}
        className="relative size-11 flex-none cursor-pointer overflow-hidden rounded-lg ring-1 ring-white/[0.08]"
        aria-label={track.title}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="size-full object-cover"
            decoding="async"
            loading="lazy"
          />
        ) : (
          <span className="block size-full bg-white/[0.04]" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {isThisPlaying ? pauseWhite12 : playWhite12}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[13.5px] font-medium leading-tight text-white/88">
          <span className="truncate">{track.title}</span>
          {isThisPlaying && <PlayingEq />}
          {!isThisPlaying && isFreshTrack(track) && (
            <span className="flex-none rounded-[5px] border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-px text-[9px] font-bold tracking-[0.1em] text-emerald-200/90">
              {t('soundwave.river.freshBadge')}
            </span>
          )}
        </p>
        <p className="mt-px truncate text-[12px] leading-tight text-white/40">
          {track.user.username}
        </p>
      </div>
      <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <LikeButton track={track} />
        <PlayNextButton
          track={track}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200 shrink-0"
        />
      </div>
      <span className="w-9 flex-none text-right font-mono text-[11.5px] text-white/30 tabular-nums">
        {dur(track.duration)}
      </span>
    </div>
  );
});

/** «Волна» — программа эфира: плотный нумерованный список в 2 колонки. */
export const WaveSchedule = React.memo(function WaveSchedule({ tracks }: { tracks: Track[] }) {
  const ctx = useMemo(() => ({ clusterId: 'wave' }), []);
  const items = tracks.slice(0, SCHEDULE_SIZE);
  return (
    <ClusterFeedbackProvider value={ctx}>
      <div className="grid gap-x-7 gap-y-1.5 lg:grid-cols-2">
        {items.map((track, i) => (
          <ScheduleRow key={track.urn} track={track} index={i} queue={tracks} />
        ))}
      </div>
    </ClusterFeedbackProvider>
  );
});
