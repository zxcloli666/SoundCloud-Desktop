import React from 'react';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../lib/formatters';
import type { Playlist } from '../../lib/hooks';
import { Heart, ListMusic, Play, pauseBlack22 } from '../../lib/icons';
import type { Track } from '../../stores/player';
import { usePlayerStore } from '../../stores/player';

interface PlaylistCardProps {
  playlist: Playlist;
  /** Show play button, playlist type badge, likes count */
  showPlayback?: boolean;
}

export const PlaylistCard = React.memo(
  function PlaylistCard({ playlist, showPlayback }: PlaylistCardProps) {
    const navigate = useNavigate();
    const cover =
      art(playlist.artwork_url, 't300x300') ?? art(playlist.tracks?.[0]?.artwork_url, 't300x300');

    const trackUrns = React.useMemo(
      () => new Set((playlist.tracks ?? []).map((t: Track) => t.urn)),
      [playlist.tracks],
    );
    const isPlayingFromThis = usePlayerStore(
      (s) =>
        !!showPlayback &&
        s.isPlaying &&
        s.currentTrack != null &&
        trackUrns.has(s.currentTrack.urn),
    );
    const isPausedFromThis = usePlayerStore(
      (s) =>
        !!showPlayback &&
        !s.isPlaying &&
        s.currentTrack != null &&
        trackUrns.has(s.currentTrack.urn),
    );

    const handlePlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      const { play, pause, resume } = usePlayerStore.getState();
      if (isPlayingFromThis) {
        pause();
        return;
      }
      if (isPausedFromThis) {
        resume();
        return;
      }
      if (playlist.tracks && playlist.tracks.length > 0) {
        play(playlist.tracks[0], playlist.tracks);
      } else {
        navigate(`/playlist/${encodeURIComponent(playlist.urn)}`);
      }
    };

    return (
      <div
        className="group relative flex cursor-pointer select-none flex-col gap-3 rounded-[26px] p-2 transition-all duration-300 ease-[var(--ease-apple)] hover:bg-white/[0.045]"
        onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
      >
        <div className="liquid-surface relative aspect-square overflow-hidden rounded-[24px] transition-all duration-500 ease-[var(--ease-apple)] group-hover:scale-[1.015]">
          {cover ? (
            <img
              src={cover}
              alt={playlist.title}
              className="w-full h-full object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-[1.05]"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
              <ListMusic size={32} className="text-white/10" />
            </div>
          )}

          {/* Hover / playing overlay */}
          {showPlayback ? (
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                isPlayingFromThis
                  ? 'bg-black/26 backdrop-blur-[5px] opacity-100'
                  : 'bg-black/0 opacity-0 group-hover:bg-black/26 group-hover:backdrop-blur-[5px] group-hover:opacity-100'
              }`}
            >
              <div
                onClick={handlePlay}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ease-[var(--ease-apple)] shadow-2xl hover:scale-110 active:scale-95 ${
                  isPlayingFromThis
                    ? 'liquid-button-primary text-accent-contrast scale-100'
                    : 'liquid-control text-white scale-75 group-hover:scale-100'
                }`}
              >
                {isPlayingFromThis ? (
                  pauseBlack22
                ) : (
                  <Play size={22} fill="black" strokeWidth={0} className="ml-1" />
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/24 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          )}

          {playlist.track_count != null && (
            <div
              className={`liquid-chip absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/90 ${
                showPlayback
                  ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                  : ''
              }`}
            >
              <ListMusic size={11} />
              {playlist.track_count}
            </div>
          )}
        </div>

        <div className="min-w-0 px-1">
          <p className="text-[14px] font-semibold text-white/90 truncate leading-snug group-hover:text-white transition-colors duration-200">
            {playlist.title}
          </p>
          {showPlayback ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider bg-white/[0.05] px-1.5 py-0.5 rounded-md">
                {playlist.playlist_type || 'Playlist'}
              </span>
              {playlist.likes_count > 0 && (
                <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1">
                  <Heart size={10} className="text-white/20" />
                  {fc(playlist.likes_count)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-white/40 truncate mt-1">
              {playlist.user?.username || 'Unknown'}
            </p>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.playlist.urn === next.playlist.urn && prev.showPlayback === next.showPlayback,
);
