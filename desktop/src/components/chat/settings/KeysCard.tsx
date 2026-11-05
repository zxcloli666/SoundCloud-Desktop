import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyStorageText } from '../../../lib/chat/gate';
import { FileText, KeyRound, RotateCcw, Shield } from '../../../lib/icons';
import { desktopOs } from '../../../lib/platform';
import { useChatStore } from '../../../stores/chat';
import { Card } from '../../settings/primitives';
import { ResetKeysDialog } from '../relogin/ResetKeysDialog';

export const KeysCard = memo(function KeysCard() {
  const { t } = useTranslation();
  const storage = useChatStore((state) => state.status?.keyStorage ?? 'os');
  const [open, setOpen] = useState(false);
  const Where = storage === 'file' ? FileText : Shield;

  return (
    <Card title={t('chat.settings.keys.title')} icon={<KeyRound size={17} />}>
      <div className="flex flex-col gap-4">
        <div
          data-ui="chat-keys-storage"
          data-storage={storage}
          className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-ink/[0.03] px-3.5 py-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink/[0.05] text-ink-60">
            <Where size={15} />
          </span>
          <span className="text-[13px] font-semibold text-ink-80">
            {t(keyStorageText(storage, desktopOs()))}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-45">
            {t('chat.settings.keys.resetHint')}
          </span>
          <button
            type="button"
            data-ui="chat-keys-reset-open"
            onClick={() => setOpen(true)}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] font-semibold text-bad outline-none transition-colors hover:bg-bad/[0.16] focus-visible:ring-2 focus-visible:ring-bad/50"
          >
            <RotateCcw size={13} />
            {t('chat.settings.keys.reset')}
          </button>
        </div>
      </div>
      <ResetKeysDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
});
