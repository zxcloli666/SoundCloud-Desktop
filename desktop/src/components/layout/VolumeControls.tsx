import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { volume1Icon16, volume2Icon16, volumeXIcon16 } from '../../lib/icons';
import { clampVolume, VOLUME_MAX, VOLUME_SNAP_POINTS } from '../../lib/volume';
import { usePlayerStore, VOLUME_DEFAULT } from '../../stores/player';
import { useVolumeDrag } from './useVolumeDrag';

const VOLUME_TICKS = VOLUME_SNAP_POINTS.filter((point) => point < VOLUME_MAX);

const VolumeTip = React.memo(
  ({ volume, fine, vertical }: { volume: number; fine: boolean; vertical: boolean }) => {
    const { t } = useTranslation();
    return (
      <span
        className={`pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap rounded-lg border bg-[#101012]/96 px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${
          vertical
            ? 'left-full top-1/2 ml-2.5 -translate-y-1/2'
            : 'bottom-full left-1/2 mb-2.5 -translate-x-1/2'
        } ${fine ? 'border-accent/40 text-accent' : 'border-white/[0.10]'} ${
          volume > 100 ? 'text-amber-400' : fine ? '' : 'text-white/85'
        }`}
      >
        {volume}%
        {fine && (
          <span className="text-[9px] font-normal uppercase tracking-wide text-accent/80">
            {t('player.volumeFine')}
          </span>
        )}
      </span>
    );
  },
);

export const VolumeSlider = React.memo(
  ({
    className = '',
    orientation = 'horizontal',
  }: {
    className?: string;
    orientation?: 'horizontal' | 'vertical';
  }) => {
    const { t } = useTranslation();
    const { volume, setVolume, resetVolume } = usePlayerStore(
      useShallow((s) => ({ volume: s.volume, setVolume: s.setVolume, resetVolume: s.resetVolume })),
    );
    const vertical = orientation === 'vertical';
    const { rootRef, dragging, fine, onValueChange, rootHandlers } = useVolumeDrag(vertical);
    const isOver100 = volume > 100;

    return (
      <div className={`relative ${className}`}>
        <Slider.Root
          ref={rootRef}
          aria-label={t('player.volume')}
          onDoubleClick={resetVolume}
          className={`relative flex items-center cursor-pointer group select-none touch-none ${
            vertical ? 'flex-col h-full w-5' : 'h-5 w-full'
          }`}
          orientation={orientation}
          value={[volume]}
          max={VOLUME_MAX}
          step={1}
          title={dragging ? undefined : `${t('player.volumeHint')}\n${t('player.volumeResetHint')}`}
          onValueChange={onValueChange}
          {...rootHandlers}
          onKeyDown={(e) => {
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
            const delta = e.deltaY || e.deltaX;
            setVolume(clampVolume(volume + (delta < 0 ? 1 : -1)));
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
            className={`relative block w-2.5 h-2.5 rounded-full transition-[transform,opacity] duration-150 outline-none ${
              dragging
                ? 'scale-100 opacity-100'
                : 'scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100'
            } ${fine ? 'ring-2 ring-accent/50' : ''} ${isOver100 ? 'bg-amber-400' : 'bg-white'}`}
          >
            {dragging && <VolumeTip volume={volume} fine={fine} vertical={vertical} />}
          </Slider.Thumb>
        </Slider.Root>
        {VOLUME_TICKS.map((point) => {
          const offset = `${(point / VOLUME_MAX) * 100}%`;
          return (
            <div
              key={point}
              style={vertical ? { bottom: offset } : { left: offset }}
              className={`absolute pointer-events-none ${point === 100 ? 'bg-white/20' : 'bg-white/10'} ${
                vertical
                  ? 'left-1/2 -translate-x-1/2 translate-y-1/2 h-px w-[3px]'
                  : 'top-1/2 -translate-y-1/2 -translate-x-1/2 h-[3px] w-px'
              }`}
            />
          );
        })}
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
  const { t } = useTranslation();
  const { volume, resetVolume } = usePlayerStore(
    useShallow((s) => ({ volume: s.volume, resetVolume: s.resetVolume })),
  );
  const isDefault = volume === VOLUME_DEFAULT;
  const tone =
    volume > 100 ? 'text-amber-400/70 hover:text-amber-300' : 'text-white/30 hover:text-white/70';
  return (
    <button
      type="button"
      title={isDefault ? t('player.volume') : t('player.volumeReset')}
      onClick={() => {
        if (!isDefault) resetVolume();
      }}
      className={`text-[10px] tabular-nums w-[34px] shrink-0 transition-colors ${isDefault ? 'cursor-default' : 'cursor-pointer'} ${className} ${tone}`}
    >
      {volume}%
    </button>
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
