import { RangeSlider } from '../primitives';

interface CacheLimitSliderProps {
  title: string;
  desc: string;
  valueLabel: string;
  step: number;
  steps: number;
  minLabel: string;
  maxLabel: string;
  danger?: boolean;
  onChange: (step: number) => void;
}

export function CacheLimitSlider({
  title,
  desc,
  valueLabel,
  step,
  steps,
  minLabel,
  maxLabel,
  danger = false,
  onChange,
}: CacheLimitSliderProps) {
  return (
    <div className="pt-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-white/60 font-medium">{title}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{desc}</p>
        </div>
        <span
          className={`shrink-0 text-[12px] tabular-nums transition-colors duration-200 ${
            danger ? 'text-red-400/80' : 'text-white/30'
          }`}
        >
          {valueLabel}
        </span>
      </div>
      <RangeSlider value={step} min={0} max={steps - 1} step={1} onChange={onChange} />
      <div className="flex justify-between text-[10px] text-white/25 tabular-nums select-none">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
