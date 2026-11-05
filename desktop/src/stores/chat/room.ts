import { create } from 'zustand';
import type { ConvId } from '../../lib/chat/types';
import {
  NO_ROOM_CHAT,
  type RoomChatSnapshot,
  showsThread,
} from '../../lib/together/room-chat-state';

export interface RoomHandoff {
  hostId: string;
  name: string;
  mine: boolean;
  at: number;
}

export interface ChatRoomState extends RoomChatSnapshot {
  handoff: RoomHandoff | null;
  setRoom: (code: string | null, conversationId: ConvId | null) => void;
  apply: (update: (state: RoomChatSnapshot) => RoomChatSnapshot) => void;
  setHandoff: (handoff: RoomHandoff | null) => void;
  dismiss: () => void;
}

function snapshot(state: ChatRoomState): RoomChatSnapshot {
  const { code, conversationId, link, exit, purged } = state;
  return { code, conversationId, link, exit, purged };
}

export const useChatRoomStore = create<ChatRoomState>()((set, get) => ({
  ...NO_ROOM_CHAT,
  handoff: null,
  setRoom: (code, conversationId) =>
    set({
      ...NO_ROOM_CHAT,
      code,
      conversationId,
      link: conversationId ? 'open' : 'idle',
    }),
  apply: (update) => {
    const current = snapshot(get());
    const next = update(current);
    if (next !== current) set(next);
  },
  setHandoff: (handoff) => set({ handoff }),
  dismiss: () => set({ ...NO_ROOM_CHAT, handoff: null }),
}));

export const selectRoomThread = (state: ChatRoomState) =>
  showsThread(state) ? state.conversationId : null;
