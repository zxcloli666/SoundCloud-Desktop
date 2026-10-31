import { useQueryClient } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from '../../../lib/icons';
import { superlikesOrder } from '../../../lib/superlikes-order';
import { useAppMode } from '../../../stores/app-status';
import { ResetOrderDialog } from '../ResetOrderDialog';

export const SuperlikesOrderReset = memo(function SuperlikesOrderReset() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const online = useAppMode() === 'online';
  const [confirming, setConfirming] = useState(false);
  if (!online) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-ink/[0.07] bg-ink/[0.03] px-3 text-[11.5px] font-semibold text-ink-50 transition-all duration-200 ease-[var(--ease-apple)] hover:border-ink/[0.14] hover:text-ink-85"
      >
        <RotateCcw size={12} />
        <span>{t('trackSort.resetOrder')}</span>
      </button>
      <ResetOrderDialog
        open={confirming}
        onOpenChange={setConfirming}
        text="superlikes.resetText"
        onReset={() => superlikesOrder.reset(qc)}
      />
    </>
  );
});
