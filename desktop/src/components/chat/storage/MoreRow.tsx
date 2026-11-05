import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from '../../../lib/icons';
import type { Load } from './storage-store';

export const MoreRow = memo(function MoreRow({
  load,
  onRetry,
}: {
  load: Load;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (load === 'loading') {
    return (
      <div className="flex justify-center py-5 text-ink-40">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }
  if (load !== 'failed') return null;
  return (
    <div className="flex items-center justify-center gap-3 py-5 text-[12.5px] text-ink-55">
      {t('chat.storage.errors.more')}
      <button
        type="button"
        onClick={onRetry}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.06] px-3 py-1.5 font-semibold text-ink-75 outline-none hover:bg-ink/[0.1] focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <RefreshCw size={12} />
        {t('chat.storage.retry')}
      </button>
    </div>
  );
});
