import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isRefreshPending } from '../../lib/api';
import { AlertCircle, ChevronLeft, Loader2, RotateCcw } from '../../lib/icons';

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.055] px-4 text-[12px] font-semibold text-ink-75 transition-colors hover:border-ink/[0.18] hover:bg-ink/[0.09] hover:text-ink disabled:opacity-50';

export const LoadErrorState = React.memo(function LoadErrorState({
  error,
  retrying,
  onRetry,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      data-ui="error-state"
      className="relative z-10 mx-auto flex w-full max-w-[390px] flex-col items-center gap-5 rounded-[24px] border border-ink/10 bg-surface/80 px-7 py-8 text-center shadow-[0_24px_70px_rgb(var(--shade)/0.18)]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/10 bg-ink/[0.05] text-ink-55">
        <AlertCircle size={21} />
      </div>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-ink-90">{t('common.pageLoadFailed')}</p>
        <p className="text-[13px] leading-relaxed text-ink-45">
          {isRefreshPending(error) ? t('common.stillLoading') : t('common.loadingFromSoundcloud')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className={BUTTON}>
          <ChevronLeft size={14} />
          {t('search.back')}
        </button>
        <button type="button" onClick={onRetry} disabled={retrying} className={BUTTON}>
          {retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
});

export function RefreshPendingHint({ reason }: { reason: unknown }) {
  const { t } = useTranslation();
  if (!isRefreshPending(reason)) return null;
  return (
    <p className="relative z-10 mt-6 text-center text-[13px] text-ink-35">
      {t('common.loadingFromSoundcloud')}
    </p>
  );
}
