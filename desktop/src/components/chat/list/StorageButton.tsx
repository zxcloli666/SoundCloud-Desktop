import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Images } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { QuotaRing } from '../storage/QuotaRing';
import { useStorageMeter } from '../storage/useStorageMeter';

const CALM = 'border-ink/[0.07] bg-ink/[0.05] text-ink-55 hover:bg-ink/[0.09] hover:text-ink-85';
const FULL = 'border-bad/30 bg-bad/10 text-bad hover:bg-bad/[0.16]';

function MeterButton({ big }: { big: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meter = useStorageMeter();
  if (!meter) return null;
  const label = t('chat.storage.entry.title');
  return (
    <button
      type="button"
      data-ui="chat-storage-button"
      data-full={meter.full || undefined}
      onClick={() => navigate('/chats/storage')}
      title={label}
      aria-label={label}
      className={`${big ? 'size-9' : 'size-8'} relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border outline-none transition-[transform,background-color,color] duration-200 hover:scale-[1.06] active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-accent/60 ${meter.full ? FULL : CALM}`}
    >
      <QuotaRing used={meter.used} quota={meter.quota} size={big ? 26 : 22} />
      <Images size={big ? 11 : 10} className="absolute" aria-hidden />
    </button>
  );
}

export const StorageButton = memo(function StorageButton({ big }: { big: boolean }) {
  const ready = useChatStore((state) => state.status?.phase === 'ready');
  return ready ? <MeterButton big={big} /> : null;
});
