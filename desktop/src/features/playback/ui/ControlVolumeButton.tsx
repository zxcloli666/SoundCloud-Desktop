import { Volume1, Volume2, VolumeX } from 'lucide-react';
import React from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../../../stores/player.ts';

const ControlVolumeButtonBase = ({ size = 'default' }: { size?: 'default' | 'sm' }) => {
  const { setVolume, volume } = usePlayerStore(
    useShallow((s) => ({
      setVolume: s.setVolume,
      volume: s.volume,
    })),
  );
  const s = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <button
      type="button"
      onClick={() => setVolume(volume > 0 ? 0 : 50)}
      className={`${s} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.04] ${
        volume === 0 ? 'text-accent' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {volume === 0 ? (
        <VolumeX size={16} />
      ) : volume < 50 ? (
        <Volume1 size={16} />
      ) : (
        <Volume2 size={16} />
      )}
    </button>
  );
};
export const ControlVolumeButton = React.memo(ControlVolumeButtonBase);
