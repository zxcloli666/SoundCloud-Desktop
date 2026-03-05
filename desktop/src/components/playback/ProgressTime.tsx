import React from 'react';
import { usePlayerStore } from '../../stores/player.ts';
import { useShallow } from 'zustand/shallow';

function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ProgressTimeBase = () => {
  const { progress, duration } = usePlayerStore(
    useShallow((s) => ({
      progress: Math.floor(s.progress),
      duration: Math.floor(s.duration),
    })),
  );

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span className="text-[11px] text-white/50 tabular-nums font-medium">
        {formatTime(progress)}
      </span>
      <span className="text-[11px] text-white/20">/</span>
      <span className="text-[11px] text-white/30 tabular-nums font-medium">
        {formatTime(duration)}
      </span>
    </div>
  );
};

export const ProgressTime = React.memo(ProgressTimeBase);
