import { useMemo } from 'react';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { canModerate, isHost } from '../../../../lib/together/room-rules';
import type { RoomView } from '../../../../lib/together/types';
import { useChatStore } from '../../../../stores/chat';
import { useChatRoomStore } from '../../../../stores/chat/room';
import { useTogetherStore } from '../../../../stores/together';

export type AttachGate =
  | 'hidden'
  | 'open'
  | 'locked'
  | 'paused'
  | 'room-host'
  | 'room-mods'
  | 'room-off';

export interface AttachAccess {
  gate: AttachGate;
  max: number;
  roomHost: boolean;
}

const ALBUM_MAX = 10;
const ROOM_ALBUM_MAX = 4;

function roomGate(room: RoomView | null, self: string | null): AttachGate {
  if (!room) return 'room-off';
  if (room.perks?.starHost !== true) return 'room-host';
  const policy = room.roomImages ?? 'mods';
  if (policy === 'off') return 'room-off';
  if (policy === 'mods' && !canModerate(room, self)) return 'room-mods';
  return 'open';
}

function useRoomGate(conversation: ConversationSummary): { gate: AttachGate; host: boolean } {
  const isRoom = conversation.kind === 'room';
  const ours = useChatRoomStore((state) => isRoom && state.conversationId === conversation.id);
  const gate = useTogetherStore((state) =>
    isRoom ? roomGate(ours ? state.room : null, state.selfId) : 'open',
  );
  const host = useTogetherStore(
    (state) => ours && state.room !== null && isHost(state.room, state.selfId),
  );
  return { gate, host };
}

export function useAttachAccess(conversation: ConversationSummary, usable = true): AttachAccess {
  const media = useChatStore((state) => state.config?.media ?? null);
  const room = useRoomGate(conversation);
  const isRoom = conversation.kind === 'room';
  const limit = isRoom ? media?.limits.roomAlbumMax : media?.limits.albumMax;
  const cap = isRoom ? ROOM_ALBUM_MAX : ALBUM_MAX;
  const max = Math.min(limit || cap, cap);
  let gate: AttachGate = room.gate;
  if (!media || !usable) gate = 'hidden';
  else if (!media.star) gate = 'locked';
  else if (!media.uploads) gate = 'paused';
  return useMemo(() => ({ gate, max, roomHost: room.host }), [gate, max, room.host]);
}
