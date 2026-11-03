import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from '../../../lib/chat/icons';
import { useChatStore } from '../../../stores/chat';
import { useMinuteNow } from '../bubbles/useMinuteNow';
import { HistoryLockedBanner } from '../devices/HistoryLockedBanner';
import { useThread } from './context';

function LockLine() {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-ink/[0.05] bg-ink/[0.025] px-3.5 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-60">
        <Lock size={13} />
      </span>
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-60">
        {t('chat.thread.history.locked')}
      </span>
    </div>
  );
}

export const HistorySlot = memo(function HistorySlot() {
  const { conversation } = useThread();
  const locked = useChatStore((state) => state.status?.history.locked === true);
  const unlocksAt = useChatStore((state) => state.status?.history.unlocksAt ?? null);
  const now = useMinuteNow();
  if (locked && unlocksAt !== null && unlocksAt > now) {
    return (
      <div className="shrink-0 px-3 pt-2">
        <div className="mx-auto w-full max-w-[780px]">
          <HistoryLockedBanner />
        </div>
      </div>
    );
  }
  return locked || conversation.historyLocked ? <LockLine /> : null;
});
