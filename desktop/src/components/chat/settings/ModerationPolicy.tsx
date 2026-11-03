import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, IdCard, Lock, Megaphone, Timer } from '../../../lib/chat/icons';
import type { ReportReason } from '../../../lib/chat/types';
import { Ban, Ellipsis, ShieldAlert, Trash2, TriangleAlert } from '../../../lib/icons';

type IconCmp = typeof Ban;

export const REASON_ICONS: Record<ReportReason, IconCmp> = {
  spam: Megaphone,
  harassment: ShieldAlert,
  doxxing: IdCard,
  illegal: TriangleAlert,
  other: Ellipsis,
};

const FORBIDDEN: ReportReason[] = ['spam', 'harassment', 'doxxing', 'illegal'];

const LADDER: Array<{ id: string; Icon: IconCmp; tone: string }> = [
  { id: 'delete', Icon: Trash2, tone: 'text-ink-70 bg-ink/[0.06]' },
  { id: 'repeat', Icon: Timer, tone: 'text-amber-200 bg-amber-400/10' },
  { id: 'illegal', Icon: Ban, tone: 'text-rose-200 bg-rose-500/15' },
];

export const ForbiddenGrid = memo(function ForbiddenGrid() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {FORBIDDEN.map((id) => {
        const Icon = REASON_ICONS[id];
        return (
          <div
            key={id}
            className={`flex min-w-[150px] flex-1 items-center gap-2.5 rounded-2xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2.5 ${
              id === 'illegal' ? 'basis-full' : 'basis-[150px]'
            }`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
              <Icon size={14} />
            </span>
            <span className="text-[12px] leading-tight font-medium text-ink-75">
              {t(`chat.settings.policy.forbidden.${id}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export const PolicyLadder = memo(function PolicyLadder() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        {LADDER.map(({ id, Icon, tone }) => (
          <li key={id} className="flex items-center gap-2.5">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon size={12} />
            </span>
            <span className="text-[12px] leading-snug text-ink-60">
              {t(`chat.settings.policy.ladder.${id}`)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[11.5px] leading-snug text-emerald-300/75">
        {t('chat.settings.policy.keeps')}
      </p>
    </div>
  );
});

export const PrivacyNote = memo(function PrivacyNote() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2.5 text-[12px] leading-snug text-ink-65">
        <Lock size={14} className="mt-px shrink-0 text-emerald-300/80" />
        {t('chat.settings.privacy.encrypted')}
      </p>
      <p className="flex items-start gap-2.5 text-[12px] leading-snug text-ink-65">
        <Flag size={14} className="mt-px shrink-0 text-ink-45" />
        {t('chat.settings.privacy.reports')}
      </p>
    </div>
  );
});
