import {Lock} from 'lucide-react';
import React from 'react';
import {useTranslation} from 'react-i18next';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import {
  headphones11,
  heart11,
  Music,
  pauseWhite14,
  playWhite14,
} from '../../lib/icons';
import { useRowPick } from '../../lib/useRowPick';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import { useAuthStore } from '../../stores/auth';
import type { Track } from '../../stores/player';
import { AddToPlaylistButton } from '../music/AddToPlaylistButton';
import { useTrackColumns } from '../music/columns/TrackColumns';
import { LikeButton } from '../music/LikeButton';
import { PlayNextButton } from '../music/PlayNextButton';
import {SaveOfflineRowButton} from '../music/SaveOfflineButton';
import {sameScdMeta, sameVideos} from '../../lib/track-rating';
import {TrackRating} from '../music/TrackRating';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { OwnerTrackMenu } from '../track/OwnerTrackMenu';

interface ThemedTrackRowProps {
  track: Track;
  index: number;
  queue: Track[];
}

function ThemedTrackRowImpl({ track, index, queue }: ThemedTrackRowProps) {
    const {t} = useTranslation();
  const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const pick = useRowPick(track);
  const cover = art(track.artwork_url, 't200x200');
  const columns = useTrackColumns();
  const isOwner = useAuthStore((s) => !!s.user?.urn && s.user.urn === track.user?.urn);

  return (
    <div {...mark}
      onContextMenu={onContextMenu}
      {...pick}
      className={`@container group flex select-none items-center gap-4 rounded-2xl px-4 py-2.5 transition-colors duration-200 ${isThis ? 'bg-accent/[0.07] ring-1 ring-accent/20' : 'hover:bg-ink/[0.04]'}`}
      onMouseEnter={() => preloadTrack(track)}
      onMouseLeave={cancelPreload}
    >
      <div
        className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer relative"
        onClick={togglePlay}
      >
        {isThisPlaying ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-contrast">
            {pauseWhite14}
          </div>
        ) : (
          <>
            <span className="text-[12px] text-ink-25 tabular-nums font-semibold group-hover:opacity-0 transition-opacity">
              {index + 1}
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/10">
                {playWhite14}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/[0.08]"
      >
        {cover ? (
          <img data-ui="artwork" src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink/[0.04]">
            <Music size={16} className="text-ink-20" />
          </div>
        )}
          {track.sharing === 'private' && (
              <div
                  title={t('sharing.private')}
                  aria-label={t('sharing.private')}
                  className="absolute top-0.5 left-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-shade-65 text-ink-90"
              >
                  <Lock size={9}/>
              </div>
        )}
      </div>

      <TrackTitleArtist track={track} highlight={isThis} size="md" className="flex-1 min-w-0" />

      <TrackRating meta={track._scd_meta} videos={track.videos} />

      {columns.plays > 0 && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-ink-35"
          style={{ width: columns.plays }}
        >
          {track.playback_count != null && (
            <>
              {headphones11} {fc(track.playback_count)}
            </>
          )}
        </span>
      )}

      {columns.likes > 0 && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-ink-35"
          style={{ width: columns.likes }}
        >
          {(track.favoritings_count ?? track.likes_count) != null && (
            <>
              {heart11} {fc(track.favoritings_count ?? track.likes_count)}
            </>
          )}
        </span>
      )}

      <div className="flex shrink-0 items-center justify-end gap-0.5" style={{ width: columns.actions }}>
        <LikeButton track={track} />
        <SaveOfflineRowButton track={track} />
        <AddToPlaylistButton
          track={track}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.06] opacity-0 group-hover:opacity-100 transition-all"
        />
        <PlayNextButton
          track={track}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.06] opacity-0 group-hover:opacity-100 transition-all"
        />
        {isOwner && <OwnerTrackMenu track={track} />}
      </div>

      <span className="text-[12px] text-ink-30 tabular-nums font-medium shrink-0 w-12 text-right">
        {dur(track.duration)}
      </span>
    </div>
  );
}

const areEqual = (prev: ThemedTrackRowProps, next: ThemedTrackRowProps) =>
  prev.track.urn === next.track.urn &&
  prev.index === next.index &&
    prev.track.user_favorite === next.track.user_favorite &&
    prev.track.sharing === next.track.sharing &&
    prev.track.title === next.track.title &&
    prev.track.description === next.track.description &&
    prev.track.genre === next.track.genre &&
    prev.track.tag_list === next.track.tag_list &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
    sameVideos(prev.track.videos, next.track.videos);

export const ThemedTrackRow = React.memo(ThemedTrackRowImpl, areEqual);
