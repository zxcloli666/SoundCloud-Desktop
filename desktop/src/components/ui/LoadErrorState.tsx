import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isRefreshPending } from '../../lib/api';
import { ChevronLeft, Loader2, RotateCcw } from '../../lib/icons';

const BUTTON =
  'inline-flex items-center gap-1.5 h-9 rounded-full text-[12px] text-white/70 hover:text-white bg-white/[0.05] border border-white/10 transition-colors cursor-pointer disabled:opacity-50';

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
    <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
      <p className="text-white/40 text-sm">
        {isRefreshPending(error) ? t('common.stillLoading') : t('common.pageLoadFailed')}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className={`${BUTTON} pl-2.5 pr-4`}>
          <ChevronLeft size={14} />
          {t('search.back')}
        </button>
        <button type="button" onClick={onRetry} disabled={retrying} className={`${BUTTON} px-4`}>
          {retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
});
