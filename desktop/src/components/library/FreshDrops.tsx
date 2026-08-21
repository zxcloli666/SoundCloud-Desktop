import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { preloadTrack } from '../../lib/audio';
import { ago, art } from '../../lib/formatters';
import {
  AudioLines,
  Loader2,
  Music,
  pauseWhite14,
  playWhite14,
  RefreshCw,
  Sparkles,
} from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { useTrackAura } from '../track/useTrackAura';
import { useFollowingDrops } from './useFollowingDrops';

function whenLabel(track: Track): string {
  return ago(track.created_at || track.release_date);
}

/** The newest drop, given the spotlight: big cover glowing in its own genre,
 *  a NEW badge and how long ago it landed. */
const FreshLead = memo(function FreshLead({ track, queue }: { track: Track; queue: Track[] }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const aura = useTrackAura(track.genre);
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(track.artwork_url, 't500x500');
  const when = whenLabel(track);

  return (
    <div
      className="relative flex items-center gap-5 p-4 rounded-[1.75rem] overflow-hidden"
      style={{
        border: `0.5px solid ${aura.accentSoft}`,
        background: `linear-gradient(120deg, ${aura.accentSoft}, rgba(255,255,255,0.015) 60%)`,
        boxShadow: perf.glow ? `0 0 50px ${aura.accentGlow}` : undefined,
      }}
    >
      <button
        type="button"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track.urn)}
        className="group relative shrink-0 w-[108px] h-[108px] md:w-[132px] md:h-[132px] rounded-2xl overflow-hidden ring-1 ring-white/10 cursor-pointer"
        style={{ boxShadow: `0 16px 42px ${aura.accentGlow}` }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
            <Music size={26} className="text-white/20" />
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-300 ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
            {isThisPlaying ? pauseWhite14 : playWhite14}
          </span>
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{ color: aura.accent, background: aura.accentSoft }}
          >
            {t('library.freshNew')}
          </span>
          {when && <span className="text-[11px] text-white/40 tabular-nums">{when}</span>}
        </div>
        <TrackTitleArtist track={track} highlight={isThis} size="lg" />
      </div>
    </div>
  );
});

const FreshDropRow = memo(function FreshDropRow({
  track,
  queue,
}: {
  track: Track;
  queue: Track[];
}) {
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(track.artwork_url, 't200x200');
  const when = whenLabel(track);

  return (
    <div
      className={`group flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-colors duration-200 ${
        isThis ? 'bg-white/[0.05]' : 'hover:bg-white/[0.035]'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track.urn)}
        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] cursor-pointer"
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
            <Music size={14} className="text-white/20" />
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isThisPlaying ? pauseWhite14 : playWhite14}
        </div>
      </button>

      <TrackTitleArtist
        track={track}
        highlight={isThis}
        size="md"
        className="flex flex-col justify-center"
      />

      {when && (
        <span className="text-[11px] text-white/30 tabular-nums shrink-0 w-10 text-right">
          {when}
        </span>
      )}
      <LikeButton track={track} />
    </div>
  );
});

/** "Fresh from who you follow" — the reason to come back. New uploads from the
 *  artists you actually chose, newest first, the latest one in the spotlight. */
export const FreshDrops = memo(function FreshDrops({ genre }: { genre?: string | null }) {
  const { t } = useTranslation();
  const { tracks: allTracks, isLoading, isFetching, hasFollowings, refetch } = useFollowingDrops();
  const tracks = useMemo(
    () => (genre ? allTracks.filter((tr) => tr.genre?.trim() === genre) : allTracks),
    [allTracks, genre],
  );

  const [lead, ...rest] = tracks;

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <span className="text-white/55">
          <Sparkles size={16} />
        </span>
        <h2 className="text-[16px] font-bold tracking-tight text-white/90">
          {t('library.freshFromFollowing')}
        </h2>
        <button
          type="button"
          onClick={refetch}
          disabled={isFetching}
          title={t('soundwave.refresh')}
          className="ml-1 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-white/15" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center py-14 px-6">
          <span className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white/25">
            <AudioLines size={24} />
          </span>
          <p className="text-white/40 text-sm max-w-[300px]">
            {hasFollowings ? t('library.freshQuiet') : t('library.freshEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lead && <FreshLead track={lead} queue={tracks} />}
          {rest.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {rest.slice(0, 10).map((track) => (
                <FreshDropRow key={track.urn} track={track} queue={tracks} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
