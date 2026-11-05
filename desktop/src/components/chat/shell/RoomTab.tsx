import { memo } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { RoomDock } from '../room/RoomDock';
import { ChatThread } from '../thread/ChatThread';

export const RoomTab = memo(function RoomTab({
  conversationId,
  onBack,
}: {
  conversationId: ConvId | null;
  onBack?: () => void;
}) {
  return (
    <RoomDock onBack={onBack}>
      {conversationId && <ChatThread key={conversationId} conversationId={conversationId} bare />}
    </RoomDock>
  );
});
