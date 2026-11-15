import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../../lib/icons';
import { AccentSpinner } from '../AccentSpinner';
import { useCurrentOrder } from '../flow/derive';
import { useFlow } from '../flow/store';

export const Progress = memo(function Progress() {
  const { t } = useTranslation();
  const step = useFlow((s) => s.step);
  const { phase } = useCurrentOrder();
  const failed = step === 'pay' && phase === 'failed';
  const done = step === 'success';
  return (
    <div
      data-ui="star-progress"
      className="flex h-12 items-center justify-center gap-2.5 rounded-[14px] text-[13.5px] font-semibold"
      style={{
        background: failed
          ? 'rgb(var(--bad) / 0.1)'
          : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
        color: failed ? 'rgb(var(--bad))' : 'rgb(var(--ink) / 0.85)',
      }}
    >
      {done ? <Check size={16} className="text-accent" /> : !failed && <AccentSpinner />}
      {t(
        done
          ? 'starpass.status.paid'
          : failed
            ? 'starpass.status.failed'
            : step === 'pay'
              ? 'starpass.status.waiting'
              : step === 'trial'
                ? 'starpass.trial.title'
                : 'starpass.bind.link',
      )}
    </div>
  );
});
