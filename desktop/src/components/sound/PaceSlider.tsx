import * as Slider from '@radix-ui/react-slider';
import { type ReactNode, useRef } from 'react';
import { useWheelStep } from '../../lib/useWheelStep';
import { LABEL } from './styles';

interface Props {
  'data-ui': string;
  icon: ReactNode;
  label: string;
  readout: string;
  changed: boolean;
  resetLabel: string;
  onReset: () => void;
  value: number;
  rest: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  children?: ReactNode;
}

export function PaceSlider({
  'data-ui': marker,
  icon,
  label,
  readout,
  changed,
  resetLabel,
  onReset,
  value,
  rest,
  min,
  max,
  step,
  onChange,
  children,
}: Props) {
  const place = (at: number) => ((at - min) / (max - min)) * 100;
  const from = Math.min(place(value), place(rest));
  const to = Math.max(place(value), place(rest));
  const sliderRef = useRef<HTMLSpanElement>(null);
  useWheelStep(sliderRef, (direction) => onChange(value + direction * step));
  return (
    <div data-ui={marker} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex h-7 items-center gap-2">
        <span className="text-ink-45" aria-hidden>
          {icon}
        </span>
        <span className={LABEL}>{label}</span>
        {children}
        <button
          type="button"
          disabled={!changed}
          onClick={onReset}
          title={changed ? resetLabel : label}
          className={`ml-auto text-[12px] font-semibold tabular-nums outline-none focus-visible:underline ${
            changed ? 'cursor-pointer text-accent' : 'text-ink-45'
          }`}
        >
          {readout}
        </button>
      </div>
      <Slider.Root
        ref={sliderRef}
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
        className="relative flex h-7 w-full cursor-pointer touch-none select-none items-center"
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.1]">
          <span
            className={`absolute h-full rounded-full ${changed ? 'bg-accent' : 'bg-ink/40'}`}
            style={{ left: `${from}%`, width: `${to - from}%` }}
          />
          <span
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/25"
            style={{ left: `${place(rest)}%` }}
          />
        </Slider.Track>
        <Slider.Thumb
          className={`block size-3 rounded-full outline-none transition-transform duration-150 hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent/50 ${
            changed ? 'bg-accent' : 'bg-ink/70'
          }`}
        />
      </Slider.Root>
    </div>
  );
}
