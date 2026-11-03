import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportReason } from '../../../lib/chat/types';
import { REASON_ICONS } from '../settings/ModerationPolicy';

const REASONS: ReportReason[] = ['spam', 'harassment', 'doxxing', 'illegal', 'other'];

interface ReportReasonsProps {
  value: ReportReason | null;
  onChange: (reason: ReportReason) => void;
}

export const ReportReasons = memo(function ReportReasons({ value, onChange }: ReportReasonsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      {REASONS.map((id) => {
        const Icon = REASON_ICONS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors duration-200 ${
              id === 'other' ? 'col-span-2' : ''
            } ${
              active
                ? 'border-rose-400/45 bg-rose-500/15 text-white'
                : 'border-ink/[0.06] bg-ink/[0.03] text-ink-65 hover:bg-ink/[0.06]'
            }`}
          >
            <Icon size={15} className={active ? 'text-rose-200' : 'text-ink-40'} />
            {t(`chat.list.report.reasons.${id}`)}
          </button>
        );
      })}
    </div>
  );
});
