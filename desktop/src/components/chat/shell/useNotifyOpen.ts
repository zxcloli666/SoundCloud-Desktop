import { useEffect } from 'react';
import { onChatEvent } from '../../../lib/chat/events';
import { useOpenChat } from './useOpenChat';

export function useNotifyOpen() {
  const openChat = useOpenChat();
  useEffect(() => {
    const listening = onChatEvent('chat:notify-open', ({ conversationId }) =>
      openChat(conversationId),
    );
    return () => {
      void listening.then((stop) => stop());
    };
  }, [openChat]);
}
