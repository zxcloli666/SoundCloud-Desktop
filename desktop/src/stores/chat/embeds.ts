import { create } from 'zustand';
import type { Embed, RoomPreview } from '../../lib/chat/types';

export interface ChatEmbedsState {
  roomPreviews: Record<string, RoomPreview>;
  closedRooms: Record<string, true>;
  shareEmbed: Embed | null;
  shareOpen: boolean;
  setRoomPreview: (code: string, preview: RoomPreview) => void;
  closeRoom: (code: string) => void;
  openShare: (embed: Embed) => void;
  closeShare: () => void;
}

export const useChatEmbedsStore = create<ChatEmbedsState>()((set) => ({
  roomPreviews: {},
  closedRooms: {},
  shareEmbed: null,
  shareOpen: false,
  setRoomPreview: (code, preview) =>
    set((state) => ({
      roomPreviews: { ...state.roomPreviews, [code]: preview },
      closedRooms: preview.alive ? state.closedRooms : { ...state.closedRooms, [code]: true },
    })),
  closeRoom: (code) =>
    set((state) =>
      state.closedRooms[code] ? state : { closedRooms: { ...state.closedRooms, [code]: true } },
    ),
  openShare: (shareEmbed) => set({ shareEmbed, shareOpen: true }),
  closeShare: () => set({ shareOpen: false }),
}));
