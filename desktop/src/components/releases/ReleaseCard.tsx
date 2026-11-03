import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { ago, art } from '../../lib/formatters';
import { Check, Music, pauseWhite14, playWhite14 } from '../../lib/icons';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { Avatar } from '../ui/Avatar';

export const ReleaseCard = memo(function ReleaseCard({
  track,
  queue,
  heard,
}: {
  track: Track;
  queue: Track[];
  heard: boolean;
}) {
  const { t } = useTranslation();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const cover = art(track.artwork_url, 't300x300');
  const age = ago(track.created_at || track.release_date);

  return (
    <div
      data-ui="track-card"
      onContextMenu={onContextMenu}
      onMouseEnter={() => preloadTrack(track)}
      onMouseLeave={cancelPreload}
      className="group relative select-none"
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`relative block aspect-square w-full cursor-pointer overflow-hidden rounded-[22px] bg-ink/[0.04] ring-1 transition-all duration-500 ease-[var(--ease-apple)] motion-safe:group-hover:-translate-y-0.5 ${
          isThis ? 'ring-accent/50' : 'ring-ink/[0.08] group-hover:ring-ink/[0.16]'
        } ${heard && !isThis ? 'opacity-70 group-hover:opacity-100' : ''}`}
        style={{ boxShadow: heard ? undefined : '0 14px 36px -14px var(--color-accent-glow)' }}
      >
        {cover ? (
          <img
            data-ui="artwork"
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-[var(--ease-apple)] motion-safe:group-hover:scale-[1.05]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-20">
            <Music size={32} />
          </span>
        )}
        <span
          data-scheme="dark"
          className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-300 ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            {isThisPlaying ? pauseWhite14 : playWhite14}
          </span>
        </span>
        {heard ? (
          <span
            title={t('releases.heard')}
            className="absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
          >
            <Check size={13} strokeWidth={3} />
          </span>
        ) : (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-accent-contrast shadow-[0_4px_14px_var(--color-accent-glow)]">
            {t('releases.new')}
          </span>
        )}
        {age && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {age}
          </span>
        )}
      </button>

      <div className="mt-2.5 flex items-start gap-2.5">
        <Avatar
          src={track.user.avatar_url}
          size={28}
          className="mt-0.5 rounded-full object-cover"
        />
        <TrackTitleArtist track={track} highlight={isThis} size="md" className="min-w-0 flex-1" />
        <LikeButton track={track} />
      </div>
    </div>
  );
});
