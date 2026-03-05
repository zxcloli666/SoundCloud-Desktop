import React from 'react';
import { Headphones, Music, Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { preloadTrack } from '../../lib/audio.ts';
import type { Track } from '../../stores/player.ts';
import { LikeButton } from './LikeButton.tsx';
import { replaceArtSize, toCompactCount, toMinSec } from '../../lib/utils.ts';
import { useTrackPlayback } from '../../lib/hooks/useTrackPlayback.ts';

type TrackRowProps = {
  track: Track;
  queue: Track[];
  index?: number;
  source?: 'default' | 'liked';
};

export const TrackRowBase = ({ track, queue, index, source = 'default' }: TrackRowProps) => {
  const { isCurrent, isCurrentPlaying, togglePlay } = useTrackPlayback(track, queue);

  const navigate = useNavigate();
  const cover = replaceArtSize(track.artwork_url, 't200x200');

  const initialLiked = source === 'liked' ? true : (track.user_favorite ?? false);

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
        isCurrent
          ? 'bg-accent/[0.06] ring-1 ring-accent/20 shadow-[inset_0_0_20px_rgba(255,85,0,0.05)]'
          : 'hover:bg-white/[0.04]'
      }`}
      onMouseEnter={() => preloadTrack(track.urn)}
    >
      <div
        className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer"
        onClick={togglePlay}
      >
        {isCurrentPlaying ? (
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
            <Pause size={16} fill="white" strokeWidth={0} />
          </div>
        ) : typeof index === 'number' ? (
          <>
            <span className="text-[13px] text-white/20 tabular-nums font-medium group-hover:hidden">
              {index + 1}
            </span>
            <div className="hidden group-hover:flex w-9 h-9 rounded-full bg-white/10 items-center justify-center">
              <Play size={16} fill="white" strokeWidth={0} className="ml-0.5" />
            </div>
          </>
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/[0.06] group-hover:bg-white/10 flex items-center justify-center">
            <Play
              size={16}
              fill="white"
              strokeWidth={0}
              className="ml-0.5 opacity-60 group-hover:opacity-100"
            />
          </div>
        )}
      </div>

      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={16} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-[14px] font-medium truncate cursor-pointer ${isCurrent ? 'text-accent' : 'text-white/90 hover:text-white'}`}
          onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
        >
          {track.title}
        </p>
        <p
          className="text-[12px] text-white/40 truncate mt-0.5 cursor-pointer hover:text-white/70"
          onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
        >
          {track.user.username}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-4 shrink-0 pr-2">
        {track.playback_count != null && (
          <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-16">
            <Headphones size={11} className="text-white/20" />
            {toCompactCount(track.playback_count)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <LikeButton trackUrn={track.urn} initialLiked={initialLiked} className="w-7 h-7" />
        <span className="text-[12px] text-white/30 tabular-nums font-medium w-12 text-right">
          {toMinSec(track.duration)}
        </span>
      </div>
    </div>
  );
};

export const TrackRow = React.memo(TrackRowBase);
