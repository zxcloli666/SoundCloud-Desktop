import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {cancelPreload, preloadTrack} from '../../lib/audio';
import {art, dur, fc} from '../../lib/formatters';
import {ListMusic, ListPlus, pauseBlack20, playBlack20, playIcon32} from '../../lib/icons';
import {recordClusterFeedback, setUrnCluster, useClusterFeedback} from '../../lib/recsFeedback';
import {useArtistDisplay, useArtistLinkItems, useDisplayTitle} from '../../lib/track-display';
import {useAutoHide} from '../../lib/useAutoHide';
import {useTrackPlay} from '../../lib/useTrackPlay';
import type {Track} from '../../stores/player';
import {usePlayerStore} from '../../stores/player';
import {AddToPlaylistDialog} from './AddToPlaylistDialog';
import {ArtistNameLinks} from './ArtistNameLinks';
import {LikeButton} from './LikeButton';
import {TrackStatusBadges} from './TrackStatusBadges';
import {UploadKindDot} from './UploadKindDot';

interface TrackCardProps {
  track: Track;
  queue?: Track[];
  /** Fires after a new track starts — e.g. arm «лайки до конца». Keep stable. */
  onPlay?: () => void;
}

export const TrackCard = React.memo(
  function TrackCard({ track, queue, onPlay }: TrackCardProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isThisPlaying, togglePlay: togglePlayRaw } = useTrackPlay(track, queue, onPlay);
    const showPlayingOverlay = useAutoHide(isThisPlaying);
    const clusterId = useClusterFeedback();
    const togglePlay = React.useCallback(() => {
      if (clusterId) {
        setUrnCluster(track.urn, clusterId);
        recordClusterFeedback(clusterId, 'click');
      }
      togglePlayRaw();
    }, [clusterId, track.urn, togglePlayRaw]);
    const addToQueueNext = usePlayerStore((s) => s.addToQueueNext);
    const artwork = art(track.artwork_url, 't300x300');
    const artistDisplay = useArtistDisplay(track);
    const displayTitle = useDisplayTitle(track);
    const artistLinks = useArtistLinkItems(track);
    const isWanted = artistDisplay.availability !== 'indexed';

    const handleAddToQueue = (e: React.MouseEvent) => {
      e.stopPropagation();
      addToQueueNext([track]);
    };

    return (
      <div
        className="group relative select-none"
        onMouseEnter={() => preloadTrack(track.urn)}
        onMouseLeave={cancelPreload}
        style={{ contain: 'layout paint style' }}
      >
        {/* Artwork */}
        <div
          className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.03] cursor-pointer ring-1 ring-white/[0.06] group-hover:ring-white/[0.12] transition-all duration-300 ease-[var(--ease-apple)]"
          onClick={togglePlay}
        >
          {artwork ? (
            <img
              src={artwork}
              alt={track.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-[1.04]"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              {playIcon32}
            </div>
          )}

          {/* Hover overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:bg-black/30 group-hover:backdrop-blur-[2px] group-hover:opacity-100 ${
              showPlayingOverlay
                ? 'bg-black/30 backdrop-blur-[2px] opacity-100'
                : 'bg-black/0 opacity-0'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-[var(--ease-apple)] shadow-xl group-hover:scale-100 ${
                showPlayingOverlay ? 'bg-white scale-100' : 'bg-white/90 scale-75'
              }`}
            >
              {isThisPlaying ? pauseBlack20 : playBlack20}
            </div>
          </div>

          {/* Duration pill */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="text-[10px] font-medium bg-black/50 backdrop-blur-md text-white/80 px-2 py-0.5 rounded-full">
              {dur(track.duration)}
            </div>
          </div>

          {/* Cache / analysis badges — bottom left */}
          <div className="absolute bottom-2 left-2 flex">
            <TrackStatusBadges meta={track._scd_meta} variant="overlay" />
          </div>

          {/* Like button — top left */}
          <LikeButton track={track} variant="overlay" />

          {/* Top right: add to playlist + add to queue */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <AddToPlaylistDialog trackUrns={[track.urn]}>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all duration-200"
                title={t('playlist.addToPlaylist')}
              >
                <ListPlus size={14} />
              </button>
            </AddToPlaylistDialog>
            <button
              type="button"
              onClick={handleAddToQueue}
              className="cursor-pointer w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all duration-200"
              title={t('player.addToQueue')}
            >
              <ListMusic size={14} />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-3 min-w-0">
          <p
            className={`text-[13px] font-medium truncate leading-snug ${isWanted ? 'text-white/55' : 'text-white/90 cursor-pointer hover:text-white'} transition-colors duration-150`}
            onClick={
              isWanted ? undefined : () => navigate(`/track/${encodeURIComponent(track.urn)}`)
            }
          >
            {displayTitle}
          </p>
          <p
            className={`text-[11px] truncate mt-0.5 flex items-center gap-1 ${
              isWanted ? 'text-white/30' : 'text-white/35'
            } transition-colors duration-150`}
          >
            <UploadKindDot kind={artistDisplay.uploadKind} />
            <span className="truncate">
              {isWanted ? (
                artistDisplay.primary
              ) : (
                <ArtistNameLinks
                  items={artistLinks}
                  linkClassName="cursor-pointer transition-colors hover:text-white/60"
                />
              )}
            </span>
          </p>
          {isWanted ? (
            <p className="text-[10px] text-white/25 mt-1">
              {t('track.notFoundOnSc', 'not found on SoundCloud')}
            </p>
          ) : (
            track.playback_count != null && (
              <p className="text-[10px] text-white/20 mt-1 tabular-nums">
                {fc(track.playback_count)} plays
              </p>
            )
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.track.user_favorite === next.track.user_favorite &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    prev.track._scd_meta?.storage_state === next.track._scd_meta?.storage_state &&
    prev.track._scd_meta?.storage_quality === next.track._scd_meta?.storage_quality &&
    prev.track._scd_meta?.index_state === next.track._scd_meta?.index_state,
);
