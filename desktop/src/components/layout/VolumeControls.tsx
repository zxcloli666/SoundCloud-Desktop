import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useShallow } from 'zustand/shallow';
import { volume1Icon16, volume2Icon16, volumeXIcon16 } from '../../lib/icons';
import { usePlayerStore } from '../../stores/player';

export const VolumeSlider = React.memo(
  ({
    className = '',
    orientation = 'horizontal',
  }: {
    className?: string;
    orientation?: 'horizontal' | 'vertical';
  }) => {
    const { volume, setVolume } = usePlayerStore(
      useShallow((s) => ({ volume: s.volume, setVolume: s.setVolume })),
    );
    const isOver100 = volume > 100;
    const vertical = orientation === 'vertical';

    return (
      <div className={`relative ${className}`}>
        <Slider.Root
          className={`relative flex items-center cursor-pointer group select-none touch-none ${
            vertical ? 'flex-col h-full w-5' : 'h-5 w-full'
          }`}
          orientation={orientation}
          value={[volume]}
          max={200}
          step={1}
          onValueChange={([v]) => setVolume(v)}
          onKeyDown={(e) => {
            // Prevent slider from handling arrows itself, otherwise it stacks with global hotkeys.
            if (
              e.key === 'ArrowLeft' ||
              e.key === 'ArrowRight' ||
              e.key === 'ArrowUp' ||
              e.key === 'ArrowDown'
            ) {
              e.preventDefault();
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            setVolume(Math.max(0, Math.min(200, volume + (e.deltaY < 0 ? 1 : -1))));
          }}
        >
          <Slider.Track
            className={`relative grow rounded-full bg-white/[0.08] transition-all duration-150 ${
              vertical ? 'w-[3px] group-hover:w-[4px]' : 'h-[3px] group-hover:h-[4px]'
            }`}
          >
            <Slider.Range
              className={`absolute rounded-full ${vertical ? 'w-full' : 'h-full'} ${
                isOver100 ? 'bg-amber-400/80' : 'bg-white/60'
              }`}
            />
          </Slider.Track>
          <Slider.Thumb
            className={`block w-2.5 h-2.5 rounded-full transition-all duration-150 outline-none scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 ${isOver100 ? 'bg-amber-400' : 'bg-white'}`}
          />
        </Slider.Root>
        {/* 100% tick mark (visual only, outside Slider tree) */}
        <div
          className={`absolute left-1/2 top-1/2 bg-white/20 pointer-events-none ${
            vertical ? '-translate-x-1/2 h-px w-[3px]' : '-translate-y-1/2 h-[3px] w-px'
          }`}
        />
      </div>
    );
  },
);

export const ControlVolumeBtn = React.memo(({ size = 'default' }: { size?: 'default' | 'sm' }) => {
  const { volume, volumeBeforeMute, setVolume } = usePlayerStore(
    useShallow((s) => ({
      volume: s.volume,
      volumeBeforeMute: s.volumeBeforeMute,
      setVolume: s.setVolume,
    })),
  );
  const s = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <button
      type="button"
      onClick={() => setVolume(volume > 0 ? 0 : volumeBeforeMute)}
      className={`${s} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.04] ${
        volume === 0 ? 'text-accent' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {volume === 0 ? volumeXIcon16 : volume < 50 ? volume1Icon16 : volume2Icon16}
    </button>
  );
});

export const VolumeLabel = React.memo(({ className = 'text-right' }: { className?: string }) => {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <span
      className={`text-[10px] tabular-nums w-[34px] shrink-0 ${className} ${volume > 100 ? 'text-amber-400/70' : 'text-white/30'}`}
    >
      {volume}%
    </span>
  );
});

export const VolumeFlyout = React.memo(() => (
  <div className="npb-vol">
    <ControlVolumeBtn size="sm" />
    <div className="npb-vol-pop">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#101012]/96 px-2 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
        <VolumeLabel className="text-center" />
        <VolumeSlider orientation="vertical" className="h-[110px]" />
      </div>
    </div>
  </div>
));
