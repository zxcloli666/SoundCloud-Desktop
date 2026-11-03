import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeleteScope, Message } from '../../../lib/chat/types';
import { Trash2, User, Users } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { ModalTitle } from '../../ui/Modal';
import { useThread } from './context';
import { toastError } from './errors';
import { canDeleteForEveryone } from './permissions';

const BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-colors duration-200 disabled:cursor-default disabled:opacity-50';

export const DeleteDialog = memo(function DeleteDialog({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { conversation, moderator } = useThread();
  const [busy, setBusy] = useState(false);
  const everyone = canDeleteForEveryone(message, conversation, moderator);

  const remove = async (scope: DeleteScope) => {
    setBusy(true);
    try {
      await useChatThreadStore.getState().remove(message, scope);
      onClose();
    } catch (error) {
      toastError(error, t, i18n.language);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
        <Trash2 size={20} />
      </div>
      <ModalTitle>{t('chat.thread.delete.title')}</ModalTitle>
      <div className="flex w-full flex-col gap-2">
        {everyone && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove('everyone')}
            className={`${BUTTON} bg-rose-500/85 text-white hover:bg-rose-500`}
          >
            <Users size={15} />
            {t('chat.thread.delete.everyone')}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove('me')}
          className={`${BUTTON} border border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20`}
        >
          <User size={15} />
          {t('chat.thread.delete.me')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1]`}
        >
          {t('chat.thread.cancel')}
        </button>
      </div>
    </div>
  );
});
