import { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useChatStore } from '../stores/chat';
import { selectMediaOn } from '../stores/chat/media';

export const ChatStorage = memo(function ChatStorage() {
  const loaded = useChatStore((state) => state.config !== null);
  const on = useChatStore(selectMediaOn);
  if (!loaded) return null;
  if (!on) return <Navigate to="/chats" replace />;
  return <div data-ui="chat-storage" className="relative h-full w-full" />;
});
