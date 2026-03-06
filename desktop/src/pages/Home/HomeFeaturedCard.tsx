import { Headphones, Heart, Music, Pause, Play, Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { FeedItem } from '../../api/index.ts';
import type { Track } from '../../api/types.ts';
import { ScdnImg } from '../../components/common/ScdnImg.tsx';
import { preloadTrack, useTrackPlayback } from '../../features/playback/index.ts';
import { replaceArtSize, toCompactCount, toMinSec, toRelativeTime } from '../../lib/utils.ts';

export function FeaturedCard({ item, queue }: { item: FeedItem; queue: Track[] }) {
  const { t } = useTranslation();

  const navigate = useNavigate();
  const track = item.origin as Track;
  const isRepost = item.type.includes('repost');
  const cover = replaceArtSize(track.artwork_url);
  const avatar = replaceArtSize(track.user.avatar_url, 'small');

  const { isCurrentPlaying, togglePlay } = useTrackPlayback(track, queue);

  return (
    <div
      className="relative rounded-3xl overflow-hidden group glass-featured animate-fade-in-up"
      onMouseEnter={() => preloadTrack(track.urn)}
    >
      {/* Blurred artwork background */}
      {cover && (
        <div className="absolute inset-0 pointer-events-none">
          <ScdnImg
            src={cover}
            alt=""
            className="w-full h-full object-cover scale-[1.4] blur-[80px] opacity-20 saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8,8,10)]/70 via-[rgb(8,8,10)]/50 to-[rgb(8,8,10)]/70" />
        </div>
      )}

      {/* Content */}
      <div className="relative flex items-center gap-6 p-6">
        {/* Artwork */}
        <div
          className="relative w-[160px] h-[160px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
          onClick={togglePlay}
        >
          {cover ? (
            <ScdnImg
              src={cover}
              alt={track.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.05]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              <Music size={40} className="text-white/15" />
            </div>
          )}

          {/* Hover play overlay on artwork */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
              isCurrentPlaying
                ? 'bg-black/30 opacity-100'
                : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                isCurrentPlaying
                  ? 'bg-white scale-100'
                  : 'bg-white/90 scale-75 group-hover/cover:scale-100'
              }`}
            >
              {isCurrentPlaying ? (
                <Pause size={18} fill="black" strokeWidth={0} />
              ) : (
                <Play size={18} fill="black" strokeWidth={0} className="ml-0.5" />
              )}
            </div>
          </div>
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0 py-1">
          {isRepost && (
            <div className="flex items-center gap-1.5 mb-2.5 text-[11px] text-white/30 font-medium">
              <Repeat2 size={11} />
              <span>{t('home.reposted')}</span>
              <span className="text-white/15">·</span>
              <span>{toRelativeTime(item.created_at)}</span>
            </div>
          )}

          <h2
            className="text-xl font-bold text-white/95 truncate leading-tight cursor-pointer hover:text-white transition-colors duration-200"
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </h2>

          <div
            className="flex items-center gap-2 mt-2 cursor-pointer group/artist"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {avatar && (
              <ScdnImg
                src={avatar}
                alt=""
                className="w-5 h-5 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
              />
            )}
            <p className="text-[13px] text-white/40 truncate group-hover/artist:text-white/60 transition-colors duration-150">
              {track.user.username}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {track.genre && (
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/45 border border-white/[0.06]">
                {track.genre}
              </span>
            )}
            <div className="flex items-center gap-3 text-[11px] text-white/25 tabular-nums">
              <span className="flex items-center gap-1">
                <Headphones size={11} />
                {toCompactCount(track.playback_count)}
              </span>
              <span className="flex items-center gap-1">
                <Heart size={11} />
                {toCompactCount(track.favoritings_count ?? track.likes_count)}
              </span>
              <span>{toMinSec(track.duration)}</span>
              {!isRepost && <span>{toRelativeTime(item.created_at)}</span>}
            </div>
          </div>
        </div>

        {/* Large play button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-[var(--ease-apple)] shadow-xl cursor-pointer ${
            isCurrentPlaying
              ? 'bg-white scale-100'
              : 'bg-white/90 hover:bg-white hover:scale-105 active:scale-95'
          }`}
        >
          {isCurrentPlaying ? (
            <Pause size={22} fill="black" strokeWidth={0} />
          ) : (
            <Play size={22} fill="black" strokeWidth={0} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
