import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, Check } from '../../lib/icons';
import { ProgressRing } from '../ui/ProgressRing';

interface Activity {
  done: number;
  total: number;
}

export const SaveTrigger = React.memo(
  React.forwardRef<
    HTMLButtonElement,
    {
      variant: 'rail' | 'pill';
      label: string;
      activity: Activity | null;
      complete: boolean;
    } & React.ButtonHTMLAttributes<HTMLButtonElement>
  >(function SaveTrigger({ variant, label, activity, complete, ...rest }, ref) {
    const { t } = useTranslation();
    const pct = activity && activity.total > 0 ? activity.done / activity.total : 0;
    const lit = activity !== null || complete;
    const icon = complete && !activity ? <Check size={16} /> : <ArrowDownToLine size={16} />;

    if (variant === 'rail') {
      return (
        <button
          ref={ref}
          type="button"
          title={label}
          aria-label={label}
          {...rest}
          className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
            lit
              ? 'text-accent bg-accent/12'
              : 'text-ink-60 hover:text-ink-95 hover:bg-ink/[0.07]'
          }`}
        >
          {activity && <ProgressRing value={pct} size={34} />}
          {icon}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        title={label}
        {...rest}
        className={`relative inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full text-[12.5px] font-semibold border transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.96] ${
          lit
            ? 'bg-accent/12 text-accent border-accent/30'
            : 'bg-ink/[0.04] border-ink/[0.08] text-ink-70 hover:bg-ink/[0.07] hover:text-ink-95'
        }`}
      >
        <span className="relative flex size-7 items-center justify-center">
          {activity && <ProgressRing value={pct} size={28} />}
          {icon}
        </span>
        {activity && activity.total > 0
          ? `${activity.done} / ${activity.total}`
          : t('collectionSave.pillLabel')}
      </button>
    );
  }),
);
