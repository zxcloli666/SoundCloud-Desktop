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
        className="group relative flex flex-col gap-3 cursor-pointer select-none"
        onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.02] ring-1 ring-white/[0.06] shadow-lg group-hover:shadow-2xl group-hover:ring-white/[0.15] transition-all duration-500 ease-[var(--ease-apple)]">
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
                  ? 'bg-black/40 backdrop-blur-sm opacity-100'
                  : 'bg-black/0 opacity-0 group-hover:bg-black/40 group-hover:backdrop-blur-sm group-hover:opacity-100'
              }`}
            >
              <div
                onClick={handlePlay}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ease-[var(--ease-apple)] shadow-2xl hover:scale-110 active:scale-95 ${
                  isPlayingFromThis
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover:scale-100'
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
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          )}

          {playlist.track_count != null && (
            <div
              className={`absolute bottom-2.5 right-2.5 flex items-center gap-1.5 text-[11px] font-medium bg-black/60 backdrop-blur-md text-white/90 px-2.5 py-1 rounded-full shadow-lg ${
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
