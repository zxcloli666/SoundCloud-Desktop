import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../stores/player.ts';
import { useShallow } from 'zustand/shallow';
import { LikeButton } from '../track/LikeButton.tsx';
import { ProgressSlider } from './ProgressSlider.tsx';
import { ControlButton } from './ControlButton.tsx';
import { ProgressTime } from './ProgressTime.tsx';
import { ControlVolumeButton } from './ControlVolumeButton.tsx';
import { VolumeSlider } from './VolumeSlider.tsx';

const VolumeValue = React.memo(() => {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <span
      className={`text-[10px] tabular-nums w-[34px] text-right shrink-0 ${
        volume > 100 ? 'text-amber-400/70' : 'text-white/30'
      }`}
    >
      {volume}%
    </span>
  );
});

export const NowPlayingBarBase = ({
  onQueueToggle,
  queueOpen,
}: {
  onQueueToggle: () => void;
  queueOpen: boolean;
}) => {
  const navigate = useNavigate();
  const {
    currentTrack,
    isPlaying,
    // volume,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    toggleShuffle,
    toggleRepeat,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      // volume: s.volume,
      shuffle: s.shuffle,
      repeat: s.repeat,
      togglePlay: s.togglePlay,
      next: s.next,
      prev: s.prev,
      toggleShuffle: s.toggleShuffle,
      toggleRepeat: s.toggleRepeat,
    })),
  );

  const artwork = currentTrack?.artwork_url?.replace('-large', '-t200x200');

  return (
    <div className="shrink-0 relative">
      {/* Glow from artwork */}
      {artwork && (
        <div
          className="absolute inset-0 opacity-[0.05] blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${artwork})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Progress bar — full width on top */}
      <ProgressSlider />

      <div className="h-[76px] flex items-center px-5 gap-3 relative">
        {/* ── Left: track info ── */}
        <div className="flex items-center gap-3.5 w-[280px] min-w-0">
          {currentTrack ? (
            <>
              <div
                className="w-14 h-14 rounded-[10px] shrink-0 overflow-hidden cursor-pointer shadow-xl shadow-black/40 ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all duration-200"
                onClick={() => navigate(`/track/${encodeURIComponent(currentTrack.urn)}`)}
              >
                {artwork ? (
                  <img src={artwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/[0.04]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] text-white/90 truncate font-medium cursor-pointer hover:text-white leading-tight transition-colors"
                  onClick={() => navigate(`/track/${encodeURIComponent(currentTrack.urn)}`)}
                >
                  {currentTrack.title}
                </p>
                <p
                  className="text-[11px] text-white/35 truncate mt-1 cursor-pointer hover:text-white/55 transition-colors"
                  onClick={() => navigate(`/user/${encodeURIComponent(currentTrack.user.urn)}`)}
                >
                  {currentTrack.user.username}
                </p>
              </div>
              <LikeButton trackUrn={currentTrack.urn} />
            </>
          ) : (
            <p className="text-[13px] text-white/15">Not playing</p>
          )}
        </div>

        {/* ── Center: controls ── */}
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-0.5">
            <ControlButton onClick={toggleShuffle} active={shuffle} size="sm">
              <Shuffle size={16} />
            </ControlButton>
            <ControlButton onClick={prev}>
              <SkipBack size={20} fill="currentColor" />
            </ControlButton>

            {/* Play/pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-black hover:bg-white hover:scale-105 active:scale-95 transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer mx-1.5"
            >
              {isPlaying ? (
                <Pause size={20} fill="black" strokeWidth={0} />
              ) : (
                <Play size={20} fill="black" strokeWidth={0} className="ml-0.5" />
              )}
            </button>

            <ControlButton onClick={next}>
              <SkipForward size={20} fill="currentColor" />
            </ControlButton>
            <ControlButton onClick={toggleRepeat} active={repeat !== 'off'} size="sm">
              {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </ControlButton>
          </div>

          {/* Time */}
          <ProgressTime />
        </div>

        {/* ── Right: volume + queue ── */}
        <div className="flex items-center gap-0.5 w-[220px] justify-end">
          <ControlButton onClick={onQueueToggle} active={queueOpen} size="sm">
            <ListMusic size={16} />
          </ControlButton>
          <ControlVolumeButton size="sm" />
          <VolumeSlider className="w-[100px]" />
          <VolumeValue />
        </div>
      </div>
    </div>
  );
};
export const NowPlayingBar = React.memo(NowPlayingBarBase);
