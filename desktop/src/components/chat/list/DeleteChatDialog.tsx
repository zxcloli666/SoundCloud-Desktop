import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch, useNavigate } from 'react-router-dom';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConversationSummary, DeleteScope } from '../../../lib/chat/types';
import { Trash2 } from '../../../lib/icons';
import { notifyError } from '../../../lib/notify';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { listErrorKey } from '../shell/errors';
import { conversationTitle } from './conversation-meta';
import { useDeleteChatStore } from './delete-chat-store';

function canDeleteForEveryone(conversation: ConversationSummary): boolean {
  if (conversation.kind === 'direct') return true;
  return conversation.kind === 'group' && conversation.role === 'owner';
}

const BUTTON =
  'h-10 w-full rounded-xl text-[13px] font-semibold transition-colors duration-200 cursor-pointer disabled:cursor-default disabled:opacity-50';

export const DeleteChatDialog = memo(function DeleteChatDialog() {
  const { t } = useTranslation();
  const open = useDeleteChatStore((state) => state.open);
  const target = useDeleteChatStore((state) => state.target);
  const close = useDeleteChatStore((state) => state.close);
  const navigate = useNavigate();
  const openMatch = useMatch('/chats/:id');
  const [busy, setBusy] = useState(false);

  const remove = async (scope: DeleteScope) => {
    if (!target) return;
    setBusy(true);
    try {
      await chatBridge.conversationDelete(target.id, scope);
      useChatListStore.getState().remove(target.id);
      useChatPrefsStore.getState().closeTab(target.id);
      if (openMatch?.params.id === target.id) navigate('/chats');
      close();
    } catch (error) {
      notifyError(t(listErrorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => !next && close()}>
      <ModalContent size="sm" showClose={false}>
        {target && (
          <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
              <Trash2 size={20} />
            </div>
            <ModalTitle>
              {t('chat.list.delete.title', { name: conversationTitle(target, t) })}
            </ModalTitle>
            <div className="flex w-full flex-col gap-2">
              {canDeleteForEveryone(target) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove('everyone')}
                  className={`${BUTTON} bg-rose-500/85 text-white hover:bg-rose-500`}
                >
                  {t('chat.list.delete.forEveryone')}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove('me')}
                className={`${BUTTON} border border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20`}
              >
                {t('chat.list.delete.forMe')}
              </button>
              <button
                type="button"
                onClick={close}
                className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1]`}
              >
                {t('chat.list.cancel')}
              </button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
});
