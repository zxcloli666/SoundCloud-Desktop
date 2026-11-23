import { RangeSlider } from '../primitives';

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
  'data-ui': dataUi,
}: {
  title: string;
  desc: string;
  valueLabel: string;
  step: number;
  steps: number;
  minLabel: string;
  maxLabel: string;
  danger?: boolean;
  onChange: (step: number) => void;
  'data-ui'?: string;
}) {
  return (
    <div data-ui={dataUi} className="set-row flex flex-col gap-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-ink-90">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-45">{desc}</p>
        </div>
        <span className={`set-chip shrink-0 ${danger ? 'text-bad' : ''}`}>{valueLabel}</span>
      </div>
      <div>
        <RangeSlider value={step} min={0} max={steps - 1} step={1} onChange={onChange} />
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-35 tabular-nums">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </div>
  );
}
