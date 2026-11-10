import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Reply } from '../../../lib/chat/icons';
import type { ConvId } from '../../../lib/chat/types';
import { PictureInPicture2 } from '../../../lib/icons';
import { muteForHours } from '../list/mute';
import { patchMine } from '../list/row-actions';
import { useMoveToDock } from '../shell/useOpenChat';

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
  const moveToDock = useMoveToDock();
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
          moveToDock(conversationId);
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
