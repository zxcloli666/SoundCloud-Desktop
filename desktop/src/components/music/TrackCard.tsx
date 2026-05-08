import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import { ListMusic, ListPlus, pauseBlack20, playBlack20, playIcon32 } from '../../lib/icons';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { usePlayerStore } from '../../stores/player';
import { AddToPlaylistDialog } from './AddToPlaylistDialog';
import { LikeButton } from './LikeButton';

interface TrackCardProps {
  track: Track;
  queue?: Track[];
}

export const TrackCard = React.memo(
  function TrackCard({ track, queue }: TrackCardProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const addToQueueNext = usePlayerStore((s) => s.addToQueueNext);
    const artwork = art(track.artwork_url, 't300x300');

    const handleAddToQueue = (e: React.MouseEvent) => {
      e.stopPropagation();
      addToQueueNext([track]);
    };

    return (
      <div
        className="group relative rounded-[26px] p-2 select-none transition-all duration-300 ease-[var(--ease-apple)] hover:bg-white/[0.045]"
        onMouseEnter={() => preloadTrack(track.urn)}
        style={{
          contentVisibility: 'auto',
          contain: 'layout paint style',
          containIntrinsicSize: '180px 260px',
        }}
      >
        {/* Artwork */}
        <div
          className="liquid-surface relative aspect-square cursor-pointer overflow-hidden rounded-[24px] transition-all duration-300 ease-[var(--ease-apple)] group-hover:scale-[1.015]"
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
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
              isThisPlaying
                ? 'bg-black/24 backdrop-blur-[5px] opacity-100'
                : 'bg-black/0 opacity-0 group-hover:bg-black/24 group-hover:backdrop-blur-[5px] group-hover:opacity-100'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-[var(--ease-apple)] shadow-xl ${
                isThisPlaying
                  ? 'liquid-button-primary text-accent-contrast scale-100'
                  : 'liquid-control text-white scale-75 group-hover:scale-100'
              }`}
            >
              {isThisPlaying ? pauseBlack20 : playBlack20}
            </div>
          </div>

          {/* Duration pill */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="liquid-chip rounded-full px-2 py-0.5 text-[10px] font-medium text-white/86">
              {dur(track.duration)}
            </div>
          </div>

          {/* Like button — top left */}
          <LikeButton track={track} variant="overlay" />

          {/* Top right: add to playlist + add to queue */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <AddToPlaylistDialog trackUrns={[track.urn]}>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="liquid-control flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-all duration-200 hover:text-white"
                title={t('playlist.addToPlaylist')}
              >
                <ListPlus size={14} />
              </button>
            </AddToPlaylistDialog>
            <button
              type="button"
              onClick={handleAddToQueue}
              className="liquid-control flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-all duration-200 hover:text-white"
              title={t('player.addToQueue')}
            >
              <ListMusic size={14} />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-3 min-w-0">
          <p
            className="text-[13px] font-medium text-white/90 truncate leading-snug cursor-pointer hover:text-white transition-colors duration-150"
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[11px] text-white/35 truncate mt-0.5 cursor-pointer hover:text-white/55 transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
          {track.playback_count != null && (
            <p className="text-[10px] text-white/20 mt-1 tabular-nums">
              {fc(track.playback_count)} plays
            </p>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn && prev.track.user_favorite === next.track.user_favorite,
);
