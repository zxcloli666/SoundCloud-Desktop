import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConvId } from '../../../lib/chat/types';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { ChatThread } from '../thread/ChatThread';
import { DockThreadActions, PageThreadActions } from './ThreadActions';

interface ThreadSlotProps {
  conversationId: ConvId;
  variant: 'page' | 'dock';
  onBack?: () => void;
}

export const ThreadSlot = memo(function ThreadSlot({
  conversationId,
  variant,
  onBack,
}: ThreadSlotProps) {
  const navigate = useNavigate();
  const page = variant === 'page';

  const leave = () => {
    useChatPrefsStore.getState().closeTab(conversationId);
    if (page) navigate('/chats');
  };

  return (
    <ChatThread
      conversationId={conversationId}
      onBack={onBack}
      onLeave={leave}
      actions={
        page ? (
          <PageThreadActions conversationId={conversationId} />
        ) : (
          <DockThreadActions conversationId={conversationId} />
        )
      }
    />
  );
});
