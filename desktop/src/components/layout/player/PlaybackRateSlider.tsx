import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatRate } from '../../../lib/sound/live';
import { useWheelStep } from '../../../lib/useWheelStep';
import {
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_STEP,
  usePlayerStore,
} from '../../../stores/player';

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
          {formatRate(playbackRate)}
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
