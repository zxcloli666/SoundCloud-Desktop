import React from 'react';
import type { Track } from '../../stores/player.ts';
import { useNavigate } from 'react-router-dom';
import { replaceArtSize, toCompactCount, toMinSec } from '../../lib/utils.ts';
import { preloadTrack } from '../../lib/audio.ts';
import { Headphones, Music, Pause, Play } from 'lucide-react';
import { useTrackPlayback } from '../../lib/hooks/useTrackPlayback.ts';

export const TrackRelatedRowBase = ({ track, queue }: { track: Track; queue: Track[] }) => {
  const { isCurrent, isCurrentPlaying, togglePlay } = useTrackPlayback(track, queue);

  const navigate = useNavigate();
  const cover = replaceArtSize(track.artwork_url, 't200x200');

  return (
    <div
      className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] ${
        isCurrent ? 'bg-accent/[0.04] ring-1 ring-accent/15' : 'hover:bg-white/[0.03]'
      }`}
      onMouseEnter={() => preloadTrack(track.urn)}
    >
      <div
        className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
        onClick={togglePlay}
      >
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
            <Music size={14} className="text-white/15" />
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isCurrentPlaying
              ? 'bg-black/30 opacity-100'
              : 'opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg">
            {isCurrentPlaying ? (
              <Pause size={11} fill="black" strokeWidth={0} />
            ) : (
              <Play size={11} fill="black" strokeWidth={0} className="ml-px" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] font-medium text-white/85 truncate cursor-pointer hover:text-white transition-colors duration-150"
          onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
        >
          {track.title}
        </p>
        <p
          className="text-[11px] text-white/30 truncate mt-0.5 cursor-pointer hover:text-white/50 transition-colors duration-150"
          onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
        >
          {track.user.username}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[10px] text-white/25 tabular-nums">{toMinSec(track.duration)}</p>
        {track.playback_count != null && (
          <p className="text-[9px] text-white/15 mt-0.5 tabular-nums flex items-center gap-0.5 justify-end">
            <Headphones size={8} />
            {toCompactCount(track.playback_count)}
          </p>
        )}
      </div>
    </div>
  );
};

export const TrackRelatedRow = React.memo(TrackRelatedRowBase);
