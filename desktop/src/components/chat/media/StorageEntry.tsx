import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Images } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { useChatMediaStore } from '../../../stores/chat/media';
import { Card } from '../../settings/primitives';
import { useFormatSize } from '../storage/bytes';
import { QuotaRing } from '../storage/QuotaRing';
import { quotaFull } from '../storage/ring-tone';

export const StorageEntry = memo(function StorageEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormatSize();
  const media = useChatStore((state) => state.config?.media ?? null);
  const usage = useChatMediaStore((state) => state.usage);

  useEffect(() => {
    if (media) void useChatMediaStore.getState().refreshUsage();
  }, [media]);

  if (!media) return null;
  const used = usage ? usage.bytes + usage.reserved : media.used;
  const quota = usage?.quota ?? media.quota;
  const full = quotaFull(used, quota);

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
            {usage ? t('chat.storage.files', { count: usage.files }) : t('chat.storage.entry.line')}
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
