import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw } from '../../lib/icons';

export type LikesNoticeKind = 'failed' | 'syncing' | 'stalled';

export const LikesNotice = React.memo(function LikesNotice({
  kind,
  onRetry,
}: {
  kind: LikesNoticeKind;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (kind === 'syncing') {
    return (
      <div className="flex items-center justify-center gap-2 text-[13px] text-white/30">
        <Loader2 size={14} className="animate-spin" />
        {t('library.likesSyncing')}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-[13px] text-white/30">
      {kind === 'failed' ? t('library.likesLoadFailed') : t('library.likesSyncSlow')}
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-white/75 transition-colors hover:border-white/[0.16] hover:bg-white/[0.09] hover:text-white/95"
      >
        <RotateCcw size={12} />
        {t('common.retry')}
      </button>
    </div>
  );
});
