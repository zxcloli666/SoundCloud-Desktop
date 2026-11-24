import * as Slider from '@radix-ui/react-slider';
import { memo, useRef } from 'react';
import { useWheelStep } from '../../../lib/useWheelStep';
import { Toggle } from '../../settings/primitives';
import { LABEL } from '../../sound/styles';

export const EffectSlider = memo(function EffectSlider({
  label,
  readout,
  value,
  min,
  max,
  step,
  lit,
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
  lit: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
  onSwitch?: (on: boolean) => void;
  on?: boolean;
}) {
  const slider = useRef<HTMLSpanElement>(null);
  useWheelStep(slider, (direction) =>
    onChange(Math.max(min, Math.min(max, Math.round(value / step + direction) * step))),
  );

  return (
    <div
      className={`min-w-0 transition-opacity duration-300 ${
        disabled ? 'pointer-events-none opacity-45' : ''
      }`}
    >
      <div className="flex h-7 items-center gap-2">
        <span className={`${LABEL} truncate`}>{label}</span>
        <span className="ml-auto shrink-0 text-[12px] font-semibold tabular-nums text-ink-45">
          {readout}
        </span>
        {onSwitch && <Toggle checked={!!on} onChange={() => onSwitch(!on)} label={label} />}
      </div>
      <Slider.Root
        ref={slider}
        className="relative flex h-7 w-full cursor-pointer touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.1]">
          <Slider.Range
            className={`absolute h-full rounded-full transition-colors ${lit ? 'bg-accent' : 'bg-ink/40'}`}
          />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          className={`block size-3 rounded-full outline-none transition-[background-color,scale] duration-150 hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent/50 ${
            lit ? 'bg-accent' : 'bg-ink/70'
          }`}
        />
      </Slider.Root>
    </div>
  );
});
