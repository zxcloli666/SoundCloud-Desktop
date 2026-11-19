import { useTranslation } from 'react-i18next';
import { Check } from '../../lib/icons';
import type { Phase } from '../../lib/mobile-link/flow';

const STEP_KEYS = [
  'mobileLink.step.browser',
  'mobileLink.step.code',
  'mobileLink.step.done',
] as const;

function dotClass(index: number, step: number, broken: boolean): string {
  if (index < step || (index === step && step === 2)) {
    return 'bg-emerald-500 border-emerald-500 text-accent-contrast';
  }
  if (index === step && broken) return 'bg-red-500/15 border-red-500/50 text-red-500';
  if (index === step)
    return 'bg-[var(--color-accent-glow)] border-[var(--color-accent)] text-[var(--color-accent)]';
  return 'bg-transparent border-ink/15 text-ink-30';
}

export function LinkSteps({ step, phase }: { step: number; phase: Phase }) {
  const { t } = useTranslation();
  const broken = phase === 'mismatch' || phase === 'failed' || phase === 'expired';
  return (
    <ol data-ui="mobile-link-steps" className="flex items-center gap-2 w-full">
      {STEP_KEYS.map((key, index) => {
        const done = index < step || (index === step && step === 2);
        return (
          <li
            key={key}
            aria-current={index === step ? 'step' : undefined}
            className="flex items-center gap-2 flex-1 last:flex-none"
          >
            <span
              className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[10px] font-bold transition-colors duration-300 ${dotClass(index, step, broken)}`}
            >
              {done ? <Check size={11} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`text-[11.5px] font-medium transition-colors duration-300 ${index <= step ? 'text-ink-70' : 'text-ink-30'}`}
            >
              {t(key)}
            </span>
            {index < STEP_KEYS.length - 1 && (
              <span
                aria-hidden
                className={`h-px flex-1 transition-colors duration-300 ${index < step ? 'bg-emerald-500/60' : 'bg-ink/10'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
