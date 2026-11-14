import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Stage } from '../../../../lib/boosty-card/use-card-link';
import { Check } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';

type Working = Extract<Stage, { kind: 'working' }>;

const ORDER = ['sending', 'confirm', 'checking', 'linking'] as const;

export const CardProgress = memo(function CardProgress({ stage }: { stage: Working }) {
  const { t } = useTranslation();
  const spin = usePerfMode().idleAnim;
  const steps = ORDER.filter((step) => step !== 'confirm' || stage.via3ds);
  const at = steps.indexOf(stage.phase);
  return (
    <ol className="flex list-none flex-col gap-3 p-0" aria-live="polite">
      {steps.map((step, i) => {
        const done = i < at;
        const active = i === at;
        return (
          <li key={step} className="flex items-center gap-2.5">
            <span
              className="grid size-[22px] place-items-center rounded-full border"
              style={{
                borderColor: done || active ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.16)',
                background: done ? 'var(--color-accent)' : 'transparent',
              }}
            >
              {done ? (
                <Check size={12} strokeWidth={3.2} className="text-accent-contrast" />
              ) : active ? (
                <span
                  className={`size-3 rounded-full border-2${spin ? ' animate-spin' : ''}`}
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
                    borderTopColor: 'var(--color-accent)',
                  }}
                />
              ) : null}
            </span>
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.14em] ${active ? 'text-ink' : done ? 'text-ink-60' : 'text-ink-35'}`}
            >
              {t(`starpass.card.step.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
});
