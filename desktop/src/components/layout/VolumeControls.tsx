import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { volume1Icon16, volume2Icon16, volumeXIcon16 } from '../../lib/icons';
import { clampVolume, VOLUME_MAX, VOLUME_SNAP_POINTS } from '../../lib/volume';
import { usePlayerStore } from '../../stores/player';
import { playerBtn } from './player/button-class';
import { useVolumeDrag } from './useVolumeDrag';

const VOLUME_TICKS = VOLUME_SNAP_POINTS.filter((point) => point < VOLUME_MAX);

function stepVolumeOnWheel(e: React.WheelEvent) {
  e.preventDefault();
  e.stopPropagation();
  const { volume, setVolume } = usePlayerStore.getState();
  setVolume(clampVolume(volume + ((e.deltaY || e.deltaX) < 0 ? 1 : -1)));
}

const VolumeTip = React.memo(
  ({ volume, fine, vertical }: { volume: number; fine: boolean; vertical: boolean }) => {
    const { t } = useTranslation();
    return (
      <span
        className={`pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap rounded-lg border bg-surface/96 px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-[0_8px_24px_rgb(var(--shade)/calc(0.5*var(--shade-alpha)))] ${
          vertical
            ? 'left-full top-1/2 ml-2.5 -translate-y-1/2'
            : 'bottom-full left-1/2 mb-2.5 -translate-x-1/2'
        } ${fine ? 'border-accent/40 text-accent' : 'border-ink/[0.10]'} ${
          volume > 100 ? 'text-bad' : fine ? '' : 'text-ink-85'
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
    const { volume, resetVolume } = usePlayerStore(
      useShallow((s) => ({ volume: s.volume, resetVolume: s.resetVolume })),
    );
    const vertical = orientation === 'vertical';
    const { rootRef, dragging, fine, onValueChange, rootHandlers } = useVolumeDrag(vertical);
    const isOver100 = volume > 100;

    return (
      <div className={`relative ${className}`}>
        <Slider.Root
          ref={rootRef}
          aria-label={t('player.volume')}
          data-ui="volume"
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
          onWheel={stepVolumeOnWheel}
        >
          <Slider.Track
            className={`relative grow rounded-full bg-ink/[0.08] transition-all duration-150 ${
              vertical ? 'w-[3px] group-hover:w-[4px]' : 'h-[3px] group-hover:h-[4px]'
            }`}
          >
            <Slider.Range
              className={`absolute rounded-full ${vertical ? 'w-full' : 'h-full'} ${
                isOver100 ? 'bg-amber-400/80' : 'bg-ink/60'
              }`}
            />
          </Slider.Track>
          <Slider.Thumb
            className={`relative block w-2.5 h-2.5 rounded-full transition-[transform,opacity] duration-150 outline-none ${
              dragging
                ? 'scale-100 opacity-100'
                : 'scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100'
            } ${fine ? 'ring-2 ring-accent/50' : ''} ${isOver100 ? 'bg-amber-400' : 'bg-ink'}`}
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
              className={`absolute pointer-events-none ${point === 100 ? 'bg-ink/20' : 'bg-ink/10'} ${
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

export const ControlVolumeBtn = React.memo(
  ({ size = 'default' }: { size?: 'default' | 'sm' | 'player' }) => {
    const { volume, volumeBeforeMute, setVolume } = usePlayerStore(
      useShallow((s) => ({
        volume: s.volume,
        volumeBeforeMute: s.volumeBeforeMute,
        setVolume: s.setVolume,
      })),
    );
    const { t } = useTranslation();
    const s = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
    return (
      <button
        type="button"
        onClick={() => setVolume(volume > 0 ? 0 : volumeBeforeMute)}
        onWheel={stepVolumeOnWheel}
        title={t('player.volume')}
        aria-label={t('player.volume')}
        className={
          size === 'player'
            ? playerBtn(volume === 0)
            : `${s} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-ink/[0.04] ${
                volume === 0 ? 'text-accent' : 'text-ink-40 hover:text-ink-70'
              }`
        }
      >
        {volume === 0 ? volumeXIcon16 : volume < 50 ? volume1Icon16 : volume2Icon16}
      </button>
    );
  },
);

export const VolumeLabel = React.memo(({ className = 'text-right' }: { className?: string }) => {
  const { t } = useTranslation();
  const { volume, setVolume } = usePlayerStore(
    useShallow((s) => ({ volume: s.volume, setVolume: s.setVolume })),
  );
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(volume));
  const tone = volume > 100 ? 'text-bad/70 hover:text-bad' : 'text-ink-30 hover:text-ink-70';

  React.useEffect(() => {
    if (!editing) setDraft(String(volume));
  }, [editing, volume]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) setVolume(clampVolume(parsed));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        max={VOLUME_MAX}
        step={1}
        inputMode="numeric"
        aria-label={t('player.volumePercent')}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(volume));
            setEditing(false);
          }
        }}
        className={`h-4 w-[34px] shrink-0 bg-transparent text-center text-[10px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${tone}`}
      />
    );
  }

  return (
    <button
      type="button"
      title={t('player.volumeType')}
      aria-label={t('player.volumeType')}
      onClick={() => setEditing(true)}
      className={`text-[10px] tabular-nums w-[34px] shrink-0 cursor-text transition-colors ${className} ${tone}`}
    >
      {volume}%
    </button>
  );
});

export const VolumeFlyout = React.memo(() => (
  <div className="npb-vol" onWheel={stepVolumeOnWheel}>
    <ControlVolumeBtn size="player" />
    <div className="npb-vol-pop">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink/[0.10] bg-surface/96 px-2 py-3 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.55*var(--shade-alpha)))]">
        <VolumeLabel className="text-center" />
        <VolumeSlider orientation="vertical" className="h-[110px]" />
      </div>
    </div>
  </div>
));
