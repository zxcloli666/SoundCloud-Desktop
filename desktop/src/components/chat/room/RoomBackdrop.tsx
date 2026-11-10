import { memo } from 'react';
import type { RoomView } from '../../../lib/together/types';
import { BackdropLayer } from '../backdrop/BackdropLayer';
import { useRoomConversation } from './useRoomTarget';

export const RoomBackdrop = memo(function RoomBackdrop({ room }: { room: RoomView }) {
  const conversationId = useRoomConversation(room);
  return <BackdropLayer conversationId={conversationId} backdrop={room.backdrop ?? null} />;
});
