import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { passDate } from '../../../lib/star-format';
import type { StarConfirm } from '../../../lib/star-status';
import { tileOf } from '../methods';
import { PillBtn } from './StarConsole';

export const ConfirmRenewalRow = memo(function ConfirmRenewalRow({
  status,
  pending,
  onConfirm,
}: {
  status: StarConfirm;
  pending: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="star-confirm-renewal"
      className="flex items-center justify-between gap-3 rounded-[14px] border border-amber-400/40 bg-amber-400/[0.06] px-4 py-3"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-85">{t('starpass.confirm.renewal')}</div>
        <div className="mt-0.5 text-[11.5px] tabular-nums text-ink-50">
          {t(`starpass.method.${tileOf(status.method).i18n}.title`)} · {status.charge} ·{' '}
          {passDate(status.at)}
        </div>
      </div>
      <PillBtn tone="accent" disabled={pending} onClick={onConfirm}>
        {t('starpass.confirm.cta')}
      </PillBtn>
    </div>
  );
});
