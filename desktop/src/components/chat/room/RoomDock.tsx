import { memo, type ReactNode } from 'react';
import { hasModeration } from '../../../lib/together/room-rules';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { useChatRoomStore } from '../../../stores/chat/room';
import { UploadChip } from '../backdrop/UploadChip';
import { HandoffBanner } from './HandoffBanner';
import { ROOM_KEYFRAMES } from './keyframes';
import { MemberStrip } from './MemberStrip';
import { MutedBar } from './MutedBar';
import { RoomBackdrop } from './RoomBackdrop';
import { RoomBackdropDialogs } from './RoomBackdropDialogs';
import { RoomExitCard } from './RoomExitCard';
import { RoomHeader } from './RoomHeader';
import { RoomQuiet } from './RoomQuiet';
import { SuggestButton } from './SuggestButton';
import { useMutedUntil, useRoom, useRoomSelf } from './useRoom';

export interface RoomDockProps {
  children?: ReactNode;
  onBack?: () => void;
}

export const RoomDock = memo(function RoomDock({ children, onBack }: RoomDockProps) {
  const room = useRoom();
  const self = useRoomSelf(room);
  const chatOn = useChatStore(selectChatEnabled);
  const code = useChatRoomStore((state) => state.code);
  const conversationId = useChatRoomStore((state) => state.conversationId);
  const link = useChatRoomStore((state) => state.link);
  const exit = useChatRoomStore((state) => state.exit);
  const purged = useChatRoomStore((state) => state.purged);
  const muted = useMutedUntil(room, self.id);

  if (exit) {
    return (
      <div data-ui="chat-room" className="h-full min-h-0">
        <style>{ROOM_KEYFRAMES}</style>
        <RoomExitCard exit={exit} code={code} />
      </div>
    );
  }
  if (!room) return null;

  const moderation = chatOn && hasModeration(room);
  const thread = link === 'open' && !purged;
  const suggest = moderation && !self.host;

  return (
    <div data-ui="chat-room" className="relative flex h-full min-h-0 flex-col">
      <style>{ROOM_KEYFRAMES}</style>
      <RoomHeader room={room} self={self} moderation={moderation} onBack={onBack} />
      <div data-ui="chat-room-stage" className="relative isolate flex min-h-0 flex-1 flex-col">
        <RoomBackdrop room={room} />
        <MemberStrip
          room={room}
          selfId={self.id}
          moderation={moderation}
          trailing={suggest && <SuggestButton disabled={muted !== null} />}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <HandoffBanner />
          {self.host && <UploadChip conversationId={conversationId} />}
          <div className="min-h-0 flex-1">
            {thread ? children : <RoomQuiet link={link} purged={purged} />}
          </div>
        </div>
        {thread && muted !== null && <MutedBar until={muted} />}
      </div>
      <RoomBackdropDialogs room={room} host={self.host} />
    </div>
  );
});
