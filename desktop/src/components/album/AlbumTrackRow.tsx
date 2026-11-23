import { memo } from 'react';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import { headphones11, heart11, ListPlus, Music, pauseWhite14, playWhite14 } from '../../lib/icons';
import { useRowPick } from '../../lib/useRowPick';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { AddToPlaylistDialog } from '../music/AddToPlaylistDialog';
import { useTrackColumns } from '../music/columns/TrackColumns';
import { LikeButton } from '../music/LikeButton';
import { PlayNextButton } from '../music/PlayNextButton';
import { SaveOfflineRowButton } from '../music/SaveOfflineButton';
import { sameScdMeta, sameVideos, TrackStatusBadges } from '../music/TrackStatusBadges';
import { TrackTitleArtist } from '../music/TrackTitleArtist';

interface AlbumTrackRowProps {
  track: Track;
  position: number;
  queue: Track[];
}

function AlbumTrackRowImpl({ track, position, queue }: AlbumTrackRowProps) {
  const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue);
  const onContextMenu = useTrackContextMenu(track);
  const pick = useRowPick(track);
  const columns = useTrackColumns();
  const cover = art(track.artwork_url, 't200x200');

  return (
    <div
      {...mark}
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
            <span className="text-[13px] text-ink-30 tabular-nums font-semibold group-hover:opacity-0 transition-opacity">
              {position}
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/10">
                {playWhite14}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink/[0.08]">
        {cover ? (
          <img
            data-ui="artwork"
            src={cover}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink/[0.04]">
            <Music size={14} className="text-ink-20" />
          </div>
        )}
      </div>

      <TrackTitleArtist track={track} highlight={isThis} size="md" className="flex-1 min-w-0" />

      {columns.badges && (
        <div className="flex shrink-0">
          <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
        </div>
      )}

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

      <div
        className="flex shrink-0 items-center justify-end gap-0.5"
        style={{ width: columns.actions }}
      >
        <LikeButton track={track} />
        <SaveOfflineRowButton track={track} />
        <AddToPlaylistDialog trackUrns={[track.urn]}>
          <button
            type="button"
            className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.06] opacity-0 group-hover:opacity-100 transition-all"
          >
            <ListPlus size={14} />
          </button>
        </AddToPlaylistDialog>
        <PlayNextButton
          track={track}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.06] opacity-0 group-hover:opacity-100 transition-all"
        />
      </div>

      <span className="text-[12px] text-ink-30 tabular-nums font-medium shrink-0 w-12 text-right">
        {dur(track.duration)}
      </span>
    </div>
  );
}

const areEqual = (prev: AlbumTrackRowProps, next: AlbumTrackRowProps) =>
  prev.track.urn === next.track.urn &&
  prev.position === next.position &&
  prev.track.user_favorite === next.track.user_favorite &&
  sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
  sameVideos(prev.track.videos, next.track.videos);

export const AlbumTrackRow = memo(AlbumTrackRowImpl, areEqual);
