import { type KeyboardEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe, Lock } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { RoomAccess } from '../../stores/settings';

const OPTIONS = [
  {
    value: 'private',
    icon: Lock,
    title: 'together.access.private',
    hint: 'together.access.privateHint',
  },
  {
    value: 'public',
    icon: Globe,
    title: 'together.access.public',
    hint: 'together.access.publicHint',
  },
] as const;

const MOVES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const SMOOTH = 'duration-300 ease-[var(--ease-apple)]';

interface AccessChoiceProps {
  value: RoomAccess;
  onChange: (value: RoomAccess) => void;
  disabled?: boolean;
}

export function AccessChoice({ value, onChange, disabled }: AccessChoiceProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent) => {
    if (!MOVES.includes(event.key)) return;
    event.preventDefault();
    const next = OPTIONS.findIndex((option) => option.value !== value);
    onChange(OPTIONS[next].value);
    cards.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('together.access.label')}
      onKeyDown={move}
      className="mb-2.5 grid grid-cols-2 gap-2"
    >
      {OPTIONS.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              cards.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`group relative flex cursor-pointer flex-col items-start rounded-2xl border p-2.5 text-left outline-none transition-[transform,border-color,background-color] ${SMOOTH} focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-[0.97] disabled:cursor-default disabled:opacity-60 ${
              selected
                ? 'border-accent/45 bg-accent/[0.07]'
                : 'border-ink/[0.07] bg-ink/[0.025] hover:border-ink/[0.13] hover:bg-ink/[0.05]'
            }`}
          >
            <span
              className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/[0.18] via-accent/[0.04] to-transparent transition-opacity ${SMOOTH} ${
                selected ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {perf.glow && (
              <span
                className={`pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_26px_-8px_var(--color-accent-glow)] transition-opacity ${SMOOTH} ${
                  selected ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
            <span className="relative mb-2 flex w-full items-start justify-between">
              <span className="relative flex h-8 w-8 items-center justify-center">
                {selected && perf.idleAnim && (
                  <span className="absolute inset-0 rounded-[10px] border border-accent/40 animate-[sw-pulse-ring_2.8s_var(--ease-apple)_infinite]" />
                )}
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-[10px] transition-[color,background-color,transform] ${SMOOTH} ${
                    selected
                      ? 'scale-100 bg-accent text-accent-contrast'
                      : 'scale-95 bg-ink/[0.06] text-ink-50 group-hover:text-ink-75'
                  }`}
                >
                  <Icon size={15} strokeWidth={2.2} />
                </span>
              </span>
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-contrast transition-[opacity,transform] ${SMOOTH} ${
                  selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
              >
                <Check size={10} strokeWidth={3.2} />
              </span>
            </span>
            <span
              className={`relative text-[12.5px] font-semibold transition-colors ${SMOOTH} ${
                selected ? 'text-ink-95' : 'text-ink-65'
              }`}
            >
              {t(option.title)}
            </span>
            <span className="relative mt-0.5 text-[10.5px] leading-snug text-ink-40">
              {t(option.hint)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
