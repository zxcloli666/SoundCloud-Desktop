import type { ReactNode } from 'react';
import { Info as InfoIcon, Star } from '../../lib/icons';

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      data-ui="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-accent' : 'bg-ink/[0.14]'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full shadow-[0_1px_3px_rgb(var(--shade)/calc(0.35*var(--shade-alpha)))] transition-[left,background-color] duration-200 ${
          checked ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
        }`}
      />
    </button>
  );
}

export function Info({ text }: { text: ReactNode }) {
  return (
    <span
      data-ui="settings-info"
      tabIndex={0}
      className="set-info relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-ink-30 outline-none transition-colors hover:text-ink-70 focus-visible:text-ink-70"
    >
      <InfoIcon size={14} />
      <span role="tooltip" className="set-tip surface-pop">
        {text}
      </span>
    </span>
  );
}

export function Row({
  title,
  desc,
  info,
  value,
  stacked = false,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  info?: ReactNode;
  value?: ReactNode;
  stacked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      data-ui="settings-row"
      className={`set-row py-3 ${
        stacked
          ? 'flex flex-col gap-3'
          : 'flex flex-wrap items-center gap-x-6 gap-y-2.5 min-h-[56px]'
      }`}
    >
      <div className={stacked ? 'min-w-0' : 'min-w-0 flex-[1_1_14rem]'}>
        <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-90">
          {title}
          {info && <Info text={info} />}
          {value && <span className="ml-auto flex shrink-0 items-center pl-3">{value}</span>}
        </div>
        {desc && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-45">{desc}</p>}
      </div>
      {children && (
        <div
          className={
            stacked
              ? 'min-w-0'
              : 'ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2'
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Divider() {
  return <div className="set-rule-top" />;
}

export function Card({
  title,
  desc,
  info,
  icon,
  action,
  children,
}: {
  title: string;
  desc?: string;
  info?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section data-ui="card" className="set-panel relative">
      <header className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3">
        <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--set-well)] text-ink-60 [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.005em] text-ink-90">
                {title}
              </h3>
              {info && <Info text={info} />}
            </div>
            {desc && (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-45">{desc}</p>
            )}
          </div>
        </div>
        {action && (
          <div className="ml-auto flex max-w-full shrink-0 items-center gap-2">{action}</div>
        )}
      </header>
      {children && <div className="set-body set-rule-top px-4 py-1 empty:hidden">{children}</div>}
    </section>
  );
}

export function Block({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`set-row py-4 ${className}`}>{children}</div>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
  full = false,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; label: string; disabled?: boolean; adornment?: ReactNode }>;
  onChange: (v: T) => void;
  columns?: number;
  full?: boolean;
}) {
  return (
    <div
      data-ui="segmented"
      role="radiogroup"
      className={`set-seg ${full ? 'w-full' : 'max-w-full'}`}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gridAutoFlow: 'row' }
          : undefined
      }
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            data-ui="segment"
            data-value={o.id}
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(o.id)}
            className="set-seg-item"
          >
            <span className="truncate">{o.label}</span>
            {o.adornment}
          </button>
        );
      })}
    </div>
  );
}

export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, var(--color-accent) ${fill}%, rgb(var(--ink) / 0.12) ${fill}%)`,
      }}
      className="h-1 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgb(var(--shade)/calc(0.45*var(--shade-alpha))),0_0_0_0.5px_rgb(var(--shade)/0.2)]"
    />
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--set-well)] px-1.5 text-[10.5px] font-semibold text-ink-60">
      <Star size={10} fill="currentColor" className="text-amber-400" />
      Star
    </span>
  );
}

export function LockedToggle() {
  return (
    <div className="relative h-6 w-11 cursor-not-allowed rounded-full bg-ink/[0.14] opacity-40">
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md" />
    </div>
  );
}
