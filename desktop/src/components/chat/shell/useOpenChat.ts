import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConvId } from '../../../lib/chat/types';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { useOnChatsPage } from './useDockMode';

export function chatPath(conversationId: ConvId): string {
  return `/chats/${encodeURIComponent(conversationId)}`;
}

export function useOpenChat(): (conversationId: ConvId) => void {
  const navigate = useNavigate();
  const onPage = useOnChatsPage();
  return useCallback(
    (conversationId: ConvId) => {
      if (onPage) navigate(chatPath(conversationId));
      else useChatPrefsStore.getState().openInDock(conversationId);
    },
    [navigate, onPage],
  );
}
