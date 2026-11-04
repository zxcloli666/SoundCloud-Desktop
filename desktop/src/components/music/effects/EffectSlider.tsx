import * as Slider from '@radix-ui/react-slider';
import { memo } from 'react';
import { Toggle } from '../../settings/primitives';

export const EffectSlider = memo(function EffectSlider({
  label,
  readout,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  onSwitch,
  on,
}: {
  label: string;
  readout: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onSwitch?: (on: boolean) => void;
  on?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border border-ink/[0.06] bg-ink/[0.02] px-3 py-2.5 transition-opacity duration-300 ${
        disabled ? 'pointer-events-none opacity-45' : ''
      }`}
    >
      <div className="mb-1.5 flex h-6 items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-45">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tabular-nums text-ink-70">{readout}</span>
          {onSwitch && <Toggle checked={!!on} onChange={() => onSwitch(!on)} label={label} />}
        </div>
      </div>
      <Slider.Root
        className="group/fx relative flex h-5 w-full cursor-pointer select-none touch-none items-center"
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.08]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-transform duration-150 hover:scale-110 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent/50" />
      </Slider.Root>
    </div>
  );
});
