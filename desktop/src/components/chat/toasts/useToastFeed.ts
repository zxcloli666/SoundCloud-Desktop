import { useEffect } from 'react';
import { onChatEvent } from '../../../lib/chat/events';
import type { MessagesEvent, NotifyPrefs } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { readNotifyPrefs } from '../settings/useChatSettings';
import { shouldToast } from './toast-rules';
import { useChatToastStore } from './toast-store';

function feed(event: MessagesEvent, bootAt: number, prefs: NotifyPrefs | undefined) {
  const now = Date.now();
  const context = {
    now,
    bootAt,
    focused: document.hasFocus(),
    openId: useChatThreadStore.getState().openId,
    myId: useChatStore.getState().status?.userId ?? null,
    prefs,
  };
  const conversation = useChatListStore.getState().byId[event.conversationId];
  const push = useChatToastStore.getState().push;
  for (const message of event.messages) {
    if (shouldToast(message, conversation, context)) push(message, now);
  }
}

export function useToastFeed() {
  useEffect(() => {
    const bootAt = Date.now();
    const listening = onChatEvent('chat:messages', (event) => {
      if (event.origin !== 'sync') return;
      void readNotifyPrefs()
        .catch(() => undefined)
        .then((prefs) => feed(event, bootAt, prefs));
    });
    return () => {
      void listening.then((stop) => stop());
    };
  }, []);
}
