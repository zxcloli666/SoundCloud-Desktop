import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Reply } from '../../../lib/chat/icons';
import type { ConvId } from '../../../lib/chat/types';
import { PictureInPicture2 } from '../../../lib/icons';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { muteForHours } from '../list/mute';
import { patchMine } from '../list/row-actions';

const ACTION =
  'flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold text-ink-65 transition-colors hover:bg-ink/[0.08] hover:text-ink';

interface ToastActionsProps {
  conversationId: ConvId;
  onReply: () => void;
  onDone: () => void;
}

export const ToastActions = memo(function ToastActions({
  conversationId,
  onReply,
  onDone,
}: ToastActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="-ml-1 flex items-center gap-0.5">
      <button type="button" className={ACTION} onClick={onReply}>
        <Reply size={12} />
        {t('chat.notify.reply')}
      </button>
      <button
        type="button"
        className={ACTION}
        onClick={() => {
          useChatPrefsStore.getState().openInDock(conversationId);
          onDone();
        }}
      >
        <PictureInPicture2 size={12} />
        {t('chat.notify.openDock')}
      </button>
      <button
        type="button"
        className={ACTION}
        onClick={() => {
          void patchMine(conversationId, { mute: muteForHours(1, Date.now()) });
          onDone();
        }}
      >
        <BellOff size={12} />
        {t('chat.notify.mute1h')}
      </button>
    </div>
  );
});
