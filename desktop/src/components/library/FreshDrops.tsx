import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cancelPreload, preloadTrack } from '../../lib/audio';
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
import { glowColors, litStyle } from '../../lib/page-glow';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { ReleaseActions } from '../releases/ReleaseActions';
import { genreColor } from '../search/utils';
import { useFollowingDrops } from './useFollowingDrops';

function whenLabel(track: Track): string {
  return ago(track.created_at || track.release_date);
}

const FreshLead = memo(function FreshLead({
  track,
  queue,
  heard,
}: {
  track: Track;
  queue: Track[];
  heard: boolean;
}) {
  const { t } = useTranslation();
  const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const cover = art(track.artwork_url, 't500x500');
  const when = whenLabel(track);
  const glow = useMemo(() => litStyle(glowColors([genreColor(track.genre)])), [track.genre]);

  return (
    <div
      {...mark}
      onContextMenu={onContextMenu}
      className="panel lit relative flex items-center gap-5 rounded-3xl p-4"
      style={glow}
    >
      <button
        type="button"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track)}
        onMouseLeave={cancelPreload}
        className="group relative h-[108px] w-[108px] shrink-0 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-ink/[0.08] md:h-[132px] md:w-[132px]"
      >
        {cover ? (
          <img
            data-ui="artwork"
            src={cover}
            alt=""
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink/[0.04]">
            <Music size={26} className="text-ink-20" />
          </div>
        )}
        <div
          data-scheme="dark"
          className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-300 ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/15">
            {isThisPlaying ? pauseWhite14 : playWhite14}
          </span>
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
              heard ? 'bg-ink/[0.07] text-ink-50' : 'bg-accent/15 text-accent'
            }`}
          >
            {heard ? t('releases.heard') : t('library.freshNew')}
          </span>
          {when && <span className="text-[11px] tabular-nums text-ink-40">{when}</span>}
        </div>
        <TrackTitleArtist track={track} highlight={isThis} size="lg" />
      </div>
    </div>
  );
});

const FreshDropRow = memo(function FreshDropRow({
  track,
  queue,
  heard,
}: {
  track: Track;
  queue: Track[];
  heard: boolean;
}) {
  const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const cover = art(track.artwork_url, 't200x200');
  const when = whenLabel(track);

  return (
    <div
      {...mark}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-colors duration-200 ${
        isThis ? 'bg-ink/[0.05]' : 'hover:bg-ink/[0.035]'
      } ${heard && !isThis ? 'opacity-60 hover:opacity-100' : ''}`}
    >
      <button
        type="button"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track)}
        onMouseLeave={cancelPreload}
        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-ink/[0.08] cursor-pointer"
      >
        {cover ? (
          <img src={cover} alt="" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink/[0.04]">
            <Music size={14} className="text-ink-20" />
          </div>
        )}
        <div
          data-scheme="dark"
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
        <span className="text-[11px] text-ink-30 tabular-nums shrink-0 w-10 text-right">
          {when}
        </span>
      )}
      <LikeButton track={track} />
    </div>
  );
});

export const FreshDrops = memo(function FreshDrops({ genre }: { genre?: string | null }) {
  const { t } = useTranslation();
  const {
    tracks: allTracks,
    heard,
    unheard,
    isLoading,
    isFetching,
    hasFollowings,
    refetch,
  } = useFollowingDrops();
  const tracks = useMemo(
    () => (genre ? allTracks.filter((tr) => tr.genre?.trim() === genre) : allTracks),
    [allTracks, genre],
  );

  const [lead, ...rest] = tracks;

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <span className="text-ink-55">
          <Sparkles size={16} />
        </span>
        <h2 className="text-[16px] font-bold tracking-tight text-ink-90">
          {t('library.freshFromFollowing')}
        </h2>
        {unheard > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-accent-contrast">
            {unheard}
          </span>
        )}
        <button
          type="button"
          onClick={refetch}
          disabled={isFetching}
          title={t('soundwave.refresh')}
          className="ml-1 w-7 h-7 rounded-full flex items-center justify-center text-ink-40 hover:text-ink-80 hover:bg-ink/[0.06] transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
        <span className="flex-1" />
        <ReleaseActions tracks={tracks} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-ink-15" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center py-14 px-6">
          <span className="w-14 h-14 rounded-2xl bg-ink/[0.04] flex items-center justify-center text-ink-25">
            <AudioLines size={24} />
          </span>
          <p className="text-ink-40 text-sm max-w-[300px]">
            {hasFollowings ? t('library.freshQuiet') : t('library.freshEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lead && <FreshLead track={lead} queue={tracks} heard={heard.has(lead.urn)} />}
          {rest.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {rest.map((track) => (
                <FreshDropRow
                  key={track.urn}
                  track={track}
                  queue={tracks}
                  heard={heard.has(track.urn)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
