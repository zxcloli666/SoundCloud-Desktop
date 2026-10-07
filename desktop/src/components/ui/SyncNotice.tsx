import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw } from '../../lib/icons';

export type SyncNoticeKind = 'failed' | 'syncing' | 'stalled';

const DEFAULT_TEXT = {
  failed: 'common.loadFailed',
  syncing: 'common.syncing',
  stalled: 'common.syncSlow',
} as const;

export interface SyncedQuery {
  isError: boolean;
  syncState?: 'complete' | SyncNoticeKind;
}

export function syncNoticeOf(query: SyncedQuery): SyncNoticeKind | null {
  if (query.isError) return 'failed';
  if (!query.syncState || query.syncState === 'complete') return null;
  return query.syncState;
}

export const SyncNotice = React.memo(function SyncNotice({
  kind,
  text,
  onRetry,
}: {
  kind: SyncNoticeKind;
  text?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const message = text ?? t(DEFAULT_TEXT[kind]);

  if (kind === 'syncing') {
    return (
      <div className="flex items-center justify-center gap-2 text-[13px] text-white/30">
        <Loader2 size={14} className="animate-spin" />
        {message}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-[13px] text-white/30">
      {message}
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
