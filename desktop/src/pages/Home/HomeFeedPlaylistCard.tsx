import { ListMusic, Loader2, Pause, Play, Repeat2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import type { FeedItem } from '../../lib/hooks.ts';
import { replaceArtSize, toRelativeTime } from '../../lib/utils.ts';
import { type Track, usePlayerStore } from '../../stores/player.ts';

const FeedPlaylistCardBase = ({ item }: { item: FeedItem }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { play, pause, resume, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      play: s.play,
      pause: s.pause,
      resume: s.resume,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );
  const [loading, setLoading] = useState(false);
  const origin = item.origin;
  const isRepost = item.type.includes('repost');
  const cover = replaceArtSize(origin.artwork_url, 't300x300');

  // Check if any track from this playlist is currently playing
  const isPlayingFromThis = currentTrack
    ? origin.tracks?.some?.((t: Track) => t.urn === currentTrack.urn)
    : false;

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlayingFromThis && isPlaying) {
      pause();
      return;
    }
    if (isPlayingFromThis) {
      resume();
      return;
    }

    // If inline tracks are available, use them directly
    if (origin.tracks && origin.tracks.length > 0) {
      play(origin.tracks[0], origin.tracks);
      return;
    }

    // Fetch tracks from API
    setLoading(true);
    try {
      const data = await import('../../lib/api.ts').then((m) =>
        m.api<{ collection: Track[] }>(`/playlists/${encodeURIComponent(origin.urn)}/tracks`),
      );
      const tracks = data.collection;
      if (tracks.length > 0) {
        play(tracks[0], tracks);
      }
    } catch {
      // fallback: navigate to playlist page
      navigate(`/playlist/${encodeURIComponent(origin.urn)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`group glass rounded-2xl p-3 flex items-center gap-3.5 transition-all duration-300 ease-[var(--ease-apple)] ${
        isPlayingFromThis ? 'ring-1 ring-accent/20 bg-accent/[0.02]' : 'hover:bg-white/[0.035]'
      }`}
    >
      {/* Artwork */}
      <div
        className="relative w-[76px] h-[76px] rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
        onClick={handlePlay}
      >
        {cover ? (
          <img src={cover} alt={origin.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
            <ListMusic size={22} className="text-white/15" />
          </div>
        )}

        {/* Play overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isPlayingFromThis && isPlaying
              ? 'bg-black/30 opacity-100'
              : 'bg-black/0 opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
          }`}
        >
          {loading ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ease-[var(--ease-apple)] ${
                isPlayingFromThis && isPlaying
                  ? 'bg-white scale-100'
                  : 'bg-white/90 scale-75 group-hover:scale-100'
              }`}
            >
              {isPlayingFromThis && isPlaying ? (
                <Pause size={14} fill="black" strokeWidth={0} />
              ) : (
                <Play size={14} fill="black" strokeWidth={0} className="ml-px" />
              )}
            </div>
          )}
        </div>

        {/* Track count pill */}
        {origin.track_count != null && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-medium bg-black/50 backdrop-blur-md text-white/70 px-1.5 py-0.5 rounded-full">
            <ListMusic size={8} />
            {origin.track_count}
          </div>
        )}
      </div>

      {/* Playlist info */}
      <div className="flex-1 min-w-0">
        {isRepost && (
          <div className="flex items-center gap-1 mb-1 text-[10px] text-white/20 font-medium">
            <Repeat2 size={9} />
            <span>{t('home.reposted')}</span>
          </div>
        )}
        <p
          className="text-[13px] font-medium text-white/90 truncate leading-snug cursor-pointer hover:text-white transition-colors duration-150"
          onClick={() => navigate(`/playlist/${encodeURIComponent(origin.urn)}`)}
        >
          {origin.title}
        </p>
        <p
          className="text-[11px] text-white/35 truncate mt-0.5 cursor-pointer hover:text-white/55 transition-colors duration-150"
          onClick={() =>
            origin.user?.urn && navigate(`/user/${encodeURIComponent(origin.user.urn)}`)
          }
        >
          {origin.user?.username}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/20">
          <span className="flex items-center gap-0.5">
            <ListMusic size={9} />
            {origin.track_count ?? 0} {t('search.tracks').toLowerCase()}
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="text-right shrink-0 self-center">
        <p className="text-[10px] text-white/15">{toRelativeTime(item.created_at)}</p>
      </div>
    </div>
  );
};

export const FeedPlaylistCard = React.memo(FeedPlaylistCardBase);
