import { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { ChatGate } from '../components/chat/shell/ChatGate';
import { ChatsGlow } from '../components/chat/shell/ChatsGlow';
import { StorageSkeleton } from '../components/chat/storage/StorageStates';
import { StorageView } from '../components/chat/storage/StorageView';
import { useChatStore } from '../stores/chat';

export const ChatStorage = memo(function ChatStorage() {
  const loaded = useChatStore((state) => state.config !== null);
  const media = useChatStore((state) => state.config?.media != null);
  if (!loaded) return null;
  if (!media) return <Navigate to="/chats" replace />;
  return (
    <div data-ui="chat-storage" className="relative min-h-full w-full">
      <ChatsGlow />
      <div
        className="relative z-10 mx-auto w-full max-w-[1240px] px-4 pt-5 pb-8 md:px-6"
        style={{ isolation: 'isolate' }}
      >
        <ChatGate loading={<StorageSkeleton />}>
          <StorageView />
        </ChatGate>
      </div>
    </div>
  );
});
