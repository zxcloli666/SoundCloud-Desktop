import { memo, useState } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import { UserPlus } from '../../../lib/chat/icons';
import { Loader2 } from '../../../lib/icons';
import { useChatListStore } from '../../../stores/chat/list';
import { useOpenChat } from '../shell/useOpenChat';
import { useThread } from '../thread/context';
import { toastError } from '../thread/errors';

export const InviteLink = memo(function InviteLink({ token }: { token: string }) {
  const { t, language } = useThread();
  const openChat = useOpenChat();
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      const summary = await chatBridge.inviteJoin(token);
      useChatListStore.getState().upsert(summary);
      openChat(summary.id);
    } catch (error) {
      toastError(error, t, language);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void join();
      }}
      className="mx-0.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 align-middle text-[12.5px] font-semibold transition-transform duration-150 hover:scale-[1.03] disabled:cursor-default disabled:opacity-60"
      style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
      {t('chat.thread.invite.join')}
    </button>
  );
});
