import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConvId } from '../../../lib/chat/types';
import { DOCK_ROOM, useChatPrefsStore } from '../../../stores/chat/prefs';
import { lastOutsidePath, useOnChatsPage } from './useDockMode';

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

export function useOpenRoomChat(): () => void {
  const navigate = useNavigate();
  const onPage = useOnChatsPage();
  return useCallback(() => {
    if (onPage) navigate(chatPath(DOCK_ROOM));
    else useChatPrefsStore.getState().show(DOCK_ROOM);
  }, [navigate, onPage]);
}

export function useMoveToDock(): (conversationId: ConvId) => void {
  const navigate = useNavigate();
  const onPage = useOnChatsPage();
  return useCallback(
    (conversationId: ConvId) => {
      useChatPrefsStore.getState().openInDock(conversationId);
      if (onPage) navigate(lastOutsidePath());
    },
    [navigate, onPage],
  );
}
