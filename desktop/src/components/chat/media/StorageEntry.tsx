import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Images } from '../../../lib/icons';
import { Card } from '../../settings/primitives';
import { useFormatSize } from '../storage/bytes';
import { QuotaRing } from '../storage/QuotaRing';
import { useStorageMeter } from '../storage/useStorageMeter';

export const StorageEntry = memo(function StorageEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormatSize();
  const meter = useStorageMeter();

  if (!meter) return null;
  const { used, quota, full, files } = meter;

  return (
    <Card title={t('chat.storage.entry.title')} icon={<Images size={17} />}>
      <button
        type="button"
        data-ui="chat-storage-entry"
        onClick={() => navigate('/chats/storage')}
        className="group -m-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-4 rounded-2xl p-2 text-left outline-none transition-colors hover:bg-ink/[0.04] focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <QuotaRing used={used} quota={quota} size={52} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={`text-[14px] font-semibold tabular-nums ${full ? 'text-bad' : 'text-ink-85'}`}
          >
            {t('chat.storage.entry.used', { used: format(used), quota: format(quota) })}
          </span>
          <span className="truncate text-[12px] text-ink-45">
            {files === null
              ? t('chat.storage.entry.line')
              : t('chat.storage.files', { count: files })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ink-55 transition-colors group-hover:text-ink-85">
          {t('chat.storage.entry.open')}
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </Card>
  );
});
