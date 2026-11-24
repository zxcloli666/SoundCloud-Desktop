import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { slidersHorizontal16 } from '../../../lib/icons';
import { useWheelStep } from '../../../lib/useWheelStep';
import {
  getEffectivePitchSemitones,
  PITCH_SEMITONES_MAX,
  PITCH_SEMITONES_MIN,
  PITCH_SEMITONES_STEP,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_STEP,
  usePlayerStore,
} from '../../../stores/player';
import { TrackSoundToggle } from '../../music/TrackSoundToggle';
import { playerBtn } from './button-class';

const formatPlaybackRate = (rate: number) =>
  `${rate
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')}x`;

export const PlaybackRateSlider = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const resetPlaybackRate = usePlayerStore((s) => s.resetPlaybackRate);
  const isDefault = Math.abs(playbackRate - 1) < 0.001;
  const sliderRef = React.useRef<HTMLSpanElement>(null);
  useWheelStep(sliderRef, (direction) =>
    setPlaybackRate(playbackRate + direction * PLAYBACK_RATE_STEP),
  );

  return (
    <div className="rounded-[14px] border border-ink/[0.06] bg-ink/[0.02] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-45">
          {t('player.playbackSpeed')}
        </span>
        <button
          type="button"
          title={isDefault ? t('player.playbackSpeed') : t('player.playbackSpeedReset')}
          onClick={() => {
            if (!isDefault) resetPlaybackRate();
          }}
          className={`min-w-[42px] text-right text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
            isDefault ? 'text-ink-45' : 'text-accent hover:text-accent/80'
          }`}
        >
          {formatPlaybackRate(playbackRate)}
        </button>
      </div>
      <Slider.Root
        ref={sliderRef}
        className="group/rate relative flex h-5 w-full cursor-pointer select-none touch-none items-center"
        aria-label={t('player.playbackSpeed')}
        value={[playbackRate]}
        min={PLAYBACK_RATE_MIN}
        max={PLAYBACK_RATE_MAX}
        step={PLAYBACK_RATE_STEP}
        onValueChange={([v]) => setPlaybackRate(v)}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.08] transition-all duration-150 group-hover/rate:h-[4px]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/rate:scale-100 group-hover/rate:opacity-100" />
      </Slider.Root>
      <div className="relative mt-1 h-2 w-full pointer-events-none">
        <div
          className="absolute top-0 h-1.5 w-px bg-ink/15"
          style={{
            left: `${((1 - PLAYBACK_RATE_MIN) / (PLAYBACK_RATE_MAX - PLAYBACK_RATE_MIN)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
});

const formatPitchSemitones = (semi: number) => {
  if (Math.abs(semi) < 0.001) return '0';
  return `${semi > 0 ? '+' : ''}${semi.toFixed(1).replace(/\.0$/, '')}`;
};

export const PitchModeToggle = React.memo(() => {
  const { t } = useTranslation();
  const mode = usePlayerStore((s) => s.pitchControlMode);
  const setMode = usePlayerStore((s) => s.setPitchControlMode);
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-ink/[0.07] bg-ink/[0.03] p-[3px]">
      <button
        type="button"
        title={t('player.pitchModeAuto')}
        onClick={() => setMode('auto')}
        className={`h-7 rounded-[10px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
          mode === 'auto' ? 'bg-ink text-paper' : 'text-ink-45 hover:text-ink-75'
        }`}
      >
        {t('player.pitchModeAutoShort')}
      </button>
      <button
        type="button"
        title={t('player.pitchModeManual')}
        onClick={() => setMode('manual')}
        className={`h-7 rounded-[10px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
          mode === 'manual' ? 'bg-ink text-paper' : 'text-ink-45 hover:text-ink-75'
        }`}
      >
        {t('player.pitchModeManualShort')}
      </button>
    </div>
  );
});

export const PitchSlider = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const pitchSemitones = usePlayerStore((s) => s.pitchSemitones);
  const mode = usePlayerStore((s) => s.pitchControlMode);
  const setPitch = usePlayerStore((s) => s.setPitchSemitones);
  const resetPitch = usePlayerStore((s) => s.resetPitchSemitones);
  const effective = getEffectivePitchSemitones(playbackRate, mode, pitchSemitones);
  const isManual = mode === 'manual';
  const canReset = isManual && Math.abs(pitchSemitones) >= 0.001;
  const sliderRef = React.useRef<HTMLSpanElement>(null);
  useWheelStep(sliderRef, (direction) => {
    if (isManual) setPitch(pitchSemitones + direction * PITCH_SEMITONES_STEP);
  });

  return (
    <div
      className={`rounded-[14px] border border-ink/[0.06] bg-ink/[0.02] px-3 py-2.5 ${
        isManual ? '' : 'opacity-65'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-45">
            {t('player.pitch')}
          </span>
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${
              isManual
                ? 'border-ink/[0.12] bg-ink/[0.05] text-ink-55'
                : 'border-accent/30 bg-accent/[0.12] text-accent'
            }`}
          >
            {isManual ? t('player.pitchModeManualShort') : t('player.pitchModeAutoShort')}
          </span>
        </div>
        <button
          type="button"
          title={canReset ? t('player.pitchReset') : t('player.pitch')}
          onClick={() => {
            if (canReset) resetPitch();
          }}
          className={`min-w-[42px] text-right text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
            canReset ? 'text-accent hover:text-accent/80' : 'text-ink-45'
          }`}
        >
          {formatPitchSemitones(effective)}
        </button>
      </div>
      <Slider.Root
        ref={sliderRef}
        className="group/pitch relative flex h-5 w-full cursor-pointer select-none touch-none items-center"
        aria-label={t('player.pitch')}
        value={[effective]}
        min={PITCH_SEMITONES_MIN}
        max={PITCH_SEMITONES_MAX}
        step={PITCH_SEMITONES_STEP}
        disabled={!isManual}
        onValueChange={([v]) => isManual && setPitch(v)}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.08] transition-all duration-150 group-hover/pitch:h-[4px]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/pitch:scale-100 group-hover/pitch:opacity-100 disabled:scale-0 disabled:opacity-0" />
      </Slider.Root>
      <div className="relative mt-1 h-2 w-full pointer-events-none">
        <div className="absolute top-0 h-1.5 w-px bg-ink/15" style={{ left: '50%' }} />
      </div>
    </div>
  );
});

export const TuningBtn = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const pitchSemitones = usePlayerStore((s) => s.pitchSemitones);
  const pitchMode = usePlayerStore((s) => s.pitchControlMode);
  const isActive =
    Math.abs(playbackRate - 1) >= 0.001 ||
    (pitchMode === 'manual' && Math.abs(pitchSemitones) >= 0.001);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-ui="player-tuning"
          title={t('player.soundTuning')}
          className={playerBtn(isActive)}
        >
          {slidersHorizontal16}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[200] w-[300px] origin-bottom-right rounded-[18px] border border-ink/[0.10] bg-surface/96 p-3 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.55*var(--shade-alpha)))] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
        >
          <div className="absolute inset-x-0 top-0 h-12 rounded-t-[18px] bg-gradient-to-b from-ink/[0.05] to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-2 px-1 pb-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/[0.08] bg-ink/[0.04] text-ink-55">
              {slidersHorizontal16}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-65">
                {t('player.soundTuning')}
              </p>
              <p className="text-[10px] text-ink-30">
                {t('player.playbackSpeed')} · {t('player.pitch')}
              </p>
            </div>
          </div>
          <div className="relative space-y-2">
            <PitchModeToggle />
            <PlaybackRateSlider />
            <PitchSlider />
            <TrackSoundToggle compact />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
