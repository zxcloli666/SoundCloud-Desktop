import { type KeyboardEvent, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportReason } from '../../../../lib/chat/types';
import { Ellipsis, Eye, Radio, ShieldAlert, TriangleAlert } from '../../../../lib/icons';

const REASONS: { reason: ReportReason; Icon: typeof Radio }[] = [
  { reason: 'spam', Icon: Radio },
  { reason: 'harassment', Icon: TriangleAlert },
  { reason: 'doxxing', Icon: Eye },
  { reason: 'illegal', Icon: ShieldAlert },
  { reason: 'other', Icon: Ellipsis },
];

const STEPS: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

export const ReportReasons = memo(function ReportReasons({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReportReason | null;
  onChange: (reason: ReportReason) => void;
}) {
  const { t } = useTranslation();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = value ? REASONS.findIndex((item) => item.reason === value) : -1;

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next =
      (Math.max(index, 0) + (index < 0 && step > 0 ? 0 : step) + REASONS.length) % REASONS.length;
    onChange(REASONS[next].reason);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={move} className="grid grid-cols-1 gap-1.5">
      {REASONS.map(({ reason, Icon }, position) => {
        const active = reason === value;
        return (
          <button
            key={reason}
            ref={(node) => {
              buttons.current[position] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (index < 0 && position === 0) ? 0 : -1}
            onClick={() => onChange(reason)}
            className={`flex h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/60 ${
              active
                ? 'border-bad/40 bg-bad/10 text-ink'
                : 'border-ink/[0.06] bg-ink/[0.03] text-ink-70 hover:bg-ink/[0.06]'
            }`}
          >
            <Icon size={15} className={active ? 'text-bad' : 'text-ink-40'} />
            {t(`chat.thread.report.reasons.${reason}`)}
          </button>
        );
      })}
    </div>
  );
});
