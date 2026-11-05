import { memo } from 'react';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { useNotifyPrefs } from '../settings/useChatSettings';
import { useDockMode } from '../shell/useDockMode';
import { useOpenChat } from '../shell/useOpenChat';
import { ChatToast } from './ChatToast';
import { useChatToastStore } from './toast-store';
import { useToastFeed } from './useToastFeed';

const EDGE = 16;
const ABOVE_PLAYER = 150;

export const ChatToastHost = memo(function ChatToastHost() {
  const items = useChatToastStore((state) => state.items);
  const { prefs } = useNotifyPrefs();
  const openChat = useOpenChat();
  const mode = useDockMode();
  const dockWidth = useChatPrefsStore((state) => state.dockWidth);
  useToastFeed();

  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed z-[60] flex flex-col items-end gap-2"
      style={{ right: EDGE + (mode === 'hidden' ? 0 : dockWidth), bottom: ABOVE_PLAYER }}
    >
      {items.map((item) => (
        <ChatToast key={item.conversationId} item={item} prefs={prefs} onOpen={openChat} />
      ))}
    </div>
  );
});
